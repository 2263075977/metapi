# Extract token router outcome cooldowns

## Goal

Extract success/failure recording and direct/OAuth route-unit cooldown
transitions out of `src/server/services/tokenRouter.ts` while preserving current
routing outcome behavior.

## Confirmed Facts

- `TokenRouter.recordSuccess`, `recordProbeSuccess`, `recordFailure`, and
  cooldown clearing currently update route channel rows, OAuth route-unit
  member rows, runtime health state, stable-first caches, and route-match cache
  snapshots.
- Existing tests cover fibonacci cooldowns, usage-limit cooldown hints,
  round-robin staged cooldowns, OAuth route-unit member behavior, and manual
  cooldown clearing.
- This child should run after runtime-health extraction and after route
  matching/cache invalidation is explicit.

## Requirements

- Move outcome recording and cooldown transition logic to a focused module.
- Preserve direct route-channel and OAuth route-unit member behavior.
- Preserve credential-scoped sibling cooldown behavior.
- Preserve short-window usage-limit cooldown handling, Codex OAuth reset hints,
  round-robin staged cooldowns, and weighted backoff caps.
- Preserve cache patching/invalidation effects after success, failure, probe
  success, and manual clear.
- Keep `TokenRouter` public methods compatible for callers.

## Acceptance Criteria

- [ ] `tokenRouter.ts` no longer owns outcome/cooldown transition internals.
- [ ] Direct channel and OAuth route-unit member paths remain independently
      covered.
- [ ] Manual cooldown clear still resets persisted runtime breaker state where
      expected.
- [ ] Targeted cooldown and OAuth route-unit tests pass.

## Validation

- `npm test -- src/server/services/tokenRouter.cache.test.ts src/server/services/tokenRouter.oauth-route-units.test.ts src/server/routes/api/tokens.cooldown-clear.test.ts`
- `npm run typecheck:server`
- `npm run repo:drift-check`

## Out of Scope

- Changing cooldown durations or thresholds.
- Database schema changes.
- Selection scoring extraction.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
