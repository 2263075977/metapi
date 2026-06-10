import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('ProxyLogs mobile layout', () => {
  it('renders compact mobile summary cards for proxy logs', () => {
    const pageSource = readFileSync(resolve(process.cwd(), 'src/web/pages/ProxyLogs.tsx'), 'utf8');
    const resultsSource = readFileSync(
      resolve(process.cwd(), 'src/web/pages/proxy-logs/ProxyLogResultsSurface.tsx'),
      'utf8',
    );

    expect(pageSource).toContain(
      'import ResponsiveFilterPanel from "../components/ResponsiveFilterPanel.js";',
    );
    expect(pageSource).toContain('<ResponsiveFilterPanel');
    expect(resultsSource).toContain('MobileCard');
    expect(resultsSource).toContain('compact');
    expect(resultsSource).toContain('mobile-summary-grid');
    expect(resultsSource).toContain("subtitle={formatDateTimeLocal(log.createdAt)}");
  });
});
