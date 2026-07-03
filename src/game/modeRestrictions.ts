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
  'SIGN_FUTURE_CONTRACT',
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

// Human-readable explanation for why a route is restricted.
export function getRouteRestrictionReason(route: string, mode: GameMode | undefined): string | undefined {
  if (!isRouteRestricted(route, mode)) return undefined;
  return 'Single Season Mode is a historical replay of the selected year. Long-term systems like Youth Academy, future contracts, and next-year development are disabled.';
}
