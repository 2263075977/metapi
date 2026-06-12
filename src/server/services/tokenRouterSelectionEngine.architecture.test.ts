import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

describe('token router selection engine architecture boundaries', () => {
  it('keeps selection below the TokenRouter facade and away from route adapters', () => {
    const selectionSource = readSource('./tokenRouterSelectionEngine.ts');
    const facadeSource = readSource('./tokenRouter.ts');

    expect(selectionSource).not.toMatch(/from\s+['"][^'"]*tokenRouter\.js['"]/);
    expect(selectionSource).not.toMatch(/from\s+['"][^'"]*routes\//);
    expect(facadeSource).toContain("from './tokenRouterSelectionEngine.js'");
  });
});
