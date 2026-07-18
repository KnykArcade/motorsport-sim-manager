import { describe, expect, it } from 'vitest';
import {
  NAVIGATION_GROUPS,
  NAVIGATION_ITEMS,
  navigationGroupForRoute,
  navigationItemsForGroup,
  visibleNavigationGroups,
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
    expect(navigationGroupForRoute('/technical')).toBe('team');
    expect(navigationGroupForRoute('/relationships')).toBe('world');
    expect(navigationGroupForRoute('/unknown')).toBe('race');
  });

  it('removes mode-restricted routes without changing other groups', () => {
    const visibleTeam = navigationItemsForGroup('team', new Set(['/technical', '/scouting']));
    expect(visibleTeam.some((item) => item.to === '/technical')).toBe(false);
    expect(visibleTeam.some((item) => item.to === '/drivers')).toBe(true);
  });

  it('exposes every allowed destination in the persistent grouped navigation', () => {
    const hidden = new Set(['/technical', '/scouting']);
    const groups = visibleNavigationGroups(hidden);
    const visibleRoutes = groups.flatMap((group) => group.items.map((item) => item.to));

    expect(groups.map((group) => group.id)).toEqual(['race', 'team', 'world']);
    expect(visibleRoutes).not.toContain('/technical');
    expect(visibleRoutes).not.toContain('/scouting');
    expect(visibleRoutes).toContain('/relationships');
    expect(visibleRoutes.length).toBe(NAVIGATION_ITEMS.length - hidden.size);
  });
});
