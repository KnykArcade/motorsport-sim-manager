import type { GameState } from '../game/careerState';
import { getCareerPhase, needsCareerLaunch } from '../game/careerPhaseEngine';
import type { CareerPhase } from '../types/careerPhaseTypes';
import type { GameMode } from '../types/gameTypes';

export type PrimarySectionId =
  | 'home'
  | 'inbox'
  | 'race'
  | 'team'
  | 'recruitment'
  | 'technical'
  | 'finance'
  | 'world'
  | 'system';

export type RouteAvailability =
  | 'public'
  | 'always'
  | 'career_launch'
  | CareerPhase
  | 'completed_race'
  | 'season_complete';

export type RouteFallback = 'next_action' | string;

export type RouteDefinition = {
  path: string;
  section: PrimarySectionId;
  sectionLabel: string;
  title: string;
  contextLabel?: string;
  contextOrder?: number;
  availability: RouteAvailability;
  restrictedModes?: ReadonlyArray<GameMode>;
  restriction?: {
    title: string;
    reason: string;
    focus: string;
  };
  fallback: RouteFallback;
  resumable?: boolean;
  legacyRedirect?: string;
};

const singleSeasonRestriction = (
  title: string,
  reason: string,
  focus: string,
): Pick<RouteDefinition, 'restrictedModes' | 'restriction'> => ({
  restrictedModes: ['SingleSeason'],
  restriction: { title, reason, focus },
});

