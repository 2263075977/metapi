import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

describe('token router route matching architecture boundaries', () => {
  it('keeps route matching below the TokenRouter facade and away from route adapters', () => {
    const matchingSource = readSource('./tokenRouterRouteMatching.ts');
    const facadeSource = readSource('./tokenRouter.ts');

    expect(matchingSource).not.toMatch(/from\s+['"][^'"]*tokenRouter\.js['"]/);
    expect(matchingSource).not.toMatch(/from\s+['"][^'"]*routes\//);
    expect(facadeSource).toContain("from './tokenRouterRouteMatching.js'");
  });
});
