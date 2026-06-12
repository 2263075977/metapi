# Characterize token router core behavior

## Goal

Create a reliable behavior baseline for `TokenRouter` before modularization.
This child should make later extraction safer by confirming the current routing,
selection, cooldown, runtime-health, and policy behavior through focused tests
or documented existing coverage.

## Confirmed Facts

- `src/server/services/tokenRouter.ts` is the next optimization target.
- Existing behavior-family tests already cover cache, selection, patterns,
  OAuth route units, downstream policy, site status, and session decoupling.
- Future child tasks will move code but should not change behavior.

## Requirements

- Review existing `tokenRouter*.test.ts` coverage and identify the behavior
  invariants future extractions rely on.
- Add narrow characterization tests only where the existing coverage has a real
  extraction risk gap.
- Prefer deterministic assertions: route precedence, explicit-group handling,
  probability explanations, stable-first ordering, cooldown transitions, and
  runtime-health state reset/persistence behavior.
- Do not extract modules or change routing behavior in this child.
- Record the targeted validation commands future child tasks should reuse.

## Acceptance Criteria

- [x] Existing token-router behavior coverage is mapped to the planned
      extraction areas.
- [x] Any missing high-risk characterization tests are added.
- [x] No production behavior changes are introduced except test-only helpers if
      needed.
- [x] Targeted token-router tests pass.
- [x] `npm run typecheck:server` passes if TypeScript test or helper signatures
      change.

## Validation

- `npm test -- src/server/services/tokenRouter.test.ts src/server/services/tokenRouter.patterns.test.ts src/server/services/tokenRouter.cache.test.ts src/server/services/tokenRouter.selection.test.ts src/server/services/tokenRouter.oauth-route-units.test.ts src/server/services/tokenRouter.downstream-policy.test.ts src/server/services/tokenRouter.siteStatus.test.ts src/server/services/tokenRouter.session-decoupling.test.ts`
- `npm run typecheck:server`

## Out of Scope

- Module extraction.
- Public API changes.
- Database schema changes.

## Notes

- Coverage map: `coverage-map.md`.
- Added characterization: explicit-group display names remain exposed by
  `getAvailableModels()` while covered exact source routes are hidden.
- Validation completed:
  - `npm test -- src/server/services/tokenRouter.patterns.test.ts`
  - `npm test -- src/server/services/tokenRouter.test.ts src/server/services/tokenRouter.patterns.test.ts src/server/services/tokenRouter.cache.test.ts src/server/services/tokenRouter.selection.test.ts src/server/services/tokenRouter.oauth-route-units.test.ts src/server/services/tokenRouter.downstream-policy.test.ts src/server/services/tokenRouter.siteStatus.test.ts src/server/services/tokenRouter.session-decoupling.test.ts`
  - `npm run typecheck:server`
  - `git diff --check`
- Spec update review completed: no `.trellis/spec/` change is needed because
  this child only records a task-specific baseline and adds a narrow
  characterization test without changing reusable implementation conventions,
  public API contracts, database schema, or cross-layer behavior.
- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
