# Design: Extract ProxyLogs debug surfaces

## Architecture And Boundaries

`ProxyLogs.tsx` should stay the route/page orchestration surface. The new
`src/web/pages/proxy-logs/` folder should own debug-specific UI modules that are
too page-specific for `src/web/components/`.

Recommended first slice:

- `DebugSettingsSurface.tsx`
  - Owns the shared settings form content and the mobile/desktop shell choice
    if this can be done without changing behavior.
  - Receives draft settings, loading/saving flags, and callbacks as props.
- `DebugTraceDetailSurface.tsx`
  - Owns the shared detail content and mobile/desktop shell choice.
  - Receives selected trace title, detail state, and close/retry callbacks as
    props.
- Optional later slice: `useProxyDebugTraceState.ts`
  - Owns debug trace list/detail loading, pagination, cache refs, and persisted
    expansion state only if presentation extraction leaves the page still too
    dense.

## Data Flow And Contracts

No API contract changes are intended.

Existing API calls should stay the same:

- `api.getProxyDebugSettings()`
- `api.updateProxyDebugSettings(...)`
- `api.getProxyDebugTraces(...)`
- `api.getProxyDebugTraceDetail(id)`

Props passed into extracted components should use existing local types from
`ProxyLogs.tsx` or neutral type aliases moved to a `proxy-logs/types.ts` file if
multiple extracted modules need them.

## Compatibility Notes

- Keep the existing localStorage key:
  `metapi.proxyLogs.debugTracePanelExpanded`.
- Keep current desktop `CenteredModal` and mobile `MobileDrawer` behavior.
- Keep existing user-facing Chinese labels unless tests or product intent
  explicitly require a wording change.

## Trade-Offs

- Presentation-only extraction is lower risk and likely sufficient for a first
  pass, but some debug state complexity will remain in `ProxyLogs.tsx`.
- Extracting a hook gives a cleaner page boundary, but it has higher behavioral
  risk because the debug trace refresh/detail cache lifecycle is async and
  already covered by focused tests.
