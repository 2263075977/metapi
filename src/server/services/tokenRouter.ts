import { and, eq } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { refreshModelPricingCatalog } from './modelPricingService.js';
import {
  normalizeRouteRoutingStrategy,
  type RouteRoutingStrategy,
} from './routeRoutingStrategy.js';
import { type DownstreamRoutingPolicy, EMPTY_DOWNSTREAM_ROUTING_POLICY } from './downstreamPolicyTypes.js';
import { isUsableAccountToken } from './accountTokenService.js';
import { getOauthInfoFromAccount } from './oauth/oauthAccount.js';
import {
  getOauthRouteUnitStrategyLabel,
} from './oauth/routeUnitService.js';
import {
  channelSupportsRequestedModel,
  findTokenRouteMatch,
  findTokenRouteMatchById,
  getVisibleEnabledTokenRouteModelNames,
  invalidateTokenRouteMatch,
  invalidateTokenRouteMatchingCache,
  isModelAllowedByDownstreamPolicy,
  isRouteDisplayNameMatch,
  matchesModelPattern,
  normalizeChannelSourceModel,
  normalizeRouteDisplayName,
  patchCachedTokenRouteChannel,
  resolveActualModelForSelectedChannel,
  resolveMappedModel,
  type TokenRouterRouteChannelCandidate,
  type TokenRouterRouteMatch,
  type TokenRouterRouteRow,
} from './tokenRouterRouteMatching.js';
import {
  ensureSiteRuntimeHealthStateLoaded,
  filterSiteRuntimeBrokenCandidatesByModel,
  resetSiteRuntimeHealthState as resetRuntimeHealthState,
  type SiteRuntimeFailureContext,
} from './tokenRouterRuntimeHealth.js';
import {
  clearTokenRouteChannelFailureState,
  recordTokenRouteFailure,
  recordTokenRouteProbeSuccess,
  recordTokenRouteSuccess,
  type TokenRouteOutcomeCacheHooks,
} from './tokenRouterOutcomeCooldowns.js';
import {
  buildStableFirstPoolPlan,
  buildStableFirstRotationKey,
  calculateWeightedSelection,
  clearTokenRouterSelectionCaches,
  clearTokenRouterSelectionCachesForRoute,
  compareNullableTimeAsc,
  compareNullableTimeDesc,
  filterRecentlyFailedCandidates,
  getRemainingStableFirstPrimaryRequestsBeforeObservation,
  getRoundRobinCandidates,
  getStableFirstRotationCacheSize,
  isChannelRecentlyFailed,
  rememberStableFirstSiteSelectionForKey,
  resetTokenRouterSelectionObservationState,
  resolveFailureBackoffSec,
  selectRoundRobinCandidate,
  selectStableFirstCandidateByWeight,
  selectWeightedRandomCandidate,
  shouldUseStableFirstObservationCandidate,
  updateStableFirstObservationProgress,
} from './tokenRouterSelectionEngine.js';
import {
  type RouteDecision,
  type RouteDecisionCandidate,
} from '../../shared/tokenRouteContract.js';

export {
  isRegexModelPattern,
  matchesModelPattern,
  parseRegexModelPattern,
} from './tokenRouterRouteMatching.js';

export {
  filterSiteRuntimeBrokenCandidates,
  flushSiteRuntimeHealthPersistence,
  getSiteRuntimeHealthMultiplier,
  isSiteRuntimeBreakerOpen,
} from './tokenRouterRuntimeHealth.js';

export {
  filterRecentlyFailedCandidates,
  isChannelRecentlyFailed,
} from './tokenRouterSelectionEngine.js';

type RouteMatch = TokenRouterRouteMatch;
type RouteChannelCandidate = TokenRouterRouteChannelCandidate;
type RouteRow = TokenRouterRouteRow;

interface SelectedChannel {
  channel: typeof schema.routeChannels.$inferSelect;
  account: typeof schema.accounts.$inferSelect;
  site: typeof schema.sites.$inferSelect;
  token: typeof schema.accountTokens.$inferSelect | null;
  tokenValue: string;
  tokenName: string;
  actualModel: string;
}

function invalidateRouteScopedCache(routeId: number): void {
  if (!Number.isFinite(routeId) || routeId <= 0) return;
  invalidateTokenRouteMatch(routeId);
  clearTokenRouterSelectionCachesForRoute(routeId);
}

const TOKEN_ROUTE_OUTCOME_CACHE_HOOKS: TokenRouteOutcomeCacheHooks = {
  invalidateRouteScopedCache,
  invalidateAllTokenRouterCache: invalidateTokenRouterCache,
};

export function resetSiteRuntimeHealthState(): void {
  resetRuntimeHealthState();
  resetTokenRouterSelectionObservationState();
}

export function invalidateTokenRouterCache(): void {
  invalidateTokenRouteMatchingCache();
  clearTokenRouterSelectionCaches();
}

function isSiteDisabled(status?: string | null): boolean {
  return (status || 'active') === 'disabled';
}

export type RouteDecisionExplanation = RouteDecision & {
  routeId?: number;
  modelPattern?: string;
  selectedAccountId?: number;
};

const DEFAULT_DOWNSTREAM_POLICY: DownstreamRoutingPolicy = EMPTY_DOWNSTREAM_ROUTING_POLICY;

type ExplainSelectionOptions = {
  excludeChannelIds?: number[];
  bypassSourceModelCheck?: boolean;
  useChannelSourceModelForCost?: boolean;
  downstreamPolicy?: DownstreamRoutingPolicy;
};

type PricingReferenceRefreshOptions = {
  useChannelSourceModelForCost?: boolean;
  downstreamPolicy?: DownstreamRoutingPolicy;
  refreshedKeys?: Set<string>;
};

type CandidateEligibilityOptions = {
  requestedModel: string;
  bypassSourceModelCheck?: boolean;
  excludeChannelIds?: number[];
  nowIso?: string;
  downstreamPolicy?: DownstreamRoutingPolicy;
};

function resolveRouteStrategy(route: RouteRow): RouteRoutingStrategy {
  return normalizeRouteRoutingStrategy(route.routingStrategy);
}

function isOauthRouteUnitCandidate(candidate: RouteChannelCandidate): boolean {
  return !!candidate.routeUnit || !!candidate.channel.oauthRouteUnitId;
}

function isOauthRouteUnitMemberCoolingDown(
  member: typeof schema.oauthRouteUnitMembers.$inferSelect,
  nowIso: string,
): boolean {
  return !!member.cooldownUntil && member.cooldownUntil > nowIso;
}

function isExplicitTokenChannel(candidate: RouteChannelCandidate): boolean {
  return typeof candidate.channel.tokenId === 'number' && candidate.channel.tokenId > 0;
}

