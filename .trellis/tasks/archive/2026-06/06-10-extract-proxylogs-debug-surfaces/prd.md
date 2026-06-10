# Extract ProxyLogs debug surfaces

## Goal

Reduce `src/web/pages/ProxyLogs.tsx` page complexity by extracting the proxy
debug trace UI surfaces into a `src/web/pages/proxy-logs/` domain folder,
without changing the user-visible proxy log or debug trace behavior.

This is an optimization task, not a feature change. The value is clearer page
boundaries, easier future maintenance, and better alignment with the frontend
directory-structure spec.

## Confirmed Facts

- `npm run repo:drift-check` currently reports 0 violations and 0 tracked debt.
- `ProxyLogs.tsx` is one of the largest top-level page files at about 132 KB.
- The page owns multiple debug-specific concerns inline:
  - debug settings modal state and save flows
  - debug trace list state, pagination, refresh, and persisted expansion state
  - debug trace detail modal state and detail-loading cache
  - duplicated mobile `MobileDrawer` and desktop `CenteredModal` containers for
    settings and detail surfaces
- Focused coverage already exists in `src/web/pages/ProxyLogs.server-driven.test.tsx`
  for debug trace enablement, list refresh, persisted expansion, and detail
  loading behavior.
- `.trellis/spec/frontend/directory-structure.md` says top-level pages should
  be route/page orchestration surfaces and extracted page surfaces should live
  under `src/web/pages/<domain>/`.

## Requirements

- Preserve current Proxy Logs behavior, labels, data loading, persistence keys,
  pagination, and mobile/desktop rendering.
- Extract debug trace presentation surfaces into `src/web/pages/proxy-logs/`
  modules instead of adding more inline JSX to `ProxyLogs.tsx`.
- Keep orchestration that truly belongs to the page in `ProxyLogs.tsx` unless a
  focused hook extraction is clearly lower risk.
- First implementation slice should extract presentation surfaces only. Debug
  trace state/data orchestration should remain in `ProxyLogs.tsx` unless the
  extraction exposes a small, obviously safer follow-up hook.
- Do not combine this with unrelated filtering, API, styling, or data-contract
  changes.
- Keep imports one-way: top-level `ProxyLogs.tsx` may import domain modules;
  domain modules must not import `ProxyLogs.tsx`.

## Acceptance Criteria

- [ ] Debug settings and debug trace detail rendering are moved out of
      `ProxyLogs.tsx` into `src/web/pages/proxy-logs/` modules.
- [ ] `ProxyLogs.tsx` remains the route/page orchestration surface and is
      smaller by a meaningful amount.
- [ ] Existing debug trace behavior covered by `ProxyLogs.server-driven.test.tsx`
      still passes.
- [ ] Frontend type checks pass: `npm run typecheck:web` and
      `npm run typecheck:web:test`.
- [ ] `npm run repo:drift-check` remains at 0 violations / 0 tracked debt.
- [ ] `git diff --check` passes.

## Out Of Scope

- Reworking proxy log server APIs or debug trace response contracts.
- Redesigning the Proxy Logs UI.
- Splitting every large section in `ProxyLogs.tsx`.
- Moving shared generic components into `src/web/components/`.

## Open Question

- None blocking planning. The hook extraction decision is intentionally deferred
  until after the presentation-only slice is implemented and validated.
