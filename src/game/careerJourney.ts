import type { SeasonBundle } from '../data/seasonCatalog';
import type { GameMode, Series } from '../types/gameTypes';
import type { GameState } from './careerState';
import type { NewGameOptions } from './initialCareer';

export type SeasonEndingPlan = {
  kind: 'multi-season' | 'single-season';
  heading: string;
  description: string;
  nextRoute: '/offseason' | '/';
  nextLabel: string;
  nextSummary: string;
};

export type SeasonBundleValidation =
  | { valid: true; bundle: SeasonBundle }
  | { valid: false; reason: string };

export function supportsOffseason(mode: GameMode): boolean {
  return mode !== 'SingleSeason';
}

export function seasonEndingPlan(mode: GameMode): SeasonEndingPlan {
  if (supportsOffseason(mode)) {
    return {
      kind: 'multi-season',
      heading: mode === 'Sandbox' ? 'Continue the sandbox' : 'Continue the career',
      description: 'The offseason processes driver movement, technical carryover, commercial reviews, and the next championship.',
      nextRoute: '/offseason',
      nextLabel: 'Enter Offseason →',
      nextSummary: 'review the transition into next season.',
    };
  }
  return {
    kind: 'single-season',
    heading: 'Choose the completed season path',
    description: 'This historical season is complete. You can finish here or rebuild the same year for a clean replay.',
    nextRoute: '/',
    nextLabel: 'Main Menu',
    nextSummary: 'finish this save or replay the same historical season.',
  };
}

export function validateSeasonBundle(
  bundle: SeasonBundle | undefined,
  expectedYear: number,
  expectedSeries: Series,
): SeasonBundleValidation {
  if (!bundle) {
    return {
      valid: false,
      reason: `${expectedYear} ${expectedSeries} season data could not be loaded.`,
    };
  }
  if (bundle.season.year !== expectedYear || bundle.season.series !== expectedSeries) {
    return {
      valid: false,
      reason: `Loaded ${bundle.season.year} ${bundle.season.series} instead of ${expectedYear} ${expectedSeries}.`,
    };
  }
  if (bundle.season.calendar.length === 0) {
    return {
      valid: false,
      reason: `${expectedYear} ${expectedSeries} has no verified calendar.`,
    };
  }
  return { valid: true, bundle };
}

export function singleSeasonReplayOptions(
  state: GameState,
  bundle: SeasonBundle,
): NewGameOptions {
  if (state.gameMode !== 'SingleSeason') {
    throw new Error('Only a completed Single Season save can use historical replay.');
  }
  return {
    gameMode: 'SingleSeason',
    seasonYear: state.seasonYear,
    series: state.series,
    teamId: state.selectedTeamId,
    teamPrincipal: state.teamPrincipal,
    principalName: state.principal?.name,
    seed: state.randomSeed,
    bundle,
  };
}

export function offseasonResumeDestination(state: GameState): string | undefined {
  if (!state.seasonComplete || !supportsOffseason(state.gameMode)) return undefined;
  if (state.lastWorkspace?.split('?')[0] !== '/offseason') return undefined;
  return state.lastWorkspace;
}
