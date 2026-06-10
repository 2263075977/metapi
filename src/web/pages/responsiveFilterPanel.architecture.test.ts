import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const filterSurfaces = [
  'src/web/pages/Accounts.tsx',
  'src/web/pages/CheckinLog.tsx',
  'src/web/pages/DownstreamKeys.tsx',
  'src/web/pages/Models.tsx',
  'src/web/pages/ProgramLogs.tsx',
  'src/web/pages/proxy-logs/ProxyLogControlsSurface.tsx',
  'src/web/pages/Sites.tsx',
  'src/web/pages/TokenRoutes.tsx',
  'src/web/pages/tokens/TokensPanel.tsx',
];

describe('ResponsiveFilterPanel adoption', () => {
  it('routes page-level filter surfaces through the shared scaffold component', () => {
    for (const surface of filterSurfaces) {
      const source = readFileSync(resolve(process.cwd(), surface), 'utf8').replace(/\r\n/g, '\n');

      expect(source, surface).toMatch(/import\s+ResponsiveFilterPanel\s+from\s+['"](?:\.\.\/|\.\.\/\.\.\/)components\/ResponsiveFilterPanel\.js['"]/);
      expect(source, surface).not.toContain("import MobileFilterSheet from '../components/MobileFilterSheet.js'");
      expect(source, surface).not.toContain('<MobileFilterSheet');
    }
  });
});
