import { eq, inArray } from 'drizzle-orm';
import { config } from '../config.js';
import { db, schema } from '../db/index.js';
import { type DownstreamRoutingPolicy } from './downstreamPolicyTypes.js';
import {
  listOauthRouteUnitMembersByUnitIds,
  loadOauthRouteUnitSummariesByIds,
  type OAuthRouteUnitSummary,
} from './oauth/routeUnitService.js';
import {
  isExactTokenRouteModelPattern,
  isTokenRouteRegexPattern,
  matchesTokenRouteModelPattern,
  parseTokenRouteRegexPattern,
} from '../../shared/tokenRoutePatterns.js';
import {
  normalizeTokenRouteMode,
  type RouteMode,
} from '../../shared/tokenRouteContract.js';

export type TokenRouterRouteRow = typeof schema.tokenRoutes.$inferSelect & {
  routeMode: RouteMode;
  sourceRouteIds: number[];
};

export type TokenRouterChannelRow = typeof schema.routeChannels.$inferSelect;

export interface TokenRouterRouteMatch {
  route: TokenRouterRouteRow;
  channels: Array<{
    channel: typeof schema.routeChannels.$inferSelect;
    account: typeof schema.accounts.$inferSelect;
    site: typeof schema.sites.$inferSelect;
    token: typeof schema.accountTokens.$inferSelect | null;
    routeUnit: OAuthRouteUnitSummary | null;
    routeUnitMembers: Array<{
      member: typeof schema.oauthRouteUnitMembers.$inferSelect;
      account: typeof schema.accounts.$inferSelect;
      site: typeof schema.sites.$inferSelect;
      token: null;
    }>;
  }>;
}

export type TokenRouterRouteChannelCandidate = TokenRouterRouteMatch['channels'][number];

type RouteCacheSnapshot = {
  loadedAt: number;
  routes: TokenRouterRouteRow[];
};

type RouteMatchCacheSnapshot = {
  loadedAt: number;
  match: TokenRouterRouteMatch;
};

let routeCacheSnapshot: RouteCacheSnapshot = {
  loadedAt: 0,
  routes: [],
};

const routeMatchCache = new Map<number, RouteMatchCacheSnapshot>();

function resolveTokenRouterCacheTtlMs(): number {
  const raw = Math.trunc(config.tokenRouterCacheTtlMs || 0);
  return Math.max(100, raw);
}

function isCacheFresh(loadedAt: number, nowMs: number): boolean {
  return nowMs - loadedAt < resolveTokenRouterCacheTtlMs();
}

export function isRegexModelPattern(pattern: string): boolean {
  return isTokenRouteRegexPattern(pattern);
}

export function parseRegexModelPattern(pattern: string): { test(value: string): boolean } | null {
  return parseTokenRouteRegexPattern(pattern).regex;
}

export function matchesModelPattern(model: string, pattern: string): boolean {
  return matchesTokenRouteModelPattern(model, pattern);
}

export function isExactRouteModelPattern(pattern: string): boolean {
  return isExactTokenRouteModelPattern(pattern);
}

function normalizeRouteMode(routeMode: string | null | undefined): RouteMode {
  return normalizeTokenRouteMode(routeMode);
}

export function isExplicitGroupRoute(
  route: Pick<TokenRouterRouteRow, 'routeMode'> | Pick<typeof schema.tokenRoutes.$inferSelect, 'routeMode'>,
): boolean {
  return normalizeRouteMode(route.routeMode) === 'explicit_group';
}

export function normalizeRouteDisplayName(displayName: string | null | undefined): string {
  return (displayName || '').trim();
}

export function isRouteDisplayNameMatch(model: string, displayName: string | null | undefined): boolean {
  const alias = normalizeRouteDisplayName(displayName);
  return !!alias && alias === model;
}

function getExposedModelNameForRoute(route: TokenRouterRouteRow): string {
  return normalizeRouteDisplayName(route.displayName) || route.modelPattern;
}

function hasCustomDisplayName(route: Pick<TokenRouterRouteRow, 'modelPattern' | 'displayName'>): boolean {
  const displayName = normalizeRouteDisplayName(route.displayName);
  const modelPattern = (route.modelPattern || '').trim();
  return !!displayName && displayName !== modelPattern;
}

