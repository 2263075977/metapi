import {
  config,
  normalizeTokenRouterFailureCooldownMaxSec,
  TOKEN_ROUTER_FAILURE_COOLDOWN_MAX_SEC_CEILING,
} from '../config.js';
import { type DownstreamRoutingPolicy } from './downstreamPolicyTypes.js';
import { getCachedModelRoutingReferenceCost } from './modelPricingService.js';
import { proxyChannelCoordinator, type ProxyChannelLoadSnapshot } from './proxyChannelCoordinator.js';
import {
  normalizeModelAlias,
  normalizeRouteDisplayName,
  type TokenRouterRouteChannelCandidate,
} from './tokenRouterRouteMatching.js';
import {
  getSiteRuntimeHealthDetails,
  resolveStableFirstSuccessRate,
} from './tokenRouterRuntimeHealth.js';

type RouteChannelCandidate = TokenRouterRouteChannelCandidate;

type FailureAwareChannel = {
  failCount?: number | null;
  lastFailAt?: string | null;
};

const FAILURE_BACKOFF_BASE_SEC = 15;
// Keep weighted-route backoff within the JavaScript Date range when fail counts grow large.
const MAX_FAILURE_BACKOFF_SEC = 30 * 24 * 60 * 60;
const MIN_EFFECTIVE_UNIT_COST = 1e-6;
const ROUND_ROBIN_COOLDOWN_LEVELS_SEC = [0, 10 * 60, 60 * 60, 24 * 60 * 60] as const;
export const ROUND_ROBIN_COOLDOWN_LEVEL_COUNT = ROUND_ROBIN_COOLDOWN_LEVELS_SEC.length;
const STABLE_FIRST_SITE_SCORE_RATIO = 0.92;
const SITE_HISTORICAL_HEALTH_MIN_MULTIPLIER = 0.45;
const SITE_HISTORICAL_HEALTH_MAX_SAMPLE = 24;
const SITE_HISTORICAL_LATENCY_BASELINE_MS = 2_000;
const SITE_HISTORICAL_LATENCY_WINDOW_MS = 20_000;
const SITE_HISTORICAL_MAX_LATENCY_PENALTY = 0.18;

export type WeightedSelectionMode = 'weighted' | 'stable_first';
export type WeightedSelectionResult = {
  selected: RouteChannelCandidate | null;
  details: Array<{ candidate: RouteChannelCandidate; probability: number; reason: string }>;
  stableSiteCount: number;
};

type StableFirstSitePoolState = {
  siteId: number;
  leader: RouteChannelCandidate;
  effectiveSuccessRate: number;
  trusted: boolean;
  observationReason: string | null;
};

export type StableFirstPoolPlan = {
  primaryCandidates: RouteChannelCandidate[];
  observationCandidates: RouteChannelCandidate[];
  primarySiteIds: Set<number>;
  observationSiteIds: Set<number>;
  siteStateById: Map<number, StableFirstSitePoolState>;
};

type StableFirstObservationProgressState = {
  requestCount: number;
  lastObservationAtMs: number | null;
};

const stableFirstLastSelectedSiteByKey = new Map<string, number>();
const MAX_STABLE_FIRST_ROTATION_KEYS = 1024;
const stableFirstObservationProgressByKey = new Map<string, StableFirstObservationProgressState>();
const stableFirstObservationSiteCooldownByKey = new Map<string, number>();
const MAX_STABLE_FIRST_OBSERVATION_PROGRESS_KEYS = 1024;
const MAX_STABLE_FIRST_OBSERVATION_SITE_COOLDOWN_KEYS = 4096;

const STABLE_FIRST_PRIMARY_SUCCESS_RATE_RATIO = 0.92;
const STABLE_FIRST_TRUSTED_RECENT_CONFIDENCE = 0.5;
const STABLE_FIRST_TRUSTED_HISTORICAL_CALLS = 8;
const STABLE_FIRST_OBSERVATION_REQUEST_INTERVAL = 24;
const STABLE_FIRST_OBSERVATION_SITE_COOLDOWN_MS = 30 * 60 * 1000;

export function rememberStableFirstSiteSelectionForKey(rotationKey: string, siteId: number): void {
  if (!rotationKey || !Number.isFinite(siteId) || siteId <= 0) return;
  if (stableFirstLastSelectedSiteByKey.has(rotationKey)) {
    stableFirstLastSelectedSiteByKey.delete(rotationKey);
  }
  stableFirstLastSelectedSiteByKey.set(rotationKey, siteId);
  while (stableFirstLastSelectedSiteByKey.size > MAX_STABLE_FIRST_ROTATION_KEYS) {
    const oldestKey = stableFirstLastSelectedSiteByKey.keys().next().value;
    if (!oldestKey) break;
    stableFirstLastSelectedSiteByKey.delete(oldestKey);
  }
}

function rememberStableFirstObservationProgressForKey(
  rotationKey: string,
  state: StableFirstObservationProgressState,
): void {
  if (!rotationKey) return;
  if (stableFirstObservationProgressByKey.has(rotationKey)) {
    stableFirstObservationProgressByKey.delete(rotationKey);
  }
  stableFirstObservationProgressByKey.set(rotationKey, state);
  while (stableFirstObservationProgressByKey.size > MAX_STABLE_FIRST_OBSERVATION_PROGRESS_KEYS) {
    const oldestKey = stableFirstObservationProgressByKey.keys().next().value;
    if (!oldestKey) break;
    stableFirstObservationProgressByKey.delete(oldestKey);
  }
}

