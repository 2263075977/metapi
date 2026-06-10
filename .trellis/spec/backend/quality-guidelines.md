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

### Scenario: Personal GHCR Docker Publishing Workflows

#### 1. Scope / Trigger
- Trigger: adding or changing GitHub Actions workflows that build and push Docker images.
- Use this pattern for personal or environment-specific images that should not replace the existing official release or CI Docker publishing flow.

#### 2. Signatures
- Workflow path: `.github/workflows/<purpose>-docker.yml`.
- Registry: `ghcr.io`.
- Auth: `docker/login-action` with `registry: ghcr.io`, `username: ${{ github.actor }}`, and `password: ${{ secrets.GITHUB_TOKEN }}`.
- Build: `docker/build-push-action` with the repository `docker/Dockerfile`.

#### 3. Contracts
- Set workflow permissions explicitly:
  ```yaml
  permissions:
    contents: read
    packages: write
  ```
- Do not require Docker Hub secrets for GHCR-only workflows.
- For Synology DS920+ personal images, publish only `linux/amd64`.
- Use a dedicated package name, such as `ghcr.io/<owner>/<repo>-synology:<version>`, when the official release workflow already publishes `ghcr.io/<owner>/<repo>:<version>`.

#### 4. Validation & Error Matrix
- Empty manual version -> fail before build.
- `latest` requested for version-only workflow -> fail before build.
- Invalid Docker tag characters -> fail before build.
- Same GHCR package/tag as the official release workflow -> reject or rename the package to avoid racing/overwriting manifests.
- Docker Hub secrets referenced by GHCR-only workflow -> reject; personal GHCR publishing must work without them.

#### 5. Good/Base/Bad Cases
- Good: `ghcr.io/2263075977/metapi-synology:v1.3.0` for a DS920+ amd64-only image.
- Base: `ghcr.io/2263075977/metapi:v1.3.0` remains owned by the official multi-arch release workflow.
- Bad: two workflows both push `ghcr.io/2263075977/metapi:v1.3.0` on the same `v*` tag.

#### 6. Tests Required
- `git diff --check`.
- Static content check for trigger, GHCR login, `linux/amd64`, and absence of Docker Hub secrets.
- YAML parse smoke test with an available parser, for example `js-yaml` when present.
- Confirm `.github/workflows/ci.yml` and `.github/workflows/release.yml` are unchanged unless the task explicitly changes them.

#### 7. Wrong vs Correct

Wrong:
```yaml
tags: ghcr.io/${{ github.repository }}:${{ github.ref_name }}
```

Correct:
```yaml
tags: ghcr.io/<owner>/<repo>-synology:<version>
```

The dedicated package keeps personal amd64 images separate from official multi-arch release manifests.

---

## Testing Requirements

<!-- What level of testing is expected -->

(To be filled by the team)

---

## Code Review Checklist

<!-- What reviewers should check -->

(To be filled by the team)
