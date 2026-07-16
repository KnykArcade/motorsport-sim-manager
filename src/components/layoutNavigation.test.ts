import { describe, expect, it } from 'vitest';
import {
  NAVIGATION_GROUPS,
  NAVIGATION_ITEMS,
  navigationGroupForRoute,
  navigationItemsForGroup,
} from './layoutNavigation';

describe('compact layout navigation', () => {
  it('keeps every destination in exactly one compact group', () => {
    expect(NAVIGATION_GROUPS.map((group) => group.id)).toEqual(['race', 'team', 'world']);
    expect(new Set(NAVIGATION_ITEMS.map((item) => item.to)).size).toBe(NAVIGATION_ITEMS.length);
    for (const group of NAVIGATION_GROUPS) {
      expect(navigationItemsForGroup(group.id, new Set()).length).toBeLessThanOrEqual(10);
    }
  });

  it('opens the group containing the current route', () => {
    expect(navigationGroupForRoute('/calendar')).toBe('race');
    expect(navigationGroupForRoute('/engine')).toBe('team');
    expect(navigationGroupForRoute('/relationships')).toBe('world');
    expect(navigationGroupForRoute('/unknown')).toBe('race');
  });

  it('removes mode-restricted routes without changing other groups', () => {
    const visibleTeam = navigationItemsForGroup('team', new Set(['/engine', '/scouting']));
    expect(visibleTeam.some((item) => item.to === '/engine')).toBe(false);
    expect(visibleTeam.some((item) => item.to === '/drivers')).toBe(true);
  });
});
