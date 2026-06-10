# Continue Proxy Boundary Cleanup Implementation Plan

## Checklist

1. Move multipart helpers
   - Move `src/server/routes/proxy/multipart.ts` to
     `src/server/proxy-core/multipart.ts`.
   - Update imports in `filesSurface.ts`, `images.ts`, and `videos.ts`.
   - Remove the old route-layer file if no callers remain.

2. Move runtime dispatch
   - Move `src/server/routes/proxy/runtimeExecutor.ts` to
     `src/server/proxy-core/runtime/runtimeDispatch.ts`.
   - Update imports inside the moved file from route-relative paths to
     proxy-core-relative paths.
   - Update `src/server/services/runtimeDispatch.ts` to re-export from the new
     proxy-core runtime module.
   - Move `runtimeExecutor.test.ts` to the matching proxy-core runtime test path
     and update imports/types.

3. Tighten architecture test
   - Remove `knownFollowUpBoundaryDebts` allowlist entries for multipart and
     runtime dispatch.
   - Keep the scanner asserting no unexpected imports from
     `routes/proxy/**`.

4. Verify no stale route-layer helper imports remain
   - Search for `routes/proxy/multipart`, `./multipart`, and
     `routes/proxy/runtimeExecutor`.
   - Search for `knownFollowUpBoundaryDebts`.

5. Leave unrelated cleanup untouched
   - Do not change direct `Response.text()` reads.
   - Do not change frontend page imports.
   - Do not alter runtime executor behavior.

## Validation Commands

Run after implementation:

```bash
npm run typecheck:server
npx vitest run --root . src/server/routes/proxy/architecture-boundaries.test.ts
npx vitest run --root . src/server/proxy-core/runtime/runtimeDispatch.test.ts
npx vitest run --root . src/server/routes/proxy/files.test.ts src/server/routes/proxy/images.edits.test.ts src/server/routes/proxy/videos.test.ts
npm run repo:drift-check
git diff --check
```

If route tests hit default hook timeout, rerun with:

```bash
npx vitest run --root . --hookTimeout 30000 <test files>
```

## Risk Points

- Moving runtime dispatch changes relative imports from `../../proxy-core/*` to
  nearby `../executors/*`; typecheck should catch missed paths.
- Service tests mock `./runtimeDispatch.js`; preserving a service re-export from
  proxy-core keeps that seam stable.
- Multipart helpers use Fastify parser registration state on the app instance;
  moving the file must not rename the marker property or change parser behavior.

## Rollback

Revert the file moves and import updates. This slice has no database, runtime
state, or user-visible data migration.
