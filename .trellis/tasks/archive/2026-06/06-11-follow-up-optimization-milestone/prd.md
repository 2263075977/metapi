# Follow-up optimization milestone

## Goal

Maintain a Trellis parent task tree for the next low-risk optimization
milestone. The tree should keep follow-up work discoverable, ordered, and
independently verifiable without starting broad implementation in this session.

## Confirmed Facts

- `npm run repo:drift-check` currently reports 0 violations and 0 tracked debt.
- Recent backend proxy boundary cleanup and proxy route body-read convergence are
  already archived and should not be duplicated in this milestone.
- Large remaining maintenance candidates include:
  - `src/web/pages/Accounts.tsx` at 3399 lines.
  - `src/web/pages/Settings.tsx` at 2536 lines.
  - `src/web/pages/OAuthManagement.tsx` at 2438 lines.
  - `src/web/api.ts` at 1411 lines.
  - `src/server/routes/api/stats.ts` at 1888 lines.
  - `src/server/routes/api/settings.ts` at 1912 lines.
- Higher-risk core files, especially `tokenRouter.ts` and
  `chatFormatsCore.ts`, remain out of this milestone.

## Requirements

- Keep this parent task as the roadmap owner for the next optimization wave.
- Track the actual deliverables as child tasks that can be planned, started,
  checked, committed, and archived independently.
- Order work by steady debt reduction: docs/config consistency, frontend
  decomposition, web API contract cleanup, then backend route adapter thinning.
- Do not change public HTTP APIs, database schema, response formats, routing
  semantics, OAuth flows, or proxy behavior as part of this roadmap task.
- Preserve the current clean architecture baseline: future boundary-heavy work
  must keep `npm run repo:drift-check` green.

## Child Deliverables

- `align-runtime-docs-config`: align Node and TypeScript version claims.
- `decompose-accounts-page-surfaces`: thin the Accounts top-level page.
- `decompose-settings-page-surfaces`: thin the Settings top-level page.
- `decompose-oauth-management-surfaces`: thin the OAuth Management page.
- `split-web-api-domain-facade`: split `src/web/api.ts` behind a compatible
  facade.
- `thin-stats-api-route-adapter`: move stats route implementation logic out of
  the Fastify adapter.
- `thin-settings-api-route-adapter`: move settings route implementation logic
  out of the Fastify adapter.

## Acceptance Criteria

- [x] Parent task has child links for all seven deliverable tasks.
- [x] Each child has a PRD with scope, constraints, acceptance criteria, and a
      focused validation path.
- [x] The setup task for creating this tree is archived separately, leaving this
      parent roadmap and deliverable children available for future work.
- [x] `python ./.trellis/scripts/task.py list` shows the deliverable children
      under this parent.
- [x] `npm run repo:drift-check` remains 0 violations / 0 tracked debt.

## Final Integration

- All eight child tasks are archived or completed under this parent.
- `python ./.trellis/scripts/task.py list` reports this parent as `[8/8 done]`.
- `npm run repo:drift-check` reports 0 violations / 0 tracked debt.

## Out of Scope

- Implementing any deliverable child in this session.
- Deep splitting `src/server/services/tokenRouter.ts` or
  `src/server/transformers/shared/chatFormatsCore.ts`.
- Database migrations, dependency upgrades, or public API changes.
