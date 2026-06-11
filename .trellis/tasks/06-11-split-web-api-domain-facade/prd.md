# Split web API facade by domain

## Goal

Split `src/web/api.ts` into domain modules while preserving the existing facade
exports for callers.

## Confirmed Facts

- `src/web/api.ts` is currently about 1411 lines.
- Many pages import from `src/web/api.ts`, so a one-shot import migration would
  create unnecessary churn.
- `src/web/api.test.ts` already exists and should remain the first targeted
  regression suite.

## Requirements

- Create domain API modules under a stable `src/web/api/` structure or another
  locally consistent web API folder.
- Keep `src/web/api.ts` as a compatibility facade/barrel so existing imports
  continue to work.
- Preserve endpoint paths, methods, request payloads, response shapes, and error
  behavior.
- Reduce weak local typing only when existing shared/domain contracts make the
  conversion straightforward.

## Acceptance Criteria

- [ ] Domain-specific API code is moved out of the monolithic facade.
- [ ] Existing imports from `src/web/api.ts` continue to compile.
- [ ] `src/web/api.test.ts` continues to pass.
- [ ] No public HTTP API or response contract changes are made.

## Validation

- `npx vitest run --root . src/web/api.test.ts`
- `npm run typecheck`
- `npm run repo:drift-check` if architecture guard files are touched.
