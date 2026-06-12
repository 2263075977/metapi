import { eq } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { upsertSetting } from '../db/upsertSetting.js';
import { RETRYABLE_TIMEOUT_PATTERNS } from './proxyRetryPolicy.js';
import {
  isExactRouteModelPattern,
  normalizeChannelSourceModel,
  normalizeModelAlias,
  type TokenRouterRouteChannelCandidate,
} from './tokenRouterRouteMatching.js';

export type SiteRuntimeFailureContext = {
  status?: number | null;
  errorText?: string | null;
  modelName?: string | null;
};

type SiteRuntimeHealthState = {
  penaltyScore: number;
  latencyEmaMs: number | null;
  transientFailureStreak: number;
  lastTransientFailureAtMs: number | null;
  recentSuccessCount: number;
  recentFailureCount: number;
  recentWindowUpdatedAtMs: number;
  breakerLevel: number;
  breakerUntilMs: number | null;
  lastUpdatedAtMs: number;
  lastFailureAtMs: number | null;
  lastSuccessAtMs: number | null;
};

type SiteRuntimeHealthPersistencePayload = {
  version: 1;
  savedAtMs: number;
  globalBySiteId: Record<string, SiteRuntimeHealthState>;
  modelBySiteId: Record<string, Record<string, SiteRuntimeHealthState>>;
};

export type SiteRuntimeHealthDetails = {
  globalMultiplier: number;
  modelMultiplier: number;
  combinedMultiplier: number;
  globalBreakerOpen: boolean;
  modelBreakerOpen: boolean;
  modelKey: string;
  recentSuccessRate: number;
  recentSampleCount: number;
  recentConfidence: number;
};

type RecentOutcomeSnapshot = {
  successCount: number;
  failureCount: number;
  sampleCount: number;
  successRate: number;
  confidence: number;
};

export type RuntimeHealthChannelClearRow = {
  siteId: number;
  sourceModel: string | null;
  routeModelPattern: string;
};

const SITE_RUNTIME_HEALTH_DECAY_HALF_LIFE_MS = 10 * 60 * 1000;
const SITE_RUNTIME_MIN_MULTIPLIER = 0.08;
const SITE_RUNTIME_LATENCY_BASELINE_MS = 2_500;
const SITE_RUNTIME_LATENCY_WINDOW_MS = 30_000;
const SITE_RUNTIME_MAX_LATENCY_PENALTY = 0.35;
const SITE_RUNTIME_LATENCY_EMA_ALPHA = 0.3;
const SITE_RUNTIME_BREAKER_STREAK_THRESHOLD = 3;
const SITE_RUNTIME_BREAKER_LEVELS_MS = [0, 60_000, 5 * 60_000, 30 * 60 * 1000] as const;
const SITE_TRANSIENT_STREAK_WINDOW_MS = 5 * 60 * 1000;
const SITE_RECENT_OUTCOME_HALF_LIFE_MS = 30 * 60 * 1000;
const SITE_RECENT_SUCCESS_CONFIDENCE_SAMPLES = 12;
const SITE_RECENT_SUCCESS_PRIOR_SUCCESSES = 1;
const SITE_RECENT_SUCCESS_PRIOR_FAILURES = 1;
const SITE_RECENT_SUCCESS_FALLBACK_RATE = 0.5;
const SITE_RECENT_MODEL_WEIGHT = 0.65;
const SITE_RUNTIME_HEALTH_SETTING_KEY = 'token_router_site_runtime_health_v1';
const SITE_RUNTIME_HEALTH_PERSIST_DEBOUNCE_MS = 500;
const SITE_RUNTIME_HEALTH_PERSIST_STALE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SITE_RUNTIME_HEALTH_PERSIST_IDLE_TTL_MS = 12 * 60 * 60 * 1000;
const SITE_RUNTIME_HEALTH_PERSIST_MIN_PENALTY = 0.02;

const SITE_PROTOCOL_FAILURE_PATTERNS: RegExp[] = [
  /unsupported\s+legacy\s+protocol/i,
  /please\s+use\s+\/v1\/responses/i,
  /please\s+use\s+\/v1\/messages/i,
  /please\s+use\s+\/v1\/chat\/completions/i,
  /does\s+not\s+allow\s+\/v1\/[a-z0-9/_:-]+\s+dispatch/i,
  /unsupported\s+endpoint/i,
  /unsupported\s+path/i,
  /unknown\s+endpoint/i,
  /unrecognized\s+request\s+url/i,
  /no\s+route\s+matched/i,
];

