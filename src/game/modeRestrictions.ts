import type { GameMode } from '../types/gameTypes';

// ---------------------------------------------------------------------------
// Mode restriction helpers — centralized so every screen, route guard, and
// action check goes through one place.
// ---------------------------------------------------------------------------

// Feature IDs that can be gated by game mode.
export type RestrictedFeature =
  | 'youth_academy'
  | 'scouting'
  | 'dev_curves'
  | 'offseason'
  | 'engine_supplier'
  | 'sponsors'
  | 'politics'
  | 'job_market'
  | 'future_contracts'
  | 'advance_season';

// Routes that are restricted in Single Season mode (long-term career systems
// and screens that assume multi-year planning or negotiation).
const SINGLE_SEASON_RESTRICTED_ROUTES = new Set([
  '/scouting',
  '/curves',
  '/politics',
  '/offseason',
  '/engine',
  '/sponsors',
]);

// Nav items hidden from the sidebar in Single Season mode.
export const SINGLE_SEASON_HIDDEN_NAV = new Set([
  '/scouting',
  '/curves',
  '/politics',
  '/offseason',
  '/engine',
  '/sponsors',
]);

// Nav items hidden from the sidebar in Career mode (none — full access).
export const CAREER_HIDDEN_NAV = new Set<string>();

// Sandbox mode has no restrictions — full access like Career.
export const SANDBOX_HIDDEN_NAV = new Set<string>();

// Feature restrictions by mode. Each mode maps feature IDs to whether they
// are allowed. This is the single source of truth for feature-level gating.
const FEATURE_RESTRICTIONS: Record<GameMode, Set<RestrictedFeature>> = {
  SingleSeason: new Set<RestrictedFeature>([
    'youth_academy',
    'scouting',
    'dev_curves',
    'offseason',
    'engine_supplier',
    'sponsors',
    'politics',
    'job_market',
    'future_contracts',
    'advance_season',
  ]),
  Career: new Set<RestrictedFeature>(),
  Sandbox: new Set<RestrictedFeature>(),
};

export function isSingleSeasonMode(mode: GameMode | undefined): boolean {
  return mode === 'SingleSeason';
}

export function isCareerMode(mode: GameMode | undefined): boolean {
  return mode === 'Career';
}

export function isSandboxMode(mode: GameMode | undefined): boolean {
  return mode === 'Sandbox';
}

// Centralized mode restrictions object.
export function getModeRestrictions(mode: GameMode | undefined) {
  return {
    restrictedFeatures: mode ? FEATURE_RESTRICTIONS[mode] : new Set<RestrictedFeature>(),
    hiddenNavRoutes: getHiddenNavRoutes(mode),
  };
}

// Check if a specific feature is allowed for a game mode.
export function isFeatureAllowedForMode(feature: RestrictedFeature, mode: GameMode | undefined): boolean {
  if (!mode) return true;
  return !FEATURE_RESTRICTIONS[mode].has(feature);
}

// Check if a route is allowed for a game mode.
export function isRouteAllowedForMode(route: string, mode: GameMode | undefined): boolean {
  return !isRouteRestricted(route, mode);
}

export function isRouteRestricted(route: string, mode: GameMode | undefined): boolean {
  if (!isSingleSeasonMode(mode)) return false;
  return SINGLE_SEASON_RESTRICTED_ROUTES.has(route);
}

export function getHiddenNavRoutes(mode: GameMode | undefined): Set<string> {
  if (isSingleSeasonMode(mode)) return SINGLE_SEASON_HIDDEN_NAV;
  if (isSandboxMode(mode)) return SANDBOX_HIDDEN_NAV;
  return CAREER_HIDDEN_NAV;
}

// Actions that should be blocked in Single Season mode.
const SINGLE_SEASON_BLOCKED_ACTIONS = new Set([
  'SIGN_ENGINE_DEAL',
  'SIGN_SPONSOR',
  'DROP_SPONSOR',
  'SIGN_YOUTH',
  'PROMOTE_ACADEMY',
  'RELEASE_ACADEMY',
  'SET_ACADEMY_DECISION',
  'CLEAR_ACADEMY_DECISION',
  'SIGN_FUTURE_CONTRACT',
  'EXTEND_DRIVER_CONTRACT',
  'ADVANCE_SEASON',
  'ACCEPT_JOB_OFFER',
  'DECLINE_JOB_OFFER',
  'SET_REGULATION_VOTE',
  'SCOUT_TARGET',
]);

export function isActionBlocked(actionType: string, mode: GameMode | undefined): boolean {
  if (!isSingleSeasonMode(mode)) return false;
  return SINGLE_SEASON_BLOCKED_ACTIONS.has(actionType);
}

