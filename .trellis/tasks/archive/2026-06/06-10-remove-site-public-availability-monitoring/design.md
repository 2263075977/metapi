# Design

## Scope

Remove the standalone external monitor surface:

- Frontend page and route: `/monitor`, `Monitors.tsx`, sidebar item.
- Frontend API client helpers for `/api/monitor/*`.
- Backend `monitorRoutes` registration and implementation, including `/monitor-proxy/ldoh/*`.
- Desktop navigation allowlist coverage for the removed proxy path.
- Public docs/screenshot references for the removed monitor page.

## Boundaries

Keep the following because they are core routing/observability features rather than the standalone external monitor:

- `modelAvailability` and `tokenModelAvailability` schema/data.
- Model discovery, route generation, and model availability probe service.
- Settings page batch probe controls.
- Dashboard site availability summaries based on proxy logs/hour aggregates.

## Compatibility

Existing saved setting key `monitor_ldoh_cookie` may remain in user databases as inert historical data. No schema migration is needed because the feature only stores a generic settings row.

## Rollback

Rollback is straightforward by restoring the deleted monitor route/page/client methods and re-registering `monitorRoutes` in `src/server/index.ts`.
