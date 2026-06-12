# Extract Token Router Route Matching Cache Implementation Plan

## Pre-Start Review

- [x] Confirm predecessor `06-12-characterize-token-router-core-behavior` is
      archived.
- [x] Review parent ordering and constraints.
- [x] Inspect current `tokenRouter.ts` route cache, match, visible-model, and
      invalidation code.
- [x] Inspect targeted tests covering route matching/cache behavior.

## Implementation Steps

- [x] Start this child task with `python ./.trellis/scripts/task.py start 06-12-extract-token-router-route-matching-cache`.
- [x] Run `trellis-before-dev` and reread applicable backend specs before code
      edits.
- [x] Add `src/server/services/tokenRouterRouteMatching.ts`.
  - Move route row/channel row and route-match types.
  - Move route cache snapshot state and match cache state.
  - Move route loading, explicit-group source expansion, match loading, visible
    route/model exposure, model mapping, display-name, source-model, and model
    pattern helpers.
  - Export cache invalidation and cached-channel patching functions.
- [x] Update `src/server/services/tokenRouter.ts` to import the new module.
  - Keep public `matchesModelPattern` and `invalidateTokenRouterCache` exports
    compatible by re-exporting or wrapping the extracted helpers.
  - Replace private `findRoute`, `findRouteById`, and `loadRouteMatch`
    internals with calls to extracted route matching functions.
  - Keep stable-first cache clearing local in this child.
  - Keep `__tokenRouterTestUtils.resolveMappedModel` compatible.
- [x] Remove route matching/cache internals from `tokenRouter.ts` after callers
      have moved.
- [x] Review import boundaries to ensure the extracted module does not import
      from route adapters or the `tokenRouter.ts` facade.
- [x] Add an architecture guard for the new route matching module boundary.

## Validation

- [x] `npm test -- src/server/services/tokenRouter.patterns.test.ts src/server/services/tokenRouter.cache.test.ts src/server/routes/api/tokens.route-update-rebuild.test.ts src/server/routes/api/tokens.route-decision-batch.test.ts`
- [x] `npm test -- src/server/services/tokenRouterRouteMatching.architecture.test.ts`
- [x] `npm run typecheck:server`
- [x] `npm run repo:drift-check`
- [x] `git diff --check`

## Rollback Points

- If TypeScript types become too broad, keep `TokenRouter` wrapper methods and
  reduce the extracted API surface before changing behavior.
- If targeted tests fail around explicit groups, inspect matching precedence and
  fallback `sourceModel` first before touching selection logic.
- If route-scoped invalidation fails, keep the route matching cache primitive in
  the new module and stable-first cache clearing in `tokenRouter.ts`; do not
  move stable-first state in this child.
