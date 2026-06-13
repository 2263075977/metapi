import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { getOauthInfoFromAccount } from './oauth/oauthAccount.js';
import { parseCodexQuotaResetHint } from './oauth/quota.js';
import { normalizeRouteRoutingStrategy } from './routeRoutingStrategy.js';
import { patchCachedTokenRouteChannel } from './tokenRouterRouteMatching.js';
import {
  clearRuntimeHealthStatesForChannels,
  ensureSiteRuntimeHealthStateLoaded,
  isUsageLimitRateLimitFailure,
  persistSiteRuntimeHealthState,
  recordSiteRuntimeFailure,
  recordSiteRuntimeSuccess,
  type SiteRuntimeFailureContext,
} from './tokenRouterRuntimeHealth.js';
import {
  clampFailureCooldownMs,
  ROUND_ROBIN_COOLDOWN_LEVEL_COUNT,
  resolveEffectiveFailureCooldownMs,
  resolveRoundRobinCooldownSec,
} from './tokenRouterSelectionEngine.js';

const SHORT_WINDOW_LIMIT_COOLDOWN_MS = 5 * 60 * 1000;
const ROUND_ROBIN_FAILURE_THRESHOLD = 3;

export type TokenRouteOutcomeCacheHooks = {
  invalidateRouteScopedCache: (routeId: number) => void;
  invalidateAllTokenRouterCache: () => void;
};

type RecordTokenRouteSuccessInput = {
  channelId: number;
  latencyMs: number;
  cost: number;
  modelName?: string | null;
  actualAccountId?: number;
  cacheHooks: TokenRouteOutcomeCacheHooks;
};

type RecordTokenRouteProbeSuccessInput = {
  channelId: number;
  latencyMs: number;
  modelName?: string | null;
  actualAccountId?: number;
  cacheHooks: TokenRouteOutcomeCacheHooks;
};

type RecordTokenRouteFailureInput = {
  channelId: number;
  context?: SiteRuntimeFailureContext | string | null;
  actualAccountId?: number;
  cacheHooks: TokenRouteOutcomeCacheHooks;
};

type ClearTokenRouteChannelFailureStateInput = {
  channelIds: number[];
  cacheHooks: TokenRouteOutcomeCacheHooks;
};

export function resolveShortWindowLimitCooldown(
  account: typeof schema.accounts.$inferSelect,
  context: SiteRuntimeFailureContext = {},
  nowMs = Date.now(),
): string | null {
  const status = typeof context.status === 'number' ? context.status : 0;
  const errorText = (context.errorText || '').trim();
  if (!isUsageLimitRateLimitFailure({ status, errorText })) return null;

  const resetHint = parseCodexQuotaResetHint(status, errorText, nowMs);
  if (resetHint) {
    const hintMs = Date.parse(resetHint.resetAt);
    if (Number.isFinite(hintMs) && hintMs > nowMs) {
      return new Date(hintMs).toISOString();
    }
  }

  const oauth = getOauthInfoFromAccount(account);
  const storedResetAt = oauth?.quota?.lastLimitResetAt;
  if (oauth?.provider === 'codex' && storedResetAt) {
    const storedMs = Date.parse(storedResetAt);
    if (Number.isFinite(storedMs) && storedMs > nowMs) {
      return new Date(storedMs).toISOString();
    }
  }

  return new Date(nowMs + SHORT_WINDOW_LIMIT_COOLDOWN_MS).toISOString();
}

async function loadCredentialScopedChannelIds(
  channel: typeof schema.routeChannels.$inferSelect,
  accountId: number,
): Promise<number[]> {
  if (typeof channel.tokenId === 'number' && channel.tokenId > 0) {
    const rows = await db.select({ id: schema.routeChannels.id })
      .from(schema.routeChannels)
      .where(eq(schema.routeChannels.tokenId, channel.tokenId))
      .all();
    return rows.map((row) => row.id);
  }

  const rows = await db.select({ id: schema.routeChannels.id })
    .from(schema.routeChannels)
    .where(and(
      eq(schema.routeChannels.accountId, accountId),
      isNull(schema.routeChannels.tokenId),
    ))
    .all();
  return rows.map((row) => row.id);
}

