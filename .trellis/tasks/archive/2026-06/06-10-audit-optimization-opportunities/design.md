# Backend Proxy Boundary Cleanup Design

## Scope

This design covers the first backend proxy boundary cleanup slice for the
optimization audit. The slice is intentionally narrow:

- Move downstream policy helpers out of `src/server/routes/proxy/`.
- Keep route files as adapters and allow them to import proxy-core helpers.
- Prevent `src/server/proxy-core/**` and `src/server/services/**` from importing
  `src/server/routes/proxy/**` helpers in future code.

This slice does not include multipart helper moves, runtime dispatch relocation,
or direct `Response.text()` cleanup. Those remain follow-up slices after the
first boundary rule is executable.

## Current Boundary Problem

`src/server/routes/proxy/downstreamPolicy.ts` contains shared helpers:

- `getDownstreamRoutingPolicy`
- `ensureModelAllowedForDownstreamKey`
- `recordDownstreamCostUsage`

Those helpers are imported by proxy-core surfaces:

- `src/server/proxy-core/surfaces/chatSurface.ts`
- `src/server/proxy-core/surfaces/openAiResponsesSurface.ts`
- `src/server/proxy-core/surfaces/geminiSurface.ts`

The repository rule says route files are adapters and shared helpers imported
outside one route file do not belong under `src/server/routes/proxy/`.

## Proposed Module Placement

Move the helper implementation to:

`src/server/proxy-core/downstreamPolicy.ts`

Rationale:

- The helpers are proxy-surface policy glue, not general business services.
- They depend on Fastify request/reply types and proxy auth context, so placing
  them under `services/` would make a service-like module own HTTP adapter
  behavior.
- `proxy-core` is already the owner of proxy orchestration and is imported by
  route adapters.

Route files that currently import `./downstreamPolicy.js` should import the
new proxy-core module instead.

## Architecture Test

Extend the existing proxy route architecture tests to make the rule executable.

Required invariant:

- `src/server/proxy-core/**` must not import from `src/server/routes/proxy/**`.
- `src/server/services/**` must not import from `src/server/routes/proxy/**`.

Allowed exceptions should be explicit and temporary only if already present and
not part of this slice. The goal of the first slice is to remove the known
`downstreamPolicy` violation without accidentally broadening the rule.

## Data Flow After Change

1. Proxy route adapter receives Fastify request.
2. Route delegates to proxy-core surface or calls proxy-core helper directly for
   legacy/simple endpoints.
3. `proxy-core/downstreamPolicy.ts` reads proxy auth context from middleware.
4. It delegates model-policy checks and managed-key cost usage to existing
   downstream API key services.
5. Surface or route continues existing request orchestration unchanged.

## Compatibility

No runtime behavior should change:

- API key model restrictions must still reject disallowed models with 403.
- Empty/missing proxy auth context should preserve existing permissive behavior.
- Managed downstream cost usage should still be recorded best-effort when a
  downstream key id exists.

## Validation

Minimum validation for this slice:

- `npm run typecheck:server`
- Targeted architecture/proxy tests:
  `npx vitest run --root . src/server/routes/proxy/architecture-boundaries.test.ts`
- Targeted affected tests if imports or helper behavior change:
  `npx vitest run --root . src/server/middleware/auth.proxy.test.ts src/server/routes/proxy/models.test.ts src/server/routes/proxy/chat.stream.test.ts`

Broader validation can be added if the implementation touches more than imports
and architecture tests.