export class TokenRouter {
  /**
   * Find matching route and select a channel for the given model.
   * Returns null if no route/channel available.
   */
  async selectChannel(requestedModel: string, downstreamPolicy: DownstreamRoutingPolicy = DEFAULT_DOWNSTREAM_POLICY): Promise<SelectedChannel | null> {
    if (!isModelAllowedByDownstreamPolicy(requestedModel, downstreamPolicy)) return null;
    await ensureSiteRuntimeHealthStateLoaded();

    const match = await this.findRoute(requestedModel, downstreamPolicy);
    if (!match) return null;
    return await this.selectFromMatch(match, requestedModel, downstreamPolicy);
  }

  async previewSelectedChannel(
    requestedModel: string,
    downstreamPolicy: DownstreamRoutingPolicy = DEFAULT_DOWNSTREAM_POLICY,
  ): Promise<SelectedChannel | null> {
    if (!isModelAllowedByDownstreamPolicy(requestedModel, downstreamPolicy)) return null;
    await ensureSiteRuntimeHealthStateLoaded();

    const match = await this.findRoute(requestedModel, downstreamPolicy);
    if (!match) return null;
    return await this.selectFromMatch(match, requestedModel, downstreamPolicy, [], false);
  }

  /**
   * Select next channel for failover (exclude already-tried channels).
   */
  async selectNextChannel(
    requestedModel: string,
    excludeChannelIds: number[],
    downstreamPolicy: DownstreamRoutingPolicy = DEFAULT_DOWNSTREAM_POLICY,
  ): Promise<SelectedChannel | null> {
    if (!isModelAllowedByDownstreamPolicy(requestedModel, downstreamPolicy)) return null;
    await ensureSiteRuntimeHealthStateLoaded();

    const match = await this.findRoute(requestedModel, downstreamPolicy);
    if (!match) return null;
    return await this.selectFromMatch(match, requestedModel, downstreamPolicy, excludeChannelIds);
  }

  async selectPreferredChannel(
    requestedModel: string,
    preferredChannelId: number,
    downstreamPolicy: DownstreamRoutingPolicy = DEFAULT_DOWNSTREAM_POLICY,
    excludeChannelIds: number[] = [],
  ): Promise<SelectedChannel | null> {
    if (!isModelAllowedByDownstreamPolicy(requestedModel, downstreamPolicy)) return null;
    const normalizedPreferredChannelId = Math.trunc(preferredChannelId || 0);
    if (normalizedPreferredChannelId <= 0) return null;
    await ensureSiteRuntimeHealthStateLoaded();

    const match = await this.findRoute(requestedModel, downstreamPolicy);
    if (!match) return null;
    return await this.selectPreferredFromMatch(
      match,
      requestedModel,
      normalizedPreferredChannelId,
      downstreamPolicy,
      excludeChannelIds,
    );
  }

  async explainSelection(
    requestedModel: string,
    excludeChannelIds: number[] = [],
    downstreamPolicy: DownstreamRoutingPolicy = DEFAULT_DOWNSTREAM_POLICY,
  ): Promise<RouteDecisionExplanation> {
    await ensureSiteRuntimeHealthStateLoaded();
    const match = await this.findRoute(requestedModel, downstreamPolicy);
    return this.explainSelectionFromMatch(match, requestedModel, { excludeChannelIds, downstreamPolicy });
  }

  async explainSelectionForRoute(
    routeId: number,
    requestedModel: string,
    excludeChannelIds: number[] = [],
    downstreamPolicy: DownstreamRoutingPolicy = DEFAULT_DOWNSTREAM_POLICY,
  ): Promise<RouteDecisionExplanation> {
    await ensureSiteRuntimeHealthStateLoaded();
    const match = await this.findRouteById(routeId, downstreamPolicy);
    return this.explainSelectionFromMatch(match, requestedModel, { excludeChannelIds, downstreamPolicy });
  }

  async explainSelectionRouteWide(routeId: number, downstreamPolicy: DownstreamRoutingPolicy = DEFAULT_DOWNSTREAM_POLICY): Promise<RouteDecisionExplanation> {
    await ensureSiteRuntimeHealthStateLoaded();
    const match = await this.findRouteById(routeId, downstreamPolicy);
    const fallbackRequestedModel = match?.route.modelPattern || `route:${routeId}`;
    return this.explainSelectionFromMatch(match, fallbackRequestedModel, {
      bypassSourceModelCheck: true,
      useChannelSourceModelForCost: true,
      downstreamPolicy,
    });
  }

  async refreshPricingReferenceCosts(
    requestedModel: string,
    options: PricingReferenceRefreshOptions = {},
  ): Promise<void> {
    const downstreamPolicy = options.downstreamPolicy ?? DEFAULT_DOWNSTREAM_POLICY;
    const match = await this.findRoute(requestedModel, downstreamPolicy);
    await this.refreshPricingReferenceCostsForMatch(match, requestedModel, options);
  }

  async refreshPricingReferenceCostsForRoute(
    routeId: number,
    requestedModel: string,
    options: PricingReferenceRefreshOptions = {},
  ): Promise<void> {
    const downstreamPolicy = options.downstreamPolicy ?? DEFAULT_DOWNSTREAM_POLICY;
    const match = await this.findRouteById(routeId, downstreamPolicy);
    await this.refreshPricingReferenceCostsForMatch(match, requestedModel, options);
  }

  async refreshRouteWidePricingReferenceCosts(
    routeId: number,
    options: Omit<PricingReferenceRefreshOptions, 'useChannelSourceModelForCost'> = {},
  ): Promise<void> {
    const downstreamPolicy = options.downstreamPolicy ?? DEFAULT_DOWNSTREAM_POLICY;
    const match = await this.findRouteById(routeId, downstreamPolicy);
    const requestedModel = match?.route.modelPattern || `route:${routeId}`;
    await this.refreshPricingReferenceCostsForMatch(match, requestedModel, {
      ...options,
      useChannelSourceModelForCost: true,
    });
  }