function resolveTargetAccountId(fallbackAccountId: number, actualAccountId?: number): number {
  return Number.isFinite(actualAccountId) && (actualAccountId ?? 0) > 0
    ? Math.trunc(actualAccountId!)
    : fallbackAccountId;
}

export async function recordTokenRouteSuccess(input: RecordTokenRouteSuccessInput): Promise<void> {
  const { channelId, latencyMs, cost, modelName, actualAccountId, cacheHooks } = input;
  await ensureSiteRuntimeHealthStateLoaded();
  const row = await db.select()
    .from(schema.routeChannels)
    .innerJoin(schema.accounts, eq(schema.routeChannels.accountId, schema.accounts.id))
    .where(eq(schema.routeChannels.id, channelId))
    .get();
  if (!row) return;

  const ch = row.route_channels;
  const account = row.accounts;
  const nowIso = new Date().toISOString();
  const nextSuccessCount = (ch.successCount ?? 0) + 1;
  const nextTotalLatencyMs = (ch.totalLatencyMs ?? 0) + latencyMs;
  const nextTotalCost = (ch.totalCost ?? 0) + cost;
  if (typeof ch.oauthRouteUnitId === 'number' && ch.oauthRouteUnitId > 0) {
    const targetAccountId = resolveTargetAccountId(account.id, actualAccountId);
    const memberRow = await db.select({
      member: schema.oauthRouteUnitMembers,
      account: schema.accounts,
    }).from(schema.oauthRouteUnitMembers)
      .innerJoin(schema.accounts, eq(schema.oauthRouteUnitMembers.accountId, schema.accounts.id))
      .where(and(
        eq(schema.oauthRouteUnitMembers.unitId, ch.oauthRouteUnitId),
        eq(schema.oauthRouteUnitMembers.accountId, targetAccountId),
      ))
      .get();

    if (memberRow) {
      const memberSuccessCount = (memberRow.member.successCount ?? 0) + 1;
      const memberTotalLatencyMs = (memberRow.member.totalLatencyMs ?? 0) + latencyMs;
      const memberTotalCost = (memberRow.member.totalCost ?? 0) + cost;
      await db.update(schema.oauthRouteUnitMembers).set({
        successCount: memberSuccessCount,
        totalLatencyMs: memberTotalLatencyMs,
        totalCost: memberTotalCost,
        lastUsedAt: nowIso,
        cooldownUntil: null,
        lastFailAt: null,
        consecutiveFailCount: 0,
        cooldownLevel: 0,
        updatedAt: nowIso,
      }).where(eq(schema.oauthRouteUnitMembers.id, memberRow.member.id)).run();
      recordSiteRuntimeSuccess(memberRow.account.siteId, latencyMs, modelName);
    } else {
      recordSiteRuntimeSuccess(account.siteId, latencyMs, modelName);
    }
    cacheHooks.invalidateRouteScopedCache(ch.routeId);
  } else {
    recordSiteRuntimeSuccess(account.siteId, latencyMs, modelName);
  }

  await db.update(schema.routeChannels).set({
    successCount: nextSuccessCount,
    totalLatencyMs: nextTotalLatencyMs,
    totalCost: nextTotalCost,
    lastUsedAt: nowIso,
    cooldownUntil: null,
    lastFailAt: null,
    consecutiveFailCount: 0,
    cooldownLevel: 0,
  }).where(eq(schema.routeChannels.id, channelId)).run();

  patchCachedTokenRouteChannel(channelId, (channel) => {
    channel.successCount = nextSuccessCount;
    channel.totalLatencyMs = nextTotalLatencyMs;
    channel.totalCost = nextTotalCost;
    channel.lastUsedAt = nowIso;
    channel.cooldownUntil = null;
    channel.lastFailAt = null;
    channel.consecutiveFailCount = 0;
    channel.cooldownLevel = 0;
  });
}

