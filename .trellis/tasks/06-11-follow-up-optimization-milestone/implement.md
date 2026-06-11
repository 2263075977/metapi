# Follow-up optimization milestone implementation plan

## Current Session

- [x] Create the parent Trellis task.
- [x] Create deliverable child tasks for the next optimization milestone.
- [x] Add a small setup child task that can be archived for this session while
      preserving the parent roadmap tree.
- [x] Replace default PRDs with scoped requirements and validation paths.
- [x] Validate the task tree with `task.py list`.
- [x] Run `npm run repo:drift-check` to confirm the clean baseline remains.
- [x] Commit the task-tree artifacts.
- [x] Archive the setup task and record the session journal.

## Future Child Order

1. `align-runtime-docs-config`
2. `decompose-accounts-page-surfaces`
3. `decompose-settings-page-surfaces`
4. `decompose-oauth-management-surfaces`
5. `split-web-api-domain-facade`
6. `thin-stats-api-route-adapter`
7. `thin-settings-api-route-adapter`

## Final Milestone Gate

Before archiving this parent in a future session:

- All deliverable children are completed or intentionally removed from scope.
- `npm run typecheck` passes after code-bearing child tasks.
- `npm run repo:drift-check` reports 0 violations and 0 tracked debt.
- The session journal records the child task commits that closed the milestone.