export const ROUTE_CATALOG: ReadonlyArray<RouteDefinition> = [
  { path: '/', section: 'system', sectionLabel: 'System', title: 'Main Menu', availability: 'public', fallback: '/', resumable: false },
  { path: '/new', section: 'system', sectionLabel: 'System', title: 'New Game', availability: 'public', fallback: '/', resumable: false },
  { path: '/data', section: 'system', sectionLabel: 'System', title: 'Data Viewer', availability: 'public', fallback: '/', resumable: false },
  { path: '/settings', section: 'system', sectionLabel: 'System', title: 'Settings', availability: 'public', fallback: '/', resumable: false },

  { path: '/hq', section: 'home', sectionLabel: 'Management', title: 'Home', contextLabel: 'Home', contextOrder: 0, availability: 'always', fallback: 'next_action', resumable: true },
  { path: '/career-launch', section: 'home', sectionLabel: 'Management', title: 'First Day', contextLabel: 'First Day', contextOrder: 0, availability: 'career_launch', fallback: 'next_action', resumable: true },
  { path: '/news', section: 'home', sectionLabel: 'Management', title: 'News Center', contextLabel: 'News', contextOrder: 1, availability: 'always', fallback: 'next_action', resumable: true },
  { path: '/stories', section: 'home', sectionLabel: 'Management', title: 'Paddock Stories', contextLabel: 'Paddock Stories', contextOrder: 2, availability: 'always', fallback: 'next_action', resumable: true },

  { path: '/inbox', section: 'inbox', sectionLabel: 'Management', title: 'Inbox', contextLabel: 'Inbox', contextOrder: 0, availability: 'always', fallback: 'next_action', resumable: true },

  { path: '/preseason', section: 'race', sectionLabel: 'Race', title: 'Preseason Review', contextLabel: 'Preseason', contextOrder: 0, availability: 'pre_season_setup', fallback: 'next_action', resumable: true },
  { path: '/paddock', section: 'race', sectionLabel: 'Race', title: 'Weekly Agenda', contextLabel: 'Paddock Week', contextOrder: 0, availability: 'paddock_week', fallback: 'next_action', resumable: true },
  { path: '/briefing', section: 'race', sectionLabel: 'Race', title: 'Race Briefing', contextLabel: 'Briefing', contextOrder: 0, availability: 'pre_race_briefing', fallback: 'next_action', resumable: true },
  { path: '/weekend', section: 'race', sectionLabel: 'Race', title: 'Race Weekend', contextLabel: 'Race Weekend', contextOrder: 0, availability: 'race_weekend', fallback: 'next_action', resumable: true },
  { path: '/live-race/:raceId', section: 'race', sectionLabel: 'Race', title: 'Live Race', contextLabel: 'Live Race', contextOrder: 0, availability: 'race_weekend', fallback: '/weekend', resumable: false },
  { path: '/results/:raceId', section: 'race', sectionLabel: 'Race', title: 'Race Results', contextLabel: 'Results', contextOrder: 0, availability: 'completed_race', fallback: 'next_action', resumable: false },
  { path: '/post-race/:raceId', section: 'race', sectionLabel: 'Race', title: 'Post-Race Review', contextLabel: 'Post-Race Review', contextOrder: 0, availability: 'completed_race', fallback: 'next_action', resumable: true },
  { path: '/season-review', section: 'race', sectionLabel: 'Race', title: 'Season Review', contextLabel: 'Season Review', contextOrder: 0, availability: 'season_complete', fallback: 'next_action', resumable: true },
  {
    path: '/offseason',
    section: 'race',
    sectionLabel: 'Race',
    title: 'Offseason',
    contextLabel: 'Offseason',
    contextOrder: 0,
    availability: 'season_complete',
    fallback: 'next_action',
    resumable: true,
    ...singleSeasonRestriction(
      'Offseason Locked',
      'The offseason is a multi-year transition system. Single Season Mode covers one historical year only.',
      'Open Season Review to inspect the completed campaign.',
    ),
  },
  { path: '/calendar', section: 'race', sectionLabel: 'Race', title: 'Calendar', contextLabel: 'Calendar', contextOrder: 10, availability: 'always', fallback: 'next_action', resumable: true },
  { path: '/performance', section: 'race', sectionLabel: 'Race', title: 'Performance Data', contextLabel: 'Performance', contextOrder: 20, availability: 'always', fallback: 'next_action', resumable: true },
  { path: '/history', section: 'race', sectionLabel: 'Race', title: 'Race History', contextLabel: 'Race History', contextOrder: 30, availability: 'always', fallback: 'next_action', resumable: true },

  { path: '/teams', section: 'team', sectionLabel: 'Team', title: 'Team', contextLabel: 'Team Info', contextOrder: 0, availability: 'always', fallback: 'next_action', resumable: true },
  { path: '/drivers', section: 'team', sectionLabel: 'Team', title: 'Drivers', contextLabel: 'Drivers', contextOrder: 10, availability: 'always', fallback: 'next_action', resumable: true },
  { path: '/drivers/:driverId/negotiate', section: 'team', sectionLabel: 'Team', title: 'Driver Negotiation', availability: 'always', fallback: '/drivers', resumable: false },
  { path: '/staff', section: 'team', sectionLabel: 'Team', title: 'Staff', contextLabel: 'Staff', contextOrder: 20, availability: 'always', fallback: 'next_action', resumable: true },
  { path: '/staff/:staffId/negotiate', section: 'team', sectionLabel: 'Team', title: 'Staff Negotiation', availability: 'always', fallback: '/staff', resumable: false },
  {
    path: '/planner',
    section: 'team',
    sectionLabel: 'Team',
    title: 'Team Planner',
    contextLabel: 'Team Planner',
    contextOrder: 30,
    availability: 'always',
    fallback: 'next_action',
    resumable: true,
    ...singleSeasonRestriction(
      'Team Planner Locked',
      'The Team Planner compares commitments across future seasons. Single Season Mode covers one historical year.',
      'Use Team, Drivers, Staff, Finance, and Technical for the current season.',
    ),
  },
  { path: '/principal', section: 'team', sectionLabel: 'Team', title: 'Team Principal', contextLabel: 'Principal', contextOrder: 40, availability: 'always', fallback: 'next_action', resumable: true },
  { path: '/relationships', section: 'team', sectionLabel: 'Team', title: 'Driver Relations', contextLabel: 'Relationships', contextOrder: 50, availability: 'always', fallback: 'next_action', resumable: true },
  { path: '/rivals', section: 'team', sectionLabel: 'Team', title: 'Rivalries', contextLabel: 'Rivalries', contextOrder: 60, availability: 'always', fallback: 'next_action', resumable: true },

  { path: '/market', section: 'recruitment', sectionLabel: 'Recruitment', title: 'Driver Market', contextLabel: 'Driver Market', contextOrder: 0, availability: 'always', fallback: 'next_action', resumable: true },
  { path: '/market/:marketId/negotiate/:seatDriverId', section: 'recruitment', sectionLabel: 'Recruitment', title: 'Contract Negotiation', availability: 'always', fallback: '/market', resumable: false },
  {
    path: '/scouting',
    section: 'recruitment',
    sectionLabel: 'Recruitment',
    title: 'Scouting',
    contextLabel: 'Scouting',
    contextOrder: 10,
    availability: 'always',
    fallback: 'next_action',
    resumable: true,
    ...singleSeasonRestriction(
      'Scouting Locked',
      'Scouting and the Youth Academy are multi-season systems. Single Season Mode uses historical lineups.',
      'Use the Driver Market to review the current field and race-seat options.',
    ),
  },
  {
    path: '/curves',
    section: 'recruitment',
    sectionLabel: 'Recruitment',
    title: 'Driver Development',
    contextLabel: 'Development',
    contextOrder: 20,
    availability: 'always',
    fallback: 'next_action',
    resumable: true,
    ...singleSeasonRestriction(
      'Development Curves Locked',
      'Development curves track multi-year driver progression. Single Season Mode covers one historical campaign.',
      'Use Drivers to manage the active lineup and current-season performance.',
    ),
  },

  { path: '/technical', section: 'technical', sectionLabel: 'Technical', title: 'Technical Center', contextLabel: 'Car & R&D', contextOrder: 0, availability: 'always', fallback: 'next_action', resumable: true },
  {
    path: '/politics',
    section: 'technical',
    sectionLabel: 'Technical',
    title: 'Regulations',
    contextLabel: 'Regulations',
    contextOrder: 10,
    availability: 'always',
    fallback: 'next_action',
    resumable: true,
    ...singleSeasonRestriction(
      'Regulation Voting Locked',
      'Regulation voting changes future seasons. Single Season Mode uses fixed historical regulations.',
      'Review the current technical rules and focus on this season’s car.',
    ),
  },

  { path: '/finance', section: 'finance', sectionLabel: 'Finance', title: 'Finance', contextLabel: 'Finance', contextOrder: 0, availability: 'always', fallback: 'next_action', resumable: true },
  { path: '/sponsors', section: 'finance', sectionLabel: 'Finance', title: 'Commercial', contextLabel: 'Commercial', contextOrder: 10, availability: 'always', fallback: 'next_action', resumable: true },

  { path: '/standings', section: 'world', sectionLabel: 'World', title: 'Championships', contextLabel: 'Championships', contextOrder: 0, availability: 'always', fallback: 'next_action', resumable: true },
  { path: '/records', section: 'world', sectionLabel: 'World', title: 'Records', contextLabel: 'Records', contextOrder: 10, availability: 'always', fallback: 'next_action', resumable: true },

  { path: '/development', section: 'technical', sectionLabel: 'Technical', title: 'Technical Center', availability: 'public', fallback: '/technical', resumable: false, legacyRedirect: '/technical' },
  { path: '/facilities', section: 'technical', sectionLabel: 'Technical', title: 'Technical Center', availability: 'public', fallback: '/technical', resumable: false, legacyRedirect: '/technical' },
  {
    path: '/engine',
    section: 'technical',
    sectionLabel: 'Technical',
    title: 'Technical Center',
    availability: 'public',
    fallback: '/technical',
    resumable: false,
    legacyRedirect: '/technical',
    ...singleSeasonRestriction(
      'Engine Supplier Locked',
      'Engine supplier deals are fixed to historical data in Single Season Mode.',
      'Review current engine performance and car development in Technical.',
    ),
  },
];

