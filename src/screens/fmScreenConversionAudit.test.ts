import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function screenSource(fileName: string): string {
  return readFileSync(new URL(fileName, import.meta.url), 'utf8');
}

describe('Phase 14 screen presentation contract', () => {
  const paneScreens = [
    'PreRaceBriefing.tsx',
    'PerformanceDataHub.tsx',
    'RaceResults.tsx',
    'SeasonReview.tsx',
  ];

  it.each(paneScreens)('%s uses a real pane workspace instead of the legacy panel shell', (fileName) => {
    const source = screenSource(fileName);

    expect(source).toContain('FmWorkspaceGrid');
    expect(source).toContain('FmPaneHeader');
    expect(source).toContain('ui-phase14-workspace');
    expect(source).not.toMatch(/import\s+\{\s*Panel\s*\}/);
  });

  it('keeps the race and season transition boards on the dense conversion surface', () => {
    expect(screenSource('PostRaceReview.tsx')).toContain('ui-post-race-workspace');
    expect(screenSource('Offseason.tsx')).toContain('ui-offseason-workspace');
    expect(screenSource('PreSeasonSetup.tsx')).toContain('ui-preseason-workspace');
    expect(screenSource('RaceWeekendPackageSelection.tsx')).toContain('ui-race-package-workspace');
  });

  it('retains the established specialist workspaces for the remaining audited surfaces', () => {
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
    ] as const;

    for (const [fileName, marker] of establishedContracts) {
      expect(screenSource(fileName), `${fileName} should retain ${marker}`).toContain(marker);
    }
  });
});
