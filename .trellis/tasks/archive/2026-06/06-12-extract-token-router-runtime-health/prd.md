# Extract token router runtime health

## Goal

Extract site/model runtime health, breaker, recent-outcome, and persistence
state out of `src/server/services/tokenRouter.ts` while keeping the current
routing behavior and exported helper compatibility.

## Confirmed Facts

- `tokenRouter.ts` currently owns module-level site runtime health maps,
  breaker thresholds, recent outcome decay, persisted setting hydration, and
  reset helpers.
- Selection scoring reads runtime health multipliers and breaker state.
- This child should run after route matching/cache extraction and before
  selection-engine extraction.

## Requirements

- Move runtime health state and helpers to a focused service module.
- Preserve exported helpers used by tests and other modules:
  `resetSiteRuntimeHealthState`, `getSiteRuntimeHealthMultiplier`,
  `isSiteRuntimeBreakerOpen`, and `filterSiteRuntimeBrokenCandidates`.
- Preserve persisted setting key and payload compatibility.
- Preserve model-scoped versus site-scoped degradation behavior.
- Preserve transient/protocol/model/validation failure classification used by
  runtime health.
- Do not change cooldown table writes or route selection behavior in this child.

## Acceptance Criteria

- [x] Runtime health maps and persistence logic no longer live in
      `tokenRouter.ts`.
- [x] Selection and outcome code consume runtime health through an explicit
      module contract.
- [x] Existing runtime-health, breaker, and persistence tests pass.
- [x] No new architecture boundary violation is introduced.

## Validation

- `npm test -- src/server/services/tokenRouter.selection.test.ts src/server/services/tokenRouter.cache.test.ts`
- `npm run typecheck:server`
- `npm run repo:drift-check`

## Out of Scope

- Tuning health thresholds.
- Changing breaker behavior.
- Selection scoring extraction.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