export async function recordTokenRouteProbeSuccess(input: RecordTokenRouteProbeSuccessInput): Promise<void> {
  const { channelId, latencyMs, modelName, actualAccountId, cacheHooks } = input;
  await ensureSiteRuntimeHealthStateLoaded();
  const row = await db.select()
    .from(schema.routeChannels)
    .innerJoin(schema.accounts, eq(schema.routeChannels.accountId, schema.accounts.id))
    .where(eq(schema.routeChannels.id, channelId))
    .get();
  if (!row) return;

  const ch = row.route_channels;
  const account = row.accounts;
  if (typeof ch.oauthRouteUnitId === 'number' && ch.oauthRouteUnitId > 0) {
    const targetAccountId = resolveTargetAccountId(account.id, actualAccountId);
    const nowIso = new Date().toISOString();
    const memberRow = await db.select({
      member: schema.oauthRouteUnitMembers,
      account: schema.accounts,
    }).from(schema.oauthRouteUnitMembers)
      .innerJoin(schema.accounts, eq(schema.oauthRouteUnitMembers.accountId, schema.accounts.id))
      .where(and(
        eq(schema.oauthRouteUnitMembers.unitId, ch.oauthRouteUnitId),
        eq(schema.oauthRouteUnitMembers.accountId, targetAccountId),
      ))
      .get();

    if (memberRow) {
      await db.update(schema.oauthRouteUnitMembers).set({
        cooldownUntil: null,
        lastFailAt: null,
        consecutiveFailCount: 0,
        cooldownLevel: 0,
        updatedAt: nowIso,
      }).where(eq(schema.oauthRouteUnitMembers.id, memberRow.member.id)).run();
      recordSiteRuntimeSuccess(memberRow.account.siteId, latencyMs, modelName);
    } else {
      recordSiteRuntimeSuccess(account.siteId, latencyMs, modelName);
    }

    await db.update(schema.routeChannels).set({
      cooldownUntil: null,
      lastFailAt: null,
      consecutiveFailCount: 0,
      cooldownLevel: 0,
    }).where(eq(schema.routeChannels.id, channelId)).run();
    patchCachedTokenRouteChannel(channelId, (channel) => {
      channel.cooldownUntil = null;
      channel.lastFailAt = null;
      channel.consecutiveFailCount = 0;
      channel.cooldownLevel = 0;
    });
    cacheHooks.invalidateRouteScopedCache(ch.routeId);
    return;
  }

  const affectedChannelIds = await loadCredentialScopedChannelIds(ch, account.id);
  const needsChannelReset = !!ch.cooldownUntil
    || !!ch.lastFailAt
    || (ch.consecutiveFailCount ?? 0) > 0
    || (ch.cooldownLevel ?? 0) > 0;

  if (needsChannelReset) {
    await db.update(schema.routeChannels).set({
      cooldownUntil: null,
      lastFailAt: null,
      consecutiveFailCount: 0,
      cooldownLevel: 0,
    }).where(inArray(schema.routeChannels.id, affectedChannelIds)).run();

    for (const affectedChannelId of affectedChannelIds) {
      patchCachedTokenRouteChannel(affectedChannelId, (channel) => {
        channel.cooldownUntil = null;
        channel.lastFailAt = null;
        channel.consecutiveFailCount = 0;
        channel.cooldownLevel = 0;
      });
    }
  } else if (affectedChannelIds.length > 1) {
    const scopedRows = await db.select({
      id: schema.routeChannels.id,
      cooldownUntil: schema.routeChannels.cooldownUntil,
      lastFailAt: schema.routeChannels.lastFailAt,
      consecutiveFailCount: schema.routeChannels.consecutiveFailCount,
      cooldownLevel: schema.routeChannels.cooldownLevel,
    })
      .from(schema.routeChannels)
      .where(inArray(schema.routeChannels.id, affectedChannelIds))
      .all();
    const siblingIdsToReset = scopedRows
      .filter((candidate) => candidate.id !== channelId && (
        !!candidate.cooldownUntil
        || !!candidate.lastFailAt
        || (candidate.consecutiveFailCount ?? 0) > 0
        || (candidate.cooldownLevel ?? 0) > 0
      ))
      .map((candidate) => candidate.id);

    if (siblingIdsToReset.length > 0) {
      await db.update(schema.routeChannels).set({
        cooldownUntil: null,
        lastFailAt: null,
        consecutiveFailCount: 0,
        cooldownLevel: 0,
      }).where(inArray(schema.routeChannels.id, siblingIdsToReset)).run();

      for (const siblingId of siblingIdsToReset) {
        patchCachedTokenRouteChannel(siblingId, (channel) => {
          channel.cooldownUntil = null;
          channel.lastFailAt = null;
          channel.consecutiveFailCount = 0;
          channel.cooldownLevel = 0;
        });
      }
    }
  }

  recordSiteRuntimeSuccess(account.siteId, latencyMs, modelName);
}

