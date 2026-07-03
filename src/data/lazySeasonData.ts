// Lazy season data loader — provides async access to season bundles via
// dynamic imports so that screens like DataViewer can load historical data
// on demand without bundling all 56 seasons upfront.
//
// The synchronous getSeasonBundle in data/index.ts remains for game
// initialization (which needs immediate access). This module is for
// informational screens that can show a loading state.

import type { Car, Driver, Season, Series, Team } from '../types/gameTypes';

export type SeasonBundle = {
  season: Season;
  teams: Team[];
  drivers: Driver[];
  cars: Car[];
};

// Cache loaded bundles so repeated calls don't re-import.
const cache = new Map<string, SeasonBundle>();

// Map of season keys to dynamic import functions.
// Each function returns a Promise resolving to the bundle components.
const loaders: Record<string, () => Promise<SeasonBundle>> = {
  '1990-F1': async () => {
    const [{ season1990 }, { teams1990 }, { drivers1990 }, { cars1990 }] = await Promise.all([
      import('./seasons/season1990'), import('./teams/teams1990'),
      import('./drivers/drivers1990'), import('./cars/cars1990'),
    ]);
    return { season: season1990, teams: teams1990, drivers: drivers1990, cars: cars1990 };
  },
  '1991-F1': async () => {
    const [{ season1991 }, { teams1991 }, { drivers1991 }, { cars1991 }] = await Promise.all([
      import('./seasons/season1991'), import('./teams/teams1991'),
      import('./drivers/drivers1991'), import('./cars/cars1991'),
    ]);
    return { season: season1991, teams: teams1991, drivers: drivers1991, cars: cars1991 };
  },
  '1992-F1': async () => {
    const [{ season1992 }, { teams1992 }, { drivers1992 }, { cars1992 }] = await Promise.all([
      import('./seasons/season1992'), import('./teams/teams1992'),
      import('./drivers/drivers1992'), import('./cars/cars1992'),
    ]);
    return { season: season1992, teams: teams1992, drivers: drivers1992, cars: cars1992 };
  },
  '1993-F1': async () => {
    const [{ season1993 }, { teams1993 }, { drivers1993 }, { cars1993 }] = await Promise.all([
      import('./seasons/season1993'), import('./teams/teams1993'),
      import('./drivers/drivers1993'), import('./cars/cars1993'),
    ]);
    return { season: season1993, teams: teams1993, drivers: drivers1993, cars: cars1993 };
  },
  '1994-F1': async () => {
    const [{ season1994 }, { teams1994 }, { drivers1994 }, { cars1994 }] = await Promise.all([
      import('./seasons/season1994'), import('./teams/teams1994'),
      import('./drivers/drivers1994'), import('./cars/cars1994'),
    ]);
    return { season: season1994, teams: teams1994, drivers: drivers1994, cars: cars1994 };
  },
  '1995-F1': async () => {
    const [{ season1995 }, { teams1995 }, { drivers1995 }, { cars1995 }] = await Promise.all([
      import('./seasons/season1995'), import('./teams/teams1995'),
      import('./drivers/drivers1995'), import('./cars/cars1995'),
    ]);
    return { season: season1995, teams: teams1995, drivers: drivers1995, cars: cars1995 };
  },
  '1996-F1': async () => {
    const [{ season1996 }, { teams1996 }, { drivers1996 }, { cars1996 }] = await Promise.all([
      import('./seasons/season1996'), import('./teams/teams1996'),
      import('./drivers/drivers1996'), import('./cars/cars1996'),
    ]);
    return { season: season1996, teams: teams1996, drivers: drivers1996, cars: cars1996 };
  },
  '1997-F1': async () => {
    const [{ season1997 }, { teams1997 }, { drivers1997 }, { cars1997 }] = await Promise.all([
      import('./seasons/season1997'), import('./teams/teams1997'),
      import('./drivers/drivers1997'), import('./cars/cars1997'),
    ]);
    return { season: season1997, teams: teams1997, drivers: drivers1997, cars: cars1997 };
  },
  '1998-F1': async () => {
    const [{ season1998 }, { teams1998 }, { drivers1998 }, { cars1998 }] = await Promise.all([
      import('./seasons/season1998'), import('./teams/teams1998'),
      import('./drivers/drivers1998'), import('./cars/cars1998'),
    ]);
    return { season: season1998, teams: teams1998, drivers: drivers1998, cars: cars1998 };
  },
  '1999-F1': async () => {
    const [{ season1999 }, { teams1999 }, { drivers1999 }, { cars1999 }] = await Promise.all([
      import('./seasons/season1999'), import('./teams/teams1999'),
      import('./drivers/drivers1999'), import('./cars/cars1999'),
    ]);
    return { season: season1999, teams: teams1999, drivers: drivers1999, cars: cars1999 };
  },
  '2000-F1': async () => {
    const [{ season2000 }, { teams2000 }, { drivers2000 }, { cars2000 }] = await Promise.all([
      import('./seasons/season2000'), import('./teams/teams2000'),
      import('./drivers/drivers2000'), import('./cars/cars2000'),
    ]);
    return { season: season2000, teams: teams2000, drivers: drivers2000, cars: cars2000 };
  },
};

// Check if a lazy loader exists for a given season key.
export function hasLazyLoader(year: number, series: Series = 'F1'): boolean {
  return `${year}-${series}` in loaders;
}

// Asynchronously load a season bundle. Returns undefined if no loader exists.
// Results are cached so repeated calls return immediately.
export async function lazyGetSeasonBundle(
  year: number,
  series: Series = 'F1',
): Promise<SeasonBundle | undefined> {
  const key = `${year}-${series}`;
  if (cache.has(key)) return cache.get(key);
  const loader = loaders[key];
  if (!loader) return undefined;
  const bundle = await loader();
  cache.set(key, bundle);
  return bundle;
}

// Preload a season bundle without waiting for the result (e.g. on hover).
export function preloadSeasonBundle(year: number, series: Series = 'F1'): void {
  const key = `${year}-${series}`;
  if (cache.has(key) || !(key in loaders)) return;
  loaders[key]().then((bundle) => cache.set(key, bundle));
}
