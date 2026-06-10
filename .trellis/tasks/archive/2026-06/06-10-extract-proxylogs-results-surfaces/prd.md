# Extract ProxyLogs results surfaces

## Goal

Reduce the remaining `src/web/pages/ProxyLogs.tsx` route-page complexity by
extracting the main proxy log results presentation into
`src/web/pages/proxy-logs/` domain modules, without changing proxy log
filtering, pagination, detail loading, mobile layout, or table behavior.

This is a follow-up to the completed debug-surface extraction. The value is a
smaller route/page orchestration surface and clearer ownership for repeated
mobile-card / desktop-table / expanded-detail rendering.

## Confirmed Facts

- Current Trellis state: this task is the active `planning` task; the
  separate `00-bootstrap-guidelines` task remains active separately.
- `ProxyLogs.tsx` is still one of the largest top-level page files after the
  debug-surface extraction:
  - `Accounts.tsx`: 3399 lines
  - `ModelTester.tsx`: 2846 lines
  - `ProxyLogs.tsx`: 2762 lines
- The previous optimization task extracted debug settings and debug trace
  detail surfaces into `src/web/pages/proxy-logs/`, but intentionally left the
  main proxy log results section in the page.
- The current `src/web/pages/proxy-logs/` folder already owns
  `DebugSettingsSurface.tsx`, `DebugTraceDetailSurface.tsx`,
  `debugStoredValue.ts`, `debugSurfaceStyles.ts`, and `types.ts`.
- Remaining inline concerns in `ProxyLogs.tsx` include:
  - filter controls and `ResponsiveFilterPanel` composition
  - proxy debug trace list mobile/desktop rendering
  - main proxy log mobile `MobileCard` list rendering
  - main proxy log desktop `data-table` rendering
  - expanded proxy log detail rendering and billing/process line presentation
- The main results block currently branches on `isMobile` inside
  `ProxyLogs.tsx`: mobile renders compact `MobileCard` entries, desktop renders
  a `data-table`, and both paths duplicate detail merging, path metadata,
  billing summary/process lines, downstream key summary, stream mode, and
  first-byte labels.
- Result-only helpers such as `formatBillingDetailSummary`,
  `buildBillingProcessLines`, `formatProxyLogUsageSource`,
  `formatProxyLogTokenValue`, `renderDownstreamKeySummary`,
  `resolveProxyLogClientDisplay`, and `renderProxyLogClientCell` are only used
  by the results mobile/table/detail rendering block.
- Existing source-reading tests currently inspect `ProxyLogs.tsx` directly:
  - `src/web/pages/logs.mobile.test.tsx` expects `MobileCard`,
    `ResponsiveFilterPanel`, `compact`, `mobile-summary-grid`, and
    `subtitle={formatDateTimeLocal(log.createdAt)}` in `ProxyLogs.tsx`.
  - `src/web/pages/responsiveFilterPanel.architecture.test.ts` expects
    `ProxyLogs.tsx` to import `ResponsiveFilterPanel`.
- `.trellis/spec/frontend/directory-structure.md` now documents that large
  route pages may extract page-local modal, drawer, or detail surfaces into a
  domain subfolder, while route state/loaders stay in the route page unless a
  hook boundary is explicitly part of the task.
- This task has one independently verifiable deliverable, so a parent/child
  Trellis task split is not needed.

## Requirements

- Preserve current Proxy Logs behavior, labels, route query behavior,
  pagination, detail expansion, mobile card layout, desktop table layout, and
  data-loading behavior.
- Extract the main proxy log results presentation slice into
  `src/web/pages/proxy-logs/`.
- Keep `ProxyLogs.tsx` as the route/page orchestration surface: route state,
  API loading, pagination state, selected/expanded id state, and persistence
  should remain in the page for the first slice.
- Update source-reading architecture/mobile tests if their asserted primitives
  move to a domain module. The filter-panel architecture assertion should stay
  pointed at `ProxyLogs.tsx` unless the filter panel also moves.
- Keep imports one-way: `ProxyLogs.tsx` may import domain modules; domain
  modules must not import `ProxyLogs.tsx`.
- Do not combine this with backend API changes, filter redesign, data-contract
  changes, or hook extraction unless planning explicitly expands scope.

## Acceptance Criteria

- [ ] The selected proxy log results presentation slice is moved from
      `ProxyLogs.tsx` into `src/web/pages/proxy-logs/` modules.
- [ ] `ProxyLogs.tsx` remains responsible for route/page orchestration and is
      smaller by a meaningful amount.
- [ ] User-visible proxy log list, detail expansion, filtering, pagination, and
      mobile/desktop rendering remain unchanged.
- [ ] Source-reading tests are updated to follow the new owner file when
      layout primitives move.
- [ ] Focused Proxy Logs tests pass:
      `npx vitest run --root . src/web/pages/ProxyLogs.server-driven.test.tsx src/web/pages/logs.mobile.test.tsx src/web/pages/responsiveFilterPanel.architecture.test.ts`.
- [ ] Frontend type checks pass: `npm run typecheck:web` and
      `npm run typecheck:web:test`.
- [ ] `npm run repo:drift-check` remains at 0 violations / 0 tracked debt.
- [ ] `git diff --check` passes.

## Out Of Scope

- Backend stats/proxy-log API changes.
- Redesigning Proxy Logs filters, cards, tables, or detail content.
- Extracting proxy log data/state orchestration into a hook in the first slice.
- Splitting unrelated large pages such as Accounts, ModelTester, or Settings.

## Open Question

- None blocking planning. The first slice is the main proxy log results
  list/table/detail presentation; filter-panel extraction remains out of scope
  for this task.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