const SITE_MODEL_FAILURE_PATTERNS: RegExp[] = [
  /unsupported\s+model/i,
  /model\s+not\s+supported/i,
  /does\s+not\s+support(?:\s+the)?\s+model/i,
  /no\s+such\s+model/i,
  /unknown\s+model/i,
  /unknown\s+provider\s+for\s+model/i,
  /invalid\s+model/i,
  /model.*does\s+not\s+exist/i,
  /当前\s*api\s*不支持所选模型/i,
  /不支持所选模型/i,
];

const SITE_VALIDATION_FAILURE_PATTERNS: RegExp[] = [
  /invalid\s+request\s+body/i,
  /validation/i,
  /missing\s+required/i,
  /required\s+parameter/i,
  /unknown\s+parameter/i,
  /unrecognized\s+(field|key|parameter)/i,
  /malformed/i,
  /invalid\s+json/i,
  /cannot\s+parse/i,
  /unsupported\s+media\s+type/i,
];

const SITE_TRANSIENT_FAILURE_PATTERNS: RegExp[] = [
  /bad\s+gateway/i,
  /gateway\s+time-?out/i,
  ...RETRYABLE_TIMEOUT_PATTERNS,
  /service\s+unavailable/i,
  /temporar(?:y|ily)\s+unavailable/i,
  /cpu\s+overloaded/i,
  /overloaded/i,
  /connection\s+reset/i,
  /connection\s+refused/i,
  /econnreset/i,
  /econnrefused/i,
];

const USAGE_LIMIT_RATE_LIMIT_PATTERNS: RegExp[] = [
  /usage_limit_reached/i,
  /usage\s+limit\s+has\s+been\s+reached/i,
  /quota\s+exceeded/i,
  /rate\s+limit/i,
  /\blimit\b/i,
];

const siteRuntimeHealthStates = new Map<number, SiteRuntimeHealthState>();
const siteModelRuntimeHealthStates = new Map<number, Map<string, SiteRuntimeHealthState>>();
let siteRuntimeHealthLoaded = false;
let siteRuntimeHealthLoadPromise: Promise<void> | null = null;
let siteRuntimeHealthSaveTimer: ReturnType<typeof setTimeout> | null = null;
let siteRuntimeHealthPersistInFlight: Promise<void> | null = null;

function resolveSiteRuntimeBreakerMs(level: number): number {
  const normalizedLevel = Math.max(0, Math.min(SITE_RUNTIME_BREAKER_LEVELS_MS.length - 1, Math.trunc(level)));
  return SITE_RUNTIME_BREAKER_LEVELS_MS[normalizedLevel] ?? 0;
}

function matchesAnyPattern(patterns: RegExp[], input?: string | null): boolean {
  const text = (input || '').trim();
  if (!text) return false;
  return patterns.some((pattern) => pattern.test(text));
}

export function isUsageLimitRateLimitFailure(context: SiteRuntimeFailureContext = {}): boolean {
  const status = typeof context.status === 'number' ? context.status : 0;
  if (status !== 429) return false;
  return matchesAnyPattern(USAGE_LIMIT_RATE_LIMIT_PATTERNS, context.errorText);
}

function isModelScopedRuntimeFailure(context: SiteRuntimeFailureContext = {}): boolean {
  return matchesAnyPattern(SITE_MODEL_FAILURE_PATTERNS, context.errorText);
}

function isProtocolRuntimeFailure(context: SiteRuntimeFailureContext = {}): boolean {
  return matchesAnyPattern(SITE_PROTOCOL_FAILURE_PATTERNS, context.errorText);
}

