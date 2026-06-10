# Implementation

## Checklist

- [x] Add `.github/workflows/synology-docker.yml`.
- [x] Configure triggers:
  - `push.branches: ['main']`
  - `workflow_dispatch`
- [x] Use `docker/setup-buildx-action`.
- [x] Use `docker/login-action` for `ghcr.io` with `github.actor` and `secrets.GITHUB_TOKEN`.
- [x] Build and push with `docker/build-push-action`:
  - `context: .`
  - `file: docker/Dockerfile`
  - `platforms: linux/amd64`
  - `push: true`
  - `ghcr.io/${{ github.repository }}:latest`
- [x] Remove old Docker Hub / multi-arch Docker publishing jobs.
- [x] Remove desktop Release workflow if no non-Docker release work remains.
- [x] Update docs and compose examples to use `ghcr.io/2263075977/metapi:latest`.

## Validation

- [x] YAML/static inspection of workflow syntax.
- [x] Exact search confirms old Docker Hub / `metapi-synology` references are absent from active paths.
- [x] `git diff --check`.
- [x] `npm install` followed by `npm run typecheck`.
- [x] Targeted Vitest coverage for workflow, update-center version selection, About, and Update Center settings.

## Risk Points

- GHCR package visibility may need manual GitHub package settings if the repository/package defaults to private.
- Avoid using Docker Hub secrets in this workflow.
