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
- Whole-body upstream response reads in proxy routes and proxy-core surfaces
  should use `readRuntimeResponseText()` instead of direct `Response.text()`
  calls, so runtime executor and compression handling stay consistent.
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
- Direct `.text()` reads in non-test `routes/proxy/**` or
  `proxy-core/surfaces/**` -> reject; use `readRuntimeResponseText()`.

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
- Bad: a route proxy reading an upstream body with `await upstream.text()`.

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

Wrong:
```typescript
const rawText = await upstream.text();
```

Correct:
```typescript
const rawText = await readRuntimeResponseText(upstream);
```

---

### Scenario: Token Router Selection Service Boundary

#### 1. Scope / Trigger
- Trigger: adding or changing route candidate selection, weighted scoring,
  round-robin ordering, stable-first rotation state, route decision probability
  details, or recent-failure avoidance for token routing.
- Use this rule for `src/server/services/tokenRouter.ts` and the lower-level
  selection helpers it delegates to.

#### 2. Signatures
- Public facade: `src/server/services/tokenRouter.ts`.
- Selection engine: `src/server/services/tokenRouterSelectionEngine.ts`.
- Architecture guard:
  `src/server/services/tokenRouterSelectionEngine.architecture.test.ts`.
- Compatibility exports that callers may keep importing from the facade include
  `TokenRouter`, `tokenRouter`, `isChannelRecentlyFailed`,
  `filterRecentlyFailedCandidates`, `invalidateTokenRouterCache`,
  `resetSiteRuntimeHealthState`, and `__tokenRouterTestUtils`.

#### 3. Contracts
- `tokenRouter.ts` remains the public service facade. Route callers, API
  handlers, and tests should keep importing token-router behavior through the
  facade unless a task explicitly changes the public boundary.
- `tokenRouterSelectionEngine.ts` owns selection math and selection-local state:
  weighted contribution calculation, stable-first pool planning, stable-first
  rotation and observation caches, round-robin candidate ordering,
  cost/load/runtime-health selection multipliers, probability reason text, and
  recent-failure filtering.
- The facade should call coarse selection-engine orchestration helpers such as
  `buildTokenRouteDecisionExplanation()` and
  `selectTokenRouteCandidateForDispatch()` for route-decision payload
  probability details and strategy candidate selection. It may pass an
  eligibility callback into those helpers, then keep dispatch finalization,
  OAuth route-unit member resolution, token value resolution, and persistence
  writes in the facade.
- The facade owns route lookup, candidate eligibility assembly, token value
  resolution, OAuth route-unit member dispatch, persistence writes, and public
  response payload assembly.
- Selection cache invalidation must stay explicit. Route-scoped invalidation
  should clear both route-match caches and selection-engine route caches; global
  invalidation should clear both global cache families.

#### 4. Validation & Error Matrix
- Selection engine imports `tokenRouter.ts` -> reject; this creates a facade
  cycle and hides selection state below a public service.
- Selection engine imports `src/server/routes/**` -> reject; route adapters must
  not become service dependencies.
- API routes or unrelated services import `tokenRouterSelectionEngine.ts`
  directly -> reject unless the task updates the public boundary and tests.
- `tokenRouter.ts` imports low-level selection math helpers such as
  `calculateWeightedSelection()`, `selectWeightedRandomCandidate()`,
  `selectRoundRobinCandidate()`, `selectStableFirstCandidateByWeight()`,
  `buildStableFirstPoolPlan()`, or
  `shouldUseStableFirstObservationCandidate()` -> reject; the facade should use
  the high-level selection-engine orchestration helpers instead.
- OAuth route-unit member cooldown or DB write logic moves into the selection
  engine -> reject until outcome/cooldown ownership is extracted into a neutral
  module.
- Selection cache clearing is changed without route-scoped and global
  invalidation coverage -> reject.

#### 5. Good/Base/Bad Cases
- Good: `tokenRouter.ts` imports `./tokenRouterSelectionEngine.js` and adapts
  engine results into existing selected-channel and route-decision payloads.
- Good: the selection engine imports neutral lower-level services for pricing,
  runtime health, runtime load, and route matching type contracts.
- Base: public helpers such as `isChannelRecentlyFailed` are re-exported from
  `tokenRouter.ts` for compatibility.
- Bad: `src/server/routes/api/tokens.ts` imports
  `tokenRouterSelectionEngine.ts` to build route-decision payloads.
- Bad: `tokenRouterSelectionEngine.ts` imports `tokenRouter.ts` for test
  helpers or public facade state.

#### 6. Tests Required
- Run:
  `npm test -- src/server/services/tokenRouter.selection.test.ts src/server/services/tokenRouter.downstream-policy.test.ts src/server/services/tokenRouter.oauth-route-units.test.ts src/server/routes/api/tokens.route-decision-batch.test.ts src/server/routes/api/tokens.route-decision-snapshot.test.ts`.
- Run:
  `npm test -- src/server/services/tokenRouterSelectionEngine.architecture.test.ts`.
- The selection architecture test should also guard the facade against
  re-importing low-level selection math helpers after it has been thinned to the
  high-level selection-engine API.
- Run `npm run typecheck:server` after import path or public export changes.
- Run `npm run repo:drift-check` before finishing changes to this boundary.

#### 7. Wrong vs Correct

Wrong:
```typescript
// A route adapter bypasses the public facade and binds to selection internals.
import { calculateWeightedSelection } from '../../services/tokenRouterSelectionEngine.js';
```

Correct:
```typescript
// Route adapters use the public facade; the facade delegates internally.
import { tokenRouter } from '../../services/tokenRouter.js';
```

