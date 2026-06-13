# Thin token router service facade

## Goal

Finish the routing-core modularization wave by reducing
`src/server/services/tokenRouter.ts` to a compatible public facade that
orchestrates extracted modules instead of owning all routing-core internals.

## Confirmed Facts

- Existing callers import `tokenRouter`, `TokenRouter`, `matchesModelPattern`,
  cache invalidation helpers, and runtime-health helpers from
  `src/server/services/tokenRouter.ts`.
- Earlier children in this roadmap should extract route matching/cache,
  runtime health, selection, and outcome/cooldown responsibilities first.
- This child should run last.

## Requirements

- Preserve compatible exports from `src/server/services/tokenRouter.ts`.
- Keep `TokenRouter` public methods as the orchestration surface for existing
  proxy-core, route API, and service callers.
- Remove leftover broad implementation ownership from the facade once extracted
  modules exist.
- Add or extend an architecture guard only if the final boundary needs an
  executable rule to prevent regression.
- Do not combine new behavior work with the facade cleanup.

## Acceptance Criteria

- [ ] `tokenRouter.ts` is substantially thinner and reads as a facade over
      extracted routing-core modules.
- [ ] Existing import paths remain compatible or are migrated with focused
      validation.
- [ ] Full token-router targeted tests pass.
- [ ] `npm run typecheck:server` passes.
- [ ] `npm run repo:drift-check` reports 0 violations and 0 tracked debt.

## Validation

- `npm test -- src/server/services/tokenRouter.test.ts src/server/services/tokenRouter.patterns.test.ts src/server/services/tokenRouter.cache.test.ts src/server/services/tokenRouter.selection.test.ts src/server/services/tokenRouter.oauth-route-units.test.ts src/server/services/tokenRouter.downstream-policy.test.ts src/server/services/tokenRouter.siteStatus.test.ts src/server/services/tokenRouter.session-decoupling.test.ts`
- `npm run typecheck:server`
- `npm run repo:drift-check`

## Out of Scope

- Routing algorithm changes.
- Public API changes.
- Starting a new optimization wave.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
