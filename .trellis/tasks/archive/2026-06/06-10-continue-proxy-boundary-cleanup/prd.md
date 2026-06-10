# Continue proxy boundary cleanup

## Goal

Continue the backend proxy boundary cleanup after the first slice moved
downstream policy helpers into `src/server/proxy-core/`. The next slice should
remove remaining route-layer helper dependencies from proxy-core/services while
keeping behavior unchanged and validation focused.

## Confirmed Facts

- Previous completed work:
  - `271a056 refactor: move downstream policy into proxy core`
  - `a10dcb7 chore(task): archive 06-10-audit-optimization-opportunities`
  - `7449822 chore: record journal`
- `npm run repo:drift-check` currently reports 0 violations and 2 tracked debt
  items. The backend debt is:
  - `src/server/proxy-core/surfaces/filesSurface.ts` imports
    `../../routes/proxy/multipart.js`.
- The architecture boundary test added in the previous slice currently allows
  two temporary proxy-route dependency debts:
  - `../../proxy-core/surfaces/filesSurface.ts imports ../../routes/proxy/multipart.js`
  - `../../services/runtimeDispatch.ts imports ../routes/proxy/runtimeExecutor.js`
- `src/server/routes/proxy/multipart.ts` exports:
  - `ensureMultipartBufferParser`
  - `isMultipartRequest`
  - `parseMultipartFormData`
  - `cloneFormDataWithOverrides`
- Multipart helpers are used by:
  - `src/server/proxy-core/surfaces/filesSurface.ts`
  - `src/server/routes/proxy/images.ts`
  - `src/server/routes/proxy/videos.ts`
- `src/server/services/runtimeDispatch.ts` currently re-exports
  `dispatchRuntimeRequest` from `src/server/routes/proxy/runtimeExecutor.ts`.
- `src/server/routes/proxy/runtimeExecutor.ts` owns executor dispatch logic but
  imports only proxy-core executors and runtime types, so it is a strong
  candidate to move under `src/server/proxy-core/runtime/`.
- Runtime dispatch is consumed by:
  - `src/server/services/runtimeModelProbe.ts`
  - `src/server/proxy-core/surfaces/sharedSurface.ts`
  - `src/server/proxy-core/surfaces/geminiSurface.ts`
  - tests that currently mock `src/server/services/runtimeDispatch.ts`

## Requirements

- Remove the remaining backend route-layer helper dependencies introduced as
  temporary exceptions in the previous architecture test.
- Preserve behavior for multipart file/image/video proxy requests.
- Preserve behavior for runtime executor dispatch across codex, claude,
  gemini-cli, antigravity, and default executor fallback.
- Keep the implementation narrow: no direct `.text()` cleanup, frontend cleanup,
  or routing algorithm changes in this slice.
- Update or tighten architecture tests so no temporary proxy-route dependency
  exception remains for backend proxy-core/services.
- Follow existing validation expectations for architecture boundary changes.

## Acceptance Criteria

- [ ] `src/server/proxy-core/**` no longer imports from
      `src/server/routes/proxy/**`.
- [ ] `src/server/services/**` no longer imports from
      `src/server/routes/proxy/**`.
- [ ] The architecture boundary test no longer needs temporary exceptions for
      multipart or runtime dispatch.
- [ ] `npm run typecheck:server` passes.
- [ ] Targeted proxy/runtime tests pass.
- [ ] `npm run repo:drift-check` reports no backend proxy-route import debt.

## Proposed Scope

1. Move multipart helper implementation out of `src/server/routes/proxy/`.
   Candidate destination: `src/server/proxy-core/multipart.ts`.
2. Move runtime executor dispatch implementation out of
   `src/server/routes/proxy/`.
   Candidate destination: `src/server/proxy-core/runtime/runtimeDispatch.ts`.
3. Leave small route-layer re-export shims only if tests or route import churn
   require a staged migration; otherwise remove route-owned helper files.
4. Remove the two temporary allowlist entries from
   `src/server/routes/proxy/architecture-boundaries.test.ts`.

## Out of Scope

- Direct upstream `Response.text()` cleanup.
- Frontend page decomposition.
- `tokenRouter.ts` modularization.
- New user-visible behavior.
- Dependency installation or upgrades.

## Open Questions

- Resolved: remove both temporary backend boundary exceptions (`multipart` and
  `runtimeDispatch`) in this slice.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
