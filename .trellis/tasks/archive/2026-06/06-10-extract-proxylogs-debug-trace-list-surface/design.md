# Design: Extract ProxyLogs debug trace list surface

## Task Shape

- This is a complex but single-deliverable UI refactor.
- No parent/child split is needed because the deliverable is one
  independently verifiable page-local surface: the Proxy Logs debug trace
  panel/list presentation.

## Architecture Boundary

- Add a new page-local domain module under `src/web/pages/proxy-logs/`, likely
  `DebugTraceListSurface.tsx`.
- `ProxyLogs.tsx` remains the route/page orchestration owner.
- The new surface owns only presentation for:
  - the `代理调试追踪` panel header and quick actions
  - summary metrics for enabled state, trace count, and latest trace time
  - capture/target summary text
  - collapsible `最近调试追踪` panel body
  - loading and empty states
  - mobile `MobileCard` list rendering
  - desktop `data-table` rendering
  - trace status badge presentation
  - pagination buttons and displayed range text

`ProxyLogs.tsx` keeps ownership of:

- runtime settings API calls and normalization
- debug trace list/detail API calls
- polling and refresh timers
- `debugTracePanelExpanded` state and localStorage persistence key
- `debugTraces`, `debugTracePage`, selected trace id, detail modal state, and
  detail cache state
- derived pagination values such as visible traces, safe page, total pages,
  displayed start, and displayed end
- settings modal open/close orchestration

## Component Contract

The new surface should be a controlled component. It should receive all data
and actions from `ProxyLogs.tsx` and should not call APIs, read/write
localStorage, create timers, or own route state.

Expected props include:

- `isMobile`
- `settings`
- `traces`
- `visibleTraces`
- `latestTrace`
- `loading`
- `saving`
- `panelExpanded`
- pagination values: `safePage`, `totalPages`, `displayedStart`,
  `displayedEnd`
- action callbacks: toggle panel, quick toggle debug, open settings, refresh
  traces, open trace detail, previous page, select page, next page

Pure presentation helpers can move with the surface:

- `formatProxyDebugCaptureSummary`
- `formatProxyDebugTargetSummary`
- `CompactSummaryMetric`
- `renderTraceStatusBadge`
- `compactSummaryMetricStyle`

## Data Flow

1. `ProxyLogs.tsx` loads settings and trace list data exactly as it does now.
2. `ProxyLogs.tsx` derives the latest trace and visible page slice.
3. `ProxyLogs.tsx` renders `DebugTraceListSurface` with derived values and
   callbacks.
4. The surface renders the existing UI and invokes callbacks for user actions.
5. `DebugSettingsSurface` and `DebugTraceDetailSurface` stay composed by
   `ProxyLogs.tsx`.

## Compatibility Requirements

- Preserve existing labels, button text, table headings, empty/loading text,
  CSS class names, and layout classes unless a type-only adjustment requires a
  small JSX reshuffle.
- Preserve `data-debug-trace-panel-toggle`,
  `data-debug-trace-panel-body`, pagination aria labels, and detail button
  text because tests already inspect them.
- Preserve the localStorage key
  `metapi.proxyLogs.debugTracePanelExpanded`; it remains in `ProxyLogs.tsx`.
- Keep import direction one-way: `ProxyLogs.tsx` imports the domain surface;
  the domain surface must not import `ProxyLogs.tsx`.
- Do not introduce a hook boundary or move debug trace state in this slice.
- Do not change backend API contracts or runtime settings keys.

## Trade-Offs

- Passing a larger props object is acceptable for this slice because it keeps
  side effects and lifecycle state in the route page, matching the frontend
  directory-structure spec.
- Extracting a hook would reduce prop count, but it would move orchestration
  and lifecycle concerns at the same time as JSX extraction, increasing review
  risk.
- Extracting only the list body would be smaller, but it would leave the panel
  shell and pagination in `ProxyLogs.tsx`, making the boundary less coherent.

## Rollback Shape

- Rollback should be limited to removing the new surface import/file and
  restoring the inline JSX in `ProxyLogs.tsx`.
- Because no API, persistence key, migration, or route contract changes are in
  scope, rollback should not require backend or data repair.
