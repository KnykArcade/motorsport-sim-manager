import type { GameMode } from '../types/gameTypes';

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

export function isSingleSeasonMode(mode: GameMode | undefined): boolean {
  return mode === 'SingleSeason';
}

export function isCareerMode(mode: GameMode | undefined): boolean {
  return mode === 'Career';
}

export function isRouteRestricted(route: string, mode: GameMode | undefined): boolean {
  if (!isSingleSeasonMode(mode)) return false;
  return SINGLE_SEASON_RESTRICTED_ROUTES.has(route);
}

export function getHiddenNavRoutes(mode: GameMode | undefined): Set<string> {
  if (isSingleSeasonMode(mode)) return SINGLE_SEASON_HIDDEN_NAV;
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
