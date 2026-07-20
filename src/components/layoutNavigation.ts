export type NavigationGroupId = 'race' | 'team' | 'world';

export type NavigationItem = {
  to: string;
  label: string;
  icon: string;
  group: NavigationGroupId;
};

export const NAVIGATION_GROUPS: ReadonlyArray<{ id: NavigationGroupId; label: string }> = [
  { id: 'race', label: 'Race' },
  { id: 'team', label: 'Team' },
  { id: 'world', label: 'World' },
];

export const NAVIGATION_ITEMS: ReadonlyArray<NavigationItem> = [
  { to: '/hq', label: 'Manager Office', icon: 'HQ', group: 'race' },
  { to: '/inbox', label: 'Inbox', icon: 'IB', group: 'race' },
  { to: '/calendar', label: 'Calendar', icon: 'CA', group: 'race' },
  { to: '/standings', label: 'Standings', icon: 'ST', group: 'race' },
  { to: '/news', label: 'News Center', icon: 'NW', group: 'race' },
  { to: '/history', label: 'Race History', icon: 'RH', group: 'race' },
  { to: '/records', label: 'Universe History', icon: 'UH', group: 'race' },

  { to: '/teams', label: 'Team Overview', icon: 'TM', group: 'team' },
  { to: '/drivers', label: 'Drivers', icon: 'DR', group: 'team' },
  { to: '/market', label: 'Driver Market', icon: 'MK', group: 'team' },
  { to: '/scouting', label: 'Intelligence', icon: 'IN', group: 'team' },
  { to: '/technical', label: 'Technical', icon: 'RD', group: 'team' },
  { to: '/finance', label: 'Finance', icon: '$', group: 'team' },
  { to: '/sponsors', label: 'Sponsors', icon: 'SP', group: 'team' },
  { to: '/staff', label: 'Staff', icon: 'SF', group: 'team' },

  { to: '/principal', label: 'Principal', icon: 'TP', group: 'world' },
  { to: '/relationships', label: 'Driver Relations', icon: 'DR', group: 'world' },
  { to: '/rivals', label: 'Team Rivalries', icon: 'RV', group: 'world' },
  { to: '/stories', label: 'Paddock Stories', icon: 'PS', group: 'world' },
  { to: '/politics', label: 'Regulations', icon: 'RG', group: 'world' },
  { to: '/curves', label: 'Dev Curves', icon: 'DC', group: 'world' },
  { to: '/data', label: 'Data Viewer', icon: 'DT', group: 'world' },
  { to: '/settings', label: 'Settings', icon: 'SE', group: 'world' },
];

export function navigationGroupForRoute(pathname: string): NavigationGroupId {
  return NAVIGATION_ITEMS.find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))?.group ?? 'race';
}

export function navigationItemsForGroup(group: NavigationGroupId, hiddenRoutes: Set<string>) {
  return NAVIGATION_ITEMS.filter((item) => item.group === group && !hiddenRoutes.has(item.to));
}

export function visibleNavigationGroups(hiddenRoutes: Set<string>) {
  return NAVIGATION_GROUPS.map((group) => ({
    ...group,
    items: navigationItemsForGroup(group.id, hiddenRoutes),
  })).filter((group) => group.items.length > 0);
}
