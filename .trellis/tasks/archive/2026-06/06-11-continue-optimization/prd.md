# Continue Optimization

## Goal

Maintain the Trellis parent task tree for the next routing-core optimization
wave. The tree should keep behavior-preserving `TokenRouter` modularization
evidence-backed, ordered, independently verifiable, and scoped enough that each
child can be planned, implemented, checked, committed, and archived separately.

## Confirmed Facts

- The previous `06-11-follow-up-optimization-milestone` is archived and should
  not be duplicated.
- That milestone already covered docs/config alignment, Accounts/Settings/OAuth
  page decomposition, `src/web/api.ts` facade splitting, and stats/settings API
  route adapter thinning.
- The chosen first wave is routing-core modularization around
  `src/server/services/tokenRouter.ts`.
- Current line-count evidence still shows several large or boundary-sensitive
  areas:
  - `src/server/services/tokenRouter.ts`: 3414 lines.
  - `src/server/transformers/shared/chatFormatsCore.ts`: 2162 lines.
  - `src/web/pages/ModelTester.tsx`: 2846 lines.
  - `src/web/pages/Sites.tsx`: 2260 lines.
  - `src/web/pages/TokenRoutes.tsx`: 1880 lines.
  - `src/web/pages/ProxyLogs.tsx`: 981 lines after earlier extraction work.
- Earlier proxy boundary candidates `downstreamPolicy.ts`, `multipart.ts`, and
  `runtimeExecutor.ts` no longer live under `src/server/routes/proxy/`; they now
  live under `src/server/proxy-core/` or proxy-core runtime modules.
- Remaining direct `.text()` reads include transformer compatibility paths,
  runtime/model probe services, platform/OAuth services, and other non-proxy
  service code; proxy route paths checked in this pass use
  `readRuntimeResponseText()` where runtime responses are involved.
- `tokenRouter.ts` already has focused tests by behavior family:
  `tokenRouter.test.ts`, `tokenRouter.selection.test.ts`,
  `tokenRouter.cache.test.ts`, `tokenRouter.patterns.test.ts`,
  `tokenRouter.oauth-route-units.test.ts`,
  `tokenRouter.downstream-policy.test.ts`,
  `tokenRouter.siteStatus.test.ts`, and
  `tokenRouter.session-decoupling.test.ts`.
- `tokenRouter.ts` currently owns runtime site health, route cache/matching,
  model mapping, selection scoring, OAuth route-unit dispatch, outcome
  recording, cooldown handling, and the public service facade in one file.

## Requirements

- Maintain this parent task as the roadmap owner for the next optimization wave.
- Use routing-core modularization as the first child wave, focused on
  behavior-preserving decomposition around `src/server/services/tokenRouter.ts`.
- Track actual deliverables as child tasks with independent requirements,
  validation paths, and completion gates.
- Prefer optimizations that reduce maintenance risk, boundary drift, duplicated
  ownership, weak contracts, or high-state top-level files.
- Avoid duplicating already archived follow-up milestone deliverables.
- Do not change public HTTP APIs, database schema, response formats, routing
  semantics, OAuth flows, proxy behavior, or platform behavior as part of the
  roadmap task itself.
- Preserve the clean architecture baseline for future boundary-heavy work.

## Child Deliverables

1. `06-12-characterize-token-router-core-behavior`: strengthen and document the
   behavior baseline before extraction.
2. `06-12-extract-token-router-route-matching-cache`: move route loading,
   matching, model mapping, visible model exposure, and cache invalidation to a
   focused routing-match module.
3. `06-12-extract-token-router-runtime-health`: move site/model runtime health,
   breaker, persistence, and recent-outcome state to a focused runtime-health
   module.
4. `06-12-extract-token-router-selection-engine`: move weighted, round-robin,
   stable-first, cost, load, and probability explanation logic to a focused
   selection module.
5. `06-12-extract-token-router-outcome-cooldowns`: move success/failure
   recording and direct/OAuth route-unit cooldown transitions to a focused
   outcome module.
6. `06-12-thin-token-router-service-facade`: keep `TokenRouter` as the public
   orchestration facade after the extracted modules exist, and add any final
   architecture guard needed to prevent regression.

## Acceptance Criteria

- [x] Parent PRD captures the chosen optimization theme, constraints, and
      cross-child acceptance criteria.
- [x] Child task map is created only for independently verifiable deliverables.
- [x] Each child task has a focused PRD before implementation starts.
- [x] Task ordering is explicit when one child should precede another.
- [x] `python ./.trellis/scripts/task.py list` shows the planned children under
      this parent after the tree is created.
- [x] No child implementation is started from this parent planning step.

## Final Integration

- All six child tasks are archived or intentionally removed from scope.
- `TokenRouter` remains the compatible import surface for existing callers.
- Token routing behavior remains unchanged except for explicitly approved
  follow-up behavior work outside this roadmap.
- `npm run typecheck:server` passes after code-bearing child tasks.
- `npm run repo:drift-check` reports 0 violations and 0 tracked debt.

## Candidate Directions

1. Routing-core modularization: split selected responsibilities out of
   `src/server/services/tokenRouter.ts` without changing routing behavior.
2. Transformer contract cleanup: reduce concentration and weak typing around
   `src/server/transformers/shared/chatFormatsCore.ts` and compatibility paths.
3. Frontend maintainability: decompose remaining large pages such as
   `ModelTester`, `Sites`, and `TokenRoutes` using existing page-domain
   patterns and mobile primitives.
4. Runtime/platform response-read consistency: review remaining direct
   `.text()` paths outside proxy route orchestration and convert only where the
   runtime response contract applies.

## Open Questions

- None blocking task-tree creation. The next implementation decision is which
  child to start first; the recommended first child is
  `06-12-characterize-token-router-core-behavior`.

## Out of Scope

- Recreating the already archived follow-up optimization milestone.
- Implementing child deliverables before the task tree is reviewed.
- Dependency upgrades, database migrations, or broad behavior changes.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
