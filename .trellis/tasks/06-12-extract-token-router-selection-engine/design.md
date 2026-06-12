# Extract Token Router Selection Engine Design

## Boundary

Move route candidate selection ownership from
`src/server/services/tokenRouter.ts` into a focused service module:

- `src/server/services/tokenRouterSelectionEngine.ts`

The new module owns:

- weighted-route contribution and probability calculation
- route-priority layer selection
- round-robin candidate ordering
- stable-first pool planning, observation cadence, and rotation caches
- site historical health scoring from route-channel counters
- effective unit-cost selection signals
- runtime-load multipliers from `proxyChannelCoordinator`
- selection-facing route decision probability details and reason strings
- recently-failed avoidance helpers used by weighted and stable-first paths

`src/server/services/tokenRouter.ts` remains the public facade. Existing callers
continue importing from `tokenRouter.ts`, including:

- `TokenRouter`
- `tokenRouter`
- `isChannelRecentlyFailed`
- `filterRecentlyFailedCandidates`
- `invalidateTokenRouterCache`
- `resetSiteRuntimeHealthState`
- `__tokenRouterTestUtils.getStableFirstRotationCacheSize`
- `__tokenRouterTestUtils.rememberStableFirstSiteSelectionForKey`

Route lookup stays in `tokenRouterRouteMatching.ts`. Runtime health details stay
in `tokenRouterRuntimeHealth.ts`. Outcome recording and cooldown table writes
stay in `tokenRouter.ts` until the outcome-cooldowns child.

## Contracts

### Selection Request Contract

The extracted module should select among already-eligible route-channel
candidates. The facade remains responsible for route lookup, candidate
eligibility, token resolution, OAuth route-unit member dispatch, and database
writes.

The intended selection input is:

```typescript
{
  match: TokenRouterRouteMatch;
  requestedModel: string;
  mappedModel: string;
  downstreamPolicy: DownstreamRoutingPolicy;
  routeStrategy: RouteRoutingStrategy;
  candidates: TokenRouterRouteChannelCandidate[];
  runtimeModelResolver: string | ((candidate: TokenRouterRouteChannelCandidate) => string);
  nowMs?: number;
  recordSelection?: boolean;
  preferredChannelId?: number;
}
```

The intended selection result is:

```typescript
{
  selected: TokenRouterRouteChannelCandidate | null;
  routeStrategy: RouteRoutingStrategy;
  selectionMode: 'weighted' | 'round_robin' | 'stable_first';
  stableFirstRotationKey?: string;
  stableFirstObservationKey?: string;
  usedStableFirstObservation?: boolean;
  probabilityDetails: Array<{
    candidate: TokenRouterRouteChannelCandidate;
    probability: number;
    reason: string;
  }>;
  avoidedByRecentFailure: TokenRouterRouteChannelCandidate[];
  avoidedByRuntimeBreaker: Array<{
    candidate: TokenRouterRouteChannelCandidate;
    reason: string;
  }>;
  summaryParts: string[];
}
```

The facade can use this result to build the existing `SelectedChannel` return
value and the route-decision explanation payload without changing public
contracts.

### Module API

The intended internal API is:

- `selectTokenRouteCandidate(input): TokenRouteSelectionResult`
- `explainTokenRouteSelection(input): TokenRouteSelectionExplanation`
- `buildStableFirstRotationKey(routeId, requestedModel): string`
- `rememberStableFirstSiteSelectionForKey(rotationKey, siteId): void`
- `updateStableFirstObservationProgressForSelection(input): void`
- `clearTokenRouterSelectionCachesForRoute(routeId): void`
- `clearTokenRouterSelectionCaches(): void`
- `resetTokenRouterSelectionState(): void`
- `getStableFirstRotationCacheSize(): number`
- `isChannelRecentlyFailed(channel, nowMs?, avoidSec?): boolean`
- `filterRecentlyFailedCandidates(candidates, nowMs?, avoidSec?): candidates`

`tokenRouter.ts` should keep compatibility re-exports or wrappers for public and
test-facing helpers.

## Data Flow

1. `TokenRouter.selectFromMatch()` resolves route strategy, mapped model,
   display-name model handling, and eligible candidates.
2. The facade passes eligible candidates to `selectTokenRouteCandidate()`.
3. The selection engine applies runtime breaker filtering, recent-failure
   avoidance, route-priority layering, weighted contribution scoring,
   round-robin ordering, or stable-first pool planning.
4. The facade resolves OAuth route-unit members and token values after an outer
   candidate has been selected.
5. After successful dispatch finalization, the facade records channel/member
   selection timestamps and calls the selection engine to update stable-first
   rotation and observation cache state.
6. Route-decision explanation code delegates probability calculation and reason
   text for selected/available candidates to the selection engine, while the
   facade preserves the existing payload shape and summary ordering.

## Compatibility

- Do not change public HTTP APIs, route decision payload field names, database
  schema, or routing semantics.
- Preserve weighted random behavior, including use of `Math.random()` and the
  current contribution order.
- Preserve route-priority behavior: weighted selection only selects from the
  first priority layer that yields a selected candidate.
- Preserve round-robin ordering by `lastSelectedAt || lastUsedAt`, then
  `lastUsedAt`, then channel id.
- Preserve stable-first primary/observation pool behavior, observation interval,
  observation cooldown, site rotation cache behavior, and test utility access.
- Preserve downstream site-weight multipliers, site global weight, runtime
  health multiplier, runtime load multiplier, historical health multiplier, and
  fallback-cost penalty.
- Preserve route decision reason strings and user-facing Chinese summary text
  unless a targeted snapshot test is updated with an explicit compatibility
  decision.
- Preserve OAuth route-unit member selection behavior in the facade unless the
  extraction can move it without coupling selection to cooldown recording.

## Risks

- Moving stable-first cache state changes invalidation ownership. Keep explicit
  cache functions and have `tokenRouter.ts` call both route-match invalidation
  and selection-cache invalidation until the facade cleanup child.
- Explanation and dispatch selection currently duplicate strategy branches.
  Extract shared calculation carefully so snapshot payloads and live dispatch
  stay aligned.
- OAuth route-unit selection has member-level cooldown and failover behavior.
  Keep member selection in the facade for this child if moving it would require
  outcome/cooldown table writes in the selection module.
- Effective cost and runtime-load scoring touch model pricing and proxy channel
  coordinator services. The new module may import those services, but must not
  import route adapters or the `tokenRouter.ts` facade.
- Stable-first behavior depends on both runtime health and historical channel
  counters. Keep the scoring formula intact and move tests with no threshold
  changes.