function buildVisibleEnabledRoutes(routes: TokenRouterRouteRow[]): TokenRouterRouteRow[] {
  const exactModelNames = new Set(
    routes
      .filter((route) => !isExplicitGroupRoute(route) && isExactRouteModelPattern(route.modelPattern))
      .map((route) => (route.modelPattern || '').trim())
      .filter(Boolean),
  );
  const coveringGroups = routes.filter((route) => (
    route.enabled
    && (
      (isExplicitGroupRoute(route) && normalizeRouteDisplayName(route.displayName).length > 0 && route.sourceRouteIds.length > 0)
      || (!isExplicitGroupRoute(route) && !isExactRouteModelPattern(route.modelPattern) && hasCustomDisplayName(route))
    )
  ));

  if (coveringGroups.length === 0) return routes;

  return routes.filter((route) => {
    if (isExplicitGroupRoute(route)) {
      return normalizeRouteDisplayName(route.displayName).length > 0;
    }
    if (!isExactRouteModelPattern(route.modelPattern)) return true;
    if (hasCustomDisplayName(route)) return true;

    const exactModel = (route.modelPattern || '').trim();
    if (!exactModel) return true;

    return !coveringGroups.some((groupRoute) => {
      if (groupRoute.id === route.id) return false;
      const groupDisplayName = normalizeRouteDisplayName(groupRoute.displayName);
      if (!groupDisplayName || exactModelNames.has(groupDisplayName)) return false;
      if (isExplicitGroupRoute(groupRoute)) {
        return groupRoute.sourceRouteIds.includes(route.id);
      }
      return matchesModelPattern(exactModel, groupRoute.modelPattern);
    });
  });
}

export function normalizeModelAlias(modelName: string): string {
  const normalized = (modelName || '').trim().toLowerCase();
  if (!normalized) return '';
  const slashIndex = normalized.lastIndexOf('/');
  if (slashIndex >= 0 && slashIndex < normalized.length - 1) {
    return normalized.slice(slashIndex + 1);
  }
  return normalized;
}

function isModelAliasEquivalent(left: string, right: string): boolean {
  const a = normalizeModelAlias(left);
  const b = normalizeModelAlias(right);
  return !!a && !!b && a === b;
}

export function channelSupportsRequestedModel(channelSourceModel: string | null | undefined, requestedModel: string): boolean {
  const source = (channelSourceModel || '').trim();
  if (!source) return true;
  if (source === requestedModel) return true;
  if (isModelAliasEquivalent(source, requestedModel)) return true;
  if (matchesModelPattern(requestedModel, source)) return true;
  return false;
}

export function isModelAllowedByDownstreamPolicy(requestedModel: string, policy: DownstreamRoutingPolicy): boolean {
  const supportedPatterns = Array.isArray(policy.supportedModels)
    ? policy.supportedModels
    : [];
  const hasSupportedPatterns = supportedPatterns.length > 0;
  const hasAllowedRoutes = policy.allowedRouteIds.length > 0;
  if (!hasSupportedPatterns && !hasAllowedRoutes) return policy.denyAllWhenEmpty === true ? false : true;
  const matchedSupportedPattern = supportedPatterns.some((pattern) => matchesModelPattern(requestedModel, pattern));
  if (matchedSupportedPattern) return true;
  if (hasAllowedRoutes) return true;
  return false;
}