  private explainSelectionFromMatch(
    match: RouteMatch | null,
    requestedModel: string,
    options: ExplainSelectionOptions = {},
  ): RouteDecisionExplanation {
    const excludeChannelIds = options.excludeChannelIds ?? [];
    const downstreamPolicy = options.downstreamPolicy ?? DEFAULT_DOWNSTREAM_POLICY;

    if (!match) {
      return {
        requestedModel,
        actualModel: requestedModel,
        matched: false,
        summary: ['未匹配到启用的路由'],
        candidates: [],
      };
    }

    const requestedByDisplayName = isRouteDisplayNameMatch(requestedModel, match.route.displayName);
    const bypassSourceModelCheck = (options.bypassSourceModelCheck ?? false) || requestedByDisplayName;
    const useChannelSourceModelForCost = (options.useChannelSourceModelForCost ?? false) || requestedByDisplayName;
    const mappedModel = resolveMappedModel(requestedModel, match.route.modelMapping);
    const routeStrategy = resolveRouteStrategy(match.route);
    const runtimeModelResolver = requestedByDisplayName
      ? ((candidate: RouteChannelCandidate) => normalizeChannelSourceModel(candidate.channel.sourceModel) || mappedModel)
      : mappedModel;

    const nowIso = new Date().toISOString();
    const nowMs = Date.now();
    const summary: string[] = [
      `命中路由：${match.route.modelPattern}`,
      routeStrategy === 'round_robin'
        ? '路由策略：轮询'
        : (routeStrategy === 'stable_first' ? '路由策略：稳定优先' : '路由策略：按权重随机'),
    ];
    if (requestedByDisplayName) {
      summary.push(`按显示名命中：${normalizeRouteDisplayName(match.route.displayName)}`);
      summary.push('显示名仅用于聚合展示，实际转发模型按选中通道来源模型决定');
    }
    const available: RouteChannelCandidate[] = [];
    const candidates: RouteDecisionCandidate[] = [];
    const candidateMap = new Map<number, RouteDecisionCandidate>();

    for (const row of match.channels) {
      const reasonParts = this.getCandidateEligibilityReasons(row, {
        requestedModel,
        bypassSourceModelCheck,
        excludeChannelIds,
        nowIso,
        downstreamPolicy,
      });

      const recentlyFailed = routeStrategy !== 'round_robin'
        ? isChannelRecentlyFailed(row.channel, nowMs)
        : false;
      const eligible = reasonParts.length === 0;
      const candidate: RouteDecisionCandidate = {
        channelId: row.channel.id,
        accountId: row.account.id,
        username: row.account.username || `account-${row.account.id}`,
        siteName: row.site.name || 'unknown',
        tokenName: row.token?.name || 'default',
        priority: row.channel.priority ?? 0,
        weight: row.channel.weight ?? 10,
        eligible,
        recentlyFailed,
        avoidedByRecentFailure: false,
        probability: 0,
        reason: eligible ? '可用' : reasonParts.join('、'),
      };
      candidates.push(candidate);
      candidateMap.set(candidate.channelId, candidate);

      if (eligible) {
        available.push(row);
      }
    }

    if (available.length === 0) {
      summary.push('没有可用通道（全部被禁用、站点不可用、冷却或令牌不可用）');
      return {
        requestedModel,
        actualModel: mappedModel,
        matched: true,
        routeId: match.route.id,
        modelPattern: match.route.modelPattern,
        summary,
        candidates,
      };
    }

    if (routeStrategy === 'round_robin') {
      const rawOrdered = getRoundRobinCandidates(available);
      const breakerFiltered = filterSiteRuntimeBrokenCandidatesByModel(rawOrdered, runtimeModelResolver, nowMs);
      if (breakerFiltered.avoided.length > 0) {
        for (const item of breakerFiltered.avoided) {
          const target = candidateMap.get(item.candidate.channel.id);
          if (!target) continue;
          target.reason = item.reason;
        }
        const breakerSummaryLabel = breakerFiltered.avoided.some((item) => item.reason.includes('模型熔断'))
          ? '运行时熔断避让'
          : '站点熔断避让';
        summary.push(`${breakerSummaryLabel} ${breakerFiltered.avoided.length}`);
      }
      const ordered = breakerFiltered.candidates;
      let selected: RouteChannelCandidate | null = null;

      for (let index = 0; index < ordered.length; index += 1) {
        const target = candidateMap.get(ordered[index].channel.id);
        if (!target || !target.eligible) continue;
        target.probability = index === 0 ? 100 : 0;
        target.reason = index === 0
          ? `轮询命中（全局第 1 / ${ordered.length} 位，忽略优先级）`
          : `轮询排队中（全局第 ${index + 1} / ${ordered.length} 位，忽略优先级）`;
        if (index === 0) {
          selected = ordered[index];
        }
      }

      if (!selected) {
        summary.push('本次未选出通道');
        return {
          requestedModel,
          actualModel: mappedModel,
          matched: true,
          routeId: match.route.id,
          modelPattern: match.route.modelPattern,
          summary,
          candidates,
        };
      }

      const selectedChannel = candidateMap.get(selected.channel.id);
      const selectedLabel = selectedChannel
        ? `${selectedChannel.username} @ ${selectedChannel.siteName} / ${selectedChannel.tokenName}`
        : `channel-${selected.channel.id}`;
      const actualModel = resolveActualModelForSelectedChannel(
        requestedModel,
        match.route,
        mappedModel,
        selected.channel.sourceModel,
      );
      summary.push(`全局轮询：可用 ${ordered.length}，忽略优先级`);
      summary.push(`最终选择：${selectedLabel}`);
      if (actualModel !== mappedModel) {
        summary.push(`实际转发模型：${actualModel}`);
      }

      return {
        requestedModel,
        actualModel,
        matched: true,
        routeId: match.route.id,
        modelPattern: match.route.modelPattern,
        selectedChannelId: selected.channel.id,
        selectedAccountId: selected.account.id,
        selectedLabel,
        summary,
        candidates,
      };
    }

    if (routeStrategy === 'stable_first') {
      const breakerFiltered = filterSiteRuntimeBrokenCandidatesByModel(available, runtimeModelResolver, nowMs);
      if (breakerFiltered.avoided.length > 0) {
        for (const item of breakerFiltered.avoided) {
          const target = candidateMap.get(item.candidate.channel.id);
          if (!target) continue;
          target.reason = item.reason;
        }
      }

      const filteredCandidates = filterRecentlyFailedCandidates(breakerFiltered.candidates, nowMs);
      const avoided = breakerFiltered.candidates.filter((row) => !filteredCandidates.some((item) => item.channel.id === row.channel.id));
      if (avoided.length > 0) {
        for (const row of avoided) {
          const target = candidateMap.get(row.channel.id);
          if (!target) continue;
          target.avoidedByRecentFailure = true;
          target.reason = `最近失败，优先避让（${resolveFailureBackoffSec(row.channel.failCount)} 秒窗口）`;
        }
      }

      const rotationKey = buildStableFirstRotationKey(match.route.id, requestedModel);
      const poolPlan = buildStableFirstPoolPlan(
        filteredCandidates,
        useChannelSourceModelForCost ? runtimeModelResolver : mappedModel,
        nowMs,
      );
      const observationDueNow = poolPlan.observationCandidates.length > 0
        && shouldUseStableFirstObservationCandidate(rotationKey, poolPlan.observationCandidates, nowMs);
      const useObservationNow = poolPlan.observationCandidates.length > 0
        && (poolPlan.primaryCandidates.length <= 0 || observationDueNow);
      const remainingPrimaryRequestsBeforeObservation = getRemainingStableFirstPrimaryRequestsBeforeObservation(
        rotationKey,
        poolPlan.primaryCandidates.length > 0,
      );
      const observationBlockedByCooldown = poolPlan.primaryCandidates.length > 0
        && poolPlan.observationCandidates.length > 0
        && remainingPrimaryRequestsBeforeObservation === 0
        && !observationDueNow;
      const primaryWeighted = calculateWeightedSelection(
        poolPlan.primaryCandidates,
        useChannelSourceModelForCost ? runtimeModelResolver : mappedModel,
        downstreamPolicy,
        nowMs,
        'stable_first',
        rotationKey,
      );
      const observationWeighted = poolPlan.observationCandidates.length > 0
        ? calculateWeightedSelection(
          poolPlan.observationCandidates,
          useChannelSourceModelForCost ? runtimeModelResolver : mappedModel,
          downstreamPolicy,
          nowMs,
          'stable_first',
          `${rotationKey}:observe`,
        )
        : {
          selected: null,
          details: [],
          stableSiteCount: 0,
        };

      for (const detail of primaryWeighted.details) {
        const target = candidateMap.get(detail.candidate.channel.id);
        if (!target) continue;
        target.probability = Number((detail.probability * (useObservationNow ? 0 : 100)).toFixed(2));
        if (target.eligible && !target.avoidedByRecentFailure) {
          target.reason = useObservationNow
            ? `主池：本次让位给观察池灰度请求；${detail.reason}`
            : `主池：${detail.reason}`;
        }
      }
      for (const detail of observationWeighted.details) {
        const target = candidateMap.get(detail.candidate.channel.id);
        if (!target) continue;
        target.probability = Number((detail.probability * (useObservationNow ? 100 : 0)).toFixed(2));
        if (target.eligible && !target.avoidedByRecentFailure) {
          const siteState = poolPlan.siteStateById.get(detail.candidate.site.id);
          const observationWindowPrefix = useObservationNow
            ? (poolPlan.primaryCandidates.length > 0
              ? '本次命中灰度真实请求'
              : '当前主池为空，改由观察池承接')
            : (observationBlockedByCooldown
              ? '当前已到灰度窗口，但观察站点仍在冷却'
              : `当前还需 ${remainingPrimaryRequestsBeforeObservation} 次主池请求`);
          target.reason = poolPlan.observationSiteIds.has(detail.candidate.site.id)
            ? `${siteState?.observationReason || '观察池'}；${observationWindowPrefix}；${detail.reason}`
            : `观察池：${observationWindowPrefix}；${detail.reason}`;
        }
      }

      const weighted = useObservationNow
        ? observationWeighted
        : (primaryWeighted.selected ? primaryWeighted : observationWeighted);
      if (!weighted.selected) {
        summary.push('本次未选出通道');
        return {
          requestedModel,
          actualModel: mappedModel,
          matched: true,
          routeId: match.route.id,
          modelPattern: match.route.modelPattern,
          summary,
          candidates,
        };
      }

      const summaryParts = [`稳定优先：可用 ${available.length}`];
      if (poolPlan.primarySiteIds.size > 0) {
        summaryParts.push(`主池站点 ${poolPlan.primarySiteIds.size}`);
      }
      if (poolPlan.observationSiteIds.size > 0) {
        summaryParts.push(`观察池站点 ${poolPlan.observationSiteIds.size}`);
      }
      summaryParts.push('按近期成功率分层后按配置顺序轮询站点');
      if (poolPlan.observationSiteIds.size > 0) {
        if (useObservationNow) {
          summaryParts.push('本次命中观察池灰度流量');
        } else if (observationBlockedByCooldown) {
          summaryParts.push('观察池已到灰度窗口，但候选站点仍在观察冷却');
        } else if (poolPlan.primaryCandidates.length <= 0) {
          summaryParts.push('当前主池为空，由观察池承接流量');
        } else {
          summaryParts.push(`观察池仅消耗少量真实请求灰度流量（当前还需 ${remainingPrimaryRequestsBeforeObservation} 次主池请求）`);
        }
      }
      if (breakerFiltered.avoided.length > 0) {
        const breakerSummaryLabel = breakerFiltered.avoided.some((item) => item.reason.includes('模型熔断'))
          ? '运行时熔断避让'
          : '站点熔断避让';
        summaryParts.push(`${breakerSummaryLabel} ${breakerFiltered.avoided.length}`);
      }
      if (avoided.length > 0) {
        summaryParts.push(`最近失败避让 ${avoided.length}`);
      }
      summary.push(summaryParts.join('，'));

      const selectedChannel = candidateMap.get(weighted.selected.channel.id);
      const selectedLabel = selectedChannel
        ? `${selectedChannel.username} @ ${selectedChannel.siteName} / ${selectedChannel.tokenName}`
        : `channel-${weighted.selected.channel.id}`;
      const actualModel = resolveActualModelForSelectedChannel(
        requestedModel,
        match.route,
        mappedModel,
        weighted.selected.channel.sourceModel,
      );
      summary.push(`最终选择：${selectedLabel}（P${weighted.selected.channel.priority ?? 0}）`);
      if (actualModel !== mappedModel) {
        summary.push(`实际转发模型：${actualModel}`);
      }

      return {
        requestedModel,
        actualModel,
        matched: true,
        routeId: match.route.id,
        modelPattern: match.route.modelPattern,
        selectedChannelId: weighted.selected.channel.id,
        selectedAccountId: weighted.selected.account.id,
        selectedLabel,
        summary,
        candidates,
      };
    }

    const availableByPriority = new Map<number, RouteChannelCandidate[]>();
    for (const row of available) {
      const priority = row.channel.priority ?? 0;
      if (!availableByPriority.has(priority)) availableByPriority.set(priority, []);
      availableByPriority.get(priority)!.push(row);
    }

    const sortedPriorities = Array.from(availableByPriority.keys()).sort((a, b) => a - b);
    let selected: RouteChannelCandidate | null = null;
    let selectedPriority = 0;

    for (const priority of sortedPriorities) {
      const rawLayer = availableByPriority.get(priority) ?? [];
      if (rawLayer.length === 0) continue;

      const breakerFiltered = filterSiteRuntimeBrokenCandidatesByModel(rawLayer, runtimeModelResolver, nowMs);
      if (breakerFiltered.avoided.length > 0) {
        for (const item of breakerFiltered.avoided) {
          const target = candidateMap.get(item.candidate.channel.id);
          if (!target) continue;
          target.reason = item.reason;
        }
      }

      const filteredLayer = filterRecentlyFailedCandidates(breakerFiltered.candidates, nowMs);
      const avoided = breakerFiltered.candidates.filter((row) => !filteredLayer.some((item) => item.channel.id === row.channel.id));
      if (avoided.length > 0) {
        for (const row of avoided) {
          const target = candidateMap.get(row.channel.id);
          if (!target) continue;
          target.avoidedByRecentFailure = true;
          target.reason = `最近失败，优先避让（${resolveFailureBackoffSec(row.channel.failCount)} 秒窗口）`;
        }
      }

      const weighted = calculateWeightedSelection(
        filteredLayer,
        useChannelSourceModelForCost ? runtimeModelResolver : mappedModel,
        downstreamPolicy,
        nowMs,
        'weighted',
      );
      for (const detail of weighted.details) {
        const target = candidateMap.get(detail.candidate.channel.id);
        if (!target) continue;
        target.probability = Number((detail.probability * 100).toFixed(2));
        if (target.eligible && !target.avoidedByRecentFailure) {
          target.reason = detail.reason;
        }
      }

      if (!weighted.selected) continue;
      selected = weighted.selected;
      selectedPriority = priority;
      const layerSummaryParts = [`优先级 P${priority}：可用 ${rawLayer.length}`];
      if (breakerFiltered.avoided.length > 0) {
        const breakerSummaryLabel = breakerFiltered.avoided.some((item) => item.reason.includes('模型熔断'))
          ? '运行时熔断避让'
          : '站点熔断避让';
        layerSummaryParts.push(`${breakerSummaryLabel} ${breakerFiltered.avoided.length}`);
      }
      if (avoided.length > 0) {
        layerSummaryParts.push(`最近失败避让 ${avoided.length}`);
      }
      summary.push(layerSummaryParts.join('，'));
      break;
    }

    if (!selected) {
      summary.push('本次未选出通道');
      return {
        requestedModel,
        actualModel: mappedModel,
        matched: true,
        routeId: match.route.id,
        modelPattern: match.route.modelPattern,
        summary,
        candidates,
      };
    }

    const selectedChannel = candidateMap.get(selected.channel.id);
    const selectedLabel = selectedChannel
      ? `${selectedChannel.username} @ ${selectedChannel.siteName} / ${selectedChannel.tokenName}`
      : `channel-${selected.channel.id}`;
    const actualModel = resolveActualModelForSelectedChannel(
      requestedModel,
      match.route,
      mappedModel,
      selected.channel.sourceModel,
    );
    summary.push(`最终选择：${selectedLabel}（P${selectedPriority}）`);
    if (actualModel !== mappedModel) {
      summary.push(`实际转发模型：${actualModel}`);
    }

    return {
      requestedModel,
      actualModel,
      matched: true,
      routeId: match.route.id,
      modelPattern: match.route.modelPattern,
      selectedChannelId: selected.channel.id,
      selectedAccountId: selected.account.id,
      selectedLabel,
      summary,
      candidates,
    };
  }

