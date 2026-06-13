import type { DownstreamRoutingPolicy } from '../services/downstreamPolicyTypes.js';
import { reportProxyAllFailed } from '../services/alertService.js';
import { tokenRouter } from '../services/tokenRouter.js';
import { normalizeForcedChannelId } from './channelSelection.js';

export async function hasAvailableRouteFailoverChannel(input: {
  requestedModel: string;
  downstreamPolicy: DownstreamRoutingPolicy;
  excludeChannelIds: number[];
  forcedChannelId?: number | null;
}): Promise<boolean> {
  if (normalizeForcedChannelId(input.forcedChannelId) !== null) return false;

  const explainSelection = (tokenRouter as {
    explainSelection?: typeof tokenRouter.explainSelection;
  }).explainSelection;
  if (!explainSelection) return false;

  const decision = await explainSelection.call(
    tokenRouter,
    input.requestedModel,
    input.excludeChannelIds,
    input.downstreamPolicy,
  );
  return typeof decision.selectedChannelId === 'number' && decision.selectedChannelId > 0;
}

export async function reportProxyAllFailedIfRouteExhausted(input: {
  requestedModel: string;
  reason: string;
  downstreamPolicy: DownstreamRoutingPolicy;
  excludeChannelIds: number[];
  forcedChannelId?: number | null;
}): Promise<boolean> {
  if (normalizeForcedChannelId(input.forcedChannelId) !== null) return false;
  if (await hasAvailableRouteFailoverChannel(input)) return false;

  await reportProxyAllFailed({
    model: input.requestedModel,
    reason: input.reason,
  });
  return true;
}
