# Audit optimization opportunities

## Goal

Identify evidence-backed optimization opportunities in Metapi and turn the broad
"check what can be optimized" request into a prioritized, implementable scope.
The audit should prefer local repository evidence over intuition and should avoid
starting code changes until the selected optimization slice is approved.

## Confirmed Facts

- Repository: single TypeScript monorepo for a Fastify server, React/Vite web UI,
  Electron desktop runtime, and Docker/deployment assets.
- Project rules emphasize narrow changes, one source of truth, route files as
  adapters, `proxy-core` ownership of proxy orchestration, generated schema
  artifacts for database changes, and existing mobile primitives for web pages.
- Current Trellis state before this task: no current task; one active bootstrap
  guidelines task exists separately.
- Validation scripts available in `package.json` include `npm run typecheck`,
  `npm test`, schema-specific tests, build scripts, and
  `npm run repo:drift-check`.
- Static size scan found large frontend pages:
  - `src/web/pages/ProxyLogs.tsx`: ~3,600 lines, 17 `useState`, 14 `useEffect`.
  - `src/web/pages/Accounts.tsx`: ~3,484 lines, 14 `useState`, many modal/panel
    references, 44 weak-type matches.
  - `src/web/pages/ModelTester.tsx`: ~3,113 lines, 23 `useState`, 7
    `useEffect`, 45 weak-type matches.
  - `src/web/pages/Settings.tsx`: ~2,648 lines, 38 `useState`, 24 weak-type
    matches.
  - `src/web/pages/OAuthManagement.tsx`: ~2,602 lines, 25 `useState`, 58
    hook matches, many modal/panel references.
- Static size scan found large backend/core files:
  - `src/server/services/tokenRouter.ts`: ~3,800 lines, owns routing, runtime
    health, cache invalidation, stable-first selection, cooldown, and reporting
    concerns in one service file.
  - `src/server/transformers/shared/chatFormatsCore.ts`: ~2,441 lines and the
    highest non-test weak-type count in server code.
  - `src/server/routes/api/settings.ts`: ~2,069 lines, 23 weak-type matches.
  - `src/server/routes/api/stats.ts`: ~2,035 lines, combines proxy log query,
    dashboard, marketplace, trend, and route-decision payload logic.
- Boundary scan found `src/server/proxy-core/surfaces/*` importing helpers from
  `src/server/routes/proxy/*`, which is worth reviewing against the rule that
  helpers imported outside one route file should not live under routes.
- Whole-body `Response.text()` scan found remaining direct reads in proxy and
  transformer paths, including `src/server/routes/proxy/videos.ts`,
  `src/server/routes/proxy/images.ts`, `src/server/routes/proxy/completions.ts`,
  `src/server/routes/proxy/embeddings.ts`, and compatibility helpers.
- Configuration/documentation consistency scan found Node/TypeScript version
  mismatches: `package.json` and `.nvmrc` require Node 25, Docker uses Node 22
  with an explanatory comment, docs mention Node 20+, and README badges mention
  Node 22.15+ and TypeScript 5.x while `package.json` uses TypeScript 6.0.3.
- Existing tests are broad and include many architecture tests, so selected
  optimizations should include targeted regression tests or existing
  architecture-test updates where boundaries are changed.

## Requirements

- Produce a prioritized list of optimization opportunities backed by repository
  evidence.
- Classify each opportunity by likely value, risk, implementation size, and
  validation path.
- Prefer optimizations that reduce maintenance risk, boundary drift, duplicated
  responsibility, or user-visible performance/ergonomics issues.
- Do not implement changes until the user approves a specific optimization
  slice and the task has moved through the Trellis planning gate.
- If the selected scope is complex, add `design.md` and `implement.md` before
  activation.

## Acceptance Criteria

- [ ] PRD captures confirmed local evidence and unresolved product/scope
      decisions.
- [ ] User chooses the first optimization focus area or explicitly requests a
      different audit priority.
