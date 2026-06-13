# Thin Token Router Service Facade Design

## Boundary

Finish the routing-core modularization wave by reducing
`src/server/services/tokenRouter.ts` to a compatible facade over extracted
modules:

- `src/server/services/tokenRouterRouteMatching.ts`
- `src/server/services/tokenRouterRuntimeHealth.ts`
- `src/server/services/tokenRouterSelectionEngine.ts`
- `src/server/services/tokenRouterOutcomeCooldowns.ts`

After the predecessor children are complete, `tokenRouter.ts` should own only:

- the public `TokenRouter` class and `tokenRouter` singleton
- compatibility exports expected by existing callers and tests
- orchestration between route lookup, selection, dispatch finalization, outcome
  recording, and cache invalidation
- thin wrappers needed to preserve legacy import paths
- test utility compatibility where those utilities are still intentionally
  public to tests

It should not own broad route matching, runtime health, selection scoring,
stable-first cache internals, or outcome/cooldown transition internals.

## Public Compatibility Contract

Existing import paths must remain compatible unless a focused migration is part
of this child and validated at all call sites. The facade should preserve:

- `TokenRouter`
- `tokenRouter`
- `matchesModelPattern`
- regex model-pattern helpers
- `invalidateTokenRouterCache`
- runtime health helper exports
- `isChannelRecentlyFailed`
- `filterRecentlyFailedCandidates`
- `__tokenRouterTestUtils.resolveMappedModel`
- `__tokenRouterTestUtils.getStableFirstRotationCacheSize`
- `__tokenRouterTestUtils.rememberStableFirstSiteSelectionForKey`

The public `TokenRouter` method signatures should remain compatible:

- selection methods
- route decision explanation methods
- pricing refresh methods
- outcome recording methods
- manual failure clear
- available model exposure

## Facade Data Flow

1. Public selection entry points check downstream model policy and ensure runtime
   health state is loaded.
2. Route lookup and visible model exposure delegate to
   `tokenRouterRouteMatching.ts`.
3. Eligibility and dispatch orchestration remain in the facade only where they
   connect multiple extracted modules or preserve public return shape.
4. Candidate selection and route-decision probability details delegate to
   `tokenRouterSelectionEngine.ts`.
5. OAuth route-unit member dispatch remains either in the facade or a focused
   helper if already extracted by a predecessor; the facade still owns the final
   `SelectedChannel` return shape.
6. Outcome methods delegate to `tokenRouterOutcomeCooldowns.ts`.
7. Public cache invalidation calls route matching, runtime health when relevant,
   and selection-cache invalidation through explicit module APIs.

## Compatibility

- Do not change routing semantics, database schema, HTTP APIs, response formats,
  OAuth flows, proxy behavior, platform behavior, or public method signatures.
- Keep extracted module imports one-way: lower-level modules must not import the
  `tokenRouter.ts` facade.
- Keep route adapters and proxy-core callers importing from the existing facade
  unless a call site migration is narrower and better validated.
- Preserve current tests as the behavior contract; do not update snapshots only
  to accommodate wording churn.
- Keep any architecture guard narrowly scoped to preventing boundary regression
  for routing-core modules.

## Risks

- Final facade cleanup can accidentally become a behavior refactor. Limit this
  child to removing leftover implementation ownership and wiring extracted
  modules.
- Compatibility exports may look redundant after extraction, but removing them
  can break tests and service callers. Search all imports before changing any
  export surface.
- Cache invalidation now crosses multiple modules. Keep public invalidation
  wrappers explicit and covered by targeted tests.
- If a predecessor leaves a helper in `tokenRouter.ts` because extraction was
  too risky, decide whether this child should move it or document why it remains
  facade orchestration.
