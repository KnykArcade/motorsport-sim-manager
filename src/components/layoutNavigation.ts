import {
  PRIMARY_SECTIONS,
  routeDefinitionForPath,
  routePath,
  type PrimarySectionId,
} from '../app/routeCatalog';
import type { GameState } from '../game/careerState';
import { workflowDestination } from './layoutWorkflow';

export type NavigationGroupId = 'management' | 'club' | 'world';

export type NavigationItem = {
  to: string;
  label: string;
  icon: string;
  iconRoute: string;
  group: NavigationGroupId;
  section: Exclude<PrimarySectionId, 'system'>;
  match?: 'section' | 'location';
  exact?: boolean;
};

export const NAVIGATION_GROUPS: ReadonlyArray<{ id: NavigationGroupId; label: string }> = [
  { id: 'management', label: 'Management' },
  { id: 'club', label: 'Team' },
  { id: 'world', label: 'World' },
];

/**
 * Eight permanent destinations mirror the game's eight player-facing areas.
 * The Race destination is resolved from live career priority by
 * navigationItemsForState so it never opens an unavailable phase screen.
 */
export const NAVIGATION_ITEMS: ReadonlyArray<NavigationItem> = PRIMARY_SECTIONS.map((section) => ({
  to: section.defaultTo,
  label: section.label,
  icon: '',
  iconRoute: section.iconRoute,
  group: section.group,
  section: section.id,
}));

export { routePath };

export function navigationItemsForState(state?: GameState): ReadonlyArray<NavigationItem> {
  if (!state) return NAVIGATION_ITEMS;
  const nextAction = workflowDestination(state);
  return NAVIGATION_ITEMS.map((item) =>
    item.section === 'race' ? { ...item, to: nextAction.to } : item);
}

export function navigationGroupForRoute(pathname: string): NavigationGroupId {
  const section = routeDefinitionForPath(pathname)?.section;
  return PRIMARY_SECTIONS.find((entry) => entry.id === section)?.group ?? 'management';
}

export function navigationItemsForGroup(
  group: NavigationGroupId,
  hiddenRoutes: Set<string>,
  state?: GameState,
) {
  return navigationItemsForState(state)
    .filter((item) => item.group === group)
    .filter((item) => !hiddenRoutes.has(routePath(item.to)));
}

export function visibleNavigationGroups(hiddenRoutes: Set<string>, state?: GameState) {
  return NAVIGATION_GROUPS.map((group) => ({
    ...group,
    items: navigationItemsForGroup(group.id, hiddenRoutes, state),
  })).filter((group) => group.items.length > 0);
}

export function isNavigationItemActive(
  item: NavigationItem,
  pathname: string,
  search: string,
): boolean {
  if (item.match === 'location') {
    const path = routePath(item.to);
    if (item.exact ? pathname !== path : pathname !== path && !pathname.startsWith(`${path}/`)) return false;
    const itemQuery = new URLSearchParams(item.to.split('?')[1] ?? '');
    const locationQuery = new URLSearchParams(search);
    return itemQuery.size === 0
      ? !item.exact || locationQuery.size === 0
      : [...itemQuery].every(([key, value]) => locationQuery.get(key) === value);
  }
  return routeDefinitionForPath(pathname)?.section === item.section;
}
