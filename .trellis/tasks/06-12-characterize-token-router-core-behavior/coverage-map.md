# Token Router Characterization Coverage

## Purpose

This map records the behavior baseline that later `tokenRouter.ts` extraction
children should preserve. It is limited to current behavior coverage and does
not propose production changes.

## Route Matching And Cache

- `src/server/services/tokenRouter.patterns.test.ts`
  - Regex route matching and invalid regex fallback.
  - Model mapping precedence for exact, glob, and `re:` keys.
  - Display-name alias matching as an exposed model.
  - Explicit-group display-name precedence over colliding exact routes.
  - Explicit-group source exact-route fallback when source channels omit
    `sourceModel`.
  - Explicit-group visible-model exposure now asserts the group display name is
    exposed and its covered exact source route is hidden.
- `src/server/services/tokenRouter.cache.test.ts`
  - Route snapshot TTL behavior and explicit invalidation.
- `src/server/routes/api/tokens.route-update-rebuild.test.ts`
  - Route update/rebuild behavior around explicit groups and source links.
- `src/server/routes/api/tokens.route-decision-batch.test.ts`
  - Batch route-decision payload behavior for API callers.

## Runtime Health

- `src/server/services/tokenRouter.selection.test.ts`
  - Runtime health penalty after transient failures and recovery after success.
  - Site breaker open/close behavior.
  - Manual cooldown clear resetting persisted runtime breaker state.
  - Validation errors avoiding site breaker escalation.
  - Persisted site success and latency history after in-memory reset.
  - Model-scoped degradation for failed or unsupported models.
- `src/server/services/tokenRouter.cache.test.ts`
  - Cache patching/invalidation behavior after outcome recording.

## Selection Engine

- `src/server/services/tokenRouter.selection.test.ts`
  - Preferred channel reuse while healthy.
  - Weighted probability normalization across same-site channels.
  - Observed, fallback, and catalog routing cost signals.
  - Stable-first deterministic selection, stable pool rotation, priority-order
    rotation, observation-pool traffic, and rotation cache cap.
  - Runtime load multiplier for saturated session-scoped channels.
- `src/server/services/tokenRouter.downstream-policy.test.ts`
  - Allowed route filtering, supported-model union semantics, site exclusions,
    credential-ref exclusions, and site weight multipliers in explanations.
- `src/server/services/tokenRouter.oauth-route-units.test.ts`
  - OAuth route-unit member selection behavior that the selection extraction
    must either preserve directly or continue to orchestrate through the facade.

## Outcome And Cooldowns

- `src/server/services/tokenRouter.test.ts`
  - Recent-failure filtering and fibonacci-style avoidance windows.
- `src/server/services/tokenRouter.cache.test.ts`
  - Weighted fibonacci cooldowns, configured max caps, usage-limit short-window
    cooldowns, Codex OAuth reset hints, sibling credential cooldowns, probe
    recovery, round-robin staged cooldowns, and overflow caps.
- `src/server/services/tokenRouter.oauth-route-units.test.ts`
  - OAuth pooled member cooldown and failover behavior.
- `src/server/routes/api/tokens.cooldown-clear.test.ts`
  - Manual cooldown clear for direct and explicit-group source-route channels.

## Facade Compatibility

- `src/server/services/tokenRouter.siteStatus.test.ts`
  - Disabled-site exclusion and credential fallback behavior.
- `src/server/services/tokenRouter.session-decoupling.test.ts`
  - Explicit token-bound channels staying routable when account sessions expire,
    while fallback account-token channels stay blocked.
- Public imports that later facade work must preserve:
  - `TokenRouter`
  - `tokenRouter`
  - `matchesModelPattern`
  - `invalidateTokenRouterCache`
  - `resetSiteRuntimeHealthState`
  - `getSiteRuntimeHealthMultiplier`
  - `isSiteRuntimeBreakerOpen`
  - `filterSiteRuntimeBrokenCandidates`

## Reusable Validation Baseline

```bash
npm test -- src/server/services/tokenRouter.test.ts src/server/services/tokenRouter.patterns.test.ts src/server/services/tokenRouter.cache.test.ts src/server/services/tokenRouter.selection.test.ts src/server/services/tokenRouter.oauth-route-units.test.ts src/server/services/tokenRouter.downstream-policy.test.ts src/server/services/tokenRouter.siteStatus.test.ts src/server/services/tokenRouter.session-decoupling.test.ts
npm run typecheck:server
```