function rememberStableFirstObservationSiteCooldown(
  rotationKey: string,
  siteId: number,
  observedAtMs: number,
): void {
  if (!rotationKey || !Number.isFinite(siteId) || siteId <= 0) return;
  const scopedKey = `${rotationKey}:${siteId}`;
  if (stableFirstObservationSiteCooldownByKey.has(scopedKey)) {
    stableFirstObservationSiteCooldownByKey.delete(scopedKey);
  }
  stableFirstObservationSiteCooldownByKey.set(scopedKey, observedAtMs);
  while (stableFirstObservationSiteCooldownByKey.size > MAX_STABLE_FIRST_OBSERVATION_SITE_COOLDOWN_KEYS) {
    const oldestKey = stableFirstObservationSiteCooldownByKey.keys().next().value;
    if (!oldestKey) break;
    stableFirstObservationSiteCooldownByKey.delete(oldestKey);
  }
}

function fibonacciNumber(index: number): number {
  if (index <= 2) return 1;
  let prev = 1;
  let current = 1;
  for (let i = 3; i <= index; i += 1) {
    const next = prev + current;
    prev = current;
    current = next;
  }
  return current;
}

export function resolveFailureBackoffSec(failCount?: number | null): number {
  const normalizedFailCount = Math.max(1, Math.trunc(failCount ?? 0));
  return Math.min(FAILURE_BACKOFF_BASE_SEC * fibonacciNumber(normalizedFailCount), MAX_FAILURE_BACKOFF_SEC);
}

function resolveConfiguredFailureCooldownMaxMs(): number {
  const normalized = normalizeTokenRouterFailureCooldownMaxSec(config.tokenRouterFailureCooldownMaxSec)
    ?? TOKEN_ROUTER_FAILURE_COOLDOWN_MAX_SEC_CEILING;
  return Math.max(1_000, normalized * 1000);
}

export function clampFailureCooldownMs(cooldownMs: number): number {
  const normalized = Math.max(0, Math.trunc(cooldownMs));
  return Math.min(normalized, resolveConfiguredFailureCooldownMaxMs());
}

export function resolveEffectiveFailureCooldownMs(failCount?: number | null): number {
  return clampFailureCooldownMs(resolveFailureBackoffSec(failCount) * 1000);
}