function isValidationRuntimeFailure(context: SiteRuntimeFailureContext = {}): boolean {
  return matchesAnyPattern(SITE_VALIDATION_FAILURE_PATTERNS, context.errorText);
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readFiniteInteger(value: unknown): number | null {
  const normalized = readFiniteNumber(value);
  return normalized == null ? null : Math.trunc(normalized);
}

function readNullableTimestamp(value: unknown): number | null {
  const normalized = readFiniteInteger(value);
  if (normalized == null || normalized <= 0) return null;
  return normalized;
}

function decayRecentOutcomeCount(value: number, elapsedMs: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (elapsedMs <= 0) return value;
  const decayFactor = Math.pow(0.5, elapsedMs / SITE_RECENT_OUTCOME_HALF_LIFE_MS);
  return value * decayFactor;
}

function buildRecentOutcomeSnapshot(
  successCount: number,
  failureCount: number,
): RecentOutcomeSnapshot {
  const normalizedSuccessCount = Math.max(0, successCount);
  const normalizedFailureCount = Math.max(0, failureCount);
  const sampleCount = normalizedSuccessCount + normalizedFailureCount;
  const successRate = (
    normalizedSuccessCount + SITE_RECENT_SUCCESS_PRIOR_SUCCESSES
  ) / (
    sampleCount + SITE_RECENT_SUCCESS_PRIOR_SUCCESSES + SITE_RECENT_SUCCESS_PRIOR_FAILURES
  );
  return {
    successCount: normalizedSuccessCount,
    failureCount: normalizedFailureCount,
    sampleCount,
    successRate,
    confidence: clampNumber(sampleCount / SITE_RECENT_SUCCESS_CONFIDENCE_SAMPLES, 0, 1),
  };
}

function getRecentOutcomeSnapshot(state: SiteRuntimeHealthState | null | undefined, nowMs = Date.now()): RecentOutcomeSnapshot {
  if (!state) {
    return buildRecentOutcomeSnapshot(0, 0);
  }
  const updatedAtMs = Math.max(0, readFiniteInteger(state.recentWindowUpdatedAtMs) ?? state.lastUpdatedAtMs ?? nowMs);
  const elapsedMs = Math.max(0, nowMs - updatedAtMs);
  return buildRecentOutcomeSnapshot(
    decayRecentOutcomeCount(state.recentSuccessCount, elapsedMs),
    decayRecentOutcomeCount(state.recentFailureCount, elapsedMs),
  );
}

function refreshRecentOutcomeWindow(state: SiteRuntimeHealthState, nowMs = Date.now()): void {
  const snapshot = getRecentOutcomeSnapshot(state, nowMs);
  state.recentSuccessCount = snapshot.successCount;
  state.recentFailureCount = snapshot.failureCount;
  state.recentWindowUpdatedAtMs = nowMs;
}

function blendRecentOutcomeSnapshots(
  globalSnapshot: RecentOutcomeSnapshot,
  modelSnapshot: RecentOutcomeSnapshot | null,
): RecentOutcomeSnapshot {
  if (!modelSnapshot || modelSnapshot.sampleCount <= 0) {
    return globalSnapshot;
  }
  const modelWeight = SITE_RECENT_MODEL_WEIGHT;
  const globalWeight = 1 - modelWeight;
  return buildRecentOutcomeSnapshot(
    (globalSnapshot.successCount * globalWeight) + (modelSnapshot.successCount * modelWeight),
    (globalSnapshot.failureCount * globalWeight) + (modelSnapshot.failureCount * modelWeight),
  );
}

export function resolveStableFirstSuccessRate(
  details: SiteRuntimeHealthDetails,
  historicalSuccessRate: number | null | undefined,
): number {
  const fallbackRate = historicalSuccessRate ?? SITE_RECENT_SUCCESS_FALLBACK_RATE;
  return (
    (details.recentSuccessRate * details.recentConfidence)
    + (fallbackRate * (1 - details.recentConfidence))
  );
}

function resolveSiteRuntimeFailurePenalty(context: SiteRuntimeFailureContext = {}): number {
  const status = typeof context.status === 'number' ? context.status : 0;
  const errorText = (context.errorText || '').trim();

  if (isUsageLimitRateLimitFailure({ status, errorText })) {
    return 0.4;
  }

  if (isModelScopedRuntimeFailure({ status, errorText })) {
    return 0.9;
  }

  if (isProtocolRuntimeFailure({ status, errorText })) {
    return 0.6;
  }

  if (isValidationRuntimeFailure({ status, errorText })) {
    return 0.25;
  }

  if (status >= 500 || matchesAnyPattern(SITE_TRANSIENT_FAILURE_PATTERNS, errorText)) {
    return 2.5;
  }

  if (status === 429) {
    return 2.2;
  }

  if (status === 401 || status === 403) {
    return 1.8;
  }

  if (status >= 400 && status < 500) {
    return 0.9;
  }

  return 1.2;
}

function isTransientSiteRuntimeFailure(context: SiteRuntimeFailureContext = {}): boolean {
  const status = typeof context.status === 'number' ? context.status : 0;
  const errorText = (context.errorText || '').trim();
  if (isUsageLimitRateLimitFailure({ status, errorText })) {
    return false;
  }
  if (isModelScopedRuntimeFailure({ status, errorText })) {
    return false;
  }
  if (isProtocolRuntimeFailure({ status, errorText })) {
    return false;
  }
  if (isValidationRuntimeFailure({ status, errorText })) {
    return false;
  }
  return status >= 500 || status === 429 || matchesAnyPattern(SITE_TRANSIENT_FAILURE_PATTERNS, errorText);
}

function getDecayedSiteRuntimePenalty(state: SiteRuntimeHealthState, nowMs: number): number {
  if (!Number.isFinite(state.penaltyScore) || state.penaltyScore <= 0) return 0;
  const elapsedMs = Math.max(0, nowMs - state.lastUpdatedAtMs);
  if (elapsedMs <= 0) return state.penaltyScore;
  const decayFactor = Math.pow(0.5, elapsedMs / SITE_RUNTIME_HEALTH_DECAY_HALF_LIFE_MS);
  return state.penaltyScore * decayFactor;
}

function hydrateSiteRuntimeHealthState(raw: unknown): SiteRuntimeHealthState | null {
  if (!isRecord(raw)) return null;

  const lastUpdatedAtMs = readFiniteInteger(raw.lastUpdatedAtMs) ?? Date.now();
  const recentWindowUpdatedAtMs = readFiniteInteger(raw.recentWindowUpdatedAtMs) ?? lastUpdatedAtMs;
  return {
    penaltyScore: Math.max(0, readFiniteNumber(raw.penaltyScore) ?? 0),
    latencyEmaMs: readFiniteNumber(raw.latencyEmaMs),
    transientFailureStreak: Math.max(0, readFiniteInteger(raw.transientFailureStreak) ?? 0),
    lastTransientFailureAtMs: readNullableTimestamp(raw.lastTransientFailureAtMs),
    recentSuccessCount: Math.max(0, readFiniteNumber(raw.recentSuccessCount) ?? 0),
    recentFailureCount: Math.max(0, readFiniteNumber(raw.recentFailureCount) ?? 0),
    recentWindowUpdatedAtMs: Math.max(0, recentWindowUpdatedAtMs),
    breakerLevel: Math.max(0, readFiniteInteger(raw.breakerLevel) ?? 0),
    breakerUntilMs: readNullableTimestamp(raw.breakerUntilMs),
    lastUpdatedAtMs: Math.max(0, lastUpdatedAtMs),
    lastFailureAtMs: readNullableTimestamp(raw.lastFailureAtMs),
    lastSuccessAtMs: readNullableTimestamp(raw.lastSuccessAtMs),
  };
}

function cloneSiteRuntimeHealthState(state: SiteRuntimeHealthState): SiteRuntimeHealthState {
  return {
    penaltyScore: state.penaltyScore,
    latencyEmaMs: state.latencyEmaMs,
    transientFailureStreak: state.transientFailureStreak,
    lastTransientFailureAtMs: state.lastTransientFailureAtMs,
    recentSuccessCount: state.recentSuccessCount,
    recentFailureCount: state.recentFailureCount,
    recentWindowUpdatedAtMs: state.recentWindowUpdatedAtMs,
    breakerLevel: state.breakerLevel,
    breakerUntilMs: state.breakerUntilMs,
    lastUpdatedAtMs: state.lastUpdatedAtMs,
    lastFailureAtMs: state.lastFailureAtMs,
    lastSuccessAtMs: state.lastSuccessAtMs,
  };
}

function getOrCreateRuntimeHealthState<K>(states: Map<K, SiteRuntimeHealthState>, key: K, nowMs = Date.now()): SiteRuntimeHealthState {
  const existing = states.get(key);
  if (!existing) {
    const initial: SiteRuntimeHealthState = {
      penaltyScore: 0,
      latencyEmaMs: null,
      transientFailureStreak: 0,
      lastTransientFailureAtMs: null,
      recentSuccessCount: 0,
      recentFailureCount: 0,
      recentWindowUpdatedAtMs: nowMs,
      breakerLevel: 0,
      breakerUntilMs: null,
      lastUpdatedAtMs: nowMs,
      lastFailureAtMs: null,
      lastSuccessAtMs: null,
    };
    states.set(key, initial);
    return initial;
  }

  const nextPenalty = getDecayedSiteRuntimePenalty(existing, nowMs);
  if (nextPenalty !== existing.penaltyScore || existing.lastUpdatedAtMs !== nowMs) {
    existing.penaltyScore = nextPenalty;
    existing.lastUpdatedAtMs = nowMs;
  }
  return existing;
}

function getOrCreateSiteRuntimeHealthState(siteId: number, nowMs = Date.now()): SiteRuntimeHealthState {
  return getOrCreateRuntimeHealthState(siteRuntimeHealthStates, siteId, nowMs);
}

function getSiteModelRuntimeHealthState(siteId: number, modelName?: string | null): SiteRuntimeHealthState | null {
  const modelKey = normalizeModelAlias(modelName || '');
  if (!modelKey) return null;
  return siteModelRuntimeHealthStates.get(siteId)?.get(modelKey) ?? null;
}

function getOrCreateSiteModelRuntimeHealthState(
  siteId: number,
  modelName?: string | null,
  nowMs = Date.now(),
): SiteRuntimeHealthState | null {
  const modelKey = normalizeModelAlias(modelName || '');
  if (!modelKey) return null;
  let modelStates = siteModelRuntimeHealthStates.get(siteId);
  if (!modelStates) {
    modelStates = new Map<string, SiteRuntimeHealthState>();
    siteModelRuntimeHealthStates.set(siteId, modelStates);
  }
  return getOrCreateRuntimeHealthState(modelStates, modelKey, nowMs);
}

function isRuntimeHealthBreakerOpen(state: SiteRuntimeHealthState | null | undefined, nowMs = Date.now()): boolean {
  if (!state) return false;
  return typeof state.breakerUntilMs === 'number' && state.breakerUntilMs > nowMs;
}

function getRuntimeHealthMultiplier(state: SiteRuntimeHealthState | null | undefined, nowMs = Date.now()): number {
  if (!state) return 1;
  if (isRuntimeHealthBreakerOpen(state, nowMs)) {
    return SITE_RUNTIME_MIN_MULTIPLIER;
  }
  const penaltyScore = getDecayedSiteRuntimePenalty(state, nowMs);
  const failurePenaltyFactor = 1 / (1 + penaltyScore);
  const latencyPenaltyRatio = state.latencyEmaMs == null
    ? 0
    : clampNumber(
      (state.latencyEmaMs - SITE_RUNTIME_LATENCY_BASELINE_MS) / SITE_RUNTIME_LATENCY_WINDOW_MS,
      0,
      1,
    );
  const latencyFactor = 1 - (latencyPenaltyRatio * SITE_RUNTIME_MAX_LATENCY_PENALTY);
  return clampNumber(failurePenaltyFactor * latencyFactor, SITE_RUNTIME_MIN_MULTIPLIER, 1);
}

export function getSiteRuntimeHealthDetails(siteId: number, modelName?: string | null, nowMs = Date.now()): SiteRuntimeHealthDetails {
  const modelKey = normalizeModelAlias(modelName || '');
  const globalState = siteRuntimeHealthStates.get(siteId);
  const modelState = modelKey ? getSiteModelRuntimeHealthState(siteId, modelKey) : null;
  const globalMultiplier = getRuntimeHealthMultiplier(globalState, nowMs);
  const modelMultiplier = modelState ? getRuntimeHealthMultiplier(modelState, nowMs) : 1;
  const globalRecentSnapshot = getRecentOutcomeSnapshot(globalState, nowMs);
  const modelRecentSnapshot = modelState ? getRecentOutcomeSnapshot(modelState, nowMs) : null;
  const recentSnapshot = blendRecentOutcomeSnapshots(globalRecentSnapshot, modelRecentSnapshot);
  return {
    globalMultiplier,
    modelMultiplier,
    combinedMultiplier: clampNumber(
      globalMultiplier * modelMultiplier,
      SITE_RUNTIME_MIN_MULTIPLIER * SITE_RUNTIME_MIN_MULTIPLIER,
      1,
    ),
    globalBreakerOpen: isRuntimeHealthBreakerOpen(globalState, nowMs),
    modelBreakerOpen: isRuntimeHealthBreakerOpen(modelState, nowMs),
    modelKey,
    recentSuccessRate: recentSnapshot.successRate,
    recentSampleCount: recentSnapshot.sampleCount,
    recentConfidence: recentSnapshot.confidence,
  };
}

function applyRuntimeHealthFailure(state: SiteRuntimeHealthState, context: SiteRuntimeFailureContext = {}, nowMs = Date.now()): void {
  refreshRecentOutcomeWindow(state, nowMs);
  state.recentFailureCount += 1;
  state.penaltyScore += resolveSiteRuntimeFailurePenalty(context);
  if (isTransientSiteRuntimeFailure(context)) {
    const lastTransientFailureAtMs = state.lastTransientFailureAtMs;
    const shouldContinueStreak = (
      typeof lastTransientFailureAtMs === 'number'
      && (nowMs - lastTransientFailureAtMs) <= SITE_TRANSIENT_STREAK_WINDOW_MS
    );
    state.transientFailureStreak = shouldContinueStreak
      ? state.transientFailureStreak + 1
      : 1;
    state.lastTransientFailureAtMs = nowMs;
    if (state.transientFailureStreak >= SITE_RUNTIME_BREAKER_STREAK_THRESHOLD) {
      state.breakerLevel = Math.min(state.breakerLevel + 1, SITE_RUNTIME_BREAKER_LEVELS_MS.length - 1);
      const breakerMs = resolveSiteRuntimeBreakerMs(state.breakerLevel);
      state.breakerUntilMs = breakerMs > 0 ? nowMs + breakerMs : null;
      state.transientFailureStreak = 0;
    }
  } else {
    state.transientFailureStreak = 0;
    state.lastTransientFailureAtMs = null;
  }
  state.lastFailureAtMs = nowMs;
}

function applyRuntimeHealthSuccess(state: SiteRuntimeHealthState, latencyMs: number, nowMs = Date.now()): void {
  refreshRecentOutcomeWindow(state, nowMs);
  state.recentSuccessCount += 1;
  state.penaltyScore = Math.max(0, state.penaltyScore * 0.2 - 0.3);
  state.transientFailureStreak = 0;
  state.lastTransientFailureAtMs = null;
  state.breakerLevel = 0;
  state.breakerUntilMs = null;
  state.lastSuccessAtMs = nowMs;
  const normalizedLatencyMs = Math.max(0, Math.trunc(latencyMs));
  state.latencyEmaMs = state.latencyEmaMs == null
    ? normalizedLatencyMs
    : (state.latencyEmaMs * (1 - SITE_RUNTIME_LATENCY_EMA_ALPHA))
      + (normalizedLatencyMs * SITE_RUNTIME_LATENCY_EMA_ALPHA);
}

function shouldPersistSiteRuntimeHealthState(state: SiteRuntimeHealthState, nowMs = Date.now()): boolean {
  const lastTouchedAtMs = Math.max(
    state.lastUpdatedAtMs,
    state.lastFailureAtMs ?? 0,
    state.lastSuccessAtMs ?? 0,
    state.lastTransientFailureAtMs ?? 0,
  );
  if ((nowMs - lastTouchedAtMs) > SITE_RUNTIME_HEALTH_PERSIST_STALE_TTL_MS) {
    return false;
  }

  if (isRuntimeHealthBreakerOpen(state, nowMs)) return true;
  if (getDecayedSiteRuntimePenalty(state, nowMs) >= SITE_RUNTIME_HEALTH_PERSIST_MIN_PENALTY) return true;
  if (getRecentOutcomeSnapshot(state, nowMs).sampleCount > 0.01) return true;
  if ((state.latencyEmaMs ?? 0) > 0) return true;
  return (nowMs - lastTouchedAtMs) <= SITE_RUNTIME_HEALTH_PERSIST_IDLE_TTL_MS;
}

function buildSiteRuntimeHealthPersistencePayload(nowMs = Date.now()): SiteRuntimeHealthPersistencePayload {
  const globalBySiteId: Record<string, SiteRuntimeHealthState> = {};
  const modelBySiteId: Record<string, Record<string, SiteRuntimeHealthState>> = {};

  for (const [siteId, state] of siteRuntimeHealthStates.entries()) {
    if (!shouldPersistSiteRuntimeHealthState(state, nowMs)) continue;
    globalBySiteId[String(siteId)] = cloneSiteRuntimeHealthState(state);
  }

  for (const [siteId, modelStates] of siteModelRuntimeHealthStates.entries()) {
    const persistedModels: Record<string, SiteRuntimeHealthState> = {};
    for (const [modelKey, state] of modelStates.entries()) {
      if (!shouldPersistSiteRuntimeHealthState(state, nowMs)) continue;
      persistedModels[modelKey] = cloneSiteRuntimeHealthState(state);
    }
    if (Object.keys(persistedModels).length > 0) {
      modelBySiteId[String(siteId)] = persistedModels;
    }
  }

  return {
    version: 1,
    savedAtMs: nowMs,
    globalBySiteId,
    modelBySiteId,
  };
}

export async function persistSiteRuntimeHealthState(): Promise<void> {
  if (siteRuntimeHealthPersistInFlight) {
    await siteRuntimeHealthPersistInFlight;
    return;
  }
  const persistTask = (async () => {
    const payload = buildSiteRuntimeHealthPersistencePayload();
    await upsertSetting(SITE_RUNTIME_HEALTH_SETTING_KEY, payload);
  })();
  siteRuntimeHealthPersistInFlight = persistTask.finally(() => {
    if (siteRuntimeHealthPersistInFlight === persistTask) {
      siteRuntimeHealthPersistInFlight = null;
    }
  });
  await siteRuntimeHealthPersistInFlight;
}

function scheduleSiteRuntimeHealthPersistence(): void {
  if (siteRuntimeHealthSaveTimer) return;
  siteRuntimeHealthSaveTimer = setTimeout(() => {
    siteRuntimeHealthSaveTimer = null;
    void persistSiteRuntimeHealthState().catch((error) => {
      console.error('Failed to persist site runtime health state', error);
    });
  }, SITE_RUNTIME_HEALTH_PERSIST_DEBOUNCE_MS);
}

async function loadSiteRuntimeHealthStateFromSettings(): Promise<void> {
  siteRuntimeHealthStates.clear();
  siteModelRuntimeHealthStates.clear();

  const row = await db.select({ value: schema.settings.value })
    .from(schema.settings)
    .where(eq(schema.settings.key, SITE_RUNTIME_HEALTH_SETTING_KEY))
    .get();
  if (!row?.value) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(row.value);
  } catch {
    return;
  }
  if (!isRecord(parsed)) return;

  const globalBySiteId = isRecord(parsed.globalBySiteId) ? parsed.globalBySiteId : {};
  for (const [siteIdKey, stateRaw] of Object.entries(globalBySiteId)) {
    const siteId = Number(siteIdKey);
    if (!Number.isFinite(siteId) || siteId <= 0) continue;
    const state = hydrateSiteRuntimeHealthState(stateRaw);
    if (!state) continue;
    siteRuntimeHealthStates.set(siteId, state);
  }

  const modelBySiteId = isRecord(parsed.modelBySiteId) ? parsed.modelBySiteId : {};
  for (const [siteIdKey, modelStatesRaw] of Object.entries(modelBySiteId)) {
    const siteId = Number(siteIdKey);
    if (!Number.isFinite(siteId) || siteId <= 0 || !isRecord(modelStatesRaw)) continue;
    const hydratedModelStates = new Map<string, SiteRuntimeHealthState>();
    for (const [rawModelKey, stateRaw] of Object.entries(modelStatesRaw)) {
      const modelKey = normalizeModelAlias(rawModelKey);
      if (!modelKey) continue;
      const state = hydrateSiteRuntimeHealthState(stateRaw);
      if (!state) continue;
      hydratedModelStates.set(modelKey, state);
    }
    if (hydratedModelStates.size > 0) {
      siteModelRuntimeHealthStates.set(siteId, hydratedModelStates);
    }
  }
}

