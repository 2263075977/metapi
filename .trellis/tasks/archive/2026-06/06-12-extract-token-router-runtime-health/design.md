# Extract Token Router Runtime Health Design

## Boundary

Move runtime health ownership from `src/server/services/tokenRouter.ts` into a
focused service module:

- `src/server/services/tokenRouterRuntimeHealth.ts`

The new module owns:

- site-level runtime health map state
- model-scoped runtime health map state
- transient/protocol/model/validation failure classification
- runtime health penalty decay and latency multiplier logic
- site/model breaker state and breaker reason text
- recent success/failure outcome decay snapshots
- persisted settings hydration and save debounce for
  `token_router_site_runtime_health_v1`
- runtime health reset, flush, and channel-clear helpers

`src/server/services/tokenRouter.ts` remains the public facade. Existing callers
continue importing from `tokenRouter.ts`, including:

- `resetSiteRuntimeHealthState`
- `flushSiteRuntimeHealthPersistence`
- `getSiteRuntimeHealthMultiplier`
- `isSiteRuntimeBreakerOpen`
- `filterSiteRuntimeBrokenCandidates`

Stable-first selection caches stay in `tokenRouter.ts` for this child. The
selection-engine child owns any later movement of stable-first scoring and
rotation state.

## Contracts

### Runtime Health Details

The extracted module should export the runtime health details consumed by
selection and explanation code:

- `SiteRuntimeFailureContext`
- `SiteRuntimeHealthDetails`

`SiteRuntimeHealthDetails` must preserve the current data used by selection:

```typescript
{
  multiplier: number;
  globalMultiplier: number;
  modelMultiplier: number;
  globalBreakerOpen: boolean;
  modelBreakerOpen: boolean;
  recentSuccessRate: number | null;
  recentSampleCount: number;
}
```

### Module API

The intended internal API is:

- `ensureSiteRuntimeHealthStateLoaded(): Promise<void>`
- `recordSiteRuntimeFailure(siteId, context?, nowMs?): void`
- `recordSiteRuntimeSuccess(siteId, latencyMs, modelName?, nowMs?): void`
- `clearRuntimeHealthStatesForChannels(rows): boolean`
- `persistSiteRuntimeHealthState(): Promise<void>`
- `resetSiteRuntimeHealthState(): void`
- `flushSiteRuntimeHealthPersistence(): Promise<void>`
- `getSiteRuntimeHealthMultiplier(siteId, nowMs?): number`
- `isSiteRuntimeBreakerOpen(siteId, nowMs?): boolean`
- `filterSiteRuntimeBrokenCandidates(candidates, nowMs?): candidates`
- `getSiteRuntimeHealthDetails(siteId, modelName?, nowMs?): SiteRuntimeHealthDetails`
- `filterSiteRuntimeBrokenCandidatesByModel(candidates, resolveModelName, nowMs?): candidates`
- `buildRuntimeBreakerReason(details): string`
- `resolveStableFirstSuccessRate(details, fallbackSuccessRate): number`

`TokenRouter` should delegate runtime health loading, recording, filtering, and
explanation through this API. It may keep compatible re-exports from
`tokenRouter.ts` to avoid changing downstream imports.

## Data Flow

1. Selection entry points call `ensureSiteRuntimeHealthStateLoaded()` before
   reading runtime health.
2. Candidate selection calls `filterSiteRuntimeBrokenCandidatesByModel()` and
   `getSiteRuntimeHealthDetails()` to apply site/model breaker and multiplier
   effects.
3. Stable-first explanation keeps using `resolveStableFirstSuccessRate()` from
   the runtime health module, while stable-first cache ownership remains in the
   facade for this child.
4. Success paths call `recordSiteRuntimeSuccess()` with site, latency, and model
   context. Failure paths normalize the current failure context and call
   `recordSiteRuntimeFailure()`.
5. Manual cooldown clearing passes affected channel/site/model rows to
   `clearRuntimeHealthStatesForChannels()` and persists immediately when the
   helper reports a state change.
6. Persistence continues through the existing `settings` row key and payload
   shape so previously stored health state can hydrate unchanged.

## Compatibility

- Do not change public HTTP APIs, route decision payloads, database schema, or
  routing semantics.
- Preserve the persisted setting key:
  `token_router_site_runtime_health_v1`.
- Preserve the persisted payload shape with `globalBySiteId` and
  `modelBySiteId`.
- Preserve model-scoped degradation for model/provider failures and site-scoped
  degradation for transient upstream failures.
- Preserve validation failure behavior, including not opening a site breaker for
  repeated timeout validation errors.
- Preserve breaker text currently surfaced in candidate reasons.
- Preserve cooldown table writes and channel cache patching in `tokenRouter.ts`
  and route-matching modules.

## Risks

- Runtime health imports route-matching normalization helpers for model keys.
  Keep the dependency one-way: runtime health may import lower-level route
  matching helpers, but it must not import the `tokenRouter.ts` facade or route
  adapters.
- Selection code reads both health multipliers and recent outcome snapshots.
  Move the calculation together to avoid duplicating recent-success logic.
- Persistence has debounced and in-flight state. Keep reset and flush behavior
  compatible for tests that reset in-memory state and reload persisted settings.
- Manual cooldown clearing depends on both global site state and model-scoped
  entries. Preserve the exact row shape and removal behavior during extraction.
