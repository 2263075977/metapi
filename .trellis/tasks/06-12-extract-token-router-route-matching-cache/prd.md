# Extract token router route matching cache

## Goal

Extract route loading, route matching, model mapping, visible model exposure,
and route-match cache ownership out of `src/server/services/tokenRouter.ts`
while preserving the existing `TokenRouter` public facade.

## Confirmed Facts

- `tokenRouter.ts` currently owns `loadEnabledRoutes()`, `loadRouteMatch()`,
  route match cache state, explicit-group source route expansion, display-name
  alias handling, model mapping, and `invalidateTokenRouterCache()`.
- Existing tests cover model patterns, explicit groups, route-decision payloads,
  and route cache behavior.
- This child should run after
  `06-12-characterize-token-router-core-behavior`.

## Requirements

- Move route matching/cache responsibilities to a focused service module.
- Preserve route precedence:
  explicit-group display name, exact model pattern, display-name alias, then
  wildcard/regex model pattern.
- Preserve explicit-group source route loading and fallback source-model
  behavior.
- Preserve `matchesModelPattern`, `invalidateTokenRouterCache`, and
  `TokenRouter.getAvailableModels()` compatibility for existing callers.
- Keep database queries semantically unchanged.
- Do not change route decision payloads, exposed model names, or public API
  behavior.

## Acceptance Criteria

- [ ] `tokenRouter.ts` no longer owns route cache internals directly.
- [ ] The extracted module has a clear route-match contract consumed by
      `TokenRouter`.
- [ ] Explicit-group and display-name alias behavior remains covered.
- [ ] Route cache invalidation still clears route and stable-first state where
      required.
- [ ] Targeted route matching and route decision tests pass.

## Validation

- `npm test -- src/server/services/tokenRouter.patterns.test.ts src/server/services/tokenRouter.cache.test.ts src/server/routes/api/tokens.route-update-rebuild.test.ts src/server/routes/api/tokens.route-decision-batch.test.ts`
- `npm run typecheck:server`
- `npm run repo:drift-check`

## Out of Scope

- Selection scoring extraction.
- Runtime health extraction.
- Public route/API behavior changes.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