  private async refreshPricingReferenceCostsForMatch(
    match: RouteMatch | null,
    requestedModel: string,
    options: PricingReferenceRefreshOptions = {},
  ): Promise<void> {
    if (!match) return;

    const requestedByDisplayName = isRouteDisplayNameMatch(requestedModel, match.route.displayName);
    const useChannelSourceModelForCost = (options.useChannelSourceModelForCost ?? false) || requestedByDisplayName;
    const mappedModel = resolveMappedModel(requestedModel, match.route.modelMapping);
    const refreshedKeys = options.refreshedKeys ?? new Set<string>();

    await Promise.allSettled(match.channels.map(async (candidate) => {
      const refreshKey = `${candidate.site.id}:${candidate.account.id}`;
      if (refreshedKeys.has(refreshKey)) return;
      refreshedKeys.add(refreshKey);

      const modelName = useChannelSourceModelForCost
        ? (normalizeChannelSourceModel(candidate.channel.sourceModel) || mappedModel)
        : mappedModel;
      if (!modelName) return;

      await refreshModelPricingCatalog({
        site: {
          id: candidate.site.id,
          url: candidate.site.url,
          platform: candidate.site.platform,
          apiKey: candidate.site.apiKey,
        },
        account: {
          id: candidate.account.id,
          accessToken: candidate.account.accessToken,
          apiToken: candidate.account.apiToken,
        },
        modelName,
      });
    }));
  }

