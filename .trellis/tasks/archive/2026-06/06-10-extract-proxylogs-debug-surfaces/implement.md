# Implementation Plan: Extract ProxyLogs debug surfaces

## Checklist

1. Run `trellis-before-dev` and re-read:
   - current task artifacts
   - frontend directory-structure spec
   - frontend quality guidelines
   - shared code reuse thinking guide
2. Inspect `ProxyLogs.tsx` debug sections around:
   - debug state setup
   - debug trace list/detail loaders
   - `renderTraceStatusBadge`
   - `renderAttemptDetail`
   - `renderDebugTraceDetailContent`
   - settings/detail modal and drawer JSX
3. Create `src/web/pages/proxy-logs/`.
4. Extract the lowest-risk debug presentation module first.
5. Update imports in `ProxyLogs.tsx`; avoid importing the page from domain
   modules.
6. Run validation after each meaningful extraction:
   - `npx vitest run --root . src/web/pages/ProxyLogs.server-driven.test.tsx`
   - `npm run typecheck:web`
   - `npm run typecheck:web:test`
   - `npm run repo:drift-check`
   - `git diff --check`
7. Stop after the presentation-only extraction unless the resulting code shows
   a small, clearly lower-risk hook boundary. Any hook extraction should be a
   deliberate second slice after focused tests pass.

## Risky Files

- `src/web/pages/ProxyLogs.tsx`
- `src/web/pages/ProxyLogs.server-driven.test.tsx`
- new files under `src/web/pages/proxy-logs/`

## Rollback Point

The safest rollback is to revert the extraction commit before any follow-up hook
or behavior refactor. Avoid mixing visual or API changes into the extraction
commit.
