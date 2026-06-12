# Continue Optimization Design

## Structure

This roadmap uses a persistent parent task plus six independently executable
child tasks. The parent owns source evidence, ordering, cross-child constraints,
and final integration criteria. The children own implementation work.

The parent should not be started for implementation unless it receives direct
integration work. Future sessions should start the child task that owns the next
deliverable.

## Ordering

1. Characterize current routing behavior first so later extractions have a
   stable regression baseline.
2. Extract route matching and cache next because it defines the data shape that
   selection, explanations, and outcome recording consume.
3. Extract runtime health before the selection engine because weighted and
   stable-first scoring read health multipliers, breakers, and recent outcomes.
4. Extract the selection engine after route matching and runtime health seams
   exist.
5. Extract outcome/cooldown recording after health and cache invalidation seams
   are explicit.
6. Thin the `TokenRouter` facade last, preserving the current public imports and
   adding guardrails only after the behavior modules exist.

## Compatibility

- Keep `src/server/services/tokenRouter.ts` as the public service facade unless
  a child explicitly plans and validates a compatible import migration.
- Keep public HTTP APIs, proxy behavior, route decision payloads, database
  schema, and OAuth route-unit behavior unchanged.
- Prefer internal module extraction over new abstractions that change call
  order or data ownership.
- Each child should run the smallest targeted tests for its behavior family plus
  `npm run typecheck:server` when TypeScript module boundaries change.

## Risks

- Selection behavior is probabilistic. Characterization must focus on
  deterministic paths, probability explanations, stable-first ordering, and
  cooldown transitions rather than trying to assert random draws directly.
- Runtime health uses module-level state and persisted settings. Extraction must
  preserve reset, persistence, and cache invalidation behavior used by tests.
- Route matching touches explicit groups and display-name aliases. Extracting it
  without tests can accidentally change exposed model lists or wildcard
  precedence.
- OAuth route-unit selection and cooldowns share outer channel and member state.
  Outcome extraction must keep direct channels and pooled members separate.

