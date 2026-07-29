import {
  PRIMARY_SECTIONS,
  contextualRoutesForSection,
  routeDefinitionForPath,
  routePath,
  type PrimarySectionId,
  type RouteDefinition,
} from '../app/routeCatalog';
import type { GameState } from '../game/careerState';
import type { NavigationGroupId, NavigationItem } from './layoutNavigation';

export type PageIdentity = {
  section: string;
  title: string;
};

function navigationGroup(section: PrimarySectionId): NavigationGroupId {
  return PRIMARY_SECTIONS.find((entry) => entry.id === section)?.group ?? 'management';
}

function itemFromDefinition(definition: RouteDefinition): NavigationItem {
  return {
    to: definition.path,
    label: definition.contextLabel ?? definition.title,
    icon: '',
    iconRoute: definition.path,
    group: navigationGroup(definition.section),
    section: definition.section === 'system' ? 'home' : definition.section,
    match: 'location',
    exact: true,
  };
}

function locationTitle(pathname: string, search: string, definition?: RouteDefinition): string {
  if (pathname === '/teams' && new URLSearchParams(search).get('filter') === 'player') return 'Team Info';
  if (pathname === '/sponsors' && new URLSearchParams(search).get('tab') === 'owner') return 'Owner Vision';
  return definition?.title ?? 'Motorsport Manager';
}

export function pageIdentityForRoute(pathname: string, search = ''): PageIdentity {
  const definition = routeDefinitionForPath(pathname);
  return {
    section: definition?.sectionLabel ?? 'Management',
    title: locationTitle(pathname, search, definition),
  };
}

export function contextualNavigationForRoute(
  pathname: string,
  hiddenRoutes: Set<string>,
  state?: GameState,
  search = '',
): ReadonlyArray<NavigationItem> {
  const definition = routeDefinitionForPath(pathname);
  if (!definition || definition.section === 'system') return [];

  const items = contextualRoutesForSection(definition.section, state)
    .filter((entry) => !entry.path.includes(':'))
    .filter((entry) => !hiddenRoutes.has(routePath(entry.path)))
    .map(itemFromDefinition);

  const currentTo = `${pathname}${search}`;
  const exactCurrentAlreadyPresent = items.some((entry) => entry.to === currentTo);
  if (!exactCurrentAlreadyPresent) {
    const samePathIndex = items.findIndex((entry) => routePath(entry.to) === pathname);
    if (samePathIndex >= 0) items.splice(samePathIndex, 1);
    items.unshift({
      to: currentTo,
      label: locationTitle(pathname, search, definition),
      icon: '',
      iconRoute: pathname,
      group: navigationGroup(definition.section),
      section: definition.section,
      match: 'location',
      exact: true,
    });
  }

  return items;
}
