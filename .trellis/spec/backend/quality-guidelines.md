# Quality Guidelines

> Code quality standards for backend development.

---

## Overview

<!--
Document your project's quality standards here.

Questions to answer:
- What patterns are forbidden?
- What linting rules do you enforce?
- What are your testing requirements?
- What code review standards apply?
-->

(To be filled by the team)

---

## Forbidden Patterns

<!-- Patterns that should never be used and why -->

(To be filled by the team)

---

## Required Patterns

<!-- Patterns that must always be used -->

### Scenario: Personal Docker-Only GHCR Publishing Workflows

#### 1. Scope / Trigger
- Trigger: adding or changing GitHub Actions workflows that build and push Docker images.
- Use this pattern for this repository's personal Docker-only publishing flow.

#### 2. Signatures
- Workflow path: `.github/workflows/<purpose>-docker.yml`.
- Registry: `ghcr.io`.
- Auth: `docker/login-action` with `registry: ghcr.io`, `username: ${{ github.actor }}`, and `password: ${{ secrets.GITHUB_TOKEN }}`.
- Build: `docker/build-push-action` with the repository `docker/Dockerfile`.
- Image tag: `ghcr.io/<owner>/<repo>:latest`.

#### 3. Contracts
- Set workflow permissions explicitly:
  ```yaml
  permissions:
    contents: read
    packages: write
  ```
- Do not require Docker Hub secrets for GHCR-only workflows.
- For Synology DS920+ personal images, publish only `linux/amd64`.
- Publish on pushes to `main` and `workflow_dispatch`.
- Do not add Docker Hub publishing, multi-arch manifests, desktop release assets, or GitHub Release uploads unless the task explicitly reverses the Docker-only decision.

#### 4. Validation & Error Matrix
- Docker Hub secrets referenced by GHCR-only workflow -> reject; personal GHCR publishing must work without them.
- `metapi-synology` package references -> reject; the repository now uses the main GHCR package.
- Desktop release workflow or GitHub Release asset upload restored -> reject unless requested.

#### 5. Good/Base/Bad Cases
- Good: `ghcr.io/2263075977/metapi:latest` for a DS920+ amd64-only image.
- Base: `.github/workflows/synology-docker.yml` owns the GHCR `latest` push.
- Bad: Docker Hub publishing jobs or desktop release jobs running alongside the personal GHCR workflow.

#### 6. Tests Required
- `git diff --check`.
- Static content check for trigger, GHCR login, `linux/amd64`, and absence of Docker Hub secrets.
- YAML parse smoke test with an available parser, for example `js-yaml` when present.
- Confirm `.github/workflows/release.yml` stays removed unless the task explicitly restores desktop/GitHub Release publishing.

#### 7. Wrong vs Correct

Wrong:
```yaml
tags: ghcr.io/${{ github.repository }}:${{ github.ref_name }}
```

Correct:
```yaml
tags: ghcr.io/<owner>/<repo>:latest
```

The single `latest` tag keeps the personal NAS deployment simple.

---

## Testing Requirements

<!-- What level of testing is expected -->

(To be filled by the team)

---

## Code Review Checklist

<!-- What reviewers should check -->

(To be filled by the team)
