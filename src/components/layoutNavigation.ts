export type NavigationGroupId = 'race' | 'team' | 'world';

export type NavigationItem = {
  to: string;
  label: string;
  icon: string;
  group: NavigationGroupId;
};

export const NAVIGATION_GROUPS: ReadonlyArray<{ id: NavigationGroupId; label: string }> = [
  { id: 'race', label: 'Management' },
  { id: 'team', label: 'Team' },
  { id: 'world', label: 'World' },
];

/**
 * FM-style primary navigation. Secondary destinations remain available through
 * the contextual navigation bar so no route or game system is removed.
 */
export const NAVIGATION_ITEMS: ReadonlyArray<NavigationItem> = [
  { to: '/hq', label: 'Home', icon: 'HQ', group: 'race' },
  { to: '/inbox', label: 'Inbox', icon: 'IB', group: 'race' },
  { to: '/weekend', label: 'Race Strategy', icon: 'RS', group: 'race' },
  { to: '/performance', label: 'Data Hub', icon: 'DH', group: 'race' },
  { to: '/calendar', label: 'Calendar', icon: 'CA', group: 'race' },

  { to: '/teams', label: 'Team', icon: 'TM', group: 'team' },
  { to: '/drivers', label: 'Drivers', icon: 'DR', group: 'team' },
  { to: '/staff', label: 'Departments', icon: 'DP', group: 'team' },
  { to: '/scouting', label: 'Scouting', icon: 'SC', group: 'team' },
  { to: '/market', label: 'Driver Market', icon: 'MK', group: 'team' },
  { to: '/finance', label: 'Finance', icon: '$', group: 'team' },
  { to: '/technical', label: 'Technical', icon: 'RD', group: 'team' },

  { to: '/standings', label: 'Championships', icon: 'CH', group: 'world' },
  { to: '/teams?filter=player', label: 'Team Info', icon: 'TI', group: 'world' },
  { to: '/sponsors?tab=owner', label: 'Owner Vision', icon: 'OV', group: 'world' },
];

export function routePath(to: string): string {
  return to.split('?')[0];
}

export function navigationGroupForRoute(pathname: string): NavigationGroupId {
  const direct = NAVIGATION_ITEMS.find((item) => {
    const path = routePath(item.to);
    return pathname === path || pathname.startsWith(`${path}/`);
  });
  return direct?.group ?? 'race';
}

export function navigationItemsForGroup(group: NavigationGroupId, hiddenRoutes: Set<string>) {
  return NAVIGATION_ITEMS.filter((item) => item.group === group && !hiddenRoutes.has(routePath(item.to)));
}

export function visibleNavigationGroups(hiddenRoutes: Set<string>) {
  return NAVIGATION_GROUPS.map((group) => ({
    ...group,
    items: navigationItemsForGroup(group.id, hiddenRoutes),
  })).filter((group) => group.items.length > 0);
}

export function isNavigationItemActive(
  item: NavigationItem,
  pathname: string,
  search: string,
): boolean {
  const path = routePath(item.to);
  if (pathname !== path && !pathname.startsWith(`${path}/`)) return false;

  const itemQuery = new URLSearchParams(item.to.split('?')[1] ?? '');
  const locationQuery = new URLSearchParams(search);
  if (itemQuery.size > 0) {
    return [...itemQuery].every(([key, value]) => locationQuery.get(key) === value);
  }

  // The general Team destination should not also appear active when the
  // dedicated Team Info or Owner Vision query is selected.
  if (path === '/teams' && locationQuery.get('filter') === 'player') return false;
  if (path === '/sponsors' && locationQuery.get('tab') === 'owner') return false;
  return true;
}
