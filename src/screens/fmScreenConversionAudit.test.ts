import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function screenSource(fileName: string): string {
  return readFileSync(new URL(fileName, import.meta.url), 'utf8');
}

function componentSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

describe('Phase 25 core workspace conversion contract', () => {
  const coreScreens = [
    'TeamHQ.tsx',
    'TeamOverview.tsx',
    'TeamPrincipal.tsx',
    'TechnicalCenter.tsx',
    'PaddockWeek.tsx',
    'PreSeasonSetup.tsx',
    'PostRaceReview.tsx',
    'Offseason.tsx',
  ];

  const framedScreens = [
    'TeamHQ.tsx',
    'TeamPrincipal.tsx',
    'TechnicalCenter.tsx',
    'PreSeasonSetup.tsx',
    'PostRaceReview.tsx',
    'Offseason.tsx',
  ];

  it('defines one selectable list/detail/context frame with independently scrollable panes', () => {
    const source = componentSource('../components/workspace/CoreWorkspace.tsx');

    expect(source).toContain('<FmWorkspaceGrid columns="three"');
    expect(source.match(/<FmPane(?:\s|>)/g)).toHaveLength(3);
    expect(source).toContain('<FmListButton');
    expect(source).toContain('ui-core-workspace-detail');
    expect(source).toContain('ui-core-workspace-context');
    expect(source).toContain('onChange(item.id)');
  });

  it.each(coreScreens)('%s uses dense report sections instead of the raised dashboard Panel', (fileName) => {
    const source = screenSource(fileName);

    expect(source).toContain('CoreWorkspaceSection as Panel');
    expect(source).not.toMatch(/from ['"]\.\.\/components\/Panel['"]/);
  });

  it.each(framedScreens)('%s keeps categories, selected detail, and consequences visible together', (fileName) => {
    const source = screenSource(fileName);

    expect(source).toContain('CoreWorkspaceFrame');
    expect(source).toContain('contextTitle=');
    expect(source).toContain('CoreWorkspaceContextGroup');
  });

  it('keeps the already-correct Team Overview and Paddock Week list/detail workspaces', () => {
    for (const fileName of ['TeamOverview.tsx', 'PaddockWeek.tsx']) {
      const source = screenSource(fileName);
      expect(source).toContain('FmWorkspaceGrid');
      expect(source).toContain('FmPaneHeader');
      expect(source).toContain('FmListButton');
    }
  });

  it('gives each race-transition workspace one direct progression action in persistent context', () => {
    const preseason = screenSource('PreSeasonSetup.tsx');
    const postRace = screenSource('PostRaceReview.tsx');
    const offseason = screenSource('Offseason.tsx');

    expect(preseason).toContain('Advance to Race 1 Briefing →');
    expect(preseason).toContain('remain before Race 1');
    expect(postRace).toContain('Continue to Paddock Week →');
    expect(postRace).toContain('Continuing leaves the unresolved reliability penalty active');
    expect(offseason).toContain('Advance to ${nextYear} Season →');
    expect(offseason).toContain('Advancing applies queued seats');
  });

  it('keeps technical depth and car setup directly reachable from the Technical Center', () => {
    const source = screenSource('TechnicalCenter.tsx');

    expect(source).toContain('<UnifiedDevelopmentBody />');
    expect(source).toContain('<PartsInventoryPanel />');
    expect(source).toContain('<FacilitiesBody />');
    expect(source).toContain('<EngineSupplierBody />');
    expect(source).toContain('Open Race & Car Setup →');
    expect(source).toContain("navigate('/weekend')");
  });

  it('keeps established specialist workspaces out of the broad conversion', () => {
    const establishedContracts = [
      ['NewCareer.tsx', 'ui-entry-workspace-grid'],
      ['Settings.tsx', 'ui-settings-workspace'],
      ['DataViewer.tsx', 'ui-data-viewer-grid'],
      ['Inbox.tsx', 'ui-inbox-grid'],
      ['Drivers.tsx', 'FmPane'],
      ['DriverMarket.tsx', 'FmWorkspaceGrid'],
      ['Scouting.tsx', 'FmWorkspaceGrid'],
      ['Finance.tsx', 'FmWorkspaceGrid'],
      ['NewsCenter.tsx', 'FmPane'],
      ['PaddockStories.tsx', 'FmWorkspaceGrid'],
      ['PreRaceBriefing.tsx', 'ui-phase14-workspace'],
      ['RaceWeekend.tsx', 'WorkspaceScreen'],
    ] as const;

    for (const [fileName, marker] of establishedContracts) {
      expect(screenSource(fileName), `${fileName} should retain ${marker}`).toContain(marker);
    }
  });

  it('styles report sections as continuous rows rather than floating cards', () => {
    const css = componentSource('../index.css');

    expect(css).toMatch(/\.ui-core-workspace-grid\s*\{[\s\S]*height:\s*100%/);
    expect(css).toMatch(/\.ui-core-workspace-section\s*\{[\s\S]*border-bottom:[\s\S]*background:\s*transparent/);
    expect(css).toMatch(/\.ui-core-workspace-section-header\s*\{[\s\S]*background:\s*#222225/);
  });
});
