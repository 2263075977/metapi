# Extract Token Router Route Matching Cache Design

## Boundary

Move route matching ownership from `src/server/services/tokenRouter.ts` into a
focused service module:

- `src/server/services/tokenRouterRouteMatching.ts`

The new module owns:

- enabled route loading and TTL state
- route-match cache state
- explicit-group source route expansion
- route/channel match data shape
- model pattern helpers and display-name matching helpers
- model mapping resolution
- visible route/model exposure
- cached channel patching after outcome writes

`src/server/services/tokenRouter.ts` remains the public facade. Existing callers
continue importing from `tokenRouter.ts`, including:

- `TokenRouter`
- `tokenRouter`
- `matchesModelPattern`
- `invalidateTokenRouterCache`
- `__tokenRouterTestUtils.resolveMappedModel`

## Contracts

### Route Match Contract

The extracted module should export route-match types consumed by `TokenRouter`:

- `TokenRouterRouteRow`
- `TokenRouterChannelRow`
- `TokenRouterRouteMatch`
- `TokenRouterRouteChannelCandidate`

`TokenRouterRouteMatch` must preserve the existing shape:

```typescript
{
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
```

### Module API

The intended internal API is:

- `loadEnabledTokenRoutes(nowMs?: number): Promise<TokenRouterRouteRow[]>`
- `loadTokenRouteMatch(route, nowMs?: number): Promise<TokenRouterRouteMatch>`
- `findTokenRouteMatch(model, downstreamPolicy): Promise<TokenRouterRouteMatch | null>`
- `findTokenRouteMatchById(routeId, downstreamPolicy): Promise<TokenRouterRouteMatch | null>`
- `getVisibleEnabledTokenRouteModelNames(): Promise<string[]>`
- `patchCachedTokenRouteChannel(channelId, apply): void`
- `invalidateTokenRouteMatchingCache(): void`
- `invalidateTokenRouteMatch(routeId): void`
- `matchesModelPattern(model, pattern): boolean`
- `resolveMappedModel(requestedModel, modelMapping): string`
- `resolveActualModelForSelectedChannel(requestedModel, route, mappedModel, channelSourceModel): string`
- `channelSupportsRequestedModel(channelSourceModel, requestedModel): boolean`
- `isModelAllowedByDownstreamPolicy(requestedModel, policy): boolean`
- `isExplicitGroupRoute(route): boolean`
- `isRouteDisplayNameMatch(model, displayName): boolean`

`TokenRouter` should delegate route lookup and visible-model exposure through
this API. It may keep private wrapper methods if that keeps the facade diff
small.

## Cache Invalidation

The route matching module owns route and route-match cache data. Stable-first
selection caches remain in `tokenRouter.ts` for this child because selection
extraction is a later task.

Preserve these effects:

- Public `invalidateTokenRouterCache()` clears route cache, route-match cache,
  and all stable-first caches.
- Route-scoped invalidation after OAuth route-unit member updates clears the
  affected route-match cache and the stable-first caches for that route.
- Cached channel patching after success/failure/probe success still updates the
  cached channel row when full invalidation is not required.

Implementation shape:

- `tokenRouterRouteMatching.ts` exports route cache invalidation primitives.
- `tokenRouter.ts` keeps `clearStableFirstCachesForRoute()` and stable-first
  global clear ownership.
- `invalidateRouteScopedCache(routeId)` in `tokenRouter.ts` calls
  `invalidateTokenRouteMatch(routeId)` and then clears stable-first route keys.
- Public `invalidateTokenRouterCache()` calls `invalidateTokenRouteMatchingCache()`
  and then clears stable-first caches.

## Compatibility

- Do not change public HTTP APIs, decision payloads, database schema, or route
  matching order.
- Preserve matching precedence:
  explicit-group display name, exact model pattern, display-name alias, then
  wildcard/regex pattern.
- Preserve display-name exposed model behavior, including hiding exact source
  routes covered by explicit groups.
- Preserve explicit-group fallback `sourceModel` from exact source routes.
- Preserve downstream policy filtering semantics in route lookup.
- Keep database queries semantically equivalent to the current code.

## Risks

- Moving `RouteMatch` types can create accidental circular imports if the new
  module imports from `tokenRouter.ts`. The new module must be lower-level and
  must not import the facade.
- Cache invalidation has two owners after this child: route matching cache in
  the new module and stable-first caches in `tokenRouter.ts`. Keep the wrapper
  functions in `tokenRouter.ts` explicit until selection extraction.
- `resolveMappedModel` and `matchesModelPattern` are used by tests and future
  extraction work. Keep compatibility re-exports from `tokenRouter.ts`.
- Explicit groups depend on source route IDs and exact source model patterns.
  Do not broaden group sources to wildcard routes while extracting.

