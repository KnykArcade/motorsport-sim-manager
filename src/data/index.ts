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
import { season1990 } from './seasons/season1990';
import { tracks1990 } from './tracks/tracks1990';
import { teams1990 } from './teams/teams1990';
import { drivers1990 } from './drivers/drivers1990';
import { cars1990 } from './cars/cars1990';
import { season1991 } from './seasons/season1991';
import { tracks1991 } from './tracks/tracks1991';
import { teams1991 } from './teams/teams1991';
import { drivers1991 } from './drivers/drivers1991';
import { cars1991 } from './cars/cars1991';
import { season1992 } from './seasons/season1992';
import { tracks1992 } from './tracks/tracks1992';
import { teams1992 } from './teams/teams1992';
import { drivers1992 } from './drivers/drivers1992';
import { cars1992 } from './cars/cars1992';
import { season1993 } from './seasons/season1993';
import { tracks1993 } from './tracks/tracks1993';
import { teams1993 } from './teams/teams1993';
import { drivers1993 } from './drivers/drivers1993';
import { cars1993 } from './cars/cars1993';
import { season2001 } from './seasons/season2001';
import { tracks2001 } from './tracks/tracks2001';
import { teams2001 } from './teams/teams2001';
import { drivers2001 } from './drivers/drivers2001';
import { cars2001 } from './cars/cars2001';
import { season2002 } from './seasons/season2002';
import { tracks2002 } from './tracks/tracks2002';
import { teams2002 } from './teams/teams2002';
import { drivers2002 } from './drivers/drivers2002';
import { cars2002 } from './cars/cars2002';
import { season2003 } from './seasons/season2003';
import { tracks2003 } from './tracks/tracks2003';
import { teams2003 } from './teams/teams2003';
import { drivers2003 } from './drivers/drivers2003';
import { cars2003 } from './cars/cars2003';
import { season2004 } from './seasons/season2004';
import { tracks2004 } from './tracks/tracks2004';
import { teams2004 } from './teams/teams2004';
import { drivers2004 } from './drivers/drivers2004';
import { cars2004 } from './cars/cars2004';
import { season2005 } from './seasons/season2005';
import { tracks2005 } from './tracks/tracks2005';
import { teams2005 } from './teams/teams2005';
import { drivers2005 } from './drivers/drivers2005';
import { cars2005 } from './cars/cars2005';
import { season2006 } from './seasons/season2006';
import { tracks2006 } from './tracks/tracks2006';
import { teams2006 } from './teams/teams2006';
import { drivers2006 } from './drivers/drivers2006';
import { cars2006 } from './cars/cars2006';
import { season2007 } from './seasons/season2007';
import { tracks2007 } from './tracks/tracks2007';
import { teams2007 } from './teams/teams2007';
import { drivers2007 } from './drivers/drivers2007';
import { cars2007 } from './cars/cars2007';
import { season2008 } from './seasons/season2008';
import { tracks2008 } from './tracks/tracks2008';
import { teams2008 } from './teams/teams2008';
import { drivers2008 } from './drivers/drivers2008';
import { cars2008 } from './cars/cars2008';
import { season2009 } from './seasons/season2009';
import { tracks2009 } from './tracks/tracks2009';
import { teams2009 } from './teams/teams2009';
import { drivers2009 } from './drivers/drivers2009';
import { cars2009 } from './cars/cars2009';
import { season2010 } from './seasons/season2010';
import { tracks2010 } from './tracks/tracks2010';
import { teams2010 } from './teams/teams2010';
import { drivers2010 } from './drivers/drivers2010';
import { cars2010 } from './cars/cars2010';
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
import { generateStaffPool } from '../sim/staffGenerator';

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

// A large, varied pool of hireable specialists is generated per season/series
// (deterministic). Memoized so the same season returns a stable pool.
const staffPoolCache = new Map<string, StaffMember[]>();
export function getStaffPool(year: number, series = 'F1'): StaffMember[] {
  const key = `${year}-${series}`;
  const cached = staffPoolCache.get(key);
  if (cached) return cached;
  const pool = generateStaffPool(year, series);
  staffPoolCache.set(key, pool);
  return pool;
}

export type SeasonBundle = {
  season: Season;
  teams: Team[];
  drivers: Driver[];
  cars: Car[];
};

