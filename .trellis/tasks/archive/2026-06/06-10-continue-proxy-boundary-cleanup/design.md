# Continue Proxy Boundary Cleanup Design

## Scope

This slice removes the two temporary backend proxy-route dependency exceptions
left after moving downstream policy helpers into proxy-core:

- `proxy-core/surfaces/filesSurface.ts -> routes/proxy/multipart.ts`
- `services/runtimeDispatch.ts -> routes/proxy/runtimeExecutor.ts`

The implementation must preserve runtime behavior and only move module
ownership/imports.

## Current Boundary Problems

### Multipart Helpers

`src/server/routes/proxy/multipart.ts` exports helpers that are shared by route
adapters and proxy-core file surface:

- `ensureMultipartBufferParser`
- `isMultipartRequest`
- `parseMultipartFormData`
- `cloneFormDataWithOverrides`

Callers:

- `src/server/proxy-core/surfaces/filesSurface.ts`
- `src/server/routes/proxy/images.ts`
- `src/server/routes/proxy/videos.ts`

Because `filesSurface.ts` is proxy-core, the helper should not live under the
route layer.

### Runtime Dispatch

`src/server/routes/proxy/runtimeExecutor.ts` implements runtime executor
dispatch but imports only proxy-core executors and runtime types. It is not a
route adapter and is consumed through `src/server/services/runtimeDispatch.ts`,
which currently re-exports route-layer code.

Callers:

- `src/server/services/runtimeModelProbe.ts`
- `src/server/proxy-core/surfaces/sharedSurface.ts`
- `src/server/proxy-core/surfaces/geminiSurface.ts`
- tests that mock `src/server/services/runtimeDispatch.ts`

## Proposed Module Placement

Move multipart helpers to:

`src/server/proxy-core/multipart.ts`

Rationale:

- Multipart parsing is proxy request infrastructure.
- It still depends on Fastify request/app types, which fits proxy-core better
  than a general service module.
- Route adapters may import proxy-core helper modules.

Move runtime dispatch implementation to:

`src/server/proxy-core/runtime/runtimeDispatch.ts`

Rationale:

- Dispatch chooses among proxy-core runtime executors.
- It is not service-layer business logic and not route registration.
- Existing `src/server/services/runtimeDispatch.ts` can remain as a compatibility
  re-export only if needed by service tests, but it must re-export from
  proxy-core, not routes.

Remove or turn `src/server/routes/proxy/runtimeExecutor.ts` into a route-local
compatibility shim only if tests require staged migration. Preferred outcome:
delete the route-layer runtime executor file and move its tests next to the new
proxy-core module.

## Architecture Test Contract

Update `src/server/routes/proxy/architecture-boundaries.test.ts` so the
temporary allowlist for route proxy imports is empty or removed:

- `src/server/proxy-core/**` must not import `src/server/routes/proxy/**`.
- `src/server/services/**` must not import `src/server/routes/proxy/**`.

## Compatibility

No runtime behavior should change:

- Multipart uploads to `/v1/files`, `/v1/images/edits`, and `/v1/videos` must
  continue to parse and forward file fields.
- Runtime executor dispatch must still route `codex`, `claude`, `gemini-cli`,
  `antigravity`, and default executor requests exactly as before.
- Existing service tests that mock `services/runtimeDispatch.ts` should keep a
  stable mock seam unless all call sites are intentionally moved.

## Validation

Minimum validation:

- `npm run typecheck:server`
- `npx vitest run --root . src/server/routes/proxy/architecture-boundaries.test.ts`
- `npx vitest run --root . src/server/proxy-core/runtime/runtimeDispatch.test.ts`
  or the migrated equivalent test path
- `npx vitest run --root . src/server/routes/proxy/files.test.ts src/server/routes/proxy/images.edits.test.ts src/server/routes/proxy/videos.test.ts`
- `npm run repo:drift-check`

Use a longer hook timeout for route tests if local database/bootstrap hooks
exceed Vitest's default.
