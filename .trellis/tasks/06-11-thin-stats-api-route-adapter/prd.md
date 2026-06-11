# Thin stats API route adapter

## Goal

Move implementation logic out of `src/server/routes/api/stats.ts` so the route
file becomes a thinner Fastify adapter.

## Confirmed Facts

- `stats.ts` is currently about 1888 lines.
- Existing tests cover stats areas including marketplace, model probe, proxy
  debug, proxy logs, site status, snapshots, token candidates, and today reward
  fallback.
- Project rules say route files are adapters and should delegate business logic
  to services or neutral contracts.

## Requirements

- Preserve all stats endpoint paths, methods, status codes, payloads, and
  response shapes.
- Move cohesive query/aggregation/payload construction logic into existing or
  new service modules outside `src/server/routes/**`.
- Keep route code focused on Fastify registration, request parsing, auth/context
  extraction, and delegation.
- Do not touch token routing semantics or proxy log schema.

## Acceptance Criteria

- [x] `stats.ts` no longer owns large business/query construction blocks.
- [x] New service code follows existing `src/server/services/` naming and test
      patterns.
- [x] All existing `stats.*.test.ts` suites continue to pass.
- [x] `npm run repo:drift-check` remains clean.

## Validation

- Passed `npx vitest run --root . src/server/routes/api/stats.proxy-logs.test.ts`
- Passed `npx vitest run --root . src/server/routes/api/stats.siteStatus.test.ts`
- Passed `npx vitest run --root . src/server/routes/api/stats.token-candidates.test.ts`
- Passed `npx vitest run --root . src/server/routes/api/stats.marketplace.test.ts`
- Passed `npx vitest run --root . src/server/routes/api/stats.model-probe.test.ts`
- Passed `npx vitest run --root . src/server/routes/api/stats.proxy-debug.test.ts`
- Passed `npx vitest run --root . src/server/routes/api/stats.todayRewardFallback.test.ts`
- Passed `npx vitest run --root . src/server/routes/api/stats.snapshot-v2.test.ts`
- Passed `npm run typecheck:server`
- Passed `npm run repo:drift-check`
- Passed `git diff --check`
