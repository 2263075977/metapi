import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('docker workflows', () => {
  it('publishes the personal GHCR latest image for Synology amd64 usage', () => {
    const ciWorkflow = readFileSync(resolve(process.cwd(), '.github/workflows/ci.yml'), 'utf8');
    const synologyWorkflow = readFileSync(resolve(process.cwd(), '.github/workflows/synology-docker.yml'), 'utf8');

    expect(ciWorkflow).not.toContain('publish-docker');
    expect(ciWorkflow).not.toContain('DOCKERHUB_IMAGE');

    expect(synologyWorkflow).toContain("branches: ['main']");
    expect(synologyWorkflow).toContain('registry: ghcr.io');
    expect(synologyWorkflow).toContain('platforms: linux/amd64');
    expect(synologyWorkflow).toContain('${{ steps.meta.outputs.image }}:latest');
    expect(synologyWorkflow).toContain('password: ${{ secrets.GITHUB_TOKEN }}');
    expect(synologyWorkflow).not.toContain('DOCKERHUB');
    expect(synologyWorkflow).not.toContain('metapi-synology');
  });

  it('keeps the old desktop and multi-channel release workflow removed', () => {
    expect(existsSync(resolve(process.cwd(), '.github/workflows/release.yml'))).toBe(false);
  });

  it('uses an armv7-capable node base image in the Dockerfile', () => {
    const dockerfile = readFileSync(resolve(process.cwd(), 'docker/Dockerfile'), 'utf8');

    expect(dockerfile).toContain('FROM node:22-bookworm-slim AS builder');
    expect(dockerfile).toContain('FROM node:22-bookworm-slim');
  });

  it('avoids buildkit-only frontend syntax so managed docker builders can parse it reliably', () => {
    const dockerfile = readFileSync(resolve(process.cwd(), 'docker/Dockerfile'), 'utf8');

    expect(dockerfile).not.toContain('# syntax=docker/dockerfile:');
    expect(dockerfile).not.toContain('RUN --mount=type=cache');
  });

  it('keeps server docker builds isolated from desktop packaging dependencies', () => {
    const dockerfile = readFileSync(resolve(process.cwd(), 'docker/Dockerfile'), 'utf8');

    expect(dockerfile).toContain('npm ci --ignore-scripts --no-audit --no-fund');
    expect(dockerfile).toContain('npm rebuild esbuild sharp better-sqlite3 --no-audit --no-fund');
    expect(dockerfile).not.toContain('npm ci --no-audit --no-fund');
    expect(dockerfile).toContain('RUN npm run build:web && npm run build:server');
    expect(dockerfile).toContain('npm prune --omit=dev --no-audit --no-fund');
  });
});