// Registry of available historical seasons.
export const seasonBundles: Record<string, SeasonBundle> = {
  '1990-F1': { season: season1990, teams: teams1990, drivers: drivers1990, cars: cars1990 },
  '1991-F1': { season: season1991, teams: teams1991, drivers: drivers1991, cars: cars1991 },
  '1992-F1': { season: season1992, teams: teams1992, drivers: drivers1992, cars: cars1992 },
  '1993-F1': { season: season1993, teams: teams1993, drivers: drivers1993, cars: cars1993 },
  '1994-F1': { season: season1994, teams: teams1994, drivers: drivers1994, cars: cars1994 },
  '1995-F1': { season: season1995, teams: teams1995, drivers: drivers1995, cars: cars1995 },
  '1996-F1': { season: season1996, teams: teams1996, drivers: drivers1996, cars: cars1996 },
  '1997-F1': { season: season1997, teams: teams1997, drivers: drivers1997, cars: cars1997 },
  '1998-F1': { season: season1998, teams: teams1998, drivers: drivers1998, cars: cars1998 },
  '1999-F1': { season: season1999, teams: teams1999, drivers: drivers1999, cars: cars1999 },
  '2000-F1': { season: season2000, teams: teams2000, drivers: drivers2000, cars: cars2000 },
  '2001-F1': { season: season2001, teams: teams2001, drivers: drivers2001, cars: cars2001 },
  '2002-F1': { season: season2002, teams: teams2002, drivers: drivers2002, cars: cars2002 },
  '2003-F1': { season: season2003, teams: teams2003, drivers: drivers2003, cars: cars2003 },
  '2004-F1': { season: season2004, teams: teams2004, drivers: drivers2004, cars: cars2004 },
  '2005-F1': { season: season2005, teams: teams2005, drivers: drivers2005, cars: cars2005 },
  '2006-F1': { season: season2006, teams: teams2006, drivers: drivers2006, cars: cars2006 },
  '2007-F1': { season: season2007, teams: teams2007, drivers: drivers2007, cars: cars2007 },
  '2008-F1': { season: season2008, teams: teams2008, drivers: drivers2008, cars: cars2008 },
  '2009-F1': { season: season2009, teams: teams2009, drivers: drivers2009, cars: cars2009 },
  '2010-F1': { season: season2010, teams: teams2010, drivers: drivers2010, cars: cars2010 },
  '2026-F1': { season: season2026, teams: teams2026, drivers: drivers2026, cars: cars2026 },
  '2026-IndyCar': { season: season2026IndyCar, teams: teams2026IndyCar, drivers: drivers2026IndyCar, cars: cars2026IndyCar },
};

// Seasons available to start a new game, in display order.
export const availableSeasons: { year: number; series: Series; label: string }[] = [
  { year: 1990, series: 'F1', label: '1990 Formula 1 World Championship' },
  { year: 1991, series: 'F1', label: '1991 Formula 1 World Championship' },
  { year: 1992, series: 'F1', label: '1992 Formula 1 World Championship' },
  { year: 1993, series: 'F1', label: '1993 Formula 1 World Championship' },
  { year: 1994, series: 'F1', label: '1994 Formula 1 World Championship' },
  { year: 1995, series: 'F1', label: '1995 Formula 1 World Championship' },
  { year: 1996, series: 'F1', label: '1996 Formula 1 World Championship' },
  { year: 1997, series: 'F1', label: '1997 Formula 1 World Championship' },
  { year: 1998, series: 'F1', label: '1998 Formula 1 World Championship' },
  { year: 1999, series: 'F1', label: '1999 Formula 1 World Championship' },
  { year: 2000, series: 'F1', label: '2000 Formula 1 World Championship' },
  { year: 2001, series: 'F1', label: '2001 Formula 1 World Championship' },
  { year: 2002, series: 'F1', label: '2002 Formula 1 World Championship' },
  { year: 2003, series: 'F1', label: '2003 Formula 1 World Championship' },
  { year: 2004, series: 'F1', label: '2004 Formula 1 World Championship' },
  { year: 2005, series: 'F1', label: '2005 Formula 1 World Championship' },
  { year: 2006, series: 'F1', label: '2006 Formula 1 World Championship' },
  { year: 2007, series: 'F1', label: '2007 Formula 1 World Championship' },
  { year: 2008, series: 'F1', label: '2008 Formula 1 World Championship' },
  { year: 2009, series: 'F1', label: '2009 Formula 1 World Championship' },
  { year: 2010, series: 'F1', label: '2010 Formula 1 World Championship' },
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
  ...tracks1990, ...tracks1991, ...tracks1992, ...tracks1993,
  ...tracks1994, ...tracks1995, ...tracks1996, ...tracks1997, ...tracks1998,
  ...tracks1999, ...tracks2000, ...tracks2001, ...tracks2002, ...tracks2003,
  ...tracks2004, ...tracks2005, ...tracks2006, ...tracks2007, ...tracks2008,
  ...tracks2009, ...tracks2010, ...tracks2026, ...tracks2026IndyCar,
];
export const tracksById = Object.fromEntries(allTracks.map((t) => [t.id, t]));

export function getTrackById(id: string) {
  return tracksById[id];
}

export { calendar1995 as defaultCalendar };
