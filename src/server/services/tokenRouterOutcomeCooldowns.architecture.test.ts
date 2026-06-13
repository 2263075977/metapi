import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

describe('token router outcome cooldown architecture boundaries', () => {
  it('keeps outcome transitions below the TokenRouter facade and away from route adapters', () => {
    const outcomeSource = readSource('./tokenRouterOutcomeCooldowns.ts');
    const facadeSource = readSource('./tokenRouter.ts');

    expect(outcomeSource).not.toMatch(/from\s+['"][^'"]*tokenRouter\.js['"]/);
    expect(outcomeSource).not.toMatch(/from\s+['"][^'"]*routes\//);
    expect(facadeSource).toContain("from './tokenRouterOutcomeCooldowns.js'");
  });
});