  /**
   * Record success for a channel.
   */
  async recordSuccess(
    channelId: number,
    latencyMs: number,
    cost: number,
    modelName?: string | null,
    actualAccountId?: number,
  ) {
    await recordTokenRouteSuccess({
      channelId,
      latencyMs,
      cost,
      modelName,
      actualAccountId,
      cacheHooks: TOKEN_ROUTE_OUTCOME_CACHE_HOOKS,
    });
  }

  async recordProbeSuccess(
    channelId: number,
    latencyMs: number,
    modelName?: string | null,
    actualAccountId?: number,
  ) {
    await recordTokenRouteProbeSuccess({
      channelId,
      latencyMs,
      modelName,
      actualAccountId,
      cacheHooks: TOKEN_ROUTE_OUTCOME_CACHE_HOOKS,
    });
  }

  /**
   * Clear persisted failure and cooldown state for the given channels.
   */
  async clearChannelFailureState(channelIds: number[]): Promise<number> {
    return await clearTokenRouteChannelFailureState({
      channelIds,
      cacheHooks: TOKEN_ROUTE_OUTCOME_CACHE_HOOKS,
    });
  }

  /**
   * Record failure and set cooldown.
   */
  async recordFailure(
    channelId: number,
    context: SiteRuntimeFailureContext | string | null = {},
    actualAccountId?: number,
  ) {
    await recordTokenRouteFailure({
      channelId,
      context,
      actualAccountId,
      cacheHooks: TOKEN_ROUTE_OUTCOME_CACHE_HOOKS,
    });
  }

  /**
   * Get all available models (aggregated from all routes).
   */
  async getAvailableModels(): Promise<string[]> {
    return await getVisibleEnabledTokenRouteModelNames();
  }

  // --- Private methods ---

