# Extract Token Router Selection Engine Implementation Plan

## Pre-Start Review

- [x] Confirm predecessor `06-12-extract-token-router-runtime-health` is
      archived.
- [x] Review parent ordering and constraints.
- [x] Inspect current `tokenRouter.ts` selection, explanation, stable-first,
      runtime-load, and probability code.
- [x] Inspect targeted tests covering weighted, stable-first, downstream-policy,
      OAuth route-unit, and route-decision payload behavior.
- [x] Review planning artifacts with the user and start this child task with
      `python3 ./.trellis/scripts/task.py start 06-12-extract-token-router-selection-engine`.

## Implementation Steps

- [x] Run `trellis-before-dev` and reread applicable backend specs before code
      edits.
- [x] Add `src/server/services/tokenRouterSelectionEngine.ts`.
  - Move selection types, scoring constants, stable-first cache state, and
    selection helpers.
  - Move weighted contribution and probability detail calculation.
  - Move round-robin ordering and stable-first pool planning.
  - Move recently-failed filtering and stable-first cache invalidation helpers.
  - Import only lower-level services needed for cost, runtime health, load, and
    route matching type contracts.
- [x] Update `src/server/services/tokenRouter.ts` to import the new module.
  - Keep public and test-facing selection helper exports compatible.
  - Replace private weighted, round-robin, stable-first, and probability
    calculation internals with selection-engine calls.
  - Keep route lookup, eligibility filtering, OAuth route-unit member dispatch,
    token resolution, and database writes in the facade for this child.
  - Wire route-scoped and global invalidation to the selection-engine cache
    clearing functions.
- [x] Preserve route-decision explanation payloads.
  - Keep the facade as the payload assembler.
  - Delegate probability/reason calculation to the selection engine.
  - Compare snapshot/batch route-decision tests before adjusting text.
- [x] Remove selection internals from `tokenRouter.ts` after all calls have
      moved.
- [x] Review import boundaries to ensure the extracted module does not import
      route adapters or the `tokenRouter.ts` facade.
- [x] Add an architecture guard for the new selection module boundary if the
      import direction is not already covered.

## Validation

- [x] `npm test -- src/server/services/tokenRouter.selection.test.ts src/server/services/tokenRouter.downstream-policy.test.ts src/server/services/tokenRouter.oauth-route-units.test.ts src/server/routes/api/tokens.route-decision-batch.test.ts src/server/routes/api/tokens.route-decision-snapshot.test.ts`
- [x] `npm test -- src/server/services/tokenRouterSelectionEngine.architecture.test.ts`
- [x] `npm run typecheck:server`
- [x] `npm run repo:drift-check`
- [x] `git diff --check`

## Current Validation Notes

- Repaired current Linux native dependencies in `node_modules` for Rollup,
  esbuild, and better-sqlite3 without semantic changes to `package.json` or
  `package-lock.json`.
- Targeted TokenRouter selection, downstream-policy, OAuth route-unit, and
  route-decision tests pass.
- Selection-engine architecture boundary test passes.
- `NODE_OPTIONS=--max-old-space-size=2048 npm run typecheck:server` passes.
- `npm run repo:drift-check` reports 0 violations and 0 tracked debt.
- `git diff --check` passes for the implementation and task artifact files.

## Rollback Points

- If explanation snapshots fail broadly, keep explanation assembly in
  `tokenRouter.ts` and extract only the shared probability/detail calculation
  first.
- If OAuth route-unit tests fail, keep member selection and member timestamp
  writes in the facade; do not move member cooldown or member failure logic in
  this child.
- If stable-first tests fail, inspect rotation-key construction, observation
  request counters, and route-scoped cache clearing before changing scoring
  thresholds.
- If weighted selection probabilities shift unexpectedly, compare contribution
  order, fallback-cost handling, downstream multipliers, and runtime load
  multipliers before changing test expectations.
