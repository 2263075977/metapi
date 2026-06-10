# Implementation Plan: Extract ProxyLogs results surfaces

## Checklist

1. Run `trellis-before-dev` before editing code and re-read:
   - this task's `prd.md`, `design.md`, and `implement.md`
   - `.trellis/spec/frontend/directory-structure.md`
   - frontend component/code style specs that `trellis-before-dev` loads
2. Inspect the current `ProxyLogs.tsx` results section and helper usages:
   - result-only helper functions near the top of the file
   - `handleToggleExpand`
   - loading skeleton, mobile card list, desktop table, expanded detail row,
     and empty state
3. Extend `src/web/pages/proxy-logs/types.ts` with shared result contracts:
   - `ProxyLogRenderItem`
   - `ProxyLogDetailState`
4. Add `src/web/pages/proxy-logs/ProxyLogResultsSurface.tsx`.
   - Move the loading, mobile, desktop, detail, and empty-state JSX.
   - Move result-only presentation helpers into this module.
   - Keep API calls and route/pagination state out of the module.
5. Replace the inline results card/table block in `ProxyLogs.tsx` with
   `<ProxyLogResultsSurface ... />`.
   - Pass `logs`, `loading`, `isMobile`, `expandedLogId`, `detailById`,
     `siteIdByName`, and `onToggleExpand`.
   - Keep the existing pagination block in `ProxyLogs.tsx`.
6. Update source-reading tests:
   - keep filter-panel assertions pointed at `ProxyLogs.tsx`
   - point result layout assertions at
     `src/web/pages/proxy-logs/ProxyLogResultsSurface.tsx`
7. Run focused validation:
   - `npx vitest run --root . src/web/pages/ProxyLogs.server-driven.test.tsx src/web/pages/logs.mobile.test.tsx src/web/pages/responsiveFilterPanel.architecture.test.ts`
   - `npm run typecheck:web`
   - `npm run typecheck:web:test`
   - `npm run repo:drift-check`
   - `git diff --check`

## Risky Files

- `src/web/pages/ProxyLogs.tsx`
- `src/web/pages/proxy-logs/ProxyLogResultsSurface.tsx`
- `src/web/pages/proxy-logs/types.ts`
- `src/web/pages/logs.mobile.test.tsx`

## Rollback Point

The safe rollback is to revert the presentation extraction as one slice before
any follow-up hook or filter-panel extraction. Avoid mixing UI redesign, API
changes, pagination changes, or debug trace changes into the extraction.

## Review Gate Before Start

Before running `python ./.trellis/scripts/task.py start`, review that:

- `prd.md` has no blocking open questions.
- `design.md` keeps route/API/state orchestration in `ProxyLogs.tsx`.
- `implement.md` has focused validation commands and rollback points.
- The user has approved starting implementation.