  private async selectFromMatch(
    match: RouteMatch,
    requestedModel: string,
    downstreamPolicy: DownstreamRoutingPolicy,
    excludeChannelIds: number[] = [],
    recordSelection = true,
  ): Promise<SelectedChannel | null> {
    const mappedModel = resolveMappedModel(requestedModel, match.route.modelMapping);
    const requestedByDisplayName = isRouteDisplayNameMatch(requestedModel, match.route.displayName);
    const bypassSourceModelCheck = requestedByDisplayName;
    const routeStrategy = resolveRouteStrategy(match.route);
    const runtimeModelResolver = requestedByDisplayName
      ? ((candidate: RouteChannelCandidate) => normalizeChannelSourceModel(candidate.channel.sourceModel) || mappedModel)
      : mappedModel;

    const nowIso = new Date().toISOString();
    const nowMs = Date.now();
    const available = match.channels.filter((candidate) => (
      this.getCandidateEligibilityReasons(candidate, {
        requestedModel,
        bypassSourceModelCheck,
        excludeChannelIds,
        nowIso,
        downstreamPolicy,
      }).length === 0
    ));

    if (available.length === 0) return null;

    if (routeStrategy === 'round_robin') {
      const breakerFiltered = filterSiteRuntimeBrokenCandidatesByModel(available, runtimeModelResolver, nowMs);
      const selected = selectRoundRobinCandidate(breakerFiltered.candidates);
      if (!selected) return null;
      return await this.finalizeSelectedCandidateForDispatch(
        selected,
        match,
        requestedModel,
        mappedModel,
        downstreamPolicy,
        recordSelection,
        nowIso,
        nowMs,
        undefined,
        undefined,
        false,
        excludeChannelIds,
      );
    }

    if (routeStrategy === 'stable_first') {
      const breakerFiltered = filterSiteRuntimeBrokenCandidatesByModel(available, runtimeModelResolver, nowMs);
      const candidates = filterRecentlyFailedCandidates(breakerFiltered.candidates, nowMs);
      const rotationKey = buildStableFirstRotationKey(match.route.id, requestedModel);
      const poolPlan = buildStableFirstPoolPlan(
        candidates,
        requestedByDisplayName ? runtimeModelResolver : mappedModel,
        nowMs,
      );
      const shouldUseObservation = (
        poolPlan.observationCandidates.length > 0
        && (
          poolPlan.primaryCandidates.length <= 0
          || (
            recordSelection
            && shouldUseStableFirstObservationCandidate(rotationKey, poolPlan.observationCandidates, nowMs)
          )
        )
      );
      const selectionPool = shouldUseObservation
        ? poolPlan.observationCandidates
        : (poolPlan.primaryCandidates.length > 0 ? poolPlan.primaryCandidates : poolPlan.observationCandidates);
      const selected = selectStableFirstCandidateByWeight(
        selectionPool,
        requestedByDisplayName ? runtimeModelResolver : mappedModel,
        downstreamPolicy,
        nowMs,
        shouldUseObservation ? `${rotationKey}:observe` : rotationKey,
      );
      if (!selected) return null;
      return await this.finalizeSelectedCandidateForDispatch(
        selected,
        match,
        requestedModel,
        mappedModel,
        downstreamPolicy,
        recordSelection,
        nowIso,
        nowMs,
        rotationKey,
        `${rotationKey}:observe`,
        shouldUseObservation,
        excludeChannelIds,
      );
    }

    const layers = new Map<number, typeof available>();
    for (const candidate of available) {
      const priority = candidate.channel.priority ?? 0;
      if (!layers.has(priority)) layers.set(priority, []);
      layers.get(priority)!.push(candidate);
    }

    const sortedPriorities = Array.from(layers.keys()).sort((a, b) => a - b);
    for (const priority of sortedPriorities) {
      const rawLayer = layers.get(priority) ?? [];
      const breakerFiltered = filterSiteRuntimeBrokenCandidatesByModel(rawLayer, runtimeModelResolver, nowMs);
      const candidates = filterRecentlyFailedCandidates(breakerFiltered.candidates, nowMs);
      const selected = selectWeightedRandomCandidate(
        candidates,
        requestedByDisplayName ? runtimeModelResolver : mappedModel,
        downstreamPolicy,
        nowMs,
      );
      if (!selected) continue;
      const resolved = await this.finalizeSelectedCandidateForDispatch(
        selected,
        match,
        requestedModel,
        mappedModel,
        downstreamPolicy,
        recordSelection,
        nowIso,
        nowMs,
        undefined,
        undefined,
        false,
        excludeChannelIds,
      );
      if (resolved) return resolved;
    }

    return null;
  }

  private async selectPreferredFromMatch(
    match: RouteMatch,
    requestedModel: string,
    preferredChannelId: number,
    downstreamPolicy: DownstreamRoutingPolicy,
    excludeChannelIds: number[] = [],
    recordSelection = true,
  ): Promise<SelectedChannel | null> {
    const mappedModel = resolveMappedModel(requestedModel, match.route.modelMapping);
    const requestedByDisplayName = isRouteDisplayNameMatch(requestedModel, match.route.displayName);
    const bypassSourceModelCheck = requestedByDisplayName;
    const routeStrategy = resolveRouteStrategy(match.route);
    const runtimeModelResolver = requestedByDisplayName
      ? ((candidate: RouteChannelCandidate) => normalizeChannelSourceModel(candidate.channel.sourceModel) || mappedModel)
      : mappedModel;

    const nowIso = new Date().toISOString();
    const nowMs = Date.now();
    const available = match.channels.filter((candidate) => (
      this.getCandidateEligibilityReasons(candidate, {
        requestedModel,
        bypassSourceModelCheck,
        excludeChannelIds,
        nowIso,
        downstreamPolicy,
      }).length === 0
    ));

    const preferred = available.find((candidate) => candidate.channel.id === preferredChannelId);
    if (!preferred) return null;

    const breakerFiltered = filterSiteRuntimeBrokenCandidatesByModel([preferred], runtimeModelResolver, nowMs);
    if (breakerFiltered.candidates.length <= 0) return null;

    const selected = breakerFiltered.candidates.find((candidate) => candidate.channel.id === preferredChannelId);
    if (!selected) return null;
    if (!isOauthRouteUnitCandidate(selected) && routeStrategy !== 'round_robin' && isChannelRecentlyFailed(selected.channel, nowMs)) {
      return null;
    }
    return await this.finalizeSelectedCandidateForDispatch(
      selected,
      match,
      requestedModel,
      mappedModel,
      downstreamPolicy,
      recordSelection && (routeStrategy === 'round_robin' || routeStrategy === 'stable_first'),
      nowIso,
      nowMs,
      routeStrategy === 'stable_first' ? buildStableFirstRotationKey(match.route.id, requestedModel) : undefined,
      routeStrategy === 'stable_first' ? `${buildStableFirstRotationKey(match.route.id, requestedModel)}:observe` : undefined,
      false,
      excludeChannelIds,
    );
  }

  private async findRoute(model: string, downstreamPolicy: DownstreamRoutingPolicy): Promise<RouteMatch | null> {
    return await findTokenRouteMatch(model, downstreamPolicy);
  }

  private async findRouteById(routeId: number, downstreamPolicy: DownstreamRoutingPolicy): Promise<RouteMatch | null> {
    return await findTokenRouteMatchById(routeId, downstreamPolicy);
  }

  private resolveRouteUnitMemberTokenValue(candidate: {
    account: typeof schema.accounts.$inferSelect;
  }): string | null {
    const oauthAccessToken = candidate.account.accessToken?.trim();
    if (oauthAccessToken) return oauthAccessToken;
    const apiToken = candidate.account.apiToken?.trim();
    return apiToken || null;
  }

  private buildRouteUnitMemberDispatchCandidate(
    outerCandidate: RouteChannelCandidate,
    memberCandidate: RouteChannelCandidate['routeUnitMembers'][number],
  ): RouteChannelCandidate {
    return {
      ...outerCandidate,
      account: memberCandidate.account,
      site: memberCandidate.site,
      token: null,
    };
  }

