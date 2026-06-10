# Extract ProxyLogs controls surface

## Goal

Continue reducing `src/web/pages/ProxyLogs.tsx` route-page complexity by
extracting the main Proxy Logs controls presentation into
`src/web/pages/proxy-logs/` domain module(s), without changing route query
sync, server-driven filtering, pagination, refresh behavior, summary values,
or mobile/desktop rendering.

This is a follow-up to the completed debug surfaces, results surface, and debug
trace list surface extractions. The value is keeping `ProxyLogs.tsx` focused on
route/page orchestration while moving another cohesive presentation slice out
of the route file.

## Confirmed Facts

- Current Trellis state: this task is active in `in_progress`; the separate
  `00-bootstrap-guidelines` task is also active and unrelated.
- Recent completed commits:
  - `606d000 refactor: extract proxy logs debug trace list surface`
  - `7f9cf94 refactor: extract proxy logs results surface`
  - `bf0af60 refactor: extract proxy logs debug surfaces`
- `ProxyLogs.tsx` is now about 1198 lines after the latest extraction.
- Existing `src/web/pages/proxy-logs/` modules already own:
  - `DebugSettingsSurface.tsx`
  - `DebugTraceDetailSurface.tsx`
  - `DebugTraceListSurface.tsx`
  - `ProxyLogResultsSurface.tsx`
  - `debugStoredValue.ts`
  - `debugSurfaceStyles.ts`
  - `types.ts`
- Remaining inline controls/presentation concerns in `ProxyLogs.tsx` include:
  - `filterControls` JSX for status tabs, client/site selects, time inputs,
    search input, and reset button
  - `ResponsiveFilterPanel` composition for mobile drawer and desktop toolbar
  - page header KPI chips and manual/auto refresh buttons
  - invalid time-range alert placement
  - bottom pagination controls, displayed range label, and page-size selector
  - page-number rendering from derived `pageNumbers`
- `ProxyLogs.server-driven.test.tsx` already covers behavior this task must
  preserve: server-driven status/client/search changes, route query hydration
  for site/time filters, summary counts, and rendered pagination text.
- `logs.mobile.test.tsx` is a source-reading test that currently expects
  `ResponsiveFilterPanel` in `ProxyLogs.tsx`; if the controls shell moves,
  that assertion likely needs to follow the new domain module.
- `.trellis/spec/frontend/directory-structure.md` says top-level pages are
  orchestration surfaces and large route pages may move repeated
  mobile/desktop shell JSX plus pure presentation helpers into
  `src/web/pages/<domain>/`, while route state/loaders stay in the route page.
- Local code inspection shows the controls area is one coherent presentation
  surface around the results list: the page header actions and KPI chips,
  `ResponsiveFilterPanel`, filter controls, invalid time alert, and bottom
  pagination all render from route-owned filter, summary, loading, and
  pagination state.
- This is a complex but single-deliverable UI refactor. It does not need a
  parent/child task split, but it should have `design.md` and `implement.md`
  before implementation starts.

## Requirements

- Preserve current Proxy Logs behavior, labels, query params, API request
  parameters, summary chips, filter reset behavior, route hydration, automatic
  refresh, manual refresh, invalid time-range alert, pagination, page-size
  changes, and mobile/desktop filter rendering.
- Extract only the main controls presentation slice into
  `src/web/pages/proxy-logs/`.
- Keep `ProxyLogs.tsx` as the route/page orchestration surface: route state,
  URL query synchronization, API calls, refresh timers, filter state, and page
  state should remain in the page for this slice.
- Keep imports one-way: `ProxyLogs.tsx` may import domain modules; domain
  modules must not import `ProxyLogs.tsx`.
- Do not combine this with route-state hook extraction, backend API changes,
  debug trace changes, results surface changes, or visual redesign unless
  planning explicitly expands scope.

## Acceptance Criteria

- [ ] The main Proxy Logs controls presentation is moved from `ProxyLogs.tsx`
      into `src/web/pages/proxy-logs/` module(s).
- [ ] `ProxyLogs.tsx` remains responsible for route/page orchestration and is
      smaller by a meaningful amount.
- [ ] Server-driven filters, URL query hydration, invalid time-range handling,
      auto/manual refresh, pagination, and page-size changes remain unchanged.
- [ ] Focused Proxy Logs tests pass:
      `npx vitest run --root . src/web/pages/ProxyLogs.server-driven.test.tsx`.
- [ ] Mobile layout/source test passes:
      `npx vitest run --root . src/web/pages/logs.mobile.test.tsx`.
- [ ] Frontend type checks pass: `npm run typecheck:web` and
      `npm run typecheck:web:test`.
- [ ] `npm run repo:drift-check` remains at 0 violations / 0 tracked debt.
- [ ] `git diff --check` passes.

## Out Of Scope

- Backend proxy log route or response-contract changes.
- Extracting route query/filter state into a hook.
- Redesigning the page header, filters, toolbar, pagination, or mobile drawer.
- Moving debug trace surfaces or the results list again.
- Splitting unrelated pages.

## Resolved Scope Decision

- The first implementation slice will extract the whole controls surface:
  page header KPI chips, refresh actions, `ResponsiveFilterPanel`, filter
  controls, invalid time alert, and pagination.
- State, loaders, route query sync, refresh timers, and pagination derivation
  stay in `ProxyLogs.tsx`.
- Trade-off accepted: the props contract will be broader than a filter-only
  extraction, but the boundary is more coherent and avoids another follow-up
  touching the same JSX area.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
