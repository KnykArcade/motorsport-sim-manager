import { describe, expect, it } from 'vitest';
import {
  NAVIGATION_GROUPS,
  NAVIGATION_ITEMS,
  isNavigationItemActive,
  navigationGroupForRoute,
  navigationItemsForState,
  navigationItemsForGroup,
} from './layoutNavigation';
import type { GameState } from '../game/careerState';

describe('FM-style primary navigation', () => {
  it('exposes exactly eight primary destinations across three compact groups', () => {
    expect(NAVIGATION_GROUPS.map((group) => group.id)).toEqual(['management', 'club', 'world']);
    expect(NAVIGATION_ITEMS).toHaveLength(8);
    expect(new Set(NAVIGATION_ITEMS.map((item) => item.to)).size).toBe(NAVIGATION_ITEMS.length);
    expect(NAVIGATION_ITEMS.map((item) => item.label)).toEqual([
      'Home',
      'Inbox',
      'Race',
      'Team',
      'Recruitment',
      'Technical',
      'Finance',
      'World',
    ]);
  });

  it('opens the group containing the current route', () => {
    expect(navigationGroupForRoute('/calendar')).toBe('management');
    expect(navigationGroupForRoute('/technical')).toBe('club');
    expect(navigationGroupForRoute('/planner')).toBe('club');
    expect(navigationGroupForRoute('/standings')).toBe('world');
    expect(navigationGroupForRoute('/unknown')).toBe('management');
  });

  it('removes mode-restricted routes without changing other groups', () => {
    const visibleTeam = navigationItemsForGroup('club', new Set(['/technical', '/scouting']));
    expect(visibleTeam.some((item) => item.to === '/technical')).toBe(false);
    expect(visibleTeam.some((item) => item.to === '/teams?filter=player')).toBe(true);
  });

  it('keeps Team active for its Drivers, Staff, and query-backed views', () => {
    const team = NAVIGATION_ITEMS.find((item) => item.label === 'Team');
    expect(team).toBeDefined();

    expect(isNavigationItemActive(team!, '/teams', '')).toBe(true);
    expect(isNavigationItemActive(team!, '/teams', '?filter=player')).toBe(true);
    expect(isNavigationItemActive(team!, '/drivers', '')).toBe(true);
    expect(isNavigationItemActive(team!, '/staff', '')).toBe(true);
  });

  it('resolves Race to the live career task instead of a fixed weekend route', () => {
    const state = {
      seasonComplete: false,
      careerPhase: { currentPhase: 'pre_race_briefing' },
    } as unknown as GameState;

    expect(navigationItemsForState(state).find((item) => item.label === 'Race')?.to)
      .toBe('/briefing?tab=preparation');
  });
});
