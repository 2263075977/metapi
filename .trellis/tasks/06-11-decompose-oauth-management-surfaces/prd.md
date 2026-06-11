# Decompose OAuth management surfaces

## Goal

Thin `src/web/pages/OAuthManagement.tsx` by extracting OAuth credential,
session, modal, and panel surfaces into the existing OAuth page domain folder.

## Confirmed Facts

- `OAuthManagement.tsx` is currently about 2438 lines.
- The repository already has `src/web/pages/oauth/`.
- OAuth flows are behavior-sensitive and should not be changed as part of a
  decomposition task.

## Requirements

- Move UI and local state groups into `src/web/pages/oauth/`.
- Preserve OAuth API payloads, response handling, credentials behavior, and
  user-visible flows.
- Follow the extraction pattern established by Accounts and Settings tasks in
  this milestone.
- Do not change server OAuth routes or token/session semantics.

## Acceptance Criteria

- [ ] `OAuthManagement.tsx` is primarily a page composer.
- [ ] Extracted surfaces live under `src/web/pages/oauth/`.
- [ ] OAuth management behavior and API contracts remain unchanged.
- [ ] No route, schema, or auth/session behavior changes are included.

## Validation

- `npm run typecheck`
- Existing OAuth route and web tests if touched by the extraction.
