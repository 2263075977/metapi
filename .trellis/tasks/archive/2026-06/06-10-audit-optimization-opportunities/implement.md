# Backend Proxy Boundary Cleanup Implementation Plan

## Checklist

1. Move downstream policy helper implementation
   - Add `src/server/proxy-core/downstreamPolicy.ts`.
   - Preserve the existing exports and behavior from
     `src/server/routes/proxy/downstreamPolicy.ts`.
   - Update imports in proxy-core surfaces and proxy route files to the new
     module path.
   - Remove the old route-layer helper file if no callers remain.

2. Add executable boundary protection
   - Extend `src/server/routes/proxy/architecture-boundaries.test.ts` or add a
     nearby architecture test.
   - Assert that `src/server/proxy-core/**` does not import
     `src/server/routes/proxy/**`.
   - Assert that `src/server/services/**` does not import
     `src/server/routes/proxy/**`.
   - Keep allowed exceptions explicit only if a later slice owns them.

3. Verify unchanged behavior
   - Confirm model restriction rejection still uses the same 403 payload.
   - Confirm empty proxy auth context remains allowed.
   - Confirm downstream cost usage still delegates to managed key usage when
     `keyId` exists.

4. Leave follow-up slices untouched
   - Do not move multipart helpers in this slice.
   - Do not move runtime dispatch in this slice.
   - Do not convert direct `.text()` reads in this slice.

## Validation Commands

Run after implementation:

```bash
npm run typecheck:server
npx vitest run --root . src/server/routes/proxy/architecture-boundaries.test.ts
```

Run if helper behavior or auth interaction changes beyond imports:

```bash
npx vitest run --root . src/server/middleware/auth.proxy.test.ts src/server/routes/proxy/models.test.ts src/server/routes/proxy/chat.stream.test.ts
```

Run before finishing if any shared architecture boundary beyond this slice is
touched:

```bash
npm run repo:drift-check
```

## Risk Points

- Import path churn can accidentally leave a re-export under `routes/proxy`.
- A broad architecture assertion can fail on known follow-up violations such as
  multipart or runtime dispatch; keep this slice focused or explicitly stage the
  exceptions.
- Full `chat.stream.test.ts` is large; if it is too slow, first run the
  architecture test and server typecheck, then decide whether targeted runtime
  tests are needed from the actual diff.

## Rollback

Revert the import path changes and remove the new proxy-core helper module.
Because the slice is intended to be pure relocation plus tests, rollback should
not require data migrations or runtime state changes.
