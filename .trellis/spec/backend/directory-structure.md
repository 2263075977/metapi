# Directory Structure

> How backend code is organized in this project.

---

## Overview

<!--
Document your project's backend directory structure here.

Questions to answer:
- How are modules/packages organized?
- Where does business logic live?
- Where are API endpoints defined?
- How are utilities and helpers organized?
-->

(To be filled by the team)

---

## Directory Layout

```
<!-- Replace with your actual structure -->
src/
├── ...
└── ...
```

---

## Module Organization

<!-- How should new features/modules be organized? -->

### Scenario: Proxy Route Adapter Boundaries

#### 1. Scope / Trigger
- Trigger: adding, moving, or sharing helpers used by proxy routes,
  `src/server/proxy-core/**`, or `src/server/services/**`.
- Use this rule when a helper starts being imported outside a single
  `src/server/routes/proxy/*` route file.

#### 2. Signatures
- Route adapter files: `src/server/routes/proxy/*.ts`.
- Proxy core modules: `src/server/proxy-core/**/*.ts`.
- Service modules: `src/server/services/**/*.ts`.
- Architecture guard:
  `src/server/routes/proxy/architecture-boundaries.test.ts`.

#### 3. Contracts
- `src/server/routes/proxy/**` files may register Fastify routes, read request
  context, and delegate to proxy-core or services.
- Shared proxy orchestration helpers belong under `src/server/proxy-core/**`
  or another neutral non-route module.
- `src/server/proxy-core/**` must not import from `src/server/routes/proxy/**`.
- `src/server/services/**` must not import from `src/server/routes/proxy/**`.
- Any temporary exception must be explicit in an architecture test and tied to a
  follow-up cleanup.

#### 4. Validation & Error Matrix
- `proxy-core/**` imports `routes/proxy/**` -> reject unless listed as a
  temporary tracked boundary debt.
- `services/**` imports `routes/proxy/**` -> reject unless listed as a
  temporary tracked boundary debt.
- A helper under `routes/proxy/**` gains a second non-route caller -> move it to
  proxy-core or a neutral module before adding the caller.

#### 5. Good/Base/Bad Cases
- Good: `routes/proxy/chat.ts` delegates to
  `proxy-core/surfaces/chatSurface.ts`.
- Good: downstream routing-policy helpers shared by proxy routes and surfaces
  live in `proxy-core/downstreamPolicy.ts`.
- Good: multipart proxy request helpers shared by file surfaces and route
  adapters live in `proxy-core/multipart.ts`.
- Good: runtime executor dispatch lives in
  `proxy-core/runtime/runtimeDispatch.ts`, with `services/runtimeDispatch.ts`
  only acting as a stable service-layer re-export when existing service tests
  need that mock seam.
- Base: route-local helpers that are used by exactly one route file may stay
  next to that route.
- Bad: `proxy-core/surfaces/chatSurface.ts` importing
  `../../routes/proxy/downstreamPolicy.js`.

#### 6. Tests Required
- Extend `src/server/routes/proxy/architecture-boundaries.test.ts` when adding
  or moving boundary-sensitive helpers.
- Run:
  `npx vitest run --root . src/server/routes/proxy/architecture-boundaries.test.ts`.
- Run `npm run typecheck:server` after import path moves.
- Run `npm run repo:drift-check` before finishing changes that touch shared
  architecture boundaries.

#### 7. Wrong vs Correct

Wrong:
```typescript
// proxy-core depends on a route-layer helper.
import { getDownstreamRoutingPolicy } from '../../routes/proxy/downstreamPolicy.js';
```

Correct:
```typescript
// route adapters and proxy-core both import the neutral core helper.
import { getDownstreamRoutingPolicy } from '../downstreamPolicy.js';
```

Correct:
```typescript
// services can keep a stable re-export seam, but it must point to proxy-core.
export { dispatchRuntimeRequest } from '../proxy-core/runtime/runtimeDispatch.js';
```

---

## Naming Conventions

<!-- File and folder naming rules -->

(To be filled by the team)

---

## Examples

<!-- Link to well-organized modules as examples -->

(To be filled by the team)
