# Converge proxy route body reads

## Goal

Converge legacy proxy route whole-body upstream reads on
`readRuntimeResponseText()` so route-level proxy paths use the same body reader
as proxy-core runtime paths.

## Confirmed Facts

- `npm run repo:drift-check` currently reports 0 violations and 0 tracked debt.
- Non-test `src/server/routes/proxy/*.ts` currently has direct `.text()` reads
  in:
  - `completions.ts`
  - `embeddings.ts`
  - `images.ts`
  - `search.ts`
  - `videos.ts`
- `readRuntimeResponseText()` already supports ordinary `undici.Response` bodies
  and zstd/stacked content encodings.
- This task should not change routing, retry, billing, persistence, API shape,
  or route ownership.

## Requirements

- Replace direct whole-body upstream `.text()` reads in the selected legacy
  proxy routes with `readRuntimeResponseText()`.
- Preserve existing fallback behavior for empty or unreadable error bodies.
- Keep stream reader loops unchanged.
- Add a scoped repo drift guard so new non-test route proxy `.text()` reads do
  not reappear.
- Update the drift-check unit test to cover the new guard.

## Acceptance Criteria

- [x] `rg -n "\.text\(" src/server/routes/proxy -g "*.ts" -g "!*.test.ts"`
      returns no matches.
- [x] Targeted proxy route tests pass for completions, embeddings, images,
      search, and videos.
- [x] `scripts/dev/repo-drift-check.test.ts` covers route proxy body-read drift.
- [x] `npm run typecheck:server` passes.
- [x] `npm run repo:drift-check` reports 0 violations and 0 tracked debt.

## Out of Scope

- Extracting new proxy-core surfaces.
- Changing retry policy, token-router success/failure bookkeeping, billing, or
  proxy log schema.
- Database migrations or public API changes.
