import { describe, expect, it } from 'vitest';
import {
  NAVIGATION_GROUPS,
  NAVIGATION_ITEMS,
  isNavigationItemActive,
  navigationGroupForRoute,
  navigationItemsForGroup,
} from './layoutNavigation';

describe('FM-style primary navigation', () => {
  it('exposes exactly ten primary destinations across three compact groups', () => {
    expect(NAVIGATION_GROUPS.map((group) => group.id)).toEqual(['race', 'team', 'world']);
    expect(NAVIGATION_ITEMS).toHaveLength(10);
    expect(new Set(NAVIGATION_ITEMS.map((item) => item.to)).size).toBe(NAVIGATION_ITEMS.length);
    expect(NAVIGATION_ITEMS.map((item) => item.label)).toEqual([
      'Home',
      'Inbox',
      'Race',
      'Team',
      'Drivers',
      'Staff',
      'Recruitment',
      'Technical',
      'Finance',
      'Competitions',
    ]);
  });

  it('opens the group containing the current route', () => {
    expect(navigationGroupForRoute('/calendar')).toBe('race');
    expect(navigationGroupForRoute('/technical')).toBe('team');
    expect(navigationGroupForRoute('/standings')).toBe('world');
    expect(navigationGroupForRoute('/unknown')).toBe('race');
  });

  it('removes mode-restricted routes without changing other groups', () => {
    const visibleTeam = navigationItemsForGroup('team', new Set(['/technical', '/scouting']));
    expect(visibleTeam.some((item) => item.to === '/technical')).toBe(false);
    expect(visibleTeam.some((item) => item.to === '/drivers')).toBe(true);
  });

  it('keeps primary routes active while contextual query-backed views are open', () => {
    const team = NAVIGATION_ITEMS.find((item) => item.label === 'Team');
    expect(team).toBeDefined();

    expect(isNavigationItemActive(team!, '/teams', '')).toBe(true);
    expect(isNavigationItemActive(team!, '/teams', '?filter=player')).toBe(true);
  });
});