export const PRIMARY_SECTIONS: ReadonlyArray<{
  id: Exclude<PrimarySectionId, 'system'>;
  label: string;
  iconRoute: string;
  defaultTo: string;
  group: 'management' | 'club' | 'world';
}> = [
  { id: 'home', label: 'Home', iconRoute: '/hq', defaultTo: '/hq', group: 'management' },
  { id: 'inbox', label: 'Inbox', iconRoute: '/inbox', defaultTo: '/inbox', group: 'management' },
  { id: 'race', label: 'Race', iconRoute: '/weekend', defaultTo: '/weekend', group: 'management' },
  { id: 'team', label: 'Team', iconRoute: '/teams', defaultTo: '/teams?filter=player', group: 'club' },
  { id: 'recruitment', label: 'Recruitment', iconRoute: '/market', defaultTo: '/market', group: 'club' },
  { id: 'technical', label: 'Technical', iconRoute: '/technical', defaultTo: '/technical', group: 'club' },
  { id: 'finance', label: 'Finance', iconRoute: '/finance', defaultTo: '/finance', group: 'club' },
  { id: 'world', label: 'World', iconRoute: '/standings', defaultTo: '/standings', group: 'world' },
];

function pathSegments(path: string): string[] {
  return path.split('?')[0].split('/').filter(Boolean);
}