Wrong:
```typescript
// The lower-level selection engine imports public facade state.
import { tokenRouter } from './tokenRouter.js';
```

Correct:
```typescript
// The facade imports the lower-level engine and preserves public exports.
import { filterRecentlyFailedCandidates } from './tokenRouterSelectionEngine.js';
```

Wrong:
```typescript
// The facade owns selection probability math again.
import { calculateWeightedSelection } from './tokenRouterSelectionEngine.js';
```

Correct:
```typescript
// The facade delegates strategy selection and keeps dispatch finalization.
import { selectTokenRouteCandidateForDispatch } from './tokenRouterSelectionEngine.js';
```

---

### Scenario: Token Router Outcome Cooldown Service Boundary

#### 1. Scope / Trigger
- Trigger: adding or changing token-route success/failure recording,
  probe-success recovery, manual failure/cooldown clearing, OAuth route-unit
  member cooldown transitions, credential-scoped sibling cooldowns, or
  runtime-health side effects caused by route outcomes.
- Use this rule for `src/server/services/tokenRouter.ts` and lower-level
  outcome/cooldown helpers it delegates to.

#### 2. Signatures
- Public facade: `src/server/services/tokenRouter.ts`.
- Outcome module: `src/server/services/tokenRouterOutcomeCooldowns.ts`.
- Architecture guard:
  `src/server/services/tokenRouterOutcomeCooldowns.architecture.test.ts`.
- Public methods that must keep their facade signatures:
  `TokenRouter.recordSuccess`, `TokenRouter.recordProbeSuccess`,
  `TokenRouter.recordFailure`, and `TokenRouter.clearChannelFailureState`.

#### 3. Contracts
- `tokenRouter.ts` remains the public service facade. Route callers and API
  handlers should call the facade methods rather than importing the outcome
  module directly.
- `tokenRouterOutcomeCooldowns.ts` owns DB writes and state transitions for:
  direct route-channel outcome counters, OAuth route-unit member outcome
  counters, short-window usage-limit cooldowns, Codex OAuth reset hints,
  weighted backoff cooldowns, round-robin staged cooldowns,
  probe-success recovery, manual failure/cooldown clear, and runtime-health
  success/failure/reset side effects.
- The outcome module may import neutral lower-level services such as
  `tokenRouterRouteMatching.ts`, `tokenRouterRuntimeHealth.ts`,
  `routeRoutingStrategy.ts`, OAuth helpers, and selection cooldown helpers.
- Selection cache invalidation stays explicit. Pass facade-owned cache hooks
  such as `invalidateRouteScopedCache` and `invalidateAllTokenRouterCache`
  into the outcome module instead of importing `tokenRouter.ts`.
- The facade continues to own route lookup, candidate eligibility, token
  resolution, selected-candidate dispatch finalization, and public payload
  assembly.

#### 4. Validation & Error Matrix
- Outcome module imports `tokenRouter.ts` -> reject; this creates a cycle from
  lower-level transition logic back to the public facade.
- Outcome module imports `src/server/routes/**` -> reject; route adapters must
  not become service dependencies.
- API routes or unrelated services import `tokenRouterOutcomeCooldowns.ts`
  directly -> reject unless the task explicitly changes the public boundary.
- Outcome changes alter cooldown durations, thresholds, or failure-count reset
  semantics without targeted test updates -> reject.
- Manual clear no longer clears persisted runtime health state or no longer
  invalidates both route-match and selection caches -> reject.
- OAuth route-unit outcome writes ignore the `actualAccountId` selected member
  and update the outer route channel account instead -> reject.

#### 5. Good/Base/Bad Cases
- Good: `TokenRouter.recordFailure()` delegates to
  `recordTokenRouteFailure({ channelId, context, actualAccountId, cacheHooks })`.
- Good: outcome code patches cached route-channel rows after direct channel
  writes and invalidates route-scoped caches after OAuth route-unit member
  writes.
- Good: short-window usage-limit cooldowns reuse credential-scoped sibling
  lookup rather than each route owning local cooldown rules.
- Base: `tokenRouter.ts` exports the same public methods and test utilities as
  before the extraction.
- Bad: `tokens.ts` imports `recordTokenRouteFailure()` directly to clear a
  cooldown.
- Bad: `tokenRouterOutcomeCooldowns.ts` imports `tokenRouter.ts` to call
  `invalidateTokenRouterCache()`.

#### 6. Tests Required
- Run:
  `npm test -- src/server/services/tokenRouter.cache.test.ts src/server/services/tokenRouter.oauth-route-units.test.ts src/server/routes/api/tokens.cooldown-clear.test.ts`.
- Run:
  `npm test -- src/server/services/tokenRouterOutcomeCooldowns.architecture.test.ts`.
- Run `npm run typecheck:server` after import path or public method changes.
- Run `npm run repo:drift-check` before finishing changes to this boundary.

#### 7. Wrong vs Correct

Wrong:
```typescript
// A route adapter bypasses the public TokenRouter facade.
import { clearTokenRouteChannelFailureState } from '../../services/tokenRouterOutcomeCooldowns.js';
```

Correct:
```typescript
// Route adapters use the public facade and let it delegate internally.
import { tokenRouter } from '../../services/tokenRouter.js';
```

Wrong:
```typescript
// The lower-level outcome module imports the public facade for cache clearing.
import { invalidateTokenRouterCache } from './tokenRouter.js';
```

Correct:
```typescript
// The facade passes explicit cache hooks into the lower-level outcome module.
await recordTokenRouteFailure({ channelId, context, cacheHooks });
```

---

## Naming Conventions

<!-- File and folder naming rules -->

(To be filled by the team)

---

## Examples

<!-- Link to well-organized modules as examples -->

(To be filled by the team)
