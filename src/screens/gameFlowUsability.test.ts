import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

describe('Phase 15 game-flow usability contract', () => {
  it('shows the exact next action instead of a generic Continue label', () => {
    const layout = source('../components/Layout.tsx');
    expect(layout).toContain("firstBlockingMessage ? 'Respond in Inbox' : workflow.label");
    expect(layout).toContain(': workflow.reason}');
  });

  it('routes handoffs directly to the required race-preparation decision', () => {
    expect(source('PaddockWeek.tsx')).toContain("navigate('/briefing?tab=preparation')");
    expect(source('PreSeasonSetup.tsx')).toContain("navigate('/briefing?tab=preparation')");
    expect(source('PreRaceBriefing.tsx')).toContain("next.set('prep', focusId)");
  });

  it('keeps routine workload reducible without delegating consequential preseason choices', () => {
    const preseason = source('PreSeasonSetup.tsx');
    const launch = source('CareerLaunch.tsx');
    expect(preseason).toContain('Acknowledge Welcome Pack');
    expect(preseason).toMatch(/ROUTINE_PRESEASON_TABS[\s\S]*teamOverview[\s\S]*budget[\s\S]*sponsorsEngine[\s\S]*roundOnePreview/);
    const routineTabs = preseason.match(/const ROUTINE_PRESEASON_TABS[^=]*=\s*\[([\s\S]*?)\];/)?.[1] ?? '';
    expect(routineTabs).not.toContain('carDevelopment');
    expect(routineTabs).not.toContain('seasonObjectives');
    expect(launch).toContain('Confirm the race lineup');
    expect(launch).toContain('Launch and test the car');
    expect(launch).toContain('Agree the owner mandate');
    expect(source('WeekendCommandMeeting.tsx')).toContain('Delegate remaining');
  });

  it('routes a newly created career into the persistent first-day flow', () => {
    expect(source('NewCareer.tsx')).toContain("navigate('/career-launch')");
    expect(source('../app/App.tsx')).toContain('needsCareerLaunch(state)');
    expect(source('CareerLaunch.tsx')).toContain("dispatch({ type: 'COMPLETE_CAREER_LAUNCH' })");
    expect(source('CareerLaunch.tsx')).toContain("navigate('/preseason?task=driverLineup')");
  });

  it('persists race-weekend drafts and clears them only at race handoff', () => {
    const weekend = source('RaceWeekend.tsx');
    expect(weekend).toContain('readRaceWeekendUiDraft');
    expect(weekend).toContain('writeRaceWeekendUiDraft');
    expect(weekend).toContain('clearRaceWeekendUiDraft');
    expect(weekend).toContain("nextQuery.set('stage'");
  });

  it('retains decision space at the supported 1024 by 720 floor', () => {
    const css = source('../index.css');
    expect(css).toContain('@media (min-width: 1024px) and (max-height: 760px)');
    expect(css).toContain('.ui-workspace-metric-detail');
    expect(css).toContain('.ui-season-workflow-rail');
  });
});
