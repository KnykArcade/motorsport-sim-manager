import type { NavigationItem } from './layoutNavigation';
import { routePath } from './layoutNavigation';

export type PageIdentity = {
  section: string;
  title: string;
};

type ContextGroup = {
  routes: ReadonlyArray<string>;
  items: ReadonlyArray<NavigationItem>;
};

const item = (to: string, label: string): NavigationItem => ({
  to,
  label,
  icon: '',
  group: 'race',
});

const CONTEXT_GROUPS: ReadonlyArray<ContextGroup> = [
  {
    routes: ['/hq', '/career-launch', '/inbox', '/news', '/stories', '/paddock'],
    items: [
      item('/news', 'News'),
      item('/stories', 'Paddock Stories'),
      item('/paddock', 'Weekly Agenda'),
    ],
  },
  {
    routes: ['/teams', '/planner', '/drivers', '/principal', '/relationships', '/rivals'],
    items: [
      item('/teams?filter=player', 'My Team'),
      item('/planner', 'Team Planner'),
      item('/principal', 'Principal'),
      item('/relationships', 'Driver Relations'),
      item('/rivals', 'Rivalries'),
    ],
  },
  {
    routes: ['/preseason', '/briefing', '/weekend', '/live-race', '/results', '/post-race', '/season-review', '/offseason'],
    items: [
      item('/briefing', 'Briefing'),
      item('/calendar', 'Calendar'),
      item('/performance', 'Performance'),
      item('/history', 'Race History'),
    ],
  },
  {
    routes: ['/market', '/scouting', '/curves'],
    items: [
      item('/scouting', 'Scouting'),
      item('/curves', 'Development'),
    ],
  },
  {
    routes: ['/staff', '/technical', '/finance', '/sponsors', '/politics'],
    items: [
      item('/sponsors', 'Commercial'),
      item('/sponsors?tab=owner', 'Owner Vision'),
      item('/politics', 'Regulations'),
    ],
  },
  {
    routes: ['/calendar', '/standings', '/history', '/records', '/data', '/performance'],
    items: [
      item('/calendar', 'Calendar'),
      item('/history', 'Race History'),
      item('/records', 'Records'),
      item('/performance', 'Data Hub'),
      item('/data', 'Data Viewer'),
    ],
  },
];

const PAGE_IDENTITIES: ReadonlyArray<{ route: string; identity: PageIdentity }> = [
  { route: '/hq', identity: { section: 'Management', title: 'Home' } },
  { route: '/career-launch', identity: { section: 'Management', title: 'First Day' } },
  { route: '/inbox', identity: { section: 'Management', title: 'Inbox' } },
  { route: '/news', identity: { section: 'Management', title: 'News Center' } },
  { route: '/stories', identity: { section: 'Management', title: 'Paddock Stories' } },
  { route: '/paddock', identity: { section: 'Race Week', title: 'Weekly Agenda' } },
  { route: '/preseason', identity: { section: 'Race Strategy', title: 'Preseason Review' } },
  { route: '/briefing', identity: { section: 'Race Strategy', title: 'Race Briefing' } },
  { route: '/weekend', identity: { section: 'Race Strategy', title: 'Race Weekend' } },
  { route: '/live-race', identity: { section: 'Race Strategy', title: 'Live Race' } },
  { route: '/results', identity: { section: 'Race Strategy', title: 'Race Results' } },
  { route: '/post-race', identity: { section: 'Race Strategy', title: 'Post-Race Review' } },
  { route: '/season-review', identity: { section: 'Race Strategy', title: 'Season Review' } },
  { route: '/offseason', identity: { section: 'Race Strategy', title: 'Offseason' } },
  { route: '/teams', identity: { section: 'Team', title: 'Team' } },
  { route: '/planner', identity: { section: 'Team', title: 'Team Planner' } },
  { route: '/drivers', identity: { section: 'Team', title: 'Drivers' } },
  { route: '/principal', identity: { section: 'Team', title: 'Team Principal' } },
  { route: '/relationships', identity: { section: 'Team', title: 'Driver Relations' } },
  { route: '/rivals', identity: { section: 'Team', title: 'Rivalries' } },
  { route: '/market', identity: { section: 'Recruitment', title: 'Driver Market' } },
  { route: '/scouting', identity: { section: 'Recruitment', title: 'Scouting' } },
  { route: '/curves', identity: { section: 'Recruitment', title: 'Driver Development' } },
  { route: '/staff', identity: { section: 'Departments', title: 'Team Departments' } },
  { route: '/technical', identity: { section: 'Departments', title: 'Technical' } },
  { route: '/finance', identity: { section: 'Departments', title: 'Finance' } },
  { route: '/sponsors', identity: { section: 'Departments', title: 'Commercial' } },
  { route: '/politics', identity: { section: 'Departments', title: 'Regulations' } },
  { route: '/calendar', identity: { section: 'Competition', title: 'Calendar' } },
  { route: '/standings', identity: { section: 'Competition', title: 'Championships' } },
  { route: '/history', identity: { section: 'Competition', title: 'Race History' } },
  { route: '/records', identity: { section: 'Competition', title: 'Records' } },
  { route: '/performance', identity: { section: 'Competition', title: 'Data Hub' } },
  { route: '/data', identity: { section: 'Competition', title: 'Data Viewer' } },
  { route: '/settings', identity: { section: 'System', title: 'Settings' } },
];

function routeMatches(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function pageIdentityForRoute(pathname: string, search = ''): PageIdentity {
  if (pathname === '/teams' && new URLSearchParams(search).get('filter') === 'player') {
    return { section: 'Team', title: 'Team Info' };
  }
  if (pathname === '/sponsors' && new URLSearchParams(search).get('tab') === 'owner') {
    return { section: 'Team', title: 'Owner Vision' };
  }
  return PAGE_IDENTITIES.find((entry) => routeMatches(pathname, entry.route))?.identity
    ?? { section: 'Management', title: 'Motorsport Manager' };
}

export function contextualNavigationForRoute(
  pathname: string,
  hiddenRoutes: Set<string>,
): ReadonlyArray<NavigationItem> {
  const group = CONTEXT_GROUPS.find((candidate) =>
    candidate.routes.some((route) => routeMatches(pathname, route)));
  return (group?.items ?? CONTEXT_GROUPS[0].items)
    .filter((entry) => !hiddenRoutes.has(routePath(entry.to)));
}
