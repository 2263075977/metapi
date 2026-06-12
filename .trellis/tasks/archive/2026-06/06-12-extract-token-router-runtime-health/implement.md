# Extract Token Router Runtime Health Implementation Plan

## Pre-Start Review

- [x] Confirm predecessor `06-12-extract-token-router-route-matching-cache` is
      archived.
- [x] Review parent ordering and constraints.
- [x] Inspect current `tokenRouter.ts` runtime health, breaker, persistence,
      recent-outcome, and reset code.
- [x] Inspect targeted tests covering runtime health, breaker, persistence, and
      model-scoped behavior.
- [x] Review planning artifacts with the user and start this child task with
      `python ./.trellis/scripts/task.py start 06-12-extract-token-router-runtime-health`.

## Implementation Steps

- [x] Run `trellis-before-dev` and reread applicable backend specs before code
      edits.
- [x] Add `src/server/services/tokenRouterRuntimeHealth.ts`.
  - Move runtime health types, constants, regex classifiers, and module-level
    state.
  - Move penalty decay, recent outcome, breaker, multiplier, and persistence
    helpers.
  - Move public-compatible runtime health helpers and selection-facing filter
    helpers.
  - Import only lower-level dependencies needed for persistence and model key
    normalization.
- [x] Update `src/server/services/tokenRouter.ts` to import the new module.
  - Keep public runtime health exports compatible by re-exporting or wrapping
    the extracted helpers.
  - Replace private calls to runtime health internals with imported helpers.
  - Keep stable-first cache state and cache invalidation wrappers local in this
    child.
  - Keep cooldown table writes and route matching cache patching unchanged.
- [x] Remove runtime health internals from `tokenRouter.ts` after callers have
      moved.
- [x] Review import boundaries to ensure the extracted module does not import
      route adapters or the `tokenRouter.ts` facade.
- [x] Add an architecture guard for the new runtime health module boundary.

## Validation

- [x] `npm test -- src/server/services/tokenRouter.selection.test.ts src/server/services/tokenRouter.cache.test.ts`
- [x] `npm test -- src/server/services/tokenRouterRuntimeHealth.architecture.test.ts`
- [x] `npm run typecheck:server`
- [x] `npm run repo:drift-check`
- [x] `git diff --check`

## Rollback Points

- If TypeScript types become too broad, keep small wrappers in `tokenRouter.ts`
  and reduce the extracted API surface before changing behavior.
- If stable-first tests fail, inspect recent outcome and
  `resolveStableFirstSuccessRate()` first; do not move stable-first caches in
  this child.
- If persistence tests fail, compare the saved settings key and payload shape
  before touching routing selection logic.
- If model-scoped breaker behavior fails, inspect model key normalization and
  failure classification before changing penalty thresholds.
