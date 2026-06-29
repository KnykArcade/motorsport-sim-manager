// Build a fresh GameState from a season bundle and the player's chosen team.

import { getSeasonBundle } from '../data';
import { BALANCED_SETUP } from '../data/setup/setupComponents';
import type { GameMode, Series } from '../types/gameTypes';
import type { CarSetup } from '../types/setupTypes';
import type { GameState } from './careerState';

// Deep clone via structuredClone (available in modern browsers / Node 18+).
function clone<T>(value: T): T {
  return structuredClone(value);
}

export type NewGameOptions = {
  gameMode: GameMode;
  seasonYear: number;
  series: Series;
  teamId: string;
  seed?: string;
};

export function createNewGame(options: NewGameOptions): GameState {
  const bundle = getSeasonBundle(options.seasonYear, options.series);
  if (!bundle) {
    throw new Error(`No season data for ${options.seasonYear} ${options.series}`);
  }

  const now = new Date().toISOString();
  const seed = options.seed ?? `${options.teamId}-${Date.now()}`;

  // Start each of the player team's drivers with a balanced base setup.
  const carSetups: Record<string, CarSetup> = {};
  for (const driver of bundle.drivers) {
    if (driver.teamId === options.teamId) carSetups[driver.id] = { ...BALANCED_SETUP };
  }

  return {
    id: `save-${Date.now()}`,
    createdAt: now,
    updatedAt: now,
    gameMode: options.gameMode,
    series: options.series,
    seasonYear: options.seasonYear,
    selectedTeamId: options.teamId,
    currentRaceIndex: 0,
    calendar: clone(bundle.season.calendar),
    teams: clone(bundle.teams),
    drivers: clone(bundle.drivers),
    cars: clone(bundle.cars),
    pointsSystemId: bundle.season.pointsSystemId,
    regulationSetId: bundle.season.regulationSetId,
    completedRaceResults: {},
    qualifyingResults: {},
    raceEvents: {},
    carSetups,
    driverStandings: [],
    constructorStandings: [],
    activeDevelopmentProjects: [],
    completedDevelopmentProjects: [],
    news: [
      {
        id: 'news-welcome',
        headline: `Welcome to the ${options.seasonYear} season`,
        body: 'A new era begins. Guide your team through the championship.',
        timestamp: now,
      },
    ],
    regulationHistory: [],
    offseasonHistory: [],
    randomSeed: seed,
    seasonComplete: false,
  };
}
