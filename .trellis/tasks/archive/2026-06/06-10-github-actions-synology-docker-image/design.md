# Design

## Scope

Add a lightweight GitHub Actions workflow dedicated to personal Synology DS920+ Docker usage:

- Registry: GitHub Container Registry (`ghcr.io`).
- Image: `ghcr.io/${{ github.repository }}:latest`.
- Platform: `linux/amd64`.
- Dockerfile: reuse `docker/Dockerfile`.
- Trigger: pushes to `main` and manual dispatch.

Existing desktop release and legacy Docker publishing jobs are removed because the repository is now personal Docker-only.

## Workflow Behavior

On `push` to `main` or `workflow_dispatch`:

- Build `linux/amd64`.
- Push `ghcr.io/<owner>/<repo>:latest`, for example `ghcr.io/2263075977/metapi:latest`.

## Permissions And Auth

- Use `permissions: packages: write, contents: read`.
- Authenticate to GHCR with `GITHUB_TOKEN`.
- No Docker Hub secrets required.

## Synology Usage

DS920+ can use the amd64 image directly:

```yaml
services:
  metapi:
    image: ghcr.io/2263075977/metapi:latest
```

If the repository/package is private, the Synology host must log in to GHCR with a GitHub PAT that has package read access. If public, no login should be needed after package visibility is public.

## Compatibility

- Does not change app runtime behavior.
- Does not change `docker/Dockerfile`.
- Default Docker docs and Compose examples should point to the GHCR latest image.

## Rollback

Restore the previous release/CI Docker publishing jobs and docs if official multi-channel publishing is needed again.
