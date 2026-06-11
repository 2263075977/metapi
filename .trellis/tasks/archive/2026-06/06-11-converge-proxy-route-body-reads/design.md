# Design

## Approach

Use the existing `readRuntimeResponseText()` helper from
`src/server/proxy-core/executors/types.ts` wherever the selected route files read
an upstream response body as a complete string.

This is a mechanical convergence: the selected routes keep their current control
flow and response handling. Only the body reader changes.

## Boundaries

- Route files remain route adapters for this task; no surface extraction is
  included.
- `readRuntimeResponseText()` stays owned by proxy-core executor utilities.
- Stream handling that reads chunks from `upstream.body.getReader()` remains
  unchanged.

## Behavior Preservation

- Error paths that previously used `response.text().catch(() => 'unknown error')`
  should still produce `unknown error` when the helper returns an empty string.
- JSON parse fallbacks should stay local to the existing route code.
- Video mapped GET/DELETE behavior should continue to relay upstream status,
  content type, and raw body shape as before.

## Guardrail

Add a repo drift rule for non-test `src/server/routes/proxy/*.ts` files that
flags direct `.text()` calls. The rule should be a violation, not tracked debt,
because the current task removes all known matches.
