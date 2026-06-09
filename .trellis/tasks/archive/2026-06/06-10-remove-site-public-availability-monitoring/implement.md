# Implementation

## Checklist

- Remove `Monitors` lazy import, sidebar item, and `/monitor` route from `src/web/App.tsx`.
- Remove monitor API helpers from `src/web/api.ts`.
- Remove backend monitor route registration from `src/server/index.ts`.
- Delete `src/server/routes/api/monitor.ts`, `src/server/routes/api/monitor.test.ts`, and `src/web/pages/Monitors.tsx`.
- Remove desktop navigation tests that allow `/monitor-proxy/ldoh/`.
- Remove docs homepage monitor screenshot card and delete the unused screenshot if no longer referenced.
- Remove monitor-specific CSS and i18n entries if no longer referenced.
- Run targeted searches for `monitor-proxy`, `/api/monitor`, `Monitors`, and `可用性监控`.

## Validation

- `npm run typecheck:web`
- `npm run typecheck:server`
- Targeted tests if still present around App/sidebar/navigation guard.

## Risky Files

- `src/web/App.tsx`: shared navigation and routes.
- `src/server/index.ts`: server route registration.
- `src/desktop/navigationGuard.test.ts`: removed assertions may reveal implementation still allows same-origin paths generally; update only monitor-specific expectations.
