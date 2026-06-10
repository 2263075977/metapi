# Implementation Plan: Extract ProxyLogs controls surface

## Preconditions

- Do not start implementation until the user reviews the planning artifacts and
  approves `task.py start`.
- Scope decision is resolved: extract the whole controls surface, including
  header KPI/refresh actions, `ResponsiveFilterPanel`, filter controls, invalid
  time alert, and pagination.
- After start, load `trellis-before-dev` before editing application code.
- Inline Codex mode is active, so no sub-agent JSONL curation is required.

## Ordered Checklist

1. Re-read this task's `prd.md`, `design.md`, and `implement.md`, then load
   `trellis-before-dev`.
2. Re-read the current `ProxyLogs.tsx` controls sections:
   - `filterControls`
   - page header KPI chips and refresh actions
   - `ResponsiveFilterPanel` composition
   - invalid time range alert
   - bottom pagination block
3. Add `src/web/pages/proxy-logs/ProxyLogControlsSurface.tsx`.
   - Move the page header, KPI chips, refresh buttons, filter drawer/toolbar,
     and filter controls into the new surface.
   - Keep it controlled by props and callbacks from `ProxyLogs.tsx`.
   - Import `ResponsiveFilterPanel`, `ModernSelect`, and `tr` from shared
     modules as needed.
4. Add named exports in the same file, or a focused second file if cleaner, for
   the invalid time range alert and main pagination controls.
   - Preserve current placement around debug trace and results surfaces.
   - Preserve `pagination`, `pagination-btn`, and `pagination-size` class
     names and labels.
5. Update `ProxyLogs.tsx`.
   - Replace inline controls JSX with the extracted surface(s).
   - Keep route query state, API calls, refresh timers, filter/page state,
     derived options, derived pagination values, debug trace surfaces, and
     results surface composition in the route page.
   - Replace direct state setter wiring with route-owned intent callbacks where
     the existing behavior resets `page` to `1`.
   - Remove imports no longer used by `ProxyLogs.tsx`.
6. Update `src/web/pages/logs.mobile.test.tsx`.
   - Point `ResponsiveFilterPanel` source-reading assertions at the new
     controls module.
   - Keep result layout assertions pointed at
     `src/web/pages/proxy-logs/ProxyLogResultsSurface.tsx`.
7. Inspect final imports and ownership.
   - `ProxyLogs.tsx` may import `ProxyLogControlsSurface` and related controls
     exports.
   - No domain module may import `ProxyLogs.tsx`.
   - The new controls module must have no API calls, route navigation,
     localStorage access, timers, or backend contract knowledge.

## Validation Commands

Run these before reporting implementation complete:

```bash
npx vitest run --root . src/web/pages/ProxyLogs.server-driven.test.tsx
npx vitest run --root . src/web/pages/logs.mobile.test.tsx
npm run typecheck:web
npm run typecheck:web:test
npm run repo:drift-check
git diff --check
```

If a command fails, inspect whether the failure is caused by this extraction
before claiming the task is complete.

## Risky Files And Checks

- `src/web/pages/ProxyLogs.tsx`
  - Risk: accidentally moving route/query/polling behavior.
  - Check: route query synchronization and refresh effects stay in the route
    page.
- `src/web/pages/proxy-logs/ProxyLogControlsSurface.tsx`
  - Risk: prop contract becomes stateful or starts coordinating side effects.
  - Check: the module renders from props and emits callbacks only.
- `src/web/pages/logs.mobile.test.tsx`
  - Risk: source-reading assertions still point at the old owner.
  - Check: assertions follow the new source owner without weakening the mobile
    layout signal.

## Rollback Point

The safe rollback is to revert the controls extraction as one slice before any
follow-up hook extraction or UI redesign. Avoid mixing backend changes, route
query changes, debug trace changes, results surface changes, or visual redesign
into this task.

## Review Gate Before Start

Before running `python ./.trellis/scripts/task.py start`, review that:

- `prd.md` has no blocking open questions.
- `design.md` keeps route/API/state orchestration in `ProxyLogs.tsx`.
- `implement.md` has focused validation commands and rollback points.
- The user has approved starting implementation.
