# Extract token router selection engine

## Goal

Extract weighted, round-robin, stable-first, cost, load, and probability
explanation logic out of `src/server/services/tokenRouter.ts` while keeping
`TokenRouter` as the public facade.

## Confirmed Facts

- `tokenRouter.ts` currently owns candidate eligibility, priority layers,
  weighted selection, stable-first pool planning, stable-first rotation caches,
  cost signals, site historical health metrics, runtime load multipliers, and
  route decision explanations.
- Selection logic depends on route-match data and runtime health state.
- This child should run after route matching/cache and runtime-health seams are
  extracted.

## Requirements

- Move selection calculation and probability explanation to a focused module.
- Preserve weighted, round-robin, stable-first, preferred-channel, and failover
  selection behavior.
- Preserve downstream policy filtering and site weight multiplier behavior.
- Preserve OAuth route-unit member selection behavior or leave it in the facade
  if extracting it here would couple this child to cooldown recording.
- Preserve route decision explanation fields and user-facing summary strings
  unless a test-backed compatibility decision explicitly changes them.
- Avoid changing random selection semantics beyond moving the code.

## Acceptance Criteria

- [ ] `tokenRouter.ts` delegates selection/probability calculation through a
      clear internal contract.
- [ ] Weighted, stable-first, downstream-policy, and OAuth route-unit tests pass.
- [ ] Existing route decision snapshot and batch decision payload tests pass if
      explanation assembly is touched.
- [ ] No public caller imports the extracted engine directly unless planned.

## Validation

- `npm test -- src/server/services/tokenRouter.selection.test.ts src/server/services/tokenRouter.downstream-policy.test.ts src/server/services/tokenRouter.oauth-route-units.test.ts src/server/routes/api/tokens.route-decision-batch.test.ts src/server/routes/api/tokens.route-decision-snapshot.test.ts`
- `npm run typecheck:server`
- `npm run repo:drift-check`

## Out of Scope

- Reweighting routing algorithms.
- Changing stable-first observation cadence.
- UI/API payload redesign.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
