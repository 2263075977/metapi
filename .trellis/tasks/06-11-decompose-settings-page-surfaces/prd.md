# Decompose Settings page surfaces

## Goal

Reduce `src/web/pages/Settings.tsx` by moving setting families, panels, and
local state into focused domain surfaces.

## Confirmed Facts

- `Settings.tsx` is currently about 2536 lines.
- The repository already has `src/web/pages/settings/` with extracted settings
  sections.
- Settings touches multiple high-impact workflows, including backup, database,
  system proxy, update center, and model availability settings.

## Requirements

- Continue the existing `src/web/pages/settings/` decomposition pattern.
- Keep settings persistence, API calls, validation behavior, and UI copy
  unchanged unless a bug is explicitly found and scoped.
- Prefer extracting cohesive sections over inventing a new settings framework.
- Do not bundle runtime config version changes from `align-runtime-docs-config`
  into this task.

## Acceptance Criteria

- [ ] `Settings.tsx` is reduced toward page orchestration rather than inline
      section implementation.
- [ ] Extracted setting sections keep stable props and local ownership.
- [ ] Existing settings tests continue to pass.
- [ ] No database schema, public API, or settings payload shape changes occur.

## Validation

- `npm run typecheck`
- `npx vitest run --root . "src/server/routes/api/settings.*.test.ts"` only if
  backend settings contracts are touched.
