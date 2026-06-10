# Extract ProxyLogs debug trace list surface

## Goal

Continue reducing `src/web/pages/ProxyLogs.tsx` route-page complexity by
extracting the proxy debug trace list/panel presentation into
`src/web/pages/proxy-logs/` domain modules, without changing debug trace
settings, trace detail loading, refresh behavior, pagination, persistence, or
mobile/desktop rendering.

This is a follow-up to the completed debug settings/detail surface extraction
and results surface extraction. The value is keeping `ProxyLogs.tsx` focused on
route/page orchestration while moving another self-contained mobile/desktop
presentation block behind a page-local domain module.

## Confirmed Facts

- Current Trellis state: no implementation task was active before this task was
  created; `00-bootstrap-guidelines` remains active separately.
- Recent completed commits:
  - `bf0af60 refactor: extract proxy logs debug surfaces`
  - `7f9cf94 refactor: extract proxy logs results surface`
- `ProxyLogs.tsx` is smaller after the results extraction but still has about
  1698 lines.
- Remaining inline debug trace list/panel concerns in `ProxyLogs.tsx` include:
  - persisted `debugTracePanelExpanded` panel shell
  - latest trace summary text and quick actions
  - trace list loading/empty states
  - mobile `MobileCard` rendering for visible debug traces
  - desktop `data-table` rendering for visible debug traces
  - trace-list pagination controls and displayed range labels
  - `renderTraceStatusBadge(trace)` presentation helper
- Repository inspection shows those concerns live in one contiguous render
  block, while the route page also owns the related state, loaders, polling,
  localStorage persistence, and selected trace-detail modal state.
- `ProxyLogs.server-driven.test.tsx` already covers the trace list surface
  behavior that must remain stable: settings access, pagination in groups of
  five, panel collapse/expand, localStorage restoration, on-demand detail
  loading, polling while enabled, and detail stability during polling refresh.
- Existing `src/web/pages/proxy-logs/` modules already own:
  - `DebugSettingsSurface.tsx`
  - `DebugTraceDetailSurface.tsx`
  - `ProxyLogResultsSurface.tsx`
  - `debugStoredValue.ts`
  - `debugSurfaceStyles.ts`
  - `types.ts`
- `.trellis/spec/frontend/directory-structure.md` says large route pages may
  extract page-local modal, drawer, detail, or repeated mobile/desktop shell
  JSX into `src/web/pages/<domain>/`, while route state/loaders stay in the
  route page unless a focused hook boundary is part of the task.
- The same frontend spec says route pages should keep request orchestration,
  route state, polling, cache refs, and persistence keys, and move repeated
  mobile/desktop shell JSX plus pure presentation helpers into the domain
  module.

## Requirements

- Preserve current Proxy Logs and debug trace behavior, labels, persistence
  key, automatic refresh, detail-modal opening, settings flows, visible trace
  pagination, mobile cards, and desktop table layout.
- Extract only the debug trace list/panel presentation slice into
  `src/web/pages/proxy-logs/`.
- Keep `ProxyLogs.tsx` as the route/page orchestration surface: API calls,
  debug trace list/detail state, selected trace id, refresh timers,
  persistence, and modal open/close state should remain in the page for the
  first slice.
- Keep imports one-way: `ProxyLogs.tsx` may import domain modules; domain
  modules must not import `ProxyLogs.tsx`.
- Do not combine this with backend debug trace API changes, hook extraction,
  filter extraction, results surface changes, or visual redesign unless
  planning explicitly expands scope.

## Scope Decision

- Extract the whole debug trace panel presentation in this implementation
  slice, including the header/summary, quick actions, loading and empty states,
  mobile cards, desktop table, status badge helper, and pagination controls.
- Keep state, loaders, polling, localStorage persistence, selected trace-detail
  state, and modal open/close orchestration in `ProxyLogs.tsx`.
- This decision was approved by the user after repository inspection showed
  the panel concerns form one contiguous render block with shared props and
  existing tests cover the behaviors that must remain stable.

## Acceptance Criteria

- [ ] The proxy debug trace list/panel presentation is moved from
      `ProxyLogs.tsx` into `src/web/pages/proxy-logs/` module(s).
- [ ] `ProxyLogs.tsx` remains responsible for route/page orchestration and is
      smaller by a meaningful amount.
- [ ] Debug trace enablement, list refresh, persisted expansion, selected trace
      detail opening, visible trace pagination, and mobile/desktop rendering
      remain unchanged.
- [ ] Focused Proxy Logs tests pass:
      `npx vitest run --root . src/web/pages/ProxyLogs.server-driven.test.tsx`.
- [ ] Frontend type checks pass: `npm run typecheck:web` and
      `npm run typecheck:web:test`.
- [ ] `npm run repo:drift-check` remains at 0 violations / 0 tracked debt.
- [ ] `git diff --check` passes.

## Out Of Scope

- Backend proxy debug trace route or response-contract changes.
- Extracting debug trace data/state orchestration into a hook.
- Redesigning the debug trace panel, cards, table, or pagination.
- Moving the main proxy log filters or results surface.
- Splitting unrelated large pages such as Accounts, ModelTester, or Settings.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
