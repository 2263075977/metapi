# Design: Extract ProxyLogs controls surface

## Task Shape

- This is a complex but single-deliverable UI refactor.
- No parent/child split is needed because the deliverable is one
  independently verifiable page-local controls surface for Proxy Logs.

## Architecture And Boundaries

`ProxyLogs.tsx` remains the route/page orchestration owner. It should continue
to own:

- route query hydration and URL synchronization
- API/meta loading and refresh timers
- filter, search, time range, summary, loading, mobile drawer, and pagination
  state
- derived pagination values such as `safePage`, `totalPages`,
  `displayedStart`, `displayedEnd`, and the page-number window unless moving a
  pure page-number helper is mechanically simpler
- debug trace settings/list/detail orchestration and modal state
- result list/detail expansion orchestration

New page-local module(s) should live under `src/web/pages/proxy-logs/`, matching
the existing debug and results surface extractions.

Recommended module shape:

- `ProxyLogControlsSurface.tsx`
  - Default export renders the page header, KPI chips, auto/manual refresh
    buttons, `ResponsiveFilterPanel`, status tabs, client/site filters, time
    fields, search field, and reset button.
  - Named exports can render the invalid time range alert and main list
    pagination controls if keeping their current placement requires composing
    them separately around the debug trace and results surfaces.
  - If the file becomes too large, split pagination into
    `ProxyLogPaginationControls.tsx`; this remains the same deliverable.

The new controls modules own only presentation. They may import shared UI
primitives such as `ResponsiveFilterPanel`, `ModernSelect`, and `tr`, but they
must not call APIs, read/write route state, start timers, touch localStorage, or
import `ProxyLogs.tsx`.

## Component Contract

The controls surface should be controlled by `ProxyLogs.tsx`. Expected props
include:

- mobile shell: `isMobile`, `mobileOpen`, `onMobileOpen`, `onMobileClose`
- summary/header: `activeSiteLabel`, `summary`, `autoRefresh`, `loading`,
  `onToggleAutoRefresh`, `onRefresh`
- filters: `statusFilter`, `clientFilter`, `siteFilter`, `fromInput`,
  `toInput`, `searchInput`, `clientOptions`, `siteOptions`
- filter callbacks: `onStatusFilterChange`, `onClientFilterChange`,
  `onSiteFilterChange`, `onFromInputChange`, `onToInputChange`,
  `onSearchInputChange`, `onResetFilters`
- pagination: `total`, `safePage`, `totalPages`, `displayedStart`,
  `displayedEnd`, `pageSize`, `pageNumbers`, and page-size options
- pagination callbacks: `onPreviousPage`, `onSelectPage`, `onNextPage`,
  `onPageSizeChange`

The route page should pass intent-level callbacks that include existing
`setPage(1)` reset behavior where applicable. The controls surface should not
directly coordinate route state across multiple setters.

## Data Flow

1. `ProxyLogs.tsx` hydrates route state and keeps URL synchronization unchanged.
2. `ProxyLogs.tsx` loads log data/meta and derives summary, filter options,
   invalid time range state, and pagination values exactly as it does now.
3. `ProxyLogs.tsx` renders the new controls module(s), passing current values
   and callbacks.
4. The controls module(s) render the existing UI and invoke callbacks for user
   actions.
5. `DebugTraceListSurface`, `DebugSettingsSurface`,
   `DebugTraceDetailSurface`, and `ProxyLogResultsSurface` remain composed by
   `ProxyLogs.tsx`.

## Compatibility Requirements

- Preserve existing labels, button text, CSS class names, mobile drawer title,
  placeholder text, status tab counts, KPI formatting, refresh button disabled
  behavior, spinner animation behavior, invalid time-range text, pagination
  range text, page button active state, and page-size labels.
- Preserve current ordering:
  - header and filters before debug trace surfaces
  - invalid time range alert after debug trace surfaces and before results
  - pagination after results
- Preserve server-driven query behavior and page reset behavior for status,
  client, site, time, search, reset, and page-size changes.
- Update source-reading tests so `logs.mobile.test.tsx` follows the new owner of
  `ResponsiveFilterPanel`.
- Keep import direction one-way: `ProxyLogs.tsx` imports domain modules; domain
  modules do not import `ProxyLogs.tsx`.

## Test Impact

`ProxyLogs.server-driven.test.tsx` should continue to cover runtime behavior for
server-driven status/client/search changes, route query hydration, summary
counts, and rendered pagination text.

`logs.mobile.test.tsx` currently reads `ProxyLogs.tsx` for
`ResponsiveFilterPanel`. After extraction it should read the new controls
module for that assertion while keeping result layout assertions pointed at
`ProxyLogResultsSurface.tsx`.

## Trade-Offs

- Extracting the whole controls surface gives a more coherent boundary and a
  meaningful `ProxyLogs.tsx` reduction, but it creates a larger prop contract.
  That is acceptable because the route page still owns state and lifecycle.
- Extracting only filter toolbar plus pagination is smaller, but leaves header
  refresh actions, KPI chips, and alert presentation in the route page, likely
  forcing another follow-up over the same JSX block.
- Moving filter state into a hook would reduce prop count, but it is out of
  scope because it combines route orchestration changes with presentation
  extraction.

## Rollback Shape

- Rollback should be limited to removing the new controls module import/file(s)
  and restoring the inline JSX in `ProxyLogs.tsx`.
- Because no API, route parameter, persistence key, migration, or backend
  contract changes are in scope, rollback should not require data repair.