export async function clearTokenRouteChannelFailureState(
  input: ClearTokenRouteChannelFailureStateInput,
): Promise<number> {
  const { channelIds, cacheHooks } = input;
  const normalizedChannelIds = Array.from(new Set(
    channelIds
      .filter((channelId): channelId is number => Number.isFinite(channelId) && channelId > 0)
      .map((channelId) => Math.trunc(channelId)),
  ));
  if (normalizedChannelIds.length === 0) return 0;

  await ensureSiteRuntimeHealthStateLoaded();
  const runtimeHealthRows = await db.select({
    siteId: schema.accounts.siteId,
    sourceModel: schema.routeChannels.sourceModel,
    routeModelPattern: schema.tokenRoutes.modelPattern,
  }).from(schema.routeChannels)
    .innerJoin(schema.accounts, eq(schema.routeChannels.accountId, schema.accounts.id))
    .innerJoin(schema.tokenRoutes, eq(schema.routeChannels.routeId, schema.tokenRoutes.id))
    .where(inArray(schema.routeChannels.id, normalizedChannelIds))
    .all();

  const result = await db.update(schema.routeChannels).set({
    failCount: 0,
    lastFailAt: null,
    consecutiveFailCount: 0,
    cooldownLevel: 0,
    cooldownUntil: null,
  }).where(inArray(schema.routeChannels.id, normalizedChannelIds)).run();

  if (clearRuntimeHealthStatesForChannels(runtimeHealthRows)) {
    await persistSiteRuntimeHealthState();
  }

  cacheHooks.invalidateAllTokenRouterCache();
  return Number(result?.changes || normalizedChannelIds.length);
}