- [ ] Chosen scope has clear acceptance criteria and validation commands.
- [ ] If implementation is requested later, planning artifacts are sufficient to
      start from a narrow, reviewable slice.

## Candidate Optimization Areas

1. Frontend maintainability and page decomposition:
   split high-state pages into domain hooks/components, especially Proxy Logs,
   Model Tester, Settings, OAuth Management, Accounts, Sites, Token Routes, and
   Tokens.
2. API/type contract cleanup:
   split `src/web/api.ts` by domain and reduce `any` usage in high-signal
   frontend/backend modules using existing shared contracts where possible.
3. Backend boundary cleanup:
   move shared route helpers used by `proxy-core` out of `routes/proxy`, review
   direct `.text()` reads in proxy orchestration paths, and align with existing
   architecture tests.
4. Routing core modularization:
   split `tokenRouter.ts` concerns into runtime health, candidate scoring,
   cache invalidation, and route decision/explanation modules without changing
   behavior.
5. Docs/config consistency:
   align Node/TypeScript claims across `.nvmrc`, `package.json`, Docker docs,
   README badges, and developer docs.

## Out of Scope Until Approved

- Broad cosmetic refactors without measurable maintenance or behavior benefit.
- Dependency upgrades or installation work.
- Database schema changes unless a selected optimization explicitly requires
  them.
- Behavior changes to routing, billing, proxy protocol conversion, or OAuth
  flows without focused tests.

## Open Questions

- Which optimization class should be prioritized first: frontend
  maintainability, backend boundary cleanup, routing-core modularization,
  type/API contract cleanup, or docs/config consistency?

## Backend Proxy Boundary Cleanup Detail

Confirmed boundary candidates:

- `src/server/proxy-core/surfaces/chatSurface.ts` and
  `src/server/proxy-core/surfaces/openAiResponsesSurface.ts` import
  `ensureModelAllowedForDownstreamKey`, `getDownstreamRoutingPolicy`, and
  `recordDownstreamCostUsage` from `src/server/routes/proxy/downstreamPolicy.ts`.
  These helpers are shared outside a route file, so their current home conflicts
  with the project rule that route files are adapters and shared helpers should
  not live under `routes/proxy`.
- `src/server/proxy-core/surfaces/geminiSurface.ts` imports
  `getDownstreamRoutingPolicy` from `routes/proxy/downstreamPolicy.ts`.
- `src/server/proxy-core/surfaces/filesSurface.ts` imports
  `ensureMultipartBufferParser` and `parseMultipartFormData` from
  `routes/proxy/multipart.ts`. Multipart parsing is now shared by proxy-core
  and route adapters, so it should move to a neutral proxy-core/shared module.
- `src/server/services/runtimeDispatch.ts` currently re-exports
  `dispatchRuntimeRequest` from `src/server/routes/proxy/runtimeExecutor.ts`.
  This makes a service depend on the route layer. The implementation itself is
  proxy-core executor dispatch, so it should move to `proxy-core/runtime` or a
  similar neutral core module, with routes and services importing from there.
- Direct upstream `Response.text()` reads remain in route proxy paths such as
  `completions.ts`, `images.ts`, and `videos.ts`. Some are simple route-local
  endpoints, but proxy orchestration paths should be reviewed and converted to
  `readRuntimeResponseText()` where runtime executor responses are possible.

Suggested first implementation slice:

- Move `downstreamPolicy.ts` to a neutral module first, because it is small,
  has clear callers, and affects the main chat/responses/gemini surfaces.
- Add or tighten an architecture test that prevents `proxy-core/**` and
  `services/**` from importing `routes/proxy/**` except allowed route
  registration adapters.
- In a second slice, move multipart helpers and runtime dispatch.
- In a third slice, review `.text()` reads in legacy/simple proxy routes and
  convert only the ones that sit on proxy orchestration/runtime response paths.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
