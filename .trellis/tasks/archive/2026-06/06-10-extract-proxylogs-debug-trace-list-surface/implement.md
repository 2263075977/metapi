# Implementation Plan: Extract ProxyLogs debug trace list surface

## Preconditions

- Do not start implementation until the user reviews the planning artifacts
  and approves `task.py start`.
- After start, load `trellis-before-dev` before editing code.
- Inline Codex mode is active, so no sub-agent JSONL curation is required.

## Ordered Checklist

1. Re-read the current `ProxyLogs.tsx` debug trace panel block and existing
   `src/web/pages/proxy-logs/` modules.
2. Create `src/web/pages/proxy-logs/DebugTraceListSurface.tsx`.
3. Move only presentation code into the new surface:
   - panel header and quick-action buttons
   - summary metrics and pure formatting helpers
   - collapsible panel body
   - loading and empty states
   - mobile card list
   - desktop table
   - status badge helper
   - pagination controls
4. Update `ProxyLogs.tsx` to import and render the new surface.
5. Keep debug settings, trace loading, polling, localStorage persistence,
   selected trace detail state, and modal orchestration in `ProxyLogs.tsx`.
6. Remove imports and helpers from `ProxyLogs.tsx` that are no longer used
   after the extraction.
7. Verify `DebugSettingsSurface`, `DebugTraceDetailSurface`, and
   `ProxyLogResultsSurface` imports remain one-way from the route page into the
   domain folder.

## Validation Commands

Run these before reporting implementation complete:

```bash
npx vitest run --root . src/web/pages/ProxyLogs.server-driven.test.tsx
npm run typecheck:web
npm run typecheck:web:test
npm run repo:drift-check
git diff --check
```

If a command fails, inspect whether the failure is caused by this extraction
before claiming the task is complete.

## Risky Files And Checks

- `src/web/pages/ProxyLogs.tsx`
  - Risk: accidentally moving lifecycle or persistence behavior.
  - Check: localStorage persistence tests still pass and the key string stays
    in the route page.
- `src/web/pages/proxy-logs/DebugTraceListSurface.tsx`
  - Risk: prop boundary becomes too stateful.
  - Check: the surface has no API calls, timers, route navigation, or
    localStorage access.
- `src/web/pages/ProxyLogs.server-driven.test.tsx`
  - Risk: source behavior changes are hidden by broad text assertions.
  - Check: existing debug trace panel tests pass without weakening assertions.

## Follow-Up Checks Before Start

- Confirm the planning scope remains the whole debug trace panel presentation,
  not a hook extraction or backend API change.
- Confirm no new product question remains open in `prd.md`.
- Ask for user review/approval before running `python ./.trellis/scripts/task.py
  start ...`.
