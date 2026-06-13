# Continue Optimization Implementation Plan

## Current Planning Session

- [x] Create the parent Trellis task.
- [x] Choose routing-core modularization as the first optimization wave.
- [x] Inspect `tokenRouter.ts`, related route/core tests, and prior milestone
      scope before creating children.
- [x] Create deliverable child tasks under this parent.
- [x] Replace default child PRDs with scoped requirements and validation paths.
- [x] Validate the task tree with `python ./.trellis/scripts/task.py list`.

## Future Child Order

1. `06-12-characterize-token-router-core-behavior`
2. `06-12-extract-token-router-route-matching-cache`
3. `06-12-extract-token-router-runtime-health`
4. `06-12-extract-token-router-selection-engine`
5. `06-12-extract-token-router-outcome-cooldowns`
6. `06-12-thin-token-router-service-facade`

## Future Validation Baseline

- `npm test -- src/server/services/tokenRouter.test.ts src/server/services/tokenRouter.patterns.test.ts src/server/services/tokenRouter.cache.test.ts src/server/services/tokenRouter.selection.test.ts src/server/services/tokenRouter.oauth-route-units.test.ts src/server/services/tokenRouter.downstream-policy.test.ts`
- `npm run typecheck:server`
- `npm run repo:drift-check`

## Final Milestone Gate

- All child tasks are archived or intentionally removed from scope.
- The parent PRD final integration criteria are satisfied.
- The session journal records the child task commits that closed the milestone.
