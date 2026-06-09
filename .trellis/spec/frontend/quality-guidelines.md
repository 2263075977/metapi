# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

<!--
Document your project's quality standards here.

Questions to answer:
- What patterns are forbidden?
- What linting rules do you enforce?
- What are your testing requirements?
- What code review standards apply?
-->

(To be filled by the team)

---

## Forbidden Patterns

<!-- Patterns that should never be used and why -->

(To be filled by the team)

---

## Required Patterns

<!-- Patterns that must always be used -->

### Scenario: Retiring A Cross-Layer UI Surface

#### 1. Scope / Trigger
- Trigger: removing a user-visible page, navigation item, or embedded tool that has frontend API helpers and backend routes.
- Scope includes every layer that made the surface reachable: route registration, sidebar/mobile navigation, API client helpers, backend route registration, dev-server proxy entries, docs/screenshots, and tests.

#### 2. Signatures
- Frontend route signature: `Route path="/removed-path" element={<RemovedPage />}` must be deleted.
- Frontend API signature: helpers such as `api.getRemovedConfig()` or `api.initRemovedSession()` must be deleted when no remaining caller exists.
- Backend API signatures backing the page, for example `GET/PUT /api/<surface>/*` or proxy routes such as `/<surface>-proxy/*`, must no longer be registered.
- Dev proxy signatures in `vite.config.ts` must be removed for backend paths that no longer exist.

#### 3. Contracts
- Navigation contract: desktop and mobile navigation must not expose the removed label or target path.
- Runtime contract: unknown removed routes should fall through to the app's existing fallback behavior, not render a stale page.
- Documentation contract: README/VitePress screenshots and feature cards must not link to deleted assets.
- Compatibility contract: stored settings left by the removed surface may remain inert when no schema migration is required.

#### 4. Validation & Error Matrix
- Stale frontend route remains -> users can still open a removed page.
- Stale API helper remains -> type-safe dead code hides an API contract that no longer exists.
- Stale backend route remains -> removed behavior is still externally reachable.
- Stale dev proxy remains -> local development suggests a backend path still exists.
- Stale screenshot/docs remain -> docs reference deleted assets or advertise removed behavior.

#### 5. Good/Base/Bad Cases
- Good: removing `/monitor` also removes its lazy import, sidebar entry, page file, API helpers, backend route registration, proxy implementation, Vite proxy entry, docs card, screenshot, CSS, i18n, and route-specific tests.
- Base: preserving unrelated observability such as dashboard availability summaries when the task only retires an external embedded monitor.
- Bad: deleting the page component but leaving `/api/monitor/*` or `/monitor-proxy/*` registered.

#### 6. Tests Required
- Run full typecheck: `npm run typecheck`.
- Run targeted tests for changed navigation or desktop guard behavior.
- Run exact searches for removed path names, API helpers, docs assets, and labels.
- Run `git diff --check`.

#### 7. Wrong vs Correct

Wrong:
```typescript
// Page is gone, but the API contract and dev proxy still exist.
api.getMonitorConfig = () => request('/api/monitor/config');
```

Correct:
```typescript
// Remove the caller, helper, backend route registration, and proxy entry together.
// Then verify no exact references to '/api/monitor' or the removed UI label remain.
```

---

## Testing Requirements

<!-- What level of testing is expected -->

(To be filled by the team)

---

## Code Review Checklist

<!-- What reviewers should check -->

(To be filled by the team)
