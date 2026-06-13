# Thin Token Router Service Facade Implementation Plan

## Pre-Start Review

- [x] Confirm predecessors `06-12-extract-token-router-route-matching-cache`
      and `06-12-extract-token-router-runtime-health` are archived.
- [x] Review parent ordering and constraints.
- [x] Inspect current `tokenRouter.ts` facade surface and remaining private
      helper ownership.
- [x] Inspect targeted token-router tests and route/API tests that import facade
      helpers.
- [x] Confirm `06-12-extract-token-router-selection-engine` and
      `06-12-extract-token-router-outcome-cooldowns` are archived before
      starting this child.
- [x] Review planning artifacts with the user and start this child task with
      `python3 ./.trellis/scripts/task.py start 06-12-thin-token-router-service-facade`.

## Implementation Steps

- [x] Run `trellis-before-dev` and reread applicable backend specs before code
      edits.
- [x] Inventory all imports from `src/server/services/tokenRouter.ts`.
  - Preserve public facade imports by default.
  - Migrate only internal call sites where direct module imports are clearly
    narrower and well validated.
- [x] Reduce `tokenRouter.ts` to orchestration.
  - Keep the public class, singleton, compatibility exports, and test utils.
  - Delegate route matching, runtime health, selection, and outcome behavior to
    extracted modules.
  - Remove leftover broad helper implementations that now belong to extracted
    modules.
- [x] Review and simplify cache invalidation wiring.
  - Keep `invalidateTokenRouterCache()` as the public compatibility entry point.
  - Ensure route-scoped invalidation clears route-match and selection caches.
  - Avoid hidden cache ownership in the facade.
- [x] Review import boundaries.
  - Ensure extracted modules do not import `tokenRouter.ts`.
  - Ensure route adapters do not start importing lower-level internals unless
    explicitly justified.
- [x] Add or extend an architecture guard only if the final boundary needs an
      executable regression check.
- [ ] Archive the parent roadmap only after all child tasks and final
      integration criteria are satisfied.

## Validation

- [x] `npm test -- src/server/services/tokenRouter.test.ts src/server/services/tokenRouter.patterns.test.ts src/server/services/tokenRouter.cache.test.ts src/server/services/tokenRouter.selection.test.ts src/server/services/tokenRouter.oauth-route-units.test.ts src/server/services/tokenRouter.downstream-policy.test.ts src/server/services/tokenRouter.siteStatus.test.ts src/server/services/tokenRouter.session-decoupling.test.ts`
- [x] `npm run typecheck:server`
- [x] `npm run repo:drift-check`
- [x] `git diff --check`

## Rollback Points

- If import compatibility breaks, restore facade re-exports first and defer
  direct caller migration.
- If broad tests fail after deleting helper code, reintroduce a thin wrapper in
  the facade and keep behavior delegated to the extracted module.
- If cache tests fail, inspect public and route-scoped invalidation wiring
  before changing extracted module internals.
- If architecture checks become noisy, narrow the guard to the specific
  token-router boundary instead of adding broad service-layer rules.