export function routePath(to: string): string {
  return to.split('?')[0];
}

export function routeDefinitionForPath(pathname: string): RouteDefinition | undefined {
  const candidateSegments = pathSegments(pathname);
  return ROUTE_CATALOG.find((definition) => {
    const definitionSegments = pathSegments(definition.path);
    if (definitionSegments.length !== candidateSegments.length) return false;
    return definitionSegments.every(
      (segment, index) => segment.startsWith(':') || segment === candidateSegments[index],
    );
  });
}

export function routeParameter(pathname: string, definition: RouteDefinition, name: string): string | undefined {
  const candidateSegments = pathSegments(pathname);
  const definitionSegments = pathSegments(definition.path);
  const index = definitionSegments.indexOf(`:${name}`);
  return index >= 0 ? candidateSegments[index] : undefined;
}

export function routeAccessForState(
  pathname: string,
  state: GameState,
): { available: boolean; reason?: string; definition?: RouteDefinition } {
  const definition = routeDefinitionForPath(pathname);
  if (!definition) {
    return {
      available: false,
      reason: 'This address does not match a current career workspace.',
    };
  }
  if (definition.availability === 'public') return { available: true, definition };

  if (definition.restrictedModes?.includes(state.gameMode)) {
    return {
      available: false,
      reason: definition.restriction
        ? `${definition.restriction.reason} ${definition.restriction.focus}`
        : `${definition.title} is unavailable in this game mode.`,
      definition,
    };
  }

  const launchRequired = needsCareerLaunch(state);
  if (definition.availability === 'career_launch') {
    return {
      available: launchRequired,
      reason: launchRequired ? undefined : 'The first-day introduction has already been completed.',
      definition,
    };
  }
  if (launchRequired) {
    return {
      available: false,
      reason: 'Complete your first-day appointment before opening the rest of the career.',
      definition,
    };
  }

  if (definition.availability === 'always') return { available: true, definition };
  if (definition.availability === 'season_complete') {
    return {
      available: state.seasonComplete,
      reason: state.seasonComplete ? undefined : `${definition.title} becomes available when the season is complete.`,
      definition,
    };
  }
  if (definition.availability === 'completed_race') {
    const raceId = routeParameter(pathname, definition, 'raceId');
    const available = Boolean(raceId && state.completedRaceResults?.[raceId]);
    return {
      available,
      reason: available ? undefined : 'That race does not have a completed report in this career.',
      definition,
    };
  }

  const phase = getCareerPhase(state);
  return {
    available: phase === definition.availability,
    reason: phase === definition.availability
      ? undefined
      : `${definition.title} is not the active career step.`,
    definition,
  };
}

export function routeIsAvailable(pathname: string, state?: GameState): boolean {
  if (!state) return true;
  return routeAccessForState(pathname, state).available;
}

export function contextualRoutesForSection(
  section: PrimarySectionId,
  state?: GameState,
): ReadonlyArray<RouteDefinition> {
  return ROUTE_CATALOG
    .filter((definition) => definition.section === section && definition.contextLabel)
    .filter((definition) => !definition.restrictedModes?.includes(state?.gameMode as GameMode))
    .filter((definition) => routeIsAvailable(definition.path, state))
    .sort((a, b) => (a.contextOrder ?? 999) - (b.contextOrder ?? 999));
}

export function phaseWorkspaceForState(state: GameState): string {
  if (needsCareerLaunch(state)) return '/career-launch';
  if (state.seasonComplete) return '/season-review';
  switch (getCareerPhase(state)) {
    case 'pre_season_setup':
      return '/preseason';
    case 'paddock_week':
      return '/paddock';
    case 'pre_race_briefing':
      return '/briefing?tab=preparation';
    case 'race_weekend':
      return '/weekend?stage=overview';
    case 'post_race_review': {
      const raceId = state.careerPhase?.lastCompletedRaceId;
      return raceId ? `/post-race/${raceId}` : '/hq';
    }
  }
}
