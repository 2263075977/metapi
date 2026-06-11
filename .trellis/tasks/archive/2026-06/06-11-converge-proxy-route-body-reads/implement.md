# Implementation Plan

1. Load backend guidance before code edits.
2. Import `readRuntimeResponseText()` into:
   - `src/server/routes/proxy/completions.ts`
   - `src/server/routes/proxy/embeddings.ts`
   - `src/server/routes/proxy/images.ts`
   - `src/server/routes/proxy/search.ts`
   - `src/server/routes/proxy/videos.ts`
3. Replace all direct route-level whole-body `.text()` calls with the helper,
   preserving existing empty-body fallback strings where needed.
4. Extend `scripts/dev/repo-drift-check.ts` with a route proxy body-read rule
   and update `scripts/dev/repo-drift-check.test.ts`.
5. Run:
   - `rg -n "\.text\(" src/server/routes/proxy -g "*.ts" -g "!*.test.ts"`
   - `npx vitest run --root . scripts/dev/repo-drift-check.test.ts`
   - `npx vitest run --root . src/server/routes/proxy/completions.usage-source.test.ts src/server/routes/proxy/completions.siteApiEndpoint.test.ts src/server/routes/proxy/embeddings.siteApiEndpoint.test.ts src/server/routes/proxy/images.edits.test.ts src/server/routes/proxy/search.test.ts src/server/routes/proxy/videos.test.ts`
   - `npx vitest run --root . src/server/routes/proxy/architecture-boundaries.test.ts`
   - `npm run typecheck:server`
   - `npm run repo:drift-check`

## Rollback Point

If helper substitution changes route behavior, revert only the affected route
file and leave the drift-check rule until the behavior mismatch is understood.