// Per-route restriction explanations for Single Season mode. Each gives the
// player a clear, specific reason for the lock and what they should focus on
// instead.
const SINGLE_SEASON_ROUTE_REASONS: Record<string, { title: string; reason: string; focus: string }> = {
  '/scouting': {
    title: 'Scouting Locked',
    reason: 'Scouting and Youth Academy are long-term development systems that span multiple seasons. In Single Season Mode, driver lineups are set to historical data.',
    focus: 'Focus on race strategy, in-season development, and driver morale management.',
  },
  '/curves': {
    title: 'Development Curves Locked',
    reason: 'Driver development curves track multi-year progression. In Single Season Mode, drivers only develop within the single historical season.',
    focus: 'Use the Development screen for in-season car upgrades that affect this season.',
  },
  '/politics': {
    title: 'Regulation Voting Locked',
    reason: 'Regulation voting shapes next season\'s rules. Single Season Mode replays one historical year with fixed regulations.',
    focus: 'View the current season\'s regulations in the Pre-Season Setup or Team HQ.',
  },
  '/offseason': {
    title: 'Offseason Locked',
    reason: 'The offseason is a multi-year transition system (budget allocation, driver contracts, development carryover). Single Season Mode covers one year only.',
    focus: 'When the season ends, visit Season Review to see final results or replay.',
  },
  '/engine': {
    title: 'Engine Supplier Locked',
    reason: 'Engine supplier deals are locked to historical data in Single Season Mode. Each team uses the engine they historically ran that year.',
    focus: 'Engine performance is still reflected in your car stats and development.',
  },
  '/sponsors': {
    title: 'Sponsors Locked',
    reason: 'Sponsor deals are locked to historical data in Single Season Mode. Commercial income is pre-set for each team.',
    focus: 'Sponsor confidence still changes with your on-track performance.',
  },
};

// Human-readable explanation for why a route is restricted.
export function getRouteRestrictionReason(route: string, mode: GameMode | undefined): string | undefined {
  if (!isRouteRestricted(route, mode)) return undefined;
  const info = SINGLE_SEASON_ROUTE_REASONS[route];
  if (info) return `${info.reason} ${info.focus}`;
  return 'Single Season Mode is a historical replay of the selected year. Long-term systems like Youth Academy, future contracts, and next-year development are disabled.';
}

// Structured restriction info for a route (title, reason, focus suggestion).
export function getRouteRestrictionInfo(route: string, mode: GameMode | undefined): { title: string; reason: string; focus: string } | undefined {
  if (!isRouteRestricted(route, mode)) return undefined;
  return SINGLE_SEASON_ROUTE_REASONS[route] ?? {
    title: 'Screen Locked',
    reason: 'Single Season Mode is a historical replay of the selected year. Long-term systems are disabled.',
    focus: 'Focus on race strategy, in-season development, and driver management.',
  };
}

// List of features locked in Single Season mode with user-facing labels and
// descriptions. Used by the setup flow and HQ info panels.
export const SINGLE_SEASON_LOCKED_FEATURES: { label: string; description: string }[] = [
  { label: 'Youth Academy & Scouting', description: 'No scouting or academy prospects — driver lineups are historical.' },
  { label: 'Engine Supplier Choice', description: 'Engine deals are auto-assigned to match the historical season.' },
  { label: 'Sponsor Management', description: 'Sponsors are pre-set; commercial income is locked to history.' },
  { label: 'Regulation Voting', description: 'Regulations are fixed to the selected year — no political influence.' },
  { label: 'Offseason & Multi-Year', description: 'No offseason budget allocation, development carryover, or season advance.' },
  { label: 'Future Contracts', description: 'No signing drivers for next year — all contracts are single-season.' },
];

// Human-readable label for a game mode.
export function getGameModeLabel(mode: GameMode | undefined): string {
  switch (mode) {
    case 'Career': return 'Career Mode';
    case 'SingleSeason': return 'Single Season';
    case 'Sandbox': return 'Sandbox Mode';
    default: return 'Single Season';
  }
}

// Check whether a development project is allowed in the given game mode.
// In Single Season mode, projects with only next-season effects (no current-season
// effects) are not allowed. Mixed projects (both current and next) are allowed
// but only their current-season effects apply.
export function isDevelopmentProjectAllowedForMode(
  project: { currentSeasonEffects?: Record<string, number> },
  mode: GameMode | undefined,
): boolean {
  if (!isSingleSeasonMode(mode)) return true;
  const hasCurrentEffects = project.currentSeasonEffects && Object.keys(project.currentSeasonEffects).length > 0;
  return !!hasCurrentEffects;
}
