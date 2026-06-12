import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

describe('token router runtime health architecture boundaries', () => {
  it('keeps runtime health below the TokenRouter facade and away from route adapters', () => {
    const runtimeHealthSource = readSource('./tokenRouterRuntimeHealth.ts');
    const facadeSource = readSource('./tokenRouter.ts');

    expect(runtimeHealthSource).not.toMatch(/from\s+['"][^'"]*tokenRouter\.js['"]/);
    expect(runtimeHealthSource).not.toMatch(/from\s+['"][^'"]*routes\//);
    expect(facadeSource).toContain("from './tokenRouterRuntimeHealth.js'");
  });
});
