# Design: Extract ProxyLogs results surfaces

## Architecture And Boundaries

`ProxyLogs.tsx` remains the route/page orchestration surface. It should continue
to own route query state, filters, API loading, pagination, expanded row state,
detail loading, debug trace orchestration, persistence, and toast behavior.

The new results presentation module should live under
`src/web/pages/proxy-logs/`, matching the existing debug surface extraction and
the frontend directory-structure spec.

Recommended first slice:

- `ProxyLogResultsSurface.tsx`
  - Owns the loading skeleton, mobile `MobileCard` list, desktop `data-table`,
    expanded detail row/card content, and empty state.
  - Receives `logs`, `loading`, `isMobile`, `expandedLogId`, `detailById`,
    `siteIdByName`, and `onToggleExpand` as props.
  - Does not call APIs, mutate route state, change pagination, read
    `localStorage`, or import `ProxyLogs.tsx`.
- `types.ts`
  - Can be extended with `ProxyLogRenderItem` and `ProxyLogDetailState` because
    those contracts are shared between the route page and the extracted results
    surface.

Keep the filter panel in `ProxyLogs.tsx` for this task. Moving filters would be
a separate orchestration boundary decision because route query state and
`ResponsiveFilterPanel` source-reading tests currently belong to the page.

## Data Flow And Contracts

No API contract changes are intended.

Existing list/detail calls stay in `ProxyLogs.tsx`:

- `api.getProxyLogs(...)` / `api.getProxyLogsQuery(...)`
- `api.getProxyLogsMeta()`
- `api.getProxyLogDetail(id)`

The results surface renders from already-loaded state:

- list rows from `ProxyLogListItem[]`
- optional detail overlays from `Record<number, ProxyLogDetailState>`
- expansion state from `expandedLogId`
- detail loading trigger through `onToggleExpand(log.id)`

When detail exists, the surface should keep the current merge behavior:
`detailLog = detail ? { ...log, ...detail } : log`.

## Presentation Helpers

Move result-only helpers with the surface so `ProxyLogs.tsx` no longer owns
presentation formatting that it does not call:

- latency and first-byte label/color helpers
- token and usage-source formatting helpers
- billing detail summary and billing process line builders
- downstream key summary rendering
- proxy client display/cell helpers

Keep route, filter, debug trace, and summary helpers in `ProxyLogs.tsx` unless
implementation proves a helper is exclusively needed by the results surface.

## Compatibility Notes

- Preserve all current labels, status badges, table headers, mobile card
  layout classes, `data-testid` row attributes, expand/collapse behavior, and
  empty-state text.
- Preserve the current desktop table structure and `colSpan={11}` detail row.
- Preserve mobile `compact` cards and `subtitle={formatDateTimeLocal(log.createdAt)}`.
- Keep one-way imports: `ProxyLogs.tsx` imports the results surface; the
  surface imports shared components, helper modules, API types, and
  `proxy-logs/types.ts`, but never imports `ProxyLogs.tsx`.

## Test Impact

`logs.mobile.test.tsx` currently source-reads `ProxyLogs.tsx` for both filter
and result primitives. After extraction it should read:

- `ProxyLogs.tsx` for `ResponsiveFilterPanel` ownership, if filters stay in the
  page.
- `ProxyLogResultsSurface.tsx` for `MobileCard`, `compact`,
  `mobile-summary-grid`, and the result timestamp subtitle.

`responsiveFilterPanel.architecture.test.ts` should remain unchanged unless
filters move, which is out of scope.

## Trade-Offs

Extracting the full results surface gives a meaningful page-size reduction and
keeps the page as orchestration, but it passes a broader prop contract than a
smaller single-card extraction. That trade-off is acceptable here because the
mobile and desktop result paths share detail preparation and helper logic.

Hook extraction would further shrink `ProxyLogs.tsx`, but it is intentionally
out of scope for this slice because it would move async detail loading and route
state behavior at the same time as presentation.
