# Extract Token Router Outcome Cooldowns Implementation Plan

## Pre-Start Review

- [x] Confirm predecessors `06-12-extract-token-router-route-matching-cache`
      and `06-12-extract-token-router-runtime-health` are archived.
- [x] Review parent ordering and constraints.
- [x] Inspect current `tokenRouter.ts` success, probe-success, failure,
      cooldown, manual-clear, and OAuth route-unit member update paths.
- [x] Inspect targeted tests covering cache effects, cooldown clearing, usage
      limits, round-robin cooldowns, and OAuth route-unit behavior.
- [x] Confirm `06-12-extract-token-router-selection-engine` is archived before
      starting this child, unless the user explicitly chooses to reorder the
      parent roadmap.
- [x] Review planning artifacts with the user and start this child task with
      `python3 ./.trellis/scripts/task.py start 06-12-extract-token-router-outcome-cooldowns`.

## Implementation Steps

- [x] Run `trellis-before-dev` and reread applicable backend specs before code
      edits.
- [x] Add `src/server/services/tokenRouterOutcomeCooldowns.ts`.
  - Move failure backoff constants and cooldown calculation helpers.
  - Move short-window usage-limit cooldown resolution.
  - Move credential-scoped channel lookup.
  - Move success, probe-success, failure, and manual-clear transition logic.
  - Keep dependencies lower-level than the `tokenRouter.ts` facade.
- [x] Update `src/server/services/tokenRouter.ts` to delegate outcome methods.
  - Keep public method signatures compatible.
  - Pass route-scoped and global cache invalidation hooks when needed.
  - Keep unrelated selection, route lookup, and token dispatch behavior out of
    the outcome module.
- [x] Preserve route-match cache patching and invalidation.
  - Patch cached channel rows after direct channel writes.
  - Invalidate affected route matches after OAuth route-unit member writes.
  - Clear selection caches through explicit hooks after route-scoped invalidation.
- [x] Preserve runtime health side effects.
  - Record success/failure for the actual OAuth member site when available.
  - Clear and persist runtime health state during manual clear.
- [x] Remove outcome/cooldown internals from `tokenRouter.ts` after all callers
      have moved.
- [x] Review import boundaries to ensure the outcome module does not import
      route adapters or the `tokenRouter.ts` facade.
- [x] Add an architecture guard for the new outcome module boundary if the
      import direction is not already covered.

## Validation

- [x] `npm test -- src/server/services/tokenRouter.cache.test.ts src/server/services/tokenRouter.oauth-route-units.test.ts src/server/routes/api/tokens.cooldown-clear.test.ts`
- [x] `npm test -- src/server/services/tokenRouterOutcomeCooldowns.architecture.test.ts`
- [x] `npm run typecheck:server`
- [x] `npm run repo:drift-check`
- [x] `git diff --check`

## Current Validation Notes

- Targeted cooldown/cache/OAuth/API tests pass together with the new outcome
  module architecture guard: 4 files, 23 tests.
- `NODE_OPTIONS=--max-old-space-size=2048 npm run typecheck:server` passes.
- `npm run repo:drift-check` reports 0 violations and 0 tracked debt.
- `git diff --check` passes for the implementation and task artifact files.

## Rollback Points

- If OAuth route-unit tests fail, compare selected member lookup,
  `actualAccountId` fallback, member cooldown fields, and route-scoped
  invalidation first.
- If cooldown-clear tests fail, inspect runtime health row loading and
  persistence before changing route-channel clear writes.
- If cache tests fail, keep cache patching in the outcome module but route
  stable-first invalidation through facade hooks; do not import the facade to
  resolve the failure.
- If usage-limit behavior changes, compare Codex reset hint parsing and
  credential-scoped sibling channel updates before changing cooldown durations.