function parseModelMappingRecord(modelMapping?: string | Record<string, unknown> | null): Record<string, unknown> | null {
  if (!modelMapping) return null;
  if (typeof modelMapping === 'object' && !Array.isArray(modelMapping)) {
    return modelMapping as Record<string, unknown>;
  }
  if (typeof modelMapping !== 'string') return null;
  try {
    const parsed = JSON.parse(modelMapping);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function resolveMappedModel(requestedModel: string, modelMapping?: string | Record<string, unknown> | null): string {
  const parsed = parseModelMappingRecord(modelMapping);
  if (!parsed) return requestedModel;

  const entries = Object.entries(parsed)
    .filter(([, value]) => typeof value === 'string' && value.trim().length > 0) as Array<[string, string]>;

  const exact = entries.find(([pattern]) => pattern === requestedModel);
  if (exact) return exact[1].trim();

  for (const [pattern, target] of entries) {
    if (matchesModelPattern(requestedModel, pattern)) {
      return target.trim();
    }
  }

  return requestedModel;
}

export function normalizeChannelSourceModel(channelSourceModel: string | null | undefined): string {
  return (channelSourceModel || '').trim();
}

export function resolveActualModelForSelectedChannel(
  requestedModel: string,
  route: TokenRouterRouteRow,
  mappedModel: string,
  channelSourceModel: string | null | undefined,
): string {
  const sourceModel = normalizeChannelSourceModel(channelSourceModel);
  if (isRouteDisplayNameMatch(requestedModel, route.displayName) && sourceModel) {
    return sourceModel;
  }
  return mappedModel;
}

export async function loadEnabledTokenRoutes(nowMs = Date.now()): Promise<TokenRouterRouteRow[]> {
  if (isCacheFresh(routeCacheSnapshot.loadedAt, nowMs)) {
    return routeCacheSnapshot.routes;
  }

  const rawRoutes = await db.select().from(schema.tokenRoutes)
    .where(eq(schema.tokenRoutes.enabled, true))
    .all();
  const explicitGroupRouteIds = rawRoutes
    .filter((route) => normalizeRouteMode(route.routeMode) === 'explicit_group')
    .map((route) => route.id);
  const sourceRows = explicitGroupRouteIds.length > 0
    ? await db.select().from(schema.routeGroupSources)
      .where(inArray(schema.routeGroupSources.groupRouteId, explicitGroupRouteIds))
      .all()
    : [];
  const sourceIdsByRouteId = new Map<number, number[]>();
  for (const row of sourceRows) {
    if (!sourceIdsByRouteId.has(row.groupRouteId)) {
      sourceIdsByRouteId.set(row.groupRouteId, []);
    }
    sourceIdsByRouteId.get(row.groupRouteId)!.push(row.sourceRouteId);
  }
  const routes = rawRoutes.map((route) => ({
    ...route,
    routeMode: normalizeRouteMode(route.routeMode),
    sourceRouteIds: Array.from(new Set(sourceIdsByRouteId.get(route.id) ?? [])),
  }));
  routeCacheSnapshot = {
    loadedAt: nowMs,
    routes,
  };
  return routes;
}

export async function loadTokenRouteMatch(route: TokenRouterRouteRow, nowMs = Date.now()): Promise<TokenRouterRouteMatch> {
  const cached = routeMatchCache.get(route.id);
  if (cached && isCacheFresh(cached.loadedAt, nowMs)) {
    return cached.match;
  }

  const enabledRoutes = await loadEnabledTokenRoutes(nowMs);
  const routeIds = (() => {
    if (!isExplicitGroupRoute(route)) {
      return [route.id];
    }
    return Array.from(new Set(route.sourceRouteIds.filter((routeId) => Number.isFinite(routeId) && routeId > 0)));
  })();
  const enabledSourceRoutes = isExplicitGroupRoute(route)
    ? enabledRoutes.filter((item) => (
      routeIds.includes(item.id)
      && !isExplicitGroupRoute(item)
      && isExactRouteModelPattern(item.modelPattern)
    ))
    : enabledRoutes.filter((item) => routeIds.includes(item.id));
  const enabledSourceRouteIds = enabledSourceRoutes.map((item) => item.id);
  const fallbackSourceModelByRouteId = new Map<number, string>(
    enabledSourceRoutes
      .filter((item) => isExactRouteModelPattern(item.modelPattern))
      .map((item) => [item.id, (item.modelPattern || '').trim()]),
  );
  const channels = enabledSourceRouteIds.length > 0
    ? await db
      .select()
      .from(schema.routeChannels)
      .innerJoin(schema.accounts, eq(schema.routeChannels.accountId, schema.accounts.id))
      .innerJoin(schema.sites, eq(schema.accounts.siteId, schema.sites.id))
      .leftJoin(schema.accountTokens, eq(schema.routeChannels.tokenId, schema.accountTokens.id))
      .where(inArray(schema.routeChannels.routeId, enabledSourceRouteIds))
      .all()
    : [];

  const oauthRouteUnitIds: number[] = Array.from(new Set<number>(
    channels
      .map((row) => Number(row.route_channels.oauthRouteUnitId))
      .filter((id): id is number => Number.isFinite(id) && id > 0),
  ));
  const [routeUnitSummaries, routeUnitMembersByUnitId] = await Promise.all([
    loadOauthRouteUnitSummariesByIds(oauthRouteUnitIds),
    listOauthRouteUnitMembersByUnitIds(oauthRouteUnitIds),
  ]);

  const mapped = channels.map((row) => ({
    channel: {
      ...row.route_channels,
      sourceModel: normalizeChannelSourceModel(row.route_channels.sourceModel)
        || fallbackSourceModelByRouteId.get(row.route_channels.routeId)
        || null,
    },
    account: row.accounts,
    site: row.sites,
    token: row.account_tokens,
    routeUnit: row.route_channels.oauthRouteUnitId
      ? (routeUnitSummaries.get(row.route_channels.oauthRouteUnitId) || null)
      : null,
    routeUnitMembers: row.route_channels.oauthRouteUnitId
      ? (routeUnitMembersByUnitId.get(row.route_channels.oauthRouteUnitId) || []).map((member) => ({
        member: member.member,
        account: member.account,
        site: member.site,
        token: null,
      }))
      : [],
  }));

  const match = { route, channels: mapped };
  routeMatchCache.set(route.id, {
    loadedAt: nowMs,
    match,
  });
  return match;
}

export function patchCachedTokenRouteChannel(channelId: number, apply: (channel: TokenRouterChannelRow) => void): void {
  for (const entry of routeMatchCache.values()) {
    const target = entry.match.channels.find((item) => item.channel.id === channelId);
    if (!target) continue;
    apply(target.channel);
    break;
  }
}

export function invalidateTokenRouteMatch(routeId: number): void {
  if (!Number.isFinite(routeId) || routeId <= 0) return;
  routeMatchCache.delete(routeId);
}

export function invalidateTokenRouteMatchingCache(): void {
  routeCacheSnapshot = {
    loadedAt: 0,
    routes: [],
  };
  routeMatchCache.clear();
}

export async function findTokenRouteMatch(
  model: string,
  downstreamPolicy: DownstreamRoutingPolicy,
): Promise<TokenRouterRouteMatch | null> {
  let routes = await loadEnabledTokenRoutes();

  const supportedPatterns = Array.isArray(downstreamPolicy.supportedModels)
    ? downstreamPolicy.supportedModels
    : [];
  const matchedSupportedPattern = supportedPatterns.some((pattern) => matchesModelPattern(model, pattern));

  if (downstreamPolicy.allowedRouteIds.length > 0 && !matchedSupportedPattern) {
    const allowSet = new Set(downstreamPolicy.allowedRouteIds);
    routes = routes.filter((route) => allowSet.has(route.id));
  }

  const matchedRoute = routes.find((route) => isExplicitGroupRoute(route) && isRouteDisplayNameMatch(model, route.displayName))
    || routes.find((route) => (
      !isExplicitGroupRoute(route)
      && isExactRouteModelPattern(route.modelPattern)
      && (route.modelPattern || '').trim() === model
    ))
    || routes.find((route) => !isExplicitGroupRoute(route) && isRouteDisplayNameMatch(model, route.displayName))
    || routes.find((route) => !isExplicitGroupRoute(route) && matchesModelPattern(model, route.modelPattern));

  if (!matchedRoute) return null;

  return await loadTokenRouteMatch(matchedRoute);
}

export async function findTokenRouteMatchById(
  routeId: number,
  downstreamPolicy: DownstreamRoutingPolicy,
): Promise<TokenRouterRouteMatch | null> {
  if (downstreamPolicy.allowedRouteIds.length > 0 && !downstreamPolicy.allowedRouteIds.includes(routeId)) {
    return null;
  }

  const route = (await loadEnabledTokenRoutes()).find((item) => item.id === routeId);
  if (!route) return null;

  return await loadTokenRouteMatch(route);
}

export async function getVisibleEnabledTokenRouteModelNames(): Promise<string[]> {
  const routes = await loadEnabledTokenRoutes();
  const exposed = buildVisibleEnabledRoutes(routes)
    .map((route) => getExposedModelNameForRoute(route).trim())
    .filter((name) => name.length > 0);
  return Array.from(new Set(exposed));
}