  private getRouteUnitMemberEligibilityReasons(
    outerCandidate: RouteChannelCandidate,
    memberCandidate: RouteChannelCandidate['routeUnitMembers'][number],
    options: CandidateEligibilityOptions,
  ): string[] {
    const reasonParts: string[] = [];
    const bypassSourceModelCheck = options.bypassSourceModelCheck ?? false;
    const nowIso = options.nowIso ?? new Date().toISOString();

    if (!bypassSourceModelCheck && !channelSupportsRequestedModel(outerCandidate.channel.sourceModel, options.requestedModel)) {
      reasonParts.push(`来源模型不匹配=${outerCandidate.channel.sourceModel || ''}`);
    }

    if (!outerCandidate.channel.enabled) reasonParts.push('通道禁用');

    if (memberCandidate.account.status !== 'active') {
      reasonParts.push(`账号状态=${memberCandidate.account.status}`);
    }

    if (isSiteDisabled(memberCandidate.site.status)) {
      reasonParts.push(`站点状态=${memberCandidate.site.status || 'disabled'}`);
    }

    const downstreamExclusionReason = this.resolveDownstreamExclusionReason(
      this.buildRouteUnitMemberDispatchCandidate(outerCandidate, memberCandidate),
      options.downstreamPolicy,
    );
    if (downstreamExclusionReason) {
      reasonParts.push(downstreamExclusionReason);
    }

    const tokenValue = this.resolveRouteUnitMemberTokenValue(memberCandidate);
    if (!tokenValue) reasonParts.push('令牌不可用');

    if (isOauthRouteUnitMemberCoolingDown(memberCandidate.member, nowIso)) {
      reasonParts.push('冷却中');
    }

    return reasonParts;
  }

  private getEligibleRouteUnitMembers(
    candidate: RouteChannelCandidate,
    options: CandidateEligibilityOptions,
  ): RouteChannelCandidate['routeUnitMembers'] {
    if (!isOauthRouteUnitCandidate(candidate)) return [];
    return candidate.routeUnitMembers.filter((memberCandidate) => (
      this.getRouteUnitMemberEligibilityReasons(candidate, memberCandidate, options).length === 0
    ));
  }

  private getRoundRobinRouteUnitMembers(
    members: RouteChannelCandidate['routeUnitMembers'],
  ): RouteChannelCandidate['routeUnitMembers'] {
    return [...members].sort((left, right) => {
      const selectionOrder = compareNullableTimeAsc(
        left.member.lastSelectedAt || left.member.lastUsedAt,
        right.member.lastSelectedAt || right.member.lastUsedAt,
      );
      if (selectionOrder !== 0) return selectionOrder;

      const usedOrder = compareNullableTimeAsc(left.member.lastUsedAt, right.member.lastUsedAt);
      if (usedOrder !== 0) return usedOrder;

      const sortOrder = (left.member.sortOrder ?? 0) - (right.member.sortOrder ?? 0);
      if (sortOrder !== 0) return sortOrder;

      return left.account.id - right.account.id;
    });
  }

  private getStickyPreferredRouteUnitMember(
    members: RouteChannelCandidate['routeUnitMembers'],
  ): RouteChannelCandidate['routeUnitMembers'][number] | null {
    return [...members].sort((left, right) => {
      const selectionOrder = compareNullableTimeDesc(
        left.member.lastSelectedAt || left.member.lastUsedAt,
        right.member.lastSelectedAt || right.member.lastUsedAt,
      );
      if (selectionOrder !== 0) return selectionOrder;

      const sortOrder = (left.member.sortOrder ?? 0) - (right.member.sortOrder ?? 0);
      if (sortOrder !== 0) return sortOrder;

      return left.account.id - right.account.id;
    })[0] ?? null;
  }

  private selectRouteUnitMember(
    candidate: RouteChannelCandidate,
    requestedModel: string,
    downstreamPolicy: DownstreamRoutingPolicy,
    nowIso: string,
    nowMs: number,
    excludeChannelIds: number[] = [],
  ): RouteChannelCandidate['routeUnitMembers'][number] | null {
    if (!isOauthRouteUnitCandidate(candidate)) return null;
    const eligibleMembers = this.getEligibleRouteUnitMembers(candidate, {
      requestedModel,
      bypassSourceModelCheck: true,
      excludeChannelIds: [],
      nowIso,
      downstreamPolicy,
    });
    if (eligibleMembers.length === 0) return null;

    const isRouteUnitFailover = excludeChannelIds.includes(candidate.channel.id);
    const healthyMembers = isRouteUnitFailover
      ? eligibleMembers.filter((memberCandidate) => !isChannelRecentlyFailed(memberCandidate.member, nowMs))
      : filterRecentlyFailedCandidates(
        eligibleMembers.map((memberCandidate) => ({
          memberCandidate,
          channel: memberCandidate.member,
        })),
        nowMs,
      ).map((item) => item.memberCandidate);
    const candidateMembers = healthyMembers.length > 0
      ? healthyMembers
      : (isRouteUnitFailover ? [] : eligibleMembers);
    if (candidate.routeUnit?.strategy === 'stick_until_unavailable') {
      const sticky = this.getStickyPreferredRouteUnitMember(candidateMembers);
      if (sticky) return sticky;
      return this.getRoundRobinRouteUnitMembers(candidateMembers)[0] ?? null;
    }

    return this.getRoundRobinRouteUnitMembers(candidateMembers)[0] ?? null;
  }

  private async recordRouteUnitMemberSelection(
    routeUnitId: number,
    accountId: number,
  ): Promise<void> {
    const nowIso = new Date().toISOString();
    await db.update(schema.oauthRouteUnitMembers).set({
      lastSelectedAt: nowIso,
      updatedAt: nowIso,
    }).where(and(
      eq(schema.oauthRouteUnitMembers.unitId, routeUnitId),
      eq(schema.oauthRouteUnitMembers.accountId, accountId),
    )).run();
    const routeRows = await db.select({
      routeId: schema.routeChannels.routeId,
    }).from(schema.routeChannels)
      .where(eq(schema.routeChannels.oauthRouteUnitId, routeUnitId))
      .all();
    const routeIds: number[] = Array.from(new Set<number>(
      routeRows
        .map((row) => Number(row.routeId))
        .filter((routeId): routeId is number => Number.isFinite(routeId) && routeId > 0),
    ));
    for (const routeId of routeIds) {
      invalidateRouteScopedCache(routeId);
    }
  }

  private resolveChannelTokenValue(candidate: {
    channel: typeof schema.routeChannels.$inferSelect;
    account: typeof schema.accounts.$inferSelect;
    site?: typeof schema.sites.$inferSelect | null;
    token: typeof schema.accountTokens.$inferSelect | null;
  }): string | null {
    if (candidate.channel.tokenId) {
      if (!candidate.token) return null;
      if (!isUsableAccountToken(candidate.token)) return null;
      const token = candidate.token.token?.trim();
      return token ? token : null;
    }

    if (getOauthInfoFromAccount(candidate.account)) {
      const accessToken = candidate.account.accessToken?.trim();
      if (accessToken) return accessToken;
      return null;
    }

    const fallback = candidate.account.apiToken?.trim();
    if (fallback) return fallback;

    return null;
  }

