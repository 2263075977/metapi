# Clean frontend page import drift

## Goal

Remove the remaining tracked frontend architecture debt reported by
`npm run repo:drift-check`: `Accounts.tsx` must not import the top-level
`Tokens.tsx` page directly.

The user value is lower frontend drift and clearer page boundaries without
changing the Accounts or Tokens user workflows.

## Requirements

- Preserve the current Accounts "账号令牌管理" embedded token panel behavior.
- Preserve the standalone Tokens page behavior and route export.
- Move the reusable token panel surface out of the top-level page module into a
  neutral domain/shared module.
- Avoid broad page refactors, visual changes, dependency changes, or unrelated
  formatting churn.
- Keep existing tests pointed at the same user-facing behavior unless import
  paths must change for the new boundary.

## Acceptance Criteria

- [x] `npm run repo:drift-check` reports 0 violations and 0 tracked debt for
      this boundary.
- [x] Accounts no longer imports `./Tokens.js`.
- [x] Standalone Tokens page still renders through the existing route module.
- [x] Focused Accounts/Tokens tests and frontend type checking pass, or any
      unrelated failures are explicitly documented.

## Notes

- Existing evidence: `npm run repo:drift-check` reports one tracked debt:
  `[web-page-to-page-import] src/web/pages/Accounts.tsx:29 top-level page
  imports ./Tokens.js`.
- Lightweight task; PRD-only is sufficient.