export async function ensureSiteRuntimeHealthStateLoaded(): Promise<void> {
  if (siteRuntimeHealthLoaded) return;
  if (!siteRuntimeHealthLoadPromise) {
    siteRuntimeHealthLoadPromise = (async () => {
      try {
        await loadSiteRuntimeHealthStateFromSettings();
        siteRuntimeHealthLoaded = true;
      } catch (error) {
        console.warn('Failed to restore site runtime health state from settings', error);
        siteRuntimeHealthLoadPromise = null;
        siteRuntimeHealthLoaded = false;
      }
    })();
  }
  await siteRuntimeHealthLoadPromise;
}

export function recordSiteRuntimeFailure(siteId: number, context: SiteRuntimeFailureContext = {}, nowMs = Date.now()): void {
  applyRuntimeHealthFailure(getOrCreateSiteRuntimeHealthState(siteId, nowMs), context, nowMs);
  const modelState = getOrCreateSiteModelRuntimeHealthState(siteId, context.modelName, nowMs);
  if (modelState) {
    applyRuntimeHealthFailure(modelState, context, nowMs);
  }
  scheduleSiteRuntimeHealthPersistence();
}

export function recordSiteRuntimeSuccess(siteId: number, latencyMs: number, modelName?: string | null, nowMs = Date.now()): void {
  applyRuntimeHealthSuccess(getOrCreateSiteRuntimeHealthState(siteId, nowMs), latencyMs, nowMs);
  const modelState = getOrCreateSiteModelRuntimeHealthState(siteId, modelName, nowMs);
  if (modelState) {
    applyRuntimeHealthSuccess(modelState, latencyMs, nowMs);
  }
  scheduleSiteRuntimeHealthPersistence();
}

