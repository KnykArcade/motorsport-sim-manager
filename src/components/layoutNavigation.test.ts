import { describe, expect, it } from 'vitest';
import {
  NAVIGATION_GROUPS,
  NAVIGATION_ITEMS,
  isNavigationItemActive,
  navigationGroupForRoute,
  navigationItemsForGroup,
  visibleNavigationGroups,
} from './layoutNavigation';

describe('FM-style primary navigation', () => {
  it('exposes exactly fifteen primary destinations across three compact groups', () => {
    expect(NAVIGATION_GROUPS.map((group) => group.id)).toEqual(['race', 'team', 'world']);
    expect(NAVIGATION_ITEMS).toHaveLength(15);
    expect(new Set(NAVIGATION_ITEMS.map((item) => item.to)).size).toBe(NAVIGATION_ITEMS.length);
    expect(NAVIGATION_ITEMS.map((item) => item.label)).toEqual([
      'Home',
      'Inbox',
      'Race Strategy',
      'Data Hub',
      'Calendar',
      'Team',
      'Drivers',
      'Departments',
      'Scouting',
      'Driver Market',
      'Finance',
      'Technical',
      'Championships',
      'Team Info',
      'Owner Vision',
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

  it('checks restrictions against pathnames for query-backed destinations', () => {
    const groups = visibleNavigationGroups(new Set(['/sponsors']));
    const visibleRoutes = groups.flatMap((group) => group.items.map((item) => item.to));
    expect(visibleRoutes).not.toContain('/sponsors?tab=owner');
  });

  it('distinguishes Team from query-backed Team Info active state', () => {
    const team = NAVIGATION_ITEMS.find((item) => item.label === 'Team');
    const teamInfo = NAVIGATION_ITEMS.find((item) => item.label === 'Team Info');
    expect(team).toBeDefined();
    expect(teamInfo).toBeDefined();

    expect(isNavigationItemActive(team!, '/teams', '')).toBe(true);
    expect(isNavigationItemActive(teamInfo!, '/teams', '')).toBe(false);
    expect(isNavigationItemActive(team!, '/teams', '?filter=player')).toBe(false);
    expect(isNavigationItemActive(teamInfo!, '/teams', '?filter=player')).toBe(true);
  });

  it('distinguishes Commercial from query-backed Owner Vision active state', () => {
    const commercial = { to: '/sponsors', label: 'Commercial', icon: '', group: 'team' as const };
    const ownerVision = NAVIGATION_ITEMS.find((item) => item.label === 'Owner Vision');
    expect(ownerVision).toBeDefined();

    expect(isNavigationItemActive(commercial, '/sponsors', '?tab=owner')).toBe(false);
    expect(isNavigationItemActive(ownerVision!, '/sponsors', '?tab=owner')).toBe(true);
  });
});