export async function recordTokenRouteFailure(input: RecordTokenRouteFailureInput): Promise<void> {
  const { channelId, context = {}, actualAccountId, cacheHooks } = input;
  await ensureSiteRuntimeHealthStateLoaded();
  const row = await db.select()
    .from(schema.routeChannels)
    .innerJoin(schema.accounts, eq(schema.routeChannels.accountId, schema.accounts.id))
    .innerJoin(schema.tokenRoutes, eq(schema.routeChannels.routeId, schema.tokenRoutes.id))
    .where(eq(schema.routeChannels.id, channelId))
    .get();
  if (!row) return;

  const ch = row.route_channels;
  const account = row.accounts;
  const route = row.token_routes;
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const normalizedContext: SiteRuntimeFailureContext = typeof context === 'string'
    ? { modelName: context }
    : (context ?? {});
  if (typeof ch.oauthRouteUnitId === 'number' && ch.oauthRouteUnitId > 0) {
    const targetAccountId = resolveTargetAccountId(account.id, actualAccountId);
    const memberRow = await db.select({
      member: schema.oauthRouteUnitMembers,
      account: schema.accounts,
      unit: schema.oauthRouteUnits,
    }).from(schema.oauthRouteUnitMembers)
      .innerJoin(schema.accounts, eq(schema.oauthRouteUnitMembers.accountId, schema.accounts.id))
      .innerJoin(schema.oauthRouteUnits, eq(schema.oauthRouteUnitMembers.unitId, schema.oauthRouteUnits.id))
      .where(and(
        eq(schema.oauthRouteUnitMembers.unitId, ch.oauthRouteUnitId),
        eq(schema.oauthRouteUnitMembers.accountId, targetAccountId),
      ))
      .get();
    if (memberRow) {
      const shortWindowLimitCooldownUntil = resolveShortWindowLimitCooldown(memberRow.account, normalizedContext, nowMs);
      const failCount = shortWindowLimitCooldownUntil ? 0 : ((memberRow.member.failCount ?? 0) + 1);
      const routeUnitStrategy = memberRow.unit.strategy === 'stick_until_unavailable'
        ? 'stick_until_unavailable'
        : 'round_robin';
      let cooldownUntil: string | null = null;
      let consecutiveFailCount = Math.max(0, memberRow.member.consecutiveFailCount ?? 0) + 1;
      let cooldownLevel = Math.max(0, memberRow.member.cooldownLevel ?? 0);

      if (shortWindowLimitCooldownUntil) {
        cooldownUntil = shortWindowLimitCooldownUntil;
        consecutiveFailCount = 0;
        cooldownLevel = 0;
      } else if (routeUnitStrategy === 'round_robin') {
        if (consecutiveFailCount >= ROUND_ROBIN_FAILURE_THRESHOLD) {
          cooldownLevel = Math.min(cooldownLevel + 1, ROUND_ROBIN_COOLDOWN_LEVEL_COUNT - 1);
          const cooldownSec = resolveRoundRobinCooldownSec(cooldownLevel);
          cooldownUntil = cooldownSec > 0
            ? new Date(nowMs + clampFailureCooldownMs(cooldownSec * 1000)).toISOString()
            : null;
          consecutiveFailCount = 0;
        }
      } else {
        cooldownUntil = new Date(nowMs + resolveEffectiveFailureCooldownMs(failCount)).toISOString();
        consecutiveFailCount = 0;
        cooldownLevel = 0;
      }

      await db.update(schema.oauthRouteUnitMembers).set({
        failCount,
        lastFailAt: nowIso,
        consecutiveFailCount,
        cooldownLevel,
        cooldownUntil,
        updatedAt: nowIso,
      }).where(eq(schema.oauthRouteUnitMembers.id, memberRow.member.id)).run();
      recordSiteRuntimeFailure(memberRow.account.siteId, normalizedContext, nowMs);
      cacheHooks.invalidateRouteScopedCache(route.id);
      return;
    }
  }

  const shortWindowLimitCooldownUntil = resolveShortWindowLimitCooldown(account, normalizedContext, nowMs);
  const failCount = shortWindowLimitCooldownUntil ? 0 : ((ch.failCount ?? 0) + 1);
  const routeStrategy = normalizeRouteRoutingStrategy(route.routingStrategy);
  const affectedChannelIds = shortWindowLimitCooldownUntil
    ? await loadCredentialScopedChannelIds(ch, account.id)
    : [channelId];
  let cooldownUntil: string | null = null;
  let consecutiveFailCount = Math.max(0, ch.consecutiveFailCount ?? 0) + 1;
  let cooldownLevel = Math.max(0, ch.cooldownLevel ?? 0);

  if (shortWindowLimitCooldownUntil) {
    cooldownUntil = shortWindowLimitCooldownUntil;
    consecutiveFailCount = 0;
    cooldownLevel = 0;
  } else if (routeStrategy === 'round_robin') {
    if (consecutiveFailCount >= ROUND_ROBIN_FAILURE_THRESHOLD) {
      cooldownLevel = Math.min(cooldownLevel + 1, ROUND_ROBIN_COOLDOWN_LEVEL_COUNT - 1);
      const cooldownSec = resolveRoundRobinCooldownSec(cooldownLevel);
      cooldownUntil = cooldownSec > 0
        ? new Date(nowMs + clampFailureCooldownMs(cooldownSec * 1000)).toISOString()
        : null;
      consecutiveFailCount = 0;
    }
  } else {
    cooldownUntil = new Date(nowMs + resolveEffectiveFailureCooldownMs(failCount)).toISOString();
    consecutiveFailCount = 0;
    cooldownLevel = 0;
  }

  await db.update(schema.routeChannels).set({
    failCount,
    lastFailAt: nowIso,
    consecutiveFailCount,
    cooldownLevel,
    cooldownUntil,
  }).where(inArray(schema.routeChannels.id, affectedChannelIds)).run();

  for (const affectedChannelId of affectedChannelIds) {
    patchCachedTokenRouteChannel(affectedChannelId, (channel) => {
      channel.failCount = failCount;
      channel.lastFailAt = nowIso;
      channel.cooldownUntil = cooldownUntil;
      channel.consecutiveFailCount = consecutiveFailCount;
      channel.cooldownLevel = cooldownLevel;
    });
  }

  recordSiteRuntimeFailure(account.siteId, normalizedContext, nowMs);
}