  private resolveDownstreamExclusionReason(
    candidate: RouteChannelCandidate,
    downstreamPolicy?: DownstreamRoutingPolicy,
  ): string | null {
    if (!downstreamPolicy) return null;

    const excludedSiteIds = Array.isArray(downstreamPolicy.excludedSiteIds)
      ? downstreamPolicy.excludedSiteIds
      : [];
    if (excludedSiteIds.includes(candidate.site.id)) {
      return '站点已被下游密钥排除';
    }

    const excludedCredentialRefs = Array.isArray(downstreamPolicy.excludedCredentialRefs)
      ? downstreamPolicy.excludedCredentialRefs
      : [];
    if (excludedCredentialRefs.length <= 0) {
      return null;
    }

    for (const ref of excludedCredentialRefs) {
      if (ref.kind === 'account_token') {
        if (
          candidate.channel.tokenId === ref.tokenId
          && candidate.token?.id === ref.tokenId
          && candidate.account.id === ref.accountId
          && candidate.site.id === ref.siteId
        ) {
          return 'API Key/令牌已被下游密钥排除';
        }
        continue;
      }

      if (
        candidate.channel.tokenId == null
        && candidate.account.id === ref.accountId
        && candidate.site.id === ref.siteId
      ) {
        const resolvedTokenValue = this.resolveChannelTokenValue(candidate);
        const accountApiToken = candidate.account.apiToken?.trim() || '';
        if (resolvedTokenValue && accountApiToken && resolvedTokenValue === accountApiToken) {
          return 'API Key/令牌已被下游密钥排除';
        }
      }
    }

    return null;
  }

  private getCandidateEligibilityReasons(
    candidate: RouteChannelCandidate,
    options: CandidateEligibilityOptions,
  ): string[] {
    const reasonParts: string[] = [];
    const bypassSourceModelCheck = options.bypassSourceModelCheck ?? false;
    const excludeChannelIds = options.excludeChannelIds ?? [];
    const nowIso = options.nowIso ?? new Date().toISOString();

    if (!bypassSourceModelCheck && !channelSupportsRequestedModel(candidate.channel.sourceModel, options.requestedModel)) {
      reasonParts.push(`来源模型不匹配=${candidate.channel.sourceModel || ''}`);
    }

    if (!candidate.channel.enabled) reasonParts.push('通道禁用');

    if (isOauthRouteUnitCandidate(candidate)) {
      if (excludeChannelIds.includes(candidate.channel.id)) {
        // Route-unit failover should stay inside the same outer channel and switch members instead of
        // excluding the entire pool after one member fails.
      }

      if (this.getEligibleRouteUnitMembers(candidate, options).length === 0) {
        reasonParts.push(`路由池成员不可用（${candidate.routeUnit?.name || getOauthRouteUnitStrategyLabel(candidate.routeUnit?.strategy || 'round_robin')}）`);
      }
      return reasonParts;
    }

    if (isExplicitTokenChannel(candidate)) {
      if (candidate.account.status === 'disabled') {
        reasonParts.push(`账号状态=${candidate.account.status}`);
      }
    } else if (candidate.account.status !== 'active') {
      reasonParts.push(`账号状态=${candidate.account.status}`);
    }

    if (isSiteDisabled(candidate.site.status)) {
      reasonParts.push(`站点状态=${candidate.site.status || 'disabled'}`);
    }

    const downstreamExclusionReason = this.resolveDownstreamExclusionReason(candidate, options.downstreamPolicy);
    if (downstreamExclusionReason) {
      reasonParts.push(downstreamExclusionReason);
    }

    if (excludeChannelIds.includes(candidate.channel.id)) {
      reasonParts.push('当前请求已尝试');
    }

    const tokenValue = this.resolveChannelTokenValue(candidate);
    if (!tokenValue) reasonParts.push('令牌不可用');

    if (candidate.channel.cooldownUntil && candidate.channel.cooldownUntil > nowIso) {
      reasonParts.push('冷却中');
    }

    return reasonParts;
  }

  private async recordChannelSelection(channelId: number): Promise<void> {
    const nowIso = new Date().toISOString();
    await db.update(schema.routeChannels).set({
      lastSelectedAt: nowIso,
    }).where(eq(schema.routeChannels.id, channelId)).run();

    patchCachedTokenRouteChannel(channelId, (channel) => {
      channel.lastSelectedAt = nowIso;
    });
  }

  private async finalizeSelectedCandidateForDispatch(
    selected: RouteChannelCandidate,
    match: RouteMatch,
    requestedModel: string,
    mappedModel: string,
    downstreamPolicy: DownstreamRoutingPolicy,
    recordSelection: boolean,
    nowIso: string,
    nowMs: number,
    stableFirstRotationKey?: string,
    stableFirstObservationKey?: string,
    usedObservation = false,
    excludeChannelIds: number[] = [],
  ): Promise<SelectedChannel | null> {
    let dispatchCandidate = selected;
    let resolvedRouteUnitMemberTokenValue: string | null = null;
    if (isOauthRouteUnitCandidate(selected)) {
      const member = this.selectRouteUnitMember(
        selected,
        requestedModel,
        downstreamPolicy,
        nowIso,
        nowMs,
        excludeChannelIds,
      );
      if (!member || !selected.routeUnit) return null;
      resolvedRouteUnitMemberTokenValue = this.resolveRouteUnitMemberTokenValue(member);
      dispatchCandidate = this.buildRouteUnitMemberDispatchCandidate(selected, member);
      if (recordSelection) {
        await this.recordRouteUnitMemberSelection(selected.routeUnit.id, member.account.id);
      }
    }

    const tokenValue = resolvedRouteUnitMemberTokenValue ?? this.resolveChannelTokenValue(dispatchCandidate);
    if (!tokenValue) return null;

    if (recordSelection) {
      if (stableFirstRotationKey && stableFirstObservationKey) {
        rememberStableFirstSiteSelectionForKey(
          usedObservation ? stableFirstObservationKey : stableFirstRotationKey,
          dispatchCandidate.site.id,
        );
        updateStableFirstObservationProgress(stableFirstRotationKey, {
          usedObservation,
          selectedSiteId: dispatchCandidate.site.id,
          nowMs,
        });
      }
      await this.recordChannelSelection(selected.channel.id);
    }

    const actualModel = resolveActualModelForSelectedChannel(
      requestedModel,
      match.route,
      mappedModel,
      selected.channel.sourceModel,
    );

    return {
      ...dispatchCandidate,
      channel: selected.channel,
      tokenValue,
      tokenName: dispatchCandidate.token?.name || 'default',
      actualModel,
    };
  }

}

export const tokenRouter = new TokenRouter();

export const __tokenRouterTestUtils = {
  resolveMappedModel,
  getStableFirstRotationCacheSize,
  rememberStableFirstSiteSelectionForKey,
};

