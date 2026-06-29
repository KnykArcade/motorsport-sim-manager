// Central access point for all seed data. Screens/engines import from here so
// future seasons can be registered in one place.

import type { Car, Driver, Season, Series, Team, Track } from '../types/gameTypes';
import type { StaffMember } from '../types/staffTypes';
import { season1995, calendar1995 } from './seasons/season1995';
import { tracks1995 } from './tracks/tracks1995';
import { teams1995 } from './teams/teams1995';
import { drivers1995 } from './drivers/drivers1995';
import { cars1995 } from './cars/cars1995';
import { season1994 } from './seasons/season1994';
import { tracks1994 } from './tracks/tracks1994';
import { teams1994 } from './teams/teams1994';
import { drivers1994 } from './drivers/drivers1994';
import { cars1994 } from './cars/cars1994';
import { season1996 } from './seasons/season1996';
import { tracks1996 } from './tracks/tracks1996';
import { teams1996 } from './teams/teams1996';
import { drivers1996 } from './drivers/drivers1996';
import { cars1996 } from './cars/cars1996';
import { season1997 } from './seasons/season1997';
import { tracks1997 } from './tracks/tracks1997';
import { teams1997 } from './teams/teams1997';
import { drivers1997 } from './drivers/drivers1997';
import { cars1997 } from './cars/cars1997';
import { season1998 } from './seasons/season1998';
import { tracks1998 } from './tracks/tracks1998';
import { teams1998 } from './teams/teams1998';
import { drivers1998 } from './drivers/drivers1998';
import { cars1998 } from './cars/cars1998';
import { season1999 } from './seasons/season1999';
import { tracks1999 } from './tracks/tracks1999';
import { teams1999 } from './teams/teams1999';
import { drivers1999 } from './drivers/drivers1999';
import { cars1999 } from './cars/cars1999';
import { season2000 } from './seasons/season2000';
import { tracks2000 } from './tracks/tracks2000';
import { teams2000 } from './teams/teams2000';
import { drivers2000 } from './drivers/drivers2000';
import { cars2000 } from './cars/cars2000';
import { season2026 } from './seasons/season2026';
import { tracks2026 } from './tracks/tracks2026';
import { teams2026 } from './teams/teams2026';
import { drivers2026 } from './drivers/drivers2026';
import { cars2026 } from './cars/cars2026';
import { season2026IndyCar } from './seasons/season2026IndyCar';
import { tracks2026IndyCar } from './tracks/tracks2026IndyCar';
import { teams2026IndyCar } from './teams/teams2026IndyCar';
import { drivers2026IndyCar } from './drivers/drivers2026IndyCar';
import { cars2026IndyCar } from './cars/cars2026IndyCar';
import { staffPool1995 } from './staff/staffPool1995';

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
export {
  driverMarket1995,
  youthProspects1995,
  getMarketBundle,
  type MarketBundle,
} from './market';
export { staffPool1995 } from './staff/staffPool1995';

export function getStaffPool(year: number, series = 'F1'): StaffMember[] {
  void year;
  void series;
  return staffPool1995; // single pool for now; later years can override
}

export type SeasonBundle = {
  season: Season;
  teams: Team[];
  drivers: Driver[];
  cars: Car[];
};

// Registry of available historical seasons.
export const seasonBundles: Record<string, SeasonBundle> = {
  '1994-F1': { season: season1994, teams: teams1994, drivers: drivers1994, cars: cars1994 },
  '1995-F1': { season: season1995, teams: teams1995, drivers: drivers1995, cars: cars1995 },
  '1996-F1': { season: season1996, teams: teams1996, drivers: drivers1996, cars: cars1996 },
  '1997-F1': { season: season1997, teams: teams1997, drivers: drivers1997, cars: cars1997 },
  '1998-F1': { season: season1998, teams: teams1998, drivers: drivers1998, cars: cars1998 },
  '1999-F1': { season: season1999, teams: teams1999, drivers: drivers1999, cars: cars1999 },
  '2000-F1': { season: season2000, teams: teams2000, drivers: drivers2000, cars: cars2000 },
  '2026-F1': { season: season2026, teams: teams2026, drivers: drivers2026, cars: cars2026 },
  '2026-IndyCar': { season: season2026IndyCar, teams: teams2026IndyCar, drivers: drivers2026IndyCar, cars: cars2026IndyCar },
};

// Seasons available to start a new game, in display order.
export const availableSeasons: { year: number; series: Series; label: string }[] = [
  { year: 1994, series: 'F1', label: '1994 Formula 1 World Championship' },
  { year: 1995, series: 'F1', label: '1995 Formula 1 World Championship' },
  { year: 1996, series: 'F1', label: '1996 Formula 1 World Championship' },
  { year: 1997, series: 'F1', label: '1997 Formula 1 World Championship' },
  { year: 1998, series: 'F1', label: '1998 Formula 1 World Championship' },
  { year: 1999, series: 'F1', label: '1999 Formula 1 World Championship' },
  { year: 2000, series: 'F1', label: '2000 Formula 1 World Championship' },
  { year: 2026, series: 'F1', label: '2026 Formula 1 World Championship' },
  { year: 2026, series: 'IndyCar', label: '2026 IndyCar Series' },
];

// Series available to start a new game, in display order.
export const availableSeries: { id: Series; label: string }[] = [
  { id: 'F1', label: 'Formula 1' },
  { id: 'IndyCar', label: 'IndyCar' },
];

export function getSeasonBundle(year: number, series: Series = 'F1'): SeasonBundle | undefined {
  return seasonBundles[`${year}-${series}`];
}

// Maximum number of cars allowed to start a race. F1 has historically capped the
// grid (e.g. 24 cars in the early-mid 1990s); cars slower than the cap in
// qualifying do not start (DNQ). Series without a cap return undefined.
export function getMaxQualifiers(series: string): number | undefined {
  return series === 'F1' ? 24 : undefined;
}

// Track ids are unique across all seasons (later seasons are year-suffixed), so a
// single global lookup serves every season's calendar.
const allTracks: Track[] = [
  ...tracks1994, ...tracks1995, ...tracks1996, ...tracks1997, ...tracks1998,
  ...tracks1999, ...tracks2000, ...tracks2026, ...tracks2026IndyCar,
];
export const tracksById = Object.fromEntries(allTracks.map((t) => [t.id, t]));

export function getTrackById(id: string) {
  return tracksById[id];
}

export { calendar1995 as defaultCalendar };
