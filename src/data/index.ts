// Central access point for all seed data. Screens/engines import from here so
// future seasons can be registered in one place.

import type { Car, Driver, Season, Team } from '../types/gameTypes';
import { season1995, calendar1995 } from './seasons/season1995';
import { tracks1995 } from './tracks/tracks1995';
import { teams1995 } from './teams/teams1995';
import { drivers1995 } from './drivers/drivers1995';
import { cars1995 } from './cars/cars1995';

export { tracks1995 } from './tracks/tracks1995';
export { teams1995 } from './teams/teams1995';
export { drivers1995 } from './drivers/drivers1995';
export { cars1995 } from './cars/cars1995';
export { season1995, calendar1995 } from './seasons/season1995';
export { setupOptions, setupOptionsById } from './setupOptions/setupOptions';
export { pointsSystems, getPointsSystem } from './pointsSystems/pointsSystems';
export {
  regulationSets,
  getRegulationSet,
  regulationChangeEvents,
} from './regulations/regulations';
export {
  qualifyingRunPlans,
  qualifyingRunPlansById,
} from './decisions/qualifyingRunPlans';
export { raceStrategies, raceStrategiesById } from './decisions/raceStrategies';
export {
  driverInstructions,
  driverInstructionsById,
} from './decisions/driverInstructions';
export {
  developmentProjectCatalog,
  developmentProjectsById,
} from './development/developmentProjects';

export type SeasonBundle = {
  season: Season;
  teams: Team[];
  drivers: Driver[];
  cars: Car[];
};

// Registry of available historical seasons. 1995 is the only fully seeded one.
export const seasonBundles: Record<string, SeasonBundle> = {
  '1995-F1': {
    season: season1995,
    teams: teams1995,
    drivers: drivers1995,
    cars: cars1995,
  },
};

export function getSeasonBundle(year: number, series = 'F1'): SeasonBundle | undefined {
  return seasonBundles[`${year}-${series}`];
}

export const tracksById = Object.fromEntries(tracks1995.map((t) => [t.id, t]));

export function getTrackById(id: string) {
  return tracksById[id];
}

export { calendar1995 as defaultCalendar };