export function resetSiteRuntimeHealthState(): void {
  siteRuntimeHealthStates.clear();
  siteModelRuntimeHealthStates.clear();
  siteRuntimeHealthLoaded = false;
  siteRuntimeHealthLoadPromise = null;
  if (siteRuntimeHealthSaveTimer) {
    clearTimeout(siteRuntimeHealthSaveTimer);
    siteRuntimeHealthSaveTimer = null;
  }
  siteRuntimeHealthPersistInFlight = null;
}

export async function flushSiteRuntimeHealthPersistence(): Promise<void> {
  if (siteRuntimeHealthSaveTimer) {
    clearTimeout(siteRuntimeHealthSaveTimer);
    siteRuntimeHealthSaveTimer = null;
    await persistSiteRuntimeHealthState();
    return;
  }
  if (siteRuntimeHealthPersistInFlight) {
    await siteRuntimeHealthPersistInFlight;
  }
}

export function clearRuntimeHealthStatesForChannels(rows: RuntimeHealthChannelClearRow[]): boolean {
  let changed = false;
  const modelKeysBySiteId = new Map<number, Set<string>>();

  for (const row of rows) {
    if (siteRuntimeHealthStates.delete(row.siteId)) {
      changed = true;
    }

    const resolvedModelName = normalizeChannelSourceModel(row.sourceModel)
      || (isExactRouteModelPattern(row.routeModelPattern) ? row.routeModelPattern.trim() : '');
    const modelKey = normalizeModelAlias(resolvedModelName);
    if (!modelKey) continue;
    if (!modelKeysBySiteId.has(row.siteId)) {
      modelKeysBySiteId.set(row.siteId, new Set());
    }
    modelKeysBySiteId.get(row.siteId)!.add(modelKey);
  }

  for (const [siteId, modelKeys] of modelKeysBySiteId.entries()) {
    const modelStates = siteModelRuntimeHealthStates.get(siteId);
    if (!modelStates) continue;
    for (const modelKey of modelKeys) {
      if (modelStates.delete(modelKey)) {
        changed = true;
      }
    }
    if (modelStates.size === 0) {
      siteModelRuntimeHealthStates.delete(siteId);
    }
  }

  return changed;
}

