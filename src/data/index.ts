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
import { season2011 } from './seasons/season2011';
import { tracks2011 } from './tracks/tracks2011';
import { teams2011 } from './teams/teams2011';
import { drivers2011 } from './drivers/drivers2011';
import { cars2011 } from './cars/cars2011';
import { season2012 } from './seasons/season2012';
import { tracks2012 } from './tracks/tracks2012';
import { teams2012 } from './teams/teams2012';
import { drivers2012 } from './drivers/drivers2012';
import { cars2012 } from './cars/cars2012';
import { season2013 } from './seasons/season2013';
import { tracks2013 } from './tracks/tracks2013';
import { teams2013 } from './teams/teams2013';
import { drivers2013 } from './drivers/drivers2013';
import { cars2013 } from './cars/cars2013';
import { season2014 } from './seasons/season2014';
import { tracks2014 } from './tracks/tracks2014';
import { teams2014 } from './teams/teams2014';
import { drivers2014 } from './drivers/drivers2014';
import { cars2014 } from './cars/cars2014';
import { season2015 } from './seasons/season2015';
import { tracks2015 } from './tracks/tracks2015';
import { teams2015 } from './teams/teams2015';
import { drivers2015 } from './drivers/drivers2015';
import { cars2015 } from './cars/cars2015';
import { season2016 } from './seasons/season2016';
import { tracks2016 } from './tracks/tracks2016';
import { teams2016 } from './teams/teams2016';
import { drivers2016 } from './drivers/drivers2016';
import { cars2016 } from './cars/cars2016';
import { season2017 } from './seasons/season2017';
import { tracks2017 } from './tracks/tracks2017';
import { teams2017 } from './teams/teams2017';
import { drivers2017 } from './drivers/drivers2017';
import { cars2017 } from './cars/cars2017';
import { season2018 } from './seasons/season2018';
import { tracks2018 } from './tracks/tracks2018';
import { teams2018 } from './teams/teams2018';
import { drivers2018 } from './drivers/drivers2018';
import { cars2018 } from './cars/cars2018';
import { season2019 } from './seasons/season2019';
import { tracks2019 } from './tracks/tracks2019';
import { teams2019 } from './teams/teams2019';
import { drivers2019 } from './drivers/drivers2019';
import { cars2019 } from './cars/cars2019';
import { season2020 } from './seasons/season2020';
import { tracks2020 } from './tracks/tracks2020';
import { teams2020 } from './teams/teams2020';
import { drivers2020 } from './drivers/drivers2020';
import { cars2020 } from './cars/cars2020';
import { season2021 } from './seasons/season2021';
import { tracks2021 } from './tracks/tracks2021';
import { teams2021 } from './teams/teams2021';
import { drivers2021 } from './drivers/drivers2021';
import { cars2021 } from './cars/cars2021';
import { season2022 } from './seasons/season2022';
import { tracks2022 } from './tracks/tracks2022';
import { teams2022 } from './teams/teams2022';
import { drivers2022 } from './drivers/drivers2022';
import { cars2022 } from './cars/cars2022';
import { season2023 } from './seasons/season2023';
import { tracks2023 } from './tracks/tracks2023';
import { teams2023 } from './teams/teams2023';
import { drivers2023 } from './drivers/drivers2023';
import { cars2023 } from './cars/cars2023';
import { season2024 } from './seasons/season2024';
import { tracks2024 } from './tracks/tracks2024';
import { teams2024 } from './teams/teams2024';
import { drivers2024 } from './drivers/drivers2024';
import { cars2024 } from './cars/cars2024';
import { season2025 } from './seasons/season2025';
import { tracks2025 } from './tracks/tracks2025';
import { teams2025 } from './teams/teams2025';
import { drivers2025 } from './drivers/drivers2025';
import { cars2025 } from './cars/cars2025';
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
export {
  buildMasterRegistry,
  getMasterRegistry,
  registryList,
  normalizeName,
  slugifyName,
} from './registry/masterRegistry';

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
  '2011-F1': { season: season2011, teams: teams2011, drivers: drivers2011, cars: cars2011 },
  '2012-F1': { season: season2012, teams: teams2012, drivers: drivers2012, cars: cars2012 },
  '2013-F1': { season: season2013, teams: teams2013, drivers: drivers2013, cars: cars2013 },
  '2014-F1': { season: season2014, teams: teams2014, drivers: drivers2014, cars: cars2014 },
  '2015-F1': { season: season2015, teams: teams2015, drivers: drivers2015, cars: cars2015 },
  '2016-F1': { season: season2016, teams: teams2016, drivers: drivers2016, cars: cars2016 },
  '2017-F1': { season: season2017, teams: teams2017, drivers: drivers2017, cars: cars2017 },
  '2018-F1': { season: season2018, teams: teams2018, drivers: drivers2018, cars: cars2018 },
  '2019-F1': { season: season2019, teams: teams2019, drivers: drivers2019, cars: cars2019 },
  '2020-F1': { season: season2020, teams: teams2020, drivers: drivers2020, cars: cars2020 },
  '2021-F1': { season: season2021, teams: teams2021, drivers: drivers2021, cars: cars2021 },
  '2022-F1': { season: season2022, teams: teams2022, drivers: drivers2022, cars: cars2022 },
  '2023-F1': { season: season2023, teams: teams2023, drivers: drivers2023, cars: cars2023 },
  '2024-F1': { season: season2024, teams: teams2024, drivers: drivers2024, cars: cars2024 },
  '2025-F1': { season: season2025, teams: teams2025, drivers: drivers2025, cars: cars2025 },
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
  { year: 2011, series: 'F1', label: '2011 Formula 1 World Championship' },
  { year: 2012, series: 'F1', label: '2012 Formula 1 World Championship' },
  { year: 2013, series: 'F1', label: '2013 Formula 1 World Championship' },
  { year: 2014, series: 'F1', label: '2014 Formula 1 World Championship' },
  { year: 2015, series: 'F1', label: '2015 Formula 1 World Championship' },
  { year: 2016, series: 'F1', label: '2016 Formula 1 World Championship' },
  { year: 2017, series: 'F1', label: '2017 Formula 1 World Championship' },
  { year: 2018, series: 'F1', label: '2018 Formula 1 World Championship' },
  { year: 2019, series: 'F1', label: '2019 Formula 1 World Championship' },
  { year: 2020, series: 'F1', label: '2020 Formula 1 World Championship' },
  { year: 2021, series: 'F1', label: '2021 Formula 1 World Championship' },
  { year: 2022, series: 'F1', label: '2022 Formula 1 World Championship' },
  { year: 2023, series: 'F1', label: '2023 Formula 1 World Championship' },
  { year: 2024, series: 'F1', label: '2024 Formula 1 World Championship' },
  { year: 2025, series: 'F1', label: '2025 Formula 1 World Championship' },
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
  ...tracks2009, ...tracks2010, ...tracks2011, ...tracks2012, ...tracks2013,
  ...tracks2014, ...tracks2015, ...tracks2016, ...tracks2017, ...tracks2018,
  ...tracks2019, ...tracks2020, ...tracks2021, ...tracks2022, ...tracks2023,
  ...tracks2024, ...tracks2025, ...tracks2026, ...tracks2026IndyCar,
];
export const tracksById = Object.fromEntries(allTracks.map((t) => [t.id, t]));

export function getTrackById(id: string) {
  return tracksById[id];
}

export { calendar1995 as defaultCalendar };
