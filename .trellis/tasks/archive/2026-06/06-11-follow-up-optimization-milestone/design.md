# Follow-up optimization milestone design

## Structure

This milestone uses a persistent parent task plus independently executable child
tasks. The parent owns the ordering, source evidence, and cross-child rules. The
children own implementation work and future verification.

The current session archives only `create-follow-up-optimization-task-tree`.
Archiving the parent now would clear active child `parent` links, so the parent
must remain active until the milestone is actually complete.

## Ordering

1. Align docs and config claims first because it is low-risk and clarifies the
   runtime baseline for later work.
2. Decompose high-state frontend pages next, continuing the existing domain
   folder pattern under `src/web/pages/<domain>/`.
3. Split the web API facade after the first frontend extractions expose stable
   domain seams.
4. Thin backend API route adapters after the frontend/API cleanup, starting with
   `stats.ts` and then applying the same route-adapter pattern to `settings.ts`.

## Compatibility

- Keep public endpoints, payloads, response shapes, and routing behavior
  unchanged.
- Keep `src/web/api.ts` as a compatibility facade when splitting domain modules.
- Add or extend focused tests only where a child task changes executable code or
  an architecture boundary.
- Do not combine child implementation work in a single patch unless the user
  explicitly asks to merge tasks.

## Risks

- Frontend page splits can create import drift if top-level pages import each
  other. Use existing domain folders and shared primitives.
- Backend route thinning can accidentally move behavior instead of ownership.
  Preserve route tests and keep adapters limited to registration, parsing, and
  delegation.
- Runtime documentation can become misleading if Docker image constraints are
  flattened into the development engine requirement. Document the Node 22 Docker
  base as an image-availability exception, not the development baseline.