export function getSiteRuntimeHealthMultiplier(siteId: number, nowMs = Date.now()): number {
  const state = siteRuntimeHealthStates.get(siteId);
  return getRuntimeHealthMultiplier(state, nowMs);
}

export function isSiteRuntimeBreakerOpen(siteId: number, nowMs = Date.now()): boolean {
  const state = siteRuntimeHealthStates.get(siteId);
  return isRuntimeHealthBreakerOpen(state, nowMs);
}

export function filterSiteRuntimeBrokenCandidates<T extends { site: { id: number } }>(
  candidates: T[],
  nowMs = Date.now(),
): T[] {
  if (candidates.length <= 1) return candidates;
  const healthy = candidates.filter((candidate) => !isSiteRuntimeBreakerOpen(candidate.site.id, nowMs));
  return healthy.length > 0 ? healthy : candidates;
}

export function buildRuntimeBreakerReason(details: SiteRuntimeHealthDetails): string {
  if (details.globalBreakerOpen && details.modelBreakerOpen) {
    return '站点熔断中，模型熔断中，优先避让';
  }
  if (details.globalBreakerOpen) {
    return '站点熔断中，优先避让';
  }
  if (details.modelBreakerOpen) {
    return '模型熔断中，优先避让';
  }
  return '运行时熔断中，优先避让';
}

export function filterSiteRuntimeBrokenCandidatesByModel(
  candidates: TokenRouterRouteChannelCandidate[],
  modelName: string | ((candidate: TokenRouterRouteChannelCandidate) => string),
  nowMs = Date.now(),
): {
  candidates: TokenRouterRouteChannelCandidate[];
  avoided: Array<{ candidate: TokenRouterRouteChannelCandidate; reason: string }>;
} {
  if (candidates.length <= 1) {
    return {
      candidates,
      avoided: [],
    };
  }

  const resolveModelName = typeof modelName === 'function'
    ? modelName
    : (() => modelName);
  const avoided: Array<{ candidate: TokenRouterRouteChannelCandidate; reason: string }> = [];
  const healthy = candidates.filter((candidate) => {
    const details = getSiteRuntimeHealthDetails(candidate.site.id, resolveModelName(candidate), nowMs);
    const blocked = details.globalBreakerOpen || details.modelBreakerOpen;
    if (blocked) {
      avoided.push({
        candidate,
        reason: buildRuntimeBreakerReason(details),
      });
    }
    return !blocked;
  });

  return healthy.length > 0
    ? {
      candidates: healthy,
      avoided,
    }
    : {
      candidates,
      avoided: [],
    };
}
