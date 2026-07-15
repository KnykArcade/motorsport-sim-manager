import { describe, expect, it } from 'vitest';
import {
  TEAM_DETAIL_TABS,
  TEAM_OVERVIEW_PAGE_SIZE,
  teamOverviewPage,
  teamOverviewPageCount,
} from './teamOverviewViewModel';

describe('Team Overview view model', () => {
  it('keeps expanded team information in four compact tabs', () => {
    expect(TEAM_DETAIL_TABS.map((tab) => tab.id)).toEqual(['overview', 'ratings', 'lineup', 'moves']);
  });

  it('fits a 95-team NASCAR grid into stable eight-row pages', () => {
    const teams = Array.from({ length: 95 }, (_, index) => `team-${index + 1}`);
    expect(TEAM_OVERVIEW_PAGE_SIZE).toBe(8);
    expect(teamOverviewPageCount(teams.length)).toBe(12);
    expect(teamOverviewPage(teams, 0)).toEqual(teams.slice(0, 8));
    expect(teamOverviewPage(teams, 11)).toEqual(teams.slice(88, 95));
    expect(teamOverviewPage(teams, 99)).toEqual(teams.slice(88, 95));
    expect(teamOverviewPage(teams, -1)).toEqual(teams.slice(0, 8));
  });
});