export function resolveRoundRobinCooldownSec(level: number): number {
  const normalizedLevel = Math.max(0, Math.min(ROUND_ROBIN_COOLDOWN_LEVELS_SEC.length - 1, Math.trunc(level)));
  return ROUND_ROBIN_COOLDOWN_LEVELS_SEC[normalizedLevel] ?? 0;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isContributionCloseToBest(value: number, bestValue: number, ratio = STABLE_FIRST_SITE_SCORE_RATIO): boolean {
  if (bestValue <= 0) return true;
  return value >= (bestValue * ratio);
}

export function clearTokenRouterSelectionCachesForRoute(routeId: number): void {
  const routePrefix = `${routeId}:`;
  for (const key of stableFirstLastSelectedSiteByKey.keys()) {
    if (key.startsWith(routePrefix)) {
      stableFirstLastSelectedSiteByKey.delete(key);
    }
  }
  for (const key of stableFirstObservationProgressByKey.keys()) {
    if (key.startsWith(routePrefix)) {
      stableFirstObservationProgressByKey.delete(key);
    }
  }
  for (const key of stableFirstObservationSiteCooldownByKey.keys()) {
    if (key.startsWith(routePrefix)) {
      stableFirstObservationSiteCooldownByKey.delete(key);
    }
  }
}

export function resetTokenRouterSelectionObservationState(): void {
  stableFirstObservationProgressByKey.clear();
  stableFirstObservationSiteCooldownByKey.clear();
}

export function clearTokenRouterSelectionCaches(): void {
  stableFirstLastSelectedSiteByKey.clear();
  stableFirstObservationProgressByKey.clear();
  stableFirstObservationSiteCooldownByKey.clear();
}

export function getStableFirstRotationCacheSize(): number {
  return stableFirstLastSelectedSiteByKey.size;
}

export function isChannelRecentlyFailed(
  channel: FailureAwareChannel,
  nowMs = Date.now(),
  avoidSec = resolveFailureBackoffSec(channel.failCount),
): boolean {
  const avoidMs = clampFailureCooldownMs(avoidSec * 1000);
  if (avoidMs <= 0) return false;
  if ((channel.failCount ?? 0) <= 0) return false;
  if (!channel.lastFailAt) return false;

  const failTs = Date.parse(channel.lastFailAt);
  if (Number.isNaN(failTs)) return false;

  return nowMs - failTs < avoidMs;
}

export function filterRecentlyFailedCandidates<T extends { channel: FailureAwareChannel }>(
  candidates: T[],
  nowMs = Date.now(),
  avoidSec?: number,
): T[] {
  if (candidates.length <= 1) return candidates;
  if (avoidSec != null && avoidSec <= 0) return candidates;

  const healthy = candidates.filter((candidate) => !isChannelRecentlyFailed(candidate.channel, nowMs, avoidSec));
  // If all channels failed recently, keep them all and let weight/random decide.
  return healthy.length > 0 ? healthy : candidates;
}

function parseIsoTimeMs(value?: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function compareNullableTimeAsc(left?: string | null, right?: string | null): number {
  const leftMs = parseIsoTimeMs(left);
  const rightMs = parseIsoTimeMs(right);
  if (leftMs == null && rightMs == null) return 0;
  if (leftMs == null) return -1;
  if (rightMs == null) return 1;
  return leftMs - rightMs;
}

export function compareNullableTimeDesc(left?: string | null, right?: string | null): number {
  return compareNullableTimeAsc(right, left);
}

function compareStableFirstCandidateOrder(left: RouteChannelCandidate, right: RouteChannelCandidate): number {
  const selectionOrder = compareNullableTimeAsc(
    left.channel.lastSelectedAt || left.channel.lastUsedAt,
    right.channel.lastSelectedAt || right.channel.lastUsedAt,
  );
  if (selectionOrder !== 0) return selectionOrder;

  const usedOrder = compareNullableTimeAsc(left.channel.lastUsedAt, right.channel.lastUsedAt);
  if (usedOrder !== 0) return usedOrder;

  return (left.channel.id ?? 0) - (right.channel.id ?? 0);
}

function resolveChannelRuntimeLoadMultiplier(snapshot: ProxyChannelLoadSnapshot): number {
  if (!snapshot.sessionScoped || snapshot.concurrencyLimit <= 0) return 1;

  const activeRatio = clampNumber(snapshot.activeLeaseCount / Math.max(1, snapshot.concurrencyLimit), 0, 1.5);
  const waitingRatio = clampNumber(snapshot.waitingCount / Math.max(1, snapshot.concurrencyLimit), 0, 3);
  const activePenalty = activeRatio * 0.28;
  const waitingPenalty = waitingRatio * 0.32;
  const saturationPenalty = snapshot.saturated ? 0.12 : 0;
  return clampNumber(1 - activePenalty - waitingPenalty - saturationPenalty, 0.18, 1);
}

function formatChannelRuntimeLoad(snapshot: ProxyChannelLoadSnapshot): string {
  if (!snapshot.sessionScoped || snapshot.concurrencyLimit <= 0) {
    return '未限流';
  }
  const multiplier = resolveChannelRuntimeLoadMultiplier(snapshot);
  return `${multiplier.toFixed(2)}（活跃=${snapshot.activeLeaseCount}/${snapshot.concurrencyLimit}，等待=${snapshot.waitingCount}）`;
}

type CostSignal = {
  unitCost: number;
  source: 'observed' | 'configured' | 'catalog' | 'fallback';
};

function resolveEffectiveUnitCost(candidate: RouteChannelCandidate, modelName: string): CostSignal {
  const successCount = Math.max(0, candidate.channel.successCount ?? 0);
  const totalCost = Math.max(0, candidate.channel.totalCost ?? 0);
  const configured = candidate.account.unitCost ?? null;

  if (successCount > 0 && totalCost > 0) {
    return {
      unitCost: Math.max(totalCost / successCount, MIN_EFFECTIVE_UNIT_COST),
      source: 'observed',
    };
  }

  if (typeof configured === 'number' && Number.isFinite(configured) && configured > 0) {
    return {
      unitCost: Math.max(configured, MIN_EFFECTIVE_UNIT_COST),
      source: 'configured',
    };
  }

  const catalogCost = getCachedModelRoutingReferenceCost({
    siteId: candidate.site.id,
    accountId: candidate.account.id,
    modelName,
  });
  if (typeof catalogCost === 'number' && Number.isFinite(catalogCost) && catalogCost > 0) {
    return {
      unitCost: Math.max(catalogCost, MIN_EFFECTIVE_UNIT_COST),
      source: 'catalog',
    };
  }

  return {
    unitCost: Math.max(config.routingFallbackUnitCost || 1, MIN_EFFECTIVE_UNIT_COST),
    source: 'fallback',
  };
}

type SiteHistoricalHealthMetrics = {
  multiplier: number;
  totalCalls: number;
  successRate: number | null;
  avgLatencyMs: number | null;
};

function buildSiteHistoricalHealthMetrics(candidates: RouteChannelCandidate[]): Map<number, SiteHistoricalHealthMetrics> {
  const totals = new Map<number, {
    totalCalls: number;
    successCount: number;
    failCount: number;
    totalLatencyMs: number;
    latencySamples: number;
  }>();

  for (const candidate of candidates) {
    const siteId = candidate.site.id;
    if (!totals.has(siteId)) {
      totals.set(siteId, {
        totalCalls: 0,
        successCount: 0,
        failCount: 0,
        totalLatencyMs: 0,
        latencySamples: 0,
      });
    }
    const target = totals.get(siteId)!;
    const successCount = Math.max(0, candidate.channel.successCount ?? 0);
    const failCount = Math.max(0, candidate.channel.failCount ?? 0);
    target.successCount += successCount;
    target.failCount += failCount;
    target.totalCalls += successCount + failCount;
    if (successCount > 0) {
      target.totalLatencyMs += Math.max(0, candidate.channel.totalLatencyMs ?? 0);
      target.latencySamples += successCount;
    }
  }

  const metrics = new Map<number, SiteHistoricalHealthMetrics>();
  for (const [siteId, total] of totals.entries()) {
    if (total.totalCalls <= 0) {
      metrics.set(siteId, {
        multiplier: 1,
        totalCalls: 0,
        successRate: null,
        avgLatencyMs: null,
      });
      continue;
    }

    const sampleFactor = clampNumber(total.totalCalls / SITE_HISTORICAL_HEALTH_MAX_SAMPLE, 0, 1);
    const successRate = total.successCount / total.totalCalls;
    const successPenaltyFactor = 1 - ((1 - successRate) * 0.55 * sampleFactor);
    const avgLatencyMs = total.latencySamples > 0
      ? Math.round(total.totalLatencyMs / total.latencySamples)
      : null;
    const latencyPenaltyRatio = avgLatencyMs == null
      ? 0
      : clampNumber(
        (avgLatencyMs - SITE_HISTORICAL_LATENCY_BASELINE_MS) / SITE_HISTORICAL_LATENCY_WINDOW_MS,
        0,
        1,
      ) * sampleFactor;
    const latencyFactor = 1 - (latencyPenaltyRatio * SITE_HISTORICAL_MAX_LATENCY_PENALTY);
    metrics.set(siteId, {
      multiplier: clampNumber(
        successPenaltyFactor * latencyFactor,
        SITE_HISTORICAL_HEALTH_MIN_MULTIPLIER,
        1,
      ),
      totalCalls: total.totalCalls,
      successRate,
      avgLatencyMs,
    });
  }

  return metrics;
}

export function buildStableFirstPoolPlan(
  candidates: RouteChannelCandidate[],
  modelName: string | ((candidate: RouteChannelCandidate) => string),
  nowMs = Date.now(),
): StableFirstPoolPlan {
  if (candidates.length <= 0) {
    return {
      primaryCandidates: [],
      observationCandidates: [],
      primarySiteIds: new Set<number>(),
      observationSiteIds: new Set<number>(),
      siteStateById: new Map<number, StableFirstSitePoolState>(),
    };
  }

  const resolveModelName = typeof modelName === 'function'
    ? modelName
    : (() => modelName);
  const historicalBySiteId = buildSiteHistoricalHealthMetrics(candidates);
  const leaderBySiteId = new Map<number, RouteChannelCandidate>();
  const siteStateById = new Map<number, StableFirstSitePoolState>();

  for (const candidate of candidates) {
    const siteId = candidate.site.id;
    const currentLeader = leaderBySiteId.get(siteId);
    if (!currentLeader || compareStableFirstCandidateOrder(candidate, currentLeader) < 0) {
      leaderBySiteId.set(siteId, candidate);
    }
  }

  for (const [siteId, leader] of leaderBySiteId.entries()) {
    const healthDetails = getSiteRuntimeHealthDetails(siteId, resolveModelName(leader), nowMs);
    const historical = historicalBySiteId.get(siteId);
    const historicalTotalCalls = historical?.totalCalls ?? 0;
    const effectiveSuccessRate = resolveStableFirstSuccessRate(healthDetails, historical?.successRate);
    const trusted = (
      healthDetails.recentConfidence >= STABLE_FIRST_TRUSTED_RECENT_CONFIDENCE
      || historicalTotalCalls >= STABLE_FIRST_TRUSTED_HISTORICAL_CALLS
    );
    siteStateById.set(siteId, {
      siteId,
      leader,
      effectiveSuccessRate,
      trusted,
      observationReason: null,
    });
  }

  const allSiteStates = Array.from(siteStateById.values()).sort((left, right) => {
    const rateDiff = right.effectiveSuccessRate - left.effectiveSuccessRate;
    if (Math.abs(rateDiff) > 1e-9) return rateDiff > 0 ? 1 : -1;
    return compareStableFirstCandidateOrder(left.leader, right.leader);
  });
  const trustedSiteStates = allSiteStates.filter((state) => state.trusted);
  const leaderPool = trustedSiteStates.length > 0 ? trustedSiteStates : allSiteStates;

  const primarySiteIds = new Set<number>();
  const observationSiteIds = new Set<number>();
  const bestRate = leaderPool[0]?.effectiveSuccessRate ?? 0;
  const thresholdRate = bestRate > 0
    ? (bestRate * STABLE_FIRST_PRIMARY_SUCCESS_RATE_RATIO)
    : 0;

  for (const state of allSiteStates) {
    const inPrimary = leaderPool.length === 0
      ? true
      : (
        leaderPool.some((leaderState) => leaderState.siteId === state.siteId)
        && state.effectiveSuccessRate >= thresholdRate
      );
    if (inPrimary) {
      primarySiteIds.add(state.siteId);
      continue;
    }
    observationSiteIds.add(state.siteId);
    state.observationReason = state.trusted
      ? '观察池：近期成功率暂时落后，仅灰度真实流量会命中'
      : '观察池：近期样本不足，仅灰度真实流量会命中';
  }

  if (primarySiteIds.size <= 0 && allSiteStates.length > 0) {
    primarySiteIds.add(allSiteStates[0].siteId);
    observationSiteIds.delete(allSiteStates[0].siteId);
  }

  return {
    primaryCandidates: candidates.filter((candidate) => primarySiteIds.has(candidate.site.id)),
    observationCandidates: candidates.filter((candidate) => observationSiteIds.has(candidate.site.id)),
    primarySiteIds,
    observationSiteIds,
    siteStateById,
  };
}

export function shouldUseStableFirstObservationCandidate(
  rotationKey: string,
  observationCandidates: RouteChannelCandidate[],
  nowMs = Date.now(),
): boolean {
  if (!rotationKey || observationCandidates.length <= 0) return false;
  const state = stableFirstObservationProgressByKey.get(rotationKey) ?? {
    requestCount: 0,
    lastObservationAtMs: null,
  };
  if ((state.requestCount + 1) < STABLE_FIRST_OBSERVATION_REQUEST_INTERVAL) {
    return false;
  }
  return observationCandidates.some((candidate) => {
    const observedAtMs = stableFirstObservationSiteCooldownByKey.get(`${rotationKey}:${candidate.site.id}`) ?? null;
    return observedAtMs == null || (nowMs - observedAtMs) >= STABLE_FIRST_OBSERVATION_SITE_COOLDOWN_MS;
  });
}

export function getStableFirstObservationProgressState(rotationKey: string): StableFirstObservationProgressState {
  return stableFirstObservationProgressByKey.get(rotationKey) ?? {
    requestCount: 0,
    lastObservationAtMs: null,
  };
}

export function getRemainingStableFirstPrimaryRequestsBeforeObservation(
  rotationKey: string,
  hasPrimaryCandidates: boolean,
): number {
  if (!hasPrimaryCandidates) return 0;
  const observationProgressState = getStableFirstObservationProgressState(rotationKey);
  return Math.max(0, STABLE_FIRST_OBSERVATION_REQUEST_INTERVAL - (observationProgressState.requestCount + 1));
}

export function updateStableFirstObservationProgress(
  rotationKey: string,
  input: {
    usedObservation: boolean;
    selectedSiteId?: number | null;
    nowMs?: number;
  },
): void {
  if (!rotationKey) return;
  const nowMs = input.nowMs ?? Date.now();
  const previous = stableFirstObservationProgressByKey.get(rotationKey) ?? {
    requestCount: 0,
    lastObservationAtMs: null,
  };
  if (input.usedObservation) {
    rememberStableFirstObservationProgressForKey(rotationKey, {
      requestCount: 0,
      lastObservationAtMs: nowMs,
    });
    if (typeof input.selectedSiteId === 'number' && input.selectedSiteId > 0) {
      rememberStableFirstObservationSiteCooldown(rotationKey, input.selectedSiteId, nowMs);
    }
    return;
  }
  rememberStableFirstObservationProgressForKey(rotationKey, {
    requestCount: Math.max(0, previous.requestCount) + 1,
    lastObservationAtMs: previous.lastObservationAtMs,
  });
}

export function getRoundRobinCandidates(candidates: RouteChannelCandidate[]): RouteChannelCandidate[] {
  return [...candidates].sort((left, right) => {
    const selectionOrder = compareNullableTimeAsc(
      left.channel.lastSelectedAt || left.channel.lastUsedAt,
      right.channel.lastSelectedAt || right.channel.lastUsedAt,
    );
    if (selectionOrder !== 0) return selectionOrder;

    const usedOrder = compareNullableTimeAsc(left.channel.lastUsedAt, right.channel.lastUsedAt);
    if (usedOrder !== 0) return usedOrder;

    return (left.channel.id ?? 0) - (right.channel.id ?? 0);
  });
}

export function selectRoundRobinCandidate(candidates: RouteChannelCandidate[]): RouteChannelCandidate | null {
  return getRoundRobinCandidates(candidates)[0] ?? null;
}

export function buildStableFirstRotationKey(routeId: number, requestedModel: string): string {
  const normalizedModel = normalizeModelAlias(requestedModel)
    || normalizeRouteDisplayName(requestedModel).toLowerCase()
    || String(routeId);
  return `${routeId}:${normalizedModel}`;
}

function getStableFirstSiteOrder(candidates: RouteChannelCandidate[], siteId: number): number {
  let order = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    if (candidate.site.id !== siteId) continue;
    order = Math.min(order, candidate.channel.priority ?? 0);
  }
  return Number.isFinite(order) ? order : 0;
}

function getStableFirstOrderedSiteLeaderIndices(
  candidates: RouteChannelCandidate[],
  stableSiteLeaderIndices: number[],
): number[] {
  return [...stableSiteLeaderIndices].sort((leftIndex, rightIndex) => {
    const leftSiteId = candidates[leftIndex]?.site.id ?? 0;
    const rightSiteId = candidates[rightIndex]?.site.id ?? 0;
    const orderDiff = getStableFirstSiteOrder(candidates, leftSiteId)
      - getStableFirstSiteOrder(candidates, rightSiteId);
    if (orderDiff !== 0) return orderDiff;
    return (candidates[leftIndex]?.channel.id ?? 0) - (candidates[rightIndex]?.channel.id ?? 0);
  });
}

export function calculateWeightedSelection(
  candidates: RouteChannelCandidate[],
  modelName: string | ((candidate: RouteChannelCandidate) => string),
  downstreamPolicy: DownstreamRoutingPolicy,
  nowMs = Date.now(),
  selectionMode: WeightedSelectionMode = 'weighted',
  stableFirstRotationKey?: string,
): WeightedSelectionResult {
  if (candidates.length === 0) {
    return {
      selected: null as RouteChannelCandidate | null,
      details: [] as Array<{ candidate: RouteChannelCandidate; probability: number; reason: string }>,
      stableSiteCount: 0,
    };
  }

  const { baseWeightFactor, valueScoreFactor, costWeight, balanceWeight, usageWeight } = config.routingWeights;
  const resolveModelName = typeof modelName === 'function'
    ? modelName
    : (() => modelName);
  const effectiveCosts = candidates.map((candidate) => resolveEffectiveUnitCost(candidate, resolveModelName(candidate)));
  const runtimeHealthDetails = candidates.map((candidate) => (
    getSiteRuntimeHealthDetails(candidate.site.id, resolveModelName(candidate), nowMs)
  ));
  const channelLoadSnapshots = candidates.map((candidate) => (
    proxyChannelCoordinator.getChannelLoadSnapshot({
      channelId: candidate.channel.id,
      accountExtraConfig: candidate.account.extraConfig,
      accountOauthProvider: candidate.account.oauthProvider,
    })
  ));

  const valueScores = candidates.map((c, i) => {
    const unitCost = effectiveCosts[i]?.unitCost || 1;
    const balance = c.account.balance || 0;
    const totalUsed = (c.channel.successCount ?? 0) + (c.channel.failCount ?? 0);
    const recentUsage = Math.max(totalUsed, 1);
    return costWeight * (1 / unitCost) + balanceWeight * balance + usageWeight * (1 / recentUsage);
  });

  const maxVS = Math.max(...valueScores, 0.001);
  const minVS = Math.min(...valueScores, 0);
  const range = maxVS - minVS || 1;
  const normalizedVS = valueScores.map((v) => (v - minVS) / range);

  const baseContributions = candidates.map((c, i) => {
    const weight = c.channel.weight ?? 10;
    return (weight + 10) * (baseWeightFactor + normalizedVS[i] * valueScoreFactor);
  });

  // Avoid over-favoring a site that has many tokens/channels for the same route.
  // Site-level total contribution remains comparable, then split across its channels.
  const siteChannelCounts = new Map<number, number>();
  for (const candidate of candidates) {
    siteChannelCounts.set(candidate.site.id, (siteChannelCounts.get(candidate.site.id) || 0) + 1);
  }
  const siteHistoricalHealthMetrics = buildSiteHistoricalHealthMetrics(candidates);

  const contributions = candidates.map((candidate, i) => {
    const siteChannels = Math.max(1, siteChannelCounts.get(candidate.site.id) || 1);
    const runtimeMultiplier = runtimeHealthDetails[i]?.combinedMultiplier ?? 1;
    const runtimeLoadMultiplier = resolveChannelRuntimeLoadMultiplier(channelLoadSnapshots[i]);
    if (selectionMode === 'stable_first') {
      const recentSuccessRate = resolveStableFirstSuccessRate(
        runtimeHealthDetails[i],
        siteHistoricalHealthMetrics.get(candidate.site.id)?.successRate,
      );
      let contribution = Math.max(1e-4, recentSuccessRate ** 2);
      contribution *= runtimeMultiplier;
      contribution *= runtimeLoadMultiplier;
      return contribution / siteChannels;
    }

    let contribution = baseContributions[i] / siteChannels;
    const downstreamSiteMultiplier = downstreamPolicy.siteWeightMultipliers[candidate.site.id] ?? 1;
    const normalizedDownstreamSiteMultiplier =
      (Number.isFinite(downstreamSiteMultiplier) && downstreamSiteMultiplier > 0)
        ? downstreamSiteMultiplier
        : 1;
    const siteGlobalWeight =
      (Number.isFinite(candidate.site.globalWeight) && (candidate.site.globalWeight || 0) > 0)
        ? (candidate.site.globalWeight as number)
        : 1;
    const combinedSiteWeight = siteGlobalWeight * normalizedDownstreamSiteMultiplier;
    if (combinedSiteWeight > 0 && Number.isFinite(combinedSiteWeight)) {
      contribution *= combinedSiteWeight;
    }

    contribution *= runtimeMultiplier;
    contribution *= siteHistoricalHealthMetrics.get(candidate.site.id)?.multiplier ?? 1;
    contribution *= runtimeLoadMultiplier;

    // If upstream price is unknown and we are using fallback unit cost,
    // apply an explicit penalty so raising fallback cost meaningfully lowers probability.
    if (effectiveCosts[i]?.source === 'fallback') {
      contribution *= 1 / Math.max(1, effectiveCosts[i]?.unitCost || 1);
    }

    return contribution;
  });

  const totalContribution = contributions.reduce((a, b) => a + b, 0);
  const rankedIndices = candidates.map((_, index) => index)
    .sort((leftIndex, rightIndex) => {
      const contributionDiff = contributions[rightIndex] - contributions[leftIndex];
      if (Math.abs(contributionDiff) > 1e-9) {
        return contributionDiff > 0 ? 1 : -1;
      }
      return compareStableFirstCandidateOrder(candidates[leftIndex], candidates[rightIndex]);
    });
  const rankByIndex = new Map<number, number>();
  rankedIndices.forEach((candidateIndex, rank) => {
    rankByIndex.set(candidateIndex, rank + 1);
  });
  const stableSiteLeaderIndices = selectionMode === 'stable_first'
    ? getStableFirstSiteLeaderIndices(candidates, contributions, rankedIndices)
    : [];
  const stableSiteIds = new Set(stableSiteLeaderIndices.map((index) => candidates[index]?.site.id).filter((siteId) => typeof siteId === 'number'));
  const details = candidates.map((candidate, i) => {
    const probability = totalContribution > 0 ? contributions[i] / totalContribution : 0;
    const weight = candidate.channel.weight ?? 10;
    const cost = effectiveCosts[i];
    const costSourceText = cost?.source === 'observed'
      ? '实测'
      : (cost?.source === 'configured' ? '配置' : (cost?.source === 'catalog' ? '目录' : '默认'));
    const siteChannels = Math.max(1, siteChannelCounts.get(candidate.site.id) || 1);
    const downstreamSiteMultiplier = downstreamPolicy.siteWeightMultipliers[candidate.site.id] ?? 1;
    const normalizedDownstreamSiteMultiplier =
      (Number.isFinite(downstreamSiteMultiplier) && downstreamSiteMultiplier > 0)
        ? downstreamSiteMultiplier
        : 1;
    const siteGlobalWeight =
      (Number.isFinite(candidate.site.globalWeight) && (candidate.site.globalWeight || 0) > 0)
        ? (candidate.site.globalWeight as number)
        : 1;
    const combinedSiteWeight = siteGlobalWeight * normalizedDownstreamSiteMultiplier;
    const siteRuntimeDetail = runtimeHealthDetails[i];
    const siteHistoricalHealth = siteHistoricalHealthMetrics.get(candidate.site.id);
    const siteHistoricalMultiplier = siteHistoricalHealth?.multiplier ?? 1;
    const historicalSuccessRateText = siteHistoricalHealth?.successRate == null
      ? '—'
      : `${(siteHistoricalHealth.successRate * 100).toFixed(1)}%`;
    const historicalLatencyText = siteHistoricalHealth?.avgLatencyMs == null
      ? '—'
      : `${siteHistoricalHealth.avgLatencyMs}ms`;
    const channelRuntimeLoad = channelLoadSnapshots[i];
    const runtimeHealthText = siteRuntimeDetail.modelKey
      ? `${siteRuntimeDetail.combinedMultiplier.toFixed(2)}（站点=${siteRuntimeDetail.globalMultiplier.toFixed(2)}，模型=${siteRuntimeDetail.modelMultiplier.toFixed(2)}）`
      : `${siteRuntimeDetail.globalMultiplier.toFixed(2)}`;
    const runtimeLoadText = formatChannelRuntimeLoad(channelRuntimeLoad);
    const recentSuccessRateText = `${(siteRuntimeDetail.recentSuccessRate * 100).toFixed(1)}%`;
    const stableFirstSuccessRate = resolveStableFirstSuccessRate(siteRuntimeDetail, siteHistoricalHealth?.successRate);
    const stableFirstSuccessRateText = `${(stableFirstSuccessRate * 100).toFixed(1)}%`;
    const stableSiteOrder = getStableFirstSiteOrder(candidates, candidate.site.id);
    const reasonPrefix = selectionMode === 'stable_first'
      ? (
        candidates.length === 1
          ? '稳定优先（唯一可用候选'
          : `稳定优先（综合评分第 ${rankByIndex.get(i) ?? 1} / ${candidates.length}`
      )
      : (
        candidates.length === 1
          ? '按权重随机（唯一可用候选'
          : '按权重随机'
      );
    const stablePoolText = selectionMode === 'stable_first'
      ? `，轮询顺位=P${stableSiteOrder}`
      : '';
    return {
      candidate,
      probability,
      reason: selectionMode === 'stable_first'
        ? `${reasonPrefix}，近期成功率=${recentSuccessRateText}（样本=${siteRuntimeDetail.recentSampleCount.toFixed(2)}，置信=${siteRuntimeDetail.recentConfidence.toFixed(2)}），回退成功率=${historicalSuccessRateText}，综合近期成功率=${stableFirstSuccessRateText}，运行时健康=${runtimeHealthText}，会话负载=${runtimeLoadText}，同站点通道=${siteChannels}${stablePoolText}，评分占比≈${(probability * 100).toFixed(1)}%）`
        : (
          candidates.length === 1
            ? `${reasonPrefix}，W=${weight}，成本=${costSourceText}:${(cost?.unitCost || 1).toFixed(6)}，站点权重=${siteGlobalWeight.toFixed(2)}x下游倍率=${normalizedDownstreamSiteMultiplier.toFixed(2)}=${combinedSiteWeight.toFixed(2)}，运行时健康=${runtimeHealthText}，会话负载=${runtimeLoadText}，历史健康=${siteHistoricalMultiplier.toFixed(2)}（成功率=${historicalSuccessRateText}，均延迟=${historicalLatencyText}，样本=${siteHistoricalHealth?.totalCalls ?? 0}），同站点通道=${siteChannels}，概率≈${(probability * 100).toFixed(1)}%）`
            : `按权重随机（W=${weight}，成本=${costSourceText}:${(cost?.unitCost || 1).toFixed(6)}，站点权重=${siteGlobalWeight.toFixed(2)}x下游倍率=${normalizedDownstreamSiteMultiplier.toFixed(2)}=${combinedSiteWeight.toFixed(2)}，运行时健康=${runtimeHealthText}，会话负载=${runtimeLoadText}，历史健康=${siteHistoricalMultiplier.toFixed(2)}（成功率=${historicalSuccessRateText}，均延迟=${historicalLatencyText}，样本=${siteHistoricalHealth?.totalCalls ?? 0}），同站点通道=${siteChannels}，概率≈${(probability * 100).toFixed(1)}%）`
        ),
    };
  });

  let selected = candidates[rankedIndices[0] ?? 0];
  if (selectionMode === 'weighted') {
    let rand = Math.random() * totalContribution;
    selected = candidates[candidates.length - 1];
    for (let i = 0; i < candidates.length; i++) {
      rand -= contributions[i];
      if (rand <= 0) {
        selected = candidates[i];
        break;
      }
    }
  } else {
    selected = selectStableFirstCandidate(
      candidates,
      contributions,
      rankedIndices,
      stableFirstRotationKey,
    ) ?? selected;
  }

  return {
    selected,
    details,
    stableSiteCount: stableSiteIds.size,
  };
}

export function selectWeightedRandomCandidate(
  candidates: RouteChannelCandidate[],
  modelName: string | ((candidate: RouteChannelCandidate) => string),
  downstreamPolicy: DownstreamRoutingPolicy,
  nowMs = Date.now(),
): RouteChannelCandidate | null {
  return calculateWeightedSelection(candidates, modelName, downstreamPolicy, nowMs, 'weighted').selected;
}

export function selectStableFirstCandidateByWeight(
  candidates: RouteChannelCandidate[],
  modelName: string | ((candidate: RouteChannelCandidate) => string),
  downstreamPolicy: DownstreamRoutingPolicy,
  nowMs = Date.now(),
  stableFirstRotationKey?: string,
): RouteChannelCandidate | null {
  return calculateWeightedSelection(
    candidates,
    modelName,
    downstreamPolicy,
    nowMs,
    'stable_first',
    stableFirstRotationKey,
  ).selected;
}

function getStableFirstSiteLeaderIndices(
  candidates: RouteChannelCandidate[],
  contributions: number[],
  rankedIndices: number[],
): number[] {
  if (rankedIndices.length <= 1) return rankedIndices;

  const siteLeaderIndices: number[] = [];
  const seenSiteIds = new Set<number>();
  for (const index of rankedIndices) {
    const siteId = candidates[index]?.site.id;
    if (!Number.isFinite(siteId) || seenSiteIds.has(siteId)) continue;
    seenSiteIds.add(siteId);
    siteLeaderIndices.push(index);
  }

  if (siteLeaderIndices.length <= 1) return siteLeaderIndices;

  const bestContribution = contributions[siteLeaderIndices[0] ?? rankedIndices[0] ?? 0] ?? 0;
  const stableSiteLeaderIndices = siteLeaderIndices.filter((index) => (
    isContributionCloseToBest(contributions[index] ?? 0, bestContribution)
  ));

  return stableSiteLeaderIndices.length > 0 ? stableSiteLeaderIndices : siteLeaderIndices;
}

function selectStableFirstCandidate(
  candidates: RouteChannelCandidate[],
  contributions: number[],
  rankedIndices: number[],
  stableFirstRotationKey?: string,
): RouteChannelCandidate | null {
  const stableSiteLeaderIndices = getStableFirstSiteLeaderIndices(candidates, contributions, rankedIndices);
  if (stableSiteLeaderIndices.length <= 0) return candidates[rankedIndices[0] ?? 0] ?? null;

  const orderedSiteLeaderIndices = getStableFirstOrderedSiteLeaderIndices(candidates, stableSiteLeaderIndices);
  const lastSelectedSiteId = stableFirstRotationKey
    ? stableFirstLastSelectedSiteByKey.get(stableFirstRotationKey)
    : undefined;
  const lastSelectedIndex = typeof lastSelectedSiteId === 'number'
    ? orderedSiteLeaderIndices.findIndex((index) => candidates[index]?.site.id === lastSelectedSiteId)
    : -1;
  const selectedSiteLeader = orderedSiteLeaderIndices[lastSelectedIndex >= 0
    ? ((lastSelectedIndex + 1) % orderedSiteLeaderIndices.length)
    : 0];
  if (selectedSiteLeader == null) return candidates[rankedIndices[0] ?? 0] ?? null;

  const selectedSiteId = candidates[selectedSiteLeader]?.site.id;
  const topSiteCandidateIndex = rankedIndices.find((index) => candidates[index]?.site.id === selectedSiteId);
  return topSiteCandidateIndex == null ? (candidates[selectedSiteLeader] ?? null) : (candidates[topSiteCandidateIndex] ?? null);
}
