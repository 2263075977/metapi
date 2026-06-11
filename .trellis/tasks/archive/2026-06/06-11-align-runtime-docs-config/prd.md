# Align runtime docs and config claims

## Goal

Align documented Node.js and TypeScript version claims with the repository's
actual runtime and package configuration.

## Confirmed Facts

- `.nvmrc` currently says `25.0.0`.
- `package.json` declares `engines.node` as `>=25.0.0`.
- `package.json` declares `typescript` as `^6.0.3`.
- README badges still mention Node.js `22.15+` and TypeScript `5.x`.
- `CONTRIBUTING.md` and `docs/getting-started.md` still mention Node.js `20+`.
- `docker/Dockerfile` intentionally uses `node:22-bookworm-slim` because newer
  slim images are not available for every target image case.

## Requirements

- Treat `.nvmrc` and `package.json` as the canonical development/runtime claim:
  Node.js `>=25.0.0` and TypeScript `^6.0.3`.
- Update user-facing and contributor-facing docs that still advertise older
  Node.js or TypeScript baselines.
- Preserve the Dockerfile Node 22 base as a documented image-build exception,
  not as the general development baseline.
- Do not change dependencies, lockfiles, Docker behavior, or runtime code.

## Acceptance Criteria

- [x] README and README_EN badges no longer mention Node.js `22.15+` or
      TypeScript `5.x`.
- [x] CONTRIBUTING and getting-started docs no longer advertise Node.js `20+`
      as the development baseline.
- [x] Docker docs or comments still explain why Docker uses Node 22.
- [x] No package or lockfile changes are made unless the user explicitly asks
      for a runtime upgrade/downgrade.

## Validation

- `rg -n "Node.js 20\\+|22\\.15|TypeScript-5\\.x|TypeScript 5" README.md README_EN.md CONTRIBUTING.md docs docker`
- `npm run repo:drift-check`
