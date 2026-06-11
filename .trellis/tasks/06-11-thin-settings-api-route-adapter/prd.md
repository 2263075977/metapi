# Thin settings API route adapter

## Goal

Move implementation logic out of `src/server/routes/api/settings.ts` so the
route file behaves as a thin Fastify adapter.

## Confirmed Facts

- `settings.ts` is currently about 1912 lines.
- Existing settings route tests cover backup WebDAV, database migration/runtime,
  events, factory reset, model availability probe, and system proxy testing.
- Settings routes cross several sensitive operational areas, so behavior changes
  must remain out of scope.

## Requirements

- Preserve all settings endpoint paths, methods, status codes, payloads, and
  response shapes.
- Move cohesive setting-family logic into services or neutral contracts outside
  `src/server/routes/**`.
- Apply the adapter pattern proven by `thin-stats-api-route-adapter`.
- Do not change database schema, migration behavior, backup behavior, or update
  center behavior.

## Acceptance Criteria

- [ ] `settings.ts` is reduced toward registration, parsing, and delegation.
- [ ] Extracted services have focused tests or continue to be covered by route
      tests.
- [ ] All existing `settings.*.test.ts` suites continue to pass.
- [ ] `npm run repo:drift-check` remains clean.

## Validation

- `npx vitest run --root . "src/server/routes/api/settings.*.test.ts"`
- `npm run typecheck:server`
- `npm run repo:drift-check`
