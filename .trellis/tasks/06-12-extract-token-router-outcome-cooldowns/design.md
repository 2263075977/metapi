# Extract Token Router Outcome Cooldowns Design

## Boundary

Move outcome recording and cooldown transition ownership from
`src/server/services/tokenRouter.ts` into a focused service module:

- `src/server/services/tokenRouterOutcomeCooldowns.ts`

The new module owns:

- success, probe-success, and failure recording for route channels
- OAuth route-unit member success, probe-success, and failure recording
- direct route-channel cooldown transitions
- OAuth route-unit member cooldown transitions
- credential-scoped sibling cooldown reset behavior
- short-window usage-limit cooldown handling
- Codex OAuth quota reset hint handling
- weighted Fibonacci backoff and backoff clamping
- round-robin staged cooldown thresholds and levels
- manual failure/cooldown clear writes
- runtime health success/failure/reset side effects for outcome paths
- route-match cache patching after outcome writes

`src/server/services/tokenRouter.ts` remains the public facade. Existing callers
continue using:

- `TokenRouter.recordSuccess`
- `TokenRouter.recordProbeSuccess`
- `TokenRouter.recordFailure`
- `TokenRouter.clearChannelFailureState`

The facade should delegate these methods to the outcome module and keep the
same method signatures.

## Contracts

### Outcome Dependencies

The outcome module should not import the `tokenRouter.ts` facade. It may import
lower-level modules directly:

- `tokenRouterRouteMatching.ts` for cached channel patching and route-match
  invalidation primitives.
- `tokenRouterRuntimeHealth.ts` for runtime success/failure/reset/persistence
  helpers.
- `routeRoutingStrategy.ts` for route strategy normalization.
- OAuth helpers for account quota reset hints and provider metadata.

Selection cache invalidation should remain explicit. The module should either:

- return affected route ids for the facade to invalidate with
  `invalidateRouteScopedCache()`, or
- accept a small dependency object containing `invalidateRouteScopedCache` and
  `invalidateAllTokenRouterCache`.

This keeps outcome code independent from the public facade while preserving
stable-first cache clearing.

### Module API

The intended internal API is:

- `recordTokenRouteSuccess(input): Promise<void>`
- `recordTokenRouteProbeSuccess(input): Promise<void>`
- `recordTokenRouteFailure(input): Promise<void>`
- `clearTokenRouteChannelFailureState(input): Promise<number>`
- `resolveFailureBackoffSec(failCount?): number`
- `resolveEffectiveFailureCooldownMs(failCount?): number`
- `resolveShortWindowLimitCooldown(account, context?, nowMs?): string | null`

The intended facade delegation shape is:

```typescript
await recordTokenRouteFailure({
  channelId,
  context,
  actualAccountId,
  invalidateRouteScopedCache,
  invalidateAllTokenRouterCache,
});
```

The public `TokenRouter` method signatures should not change.

## Data Flow

1. Facade methods call the outcome module with channel id, failure/success
   context, actual OAuth member account id when present, and cache invalidation
   hooks.
2. The outcome module loads the route-channel, account, route, OAuth member, and
   OAuth unit rows needed for the transition.
3. Success paths update success counters, latency/cost totals, selected member
   rows when applicable, direct channel state, runtime health success state, and
   cached channel rows.
4. Probe-success paths clear cooldown/failure state for the selected credential
   and credential-scoped siblings where current behavior does so.
5. Failure paths classify short-window usage-limit cooldowns first, then apply
   route-unit strategy cooldowns, route strategy cooldowns, weighted Fibonacci
   backoff, or round-robin staged cooldowns.
6. Manual clear resets persisted route-channel failure state, clears matching
   runtime health state, persists runtime health when changed, and invalidates
   all token-router caches.

## Compatibility

- Do not change public method signatures, HTTP APIs, route decision payloads,
  database schema, cooldown durations, or routing algorithms.
- Preserve weighted Fibonacci backoff, configured max cooldown clamping, and the
  JavaScript Date-range guard.
- Preserve round-robin staged cooldown behavior, including threshold 3 and
  levels 0, 10 minutes, 1 hour, and 24 hours.
- Preserve short-window usage-limit cooldown behavior and Codex OAuth reset
  hint precedence.
- Preserve credential-scoped sibling cooldown clearing for account-token and
  account-level credentials.
- Preserve OAuth route-unit member behavior for `round_robin` and
  `stick_until_unavailable`.
- Preserve cache effects after success, probe success, failure, and manual
  clear, including route-scoped stable-first cache clearing.
- Preserve runtime health recording using actual OAuth member site/account
  context when a route-unit member is involved.

## Risks

- Outcome code touches database writes, runtime health state, route-match cache
  patching, and selection-cache invalidation. Keep the module API explicit so
  cache invalidation remains observable and testable.
- Selection extraction may already own recently-failed helpers and stable-first
  caches. Avoid circular imports by having the outcome module receive
  invalidation hooks or return affected route ids instead of importing the
  `tokenRouter.ts` facade.
- OAuth route-unit member updates must use the actual selected member account
  when `actualAccountId` is provided; falling back to the outer route channel
  account would regress member cooldown behavior.
- Probe success has different direct-channel and route-unit reset behavior.
  Move it as its own path instead of folding it into normal success handling.
- Manual clear also clears runtime health state. Keep persistence and cache
  invalidation ordering compatible with current tests.
