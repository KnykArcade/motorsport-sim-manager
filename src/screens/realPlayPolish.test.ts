import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

describe('Phase 28 real-play polish contracts', () => {
  it('keeps mounted workspace tabs authoritative to URL state', () => {
    const finance = source('Finance.tsx');
    const offseason = source('Offseason.tsx');
    const politics = source('Politics.tsx');
    const preseason = source('PreSeasonSetup.tsx');
    const technical = source('TechnicalCenter.tsx');

    expect(finance).toContain('const tab: FinanceWorkspaceTab =');
    expect(offseason).toContain('const tab: OffseasonTab =');
    expect(politics).toContain('const activeTab: TabKey =');
    expect(preseason).toContain('const activeTab: PreseasonTab =');
    expect(technical).toContain("technicalSectionFromQuery(searchParams.get('section'))");
    for (const workspace of [finance, offseason, politics, technical]) {
      expect(workspace).toContain('new URLSearchParams(searchParams)');
      expect(workspace).toContain('setSearchParams');
    }
    expect(preseason).toContain('setSearchParams({ task: nextTab })');
  });

  it('uses query focus as the selected record across connected destinations', () => {
    expect(source('TeamPrincipal.tsx')).toContain("const selectedOfferId = searchParams.get('focus')");
    expect(source('Sponsors.tsx')).toContain("const focusedId = searchParams.get('focus')");
    expect(source('NewsCenter.tsx')).toContain("const focusedItemId = searchParams.get('focus')");
    expect(source('Politics.tsx')).toContain("const selectedProposalId = searchParams.get('focus')");
    expect(source('Relationships.tsx')).toContain("const focusedRelationship = searchParams.get('focus')");
    expect(source('TechnicalCenter.tsx')).toContain('<PartsInventoryPanel focusedPartId={focusedId} />');
    expect(source('Offseason.tsx')).toContain("aria-current={focusedId === s.sourceId ? 'true' : undefined}");
  });

  it('keeps first-day review separate from the saved checkpoint and hides general navigation', () => {
    const layout = source('../components/Layout.tsx');
    const launch = source('CareerLaunch.tsx');
    expect(layout).toContain('firstDayFocus');
    expect(layout).toContain("aria-label={firstDayFocus ? 'First-day navigation' : 'Game navigation'}");
    expect(layout).toContain('state && !firstDayFocus && <GlobalSearch');
    expect(launch).toContain('reviewedStep');
    expect(launch).toContain('reviewingCompletedStep');
    expect(launch).toContain('setReviewedStep(index === stepIndex ? undefined : step.id)');
  });

  it('runs a dedicated Chromium smoke suite in CI without changing the Node test command', () => {
    const packageJson = JSON.parse(source('../../package.json')) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const workflow = source('../../.github/workflows/ci.yml');
    const browserConfig = source('../../vitest.browser.config.ts');

    expect(packageJson.scripts.test).toBe('node scripts/runTestShards.mjs');
    expect(packageJson.scripts['test:browser']).toBe('vitest run --config vitest.browser.config.ts');
    expect(packageJson.dependencies.playwright).toBeUndefined();
    expect(packageJson.devDependencies.playwright).toBeTruthy();
    expect(packageJson.devDependencies['@vitest/browser-playwright']).toBeTruthy();
    expect(workflow).toContain('npx playwright install --with-deps chromium');
    expect(workflow).toContain('npm run test:browser');
    expect(browserConfig).toContain("instances: [{ browser: 'chromium' }]");
  });
});
