# Create follow-up optimization task tree

## Goal

Create and document the Trellis task tree for the next steady debt-reduction
optimization milestone.

## Requirements

- Create a parent roadmap task for the follow-up optimization milestone.
- Create deliverable child tasks for docs/config consistency, frontend page
  decomposition, web API facade splitting, and backend API route thinning.
- Write scoped PRDs for the parent and each deliverable child.
- Leave implementation of deliverable children out of this session.
- Preserve the active parent/child tree after this setup task is archived.

## Acceptance Criteria

- [x] Parent task exists and owns the deliverable child list.
- [x] Seven deliverable child tasks exist under the parent.
- [x] Parent task has PRD, design, and implement artifacts.
- [x] Each deliverable child has a non-template PRD.
- [x] `task.py list` shows the parent tree with deliverable children.
- [x] `npm run repo:drift-check` reports 0 violations and 0 tracked debt.

## Notes

- This setup task may be archived at the end of the session.
- The parent milestone task should remain active so future sessions can start
  one child at a time.
