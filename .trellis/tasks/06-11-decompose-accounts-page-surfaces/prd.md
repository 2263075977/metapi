# Decompose Accounts page surfaces

## Goal

Reduce `src/web/pages/Accounts.tsx` from a large top-level page into a thin
orchestration surface backed by domain components and hooks.

## Confirmed Facts

- `Accounts.tsx` is currently about 3399 lines.
- The repository already has `src/web/pages/accounts/` for Accounts domain
  pieces.
- Project rules say pages are orchestration surfaces and top-level pages should
  not import each other.

## Requirements

- Move cohesive Accounts UI/state groups into `src/web/pages/accounts/`.
- Keep route registration, user-visible behavior, API calls, and payload shapes
  unchanged.
- Reuse existing shared web primitives before adding new abstractions.
- Avoid broad formatting churn and unrelated type cleanup.

## Acceptance Criteria

- [ ] `Accounts.tsx` primarily coordinates layout, data loading, and composed
      domain surfaces.
- [ ] Extracted code lives under `src/web/pages/accounts/` or existing shared
      web helpers.
- [ ] No top-level page imports another top-level page.
- [ ] Accounts workflows, filters, batch actions, and modal behavior remain
      unchanged.

## Validation

- `npm run typecheck`
- Targeted web tests that cover Accounts-adjacent shared behavior, if present.
- Manual static check for top-level page import drift.
