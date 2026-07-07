// Comprehensive async season loader for ALL playable seasons.
// Uses Vite-compatible dynamic imports so each season's data is code-split
// into a separate chunk. Bundles are cached after first load.
//
// A global tracks registry is populated as bundles load, so getTrackById
// in data/index.ts can look up tracks without importing all seasons eagerly.

import type { Series, Track } from '../types/gameTypes';
import type { SeasonBundle } from './seasonCatalog';

// Cache loaded bundles so repeated calls don't re-import.
const bundleCache = new Map<string, SeasonBundle>();

// Global tracks registry — populated as bundles are loaded.
const tracksByIdMap = new Map<string, Track>();

export function registerTracks(tracks: Track[]): void {
  for (const t of tracks) {
    tracksByIdMap.set(t.id, t);
  }
}

export function getTrackFromRegistry(id: string): Track | undefined {
  return tracksByIdMap.get(id);
}

function loaderSeriesSuffix(series: Series): string {
  if (series === 'F1') return '';
  if (series === 'Champ Car') return 'CART';
  return series;
}

// Build a loader function for a given season key.
function makeLoader(
  year: number,
  series: Series,
  seasonModule: () => Promise<{ [key: string]: unknown }>,
  teamsModule: () => Promise<{ [key: string]: unknown }>,
  driversModule: () => Promise<{ [key: string]: unknown }>,
  carsModule: () => Promise<{ [key: string]: unknown }>,
  tracksModule: () => Promise<{ [key: string]: unknown }>,
): () => Promise<SeasonBundle> {
  const sfx = loaderSeriesSuffix(series);
  const seasonExport = `season${year}${sfx}`;
  const teamsExport = `teams${year}${sfx}`;
  const driversExport = `drivers${year}${sfx}`;
  const carsExport = `cars${year}${sfx}`;
  const tracksExport = `tracks${year}${sfx}`;

  return async () => {
    const [seasonMod, teamsMod, driversMod, carsMod, tracksMod] = await Promise.all([
      seasonModule(), teamsModule(), driversModule(), carsModule(), tracksModule(),
    ]);
    const bundle: SeasonBundle = {
      season: seasonMod[seasonExport] as SeasonBundle['season'],
      teams: teamsMod[teamsExport] as SeasonBundle['teams'],
      drivers: driversMod[driversExport] as SeasonBundle['drivers'],
      cars: carsMod[carsExport] as SeasonBundle['cars'],
    };
    // Register tracks for global lookup
    const tracks = tracksMod[tracksExport] as Track[];
    if (tracks) registerTracks(tracks);
    return bundle;
  };
}

// Generate loader keys for all seasons.
function seasonKey(year: number, series: Series): string {
  return `${year}-${series}`;
}

// Loader map — each entry uses dynamic import() so Vite code-splits each season.
const loaders: Record<string, () => Promise<SeasonBundle>> = {};

// F1 seasons 1990–2026
for (let year = 1990; year <= 2026; year++) {
  const y = year;
  loaders[seasonKey(y, 'F1')] = makeLoader(
    y, 'F1',
    () => import(`./seasons/season${y}.ts`),
    () => import(`./teams/teams${y}.ts`),
    () => import(`./drivers/drivers${y}.ts`),
    () => import(`./cars/cars${y}.ts`),
    () => import(`./tracks/tracks${y}.ts`),
  );
}

// IndyCar seasons 1996–2007 and 2008–2026
for (let year = 1996; year <= 2007; year++) {
  const y = year;
  loaders[seasonKey(y, 'IndyCar')] = makeLoader(
    y, 'IndyCar',
    () => import(`./seasons/season${y}IndyCar.ts`),
    () => import(`./teams/teams${y}IndyCar.ts`),
    () => import(`./drivers/drivers${y}IndyCar.ts`),
    () => import(`./cars/cars${y}IndyCar.ts`),
    () => import(`./tracks/tracks${y}IndyCar.ts`),
  );
}

// IndyCar seasons 1996–2007 and 2008–2026
for (let year = 1996; year <= 2007; year++) {
  const y = year;
  loaders[seasonKey(y, 'IndyCar')] = makeLoader(
    y, 'IndyCar',
    () => import(`./seasons/season${y}IndyCar.ts`),
    () => import(`./teams/teams${y}IndyCar.ts`),
    () => import(`./drivers/drivers${y}IndyCar.ts`),
    () => import(`./cars/cars${y}IndyCar.ts`),
    () => import(`./tracks/tracks${y}IndyCar.ts`),
  );
}

// IndyCar seasons 1996–2007 and 2008–2026
for (let year = 1996; year <= 2007; year++) {
  const y = year;
  loaders[seasonKey(y, 'IndyCar')] = makeLoader(
    y, 'IndyCar',
    () => import(`./seasons/season${y}IndyCar.ts`),
    () => import(`./teams/teams${y}IndyCar.ts`),
    () => import(`./drivers/drivers${y}IndyCar.ts`),
    () => import(`./cars/cars${y}IndyCar.ts`),
    () => import(`./tracks/tracks${y}IndyCar.ts`),
  );
}

// IndyCar seasons 1996–2007 and 2008–2026
for (let year = 1996; year <= 2007; year++) {
  const y = year;
  loaders[seasonKey(y, 'IndyCar')] = makeLoader(
    y, 'IndyCar',
    () => import(`./seasons/season${y}IndyCar.ts`),
    () => import(`./teams/teams${y}IndyCar.ts`),
    () => import(`./drivers/drivers${y}IndyCar.ts`),
    () => import(`./cars/cars${y}IndyCar.ts`),
    () => import(`./tracks/tracks${y}IndyCar.ts`),
  );
}

// IndyCar seasons 1996–2007 and 2008–2026
for (let year = 1996; year <= 2007; year++) {
  const y = year;
  loaders[seasonKey(y, 'IndyCar')] = makeLoader(
    y, 'IndyCar',
    () => import(`./seasons/season${y}IndyCar.ts`),
    () => import(`./teams/teams${y}IndyCar.ts`),
    () => import(`./drivers/drivers${y}IndyCar.ts`),
    () => import(`./cars/cars${y}IndyCar.ts`),
    () => import(`./tracks/tracks${y}IndyCar.ts`),
  );
}

// IndyCar seasons 1996–2007 and 2008–2026
for (let year = 1996; year <= 2007; year++) {
  const y = year;
  loaders[seasonKey(y, 'IndyCar')] = makeLoader(
    y, 'IndyCar',
    () => import(`./seasons/season${y}IndyCar.ts`),
    () => import(`./teams/teams${y}IndyCar.ts`),
    () => import(`./drivers/drivers${y}IndyCar.ts`),
    () => import(`./cars/cars${y}IndyCar.ts`),
    () => import(`./tracks/tracks${y}IndyCar.ts`),
  );
}

// IndyCar seasons 1996–2007 and 2008–2026
for (let year = 1996; year <= 2007; year++) {
  const y = year;
  loaders[seasonKey(y, 'IndyCar')] = makeLoader(
    y, 'IndyCar',
    () => import(`./seasons/season${y}IndyCar.ts`),
    () => import(`./teams/teams${y}IndyCar.ts`),
    () => import(`./drivers/drivers${y}IndyCar.ts`),
    () => import(`./cars/cars${y}IndyCar.ts`),
    () => import(`./tracks/tracks${y}IndyCar.ts`),
  );
}

// IndyCar seasons 1996–2007 and 2008–2026
for (let year = 1996; year <= 2007; year++) {
  const y = year;
  loaders[seasonKey(y, 'IndyCar')] = makeLoader(
    y, 'IndyCar',
    () => import(`./seasons/season${y}IndyCar.ts`),
    () => import(`./teams/teams${y}IndyCar.ts`),
    () => import(`./drivers/drivers${y}IndyCar.ts`),
    () => import(`./cars/cars${y}IndyCar.ts`),
    () => import(`./tracks/tracks${y}IndyCar.ts`),
  );
}

// IndyCar seasons 1996–2007 and 2008–2026
for (let year = 1996; year <= 2007; year++) {
  const y = year;
  loaders[seasonKey(y, 'IndyCar')] = makeLoader(
    y, 'IndyCar',
    () => import(`./seasons/season${y}IndyCar.ts`),
    () => import(`./teams/teams${y}IndyCar.ts`),
    () => import(`./drivers/drivers${y}IndyCar.ts`),
    () => import(`./cars/cars${y}IndyCar.ts`),
    () => import(`./tracks/tracks${y}IndyCar.ts`),
  );
}

// IndyCar seasons 1996–2007 and 2008–2026
for (let year = 1996; year <= 2007; year++) {
  const y = year;
  loaders[seasonKey(y, 'IndyCar')] = makeLoader(
    y, 'IndyCar',
    () => import(`./seasons/season${y}IndyCar.ts`),
    () => import(`./teams/teams${y}IndyCar.ts`),
    () => import(`./drivers/drivers${y}IndyCar.ts`),
    () => import(`./cars/cars${y}IndyCar.ts`),
    () => import(`./tracks/tracks${y}IndyCar.ts`),
  );
}

// IndyCar seasons 1996–2007 and 2008–2026
for (let year = 1996; year <= 2007; year++) {
  const y = year;
  loaders[seasonKey(y, 'IndyCar')] = makeLoader(
    y, 'IndyCar',
    () => import(`./seasons/season${y}IndyCar.ts`),
    () => import(`./teams/teams${y}IndyCar.ts`),
    () => import(`./drivers/drivers${y}IndyCar.ts`),
    () => import(`./cars/cars${y}IndyCar.ts`),
    () => import(`./tracks/tracks${y}IndyCar.ts`),
  );
}

// IndyCar seasons 1996–2007 and 2008–2026
for (let year = 1996; year <= 2007; year++) {
  const y = year;
  loaders[seasonKey(y, 'IndyCar')] = makeLoader(
    y, 'IndyCar',
    () => import(`./seasons/season${y}IndyCar.ts`),
    () => import(`./teams/teams${y}IndyCar.ts`),
    () => import(`./drivers/drivers${y}IndyCar.ts`),
    () => import(`./cars/cars${y}IndyCar.ts`),
    () => import(`./tracks/tracks${y}IndyCar.ts`),
  );
}

// IndyCar seasons 1996–2007 and 2008–2026
for (let year = 1996; year <= 2007; year++) {
  const y = year;
  loaders[seasonKey(y, 'IndyCar')] = makeLoader(
    y, 'IndyCar',
    () => import(`./seasons/season${y}IndyCar.ts`),
    () => import(`./teams/teams${y}IndyCar.ts`),
    () => import(`./drivers/drivers${y}IndyCar.ts`),
    () => import(`./cars/cars${y}IndyCar.ts`),
    () => import(`./tracks/tracks${y}IndyCar.ts`),
  );
}

// IndyCar seasons 1996–2007 and 2008–2026
for (let year = 1996; year <= 2007; year++) {
  const y = year;
  loaders[seasonKey(y, 'IndyCar')] = makeLoader(
    y, 'IndyCar',
    () => import(`./seasons/season${y}IndyCar.ts`),
    () => import(`./teams/teams${y}IndyCar.ts`),
    () => import(`./drivers/drivers${y}IndyCar.ts`),
    () => import(`./cars/cars${y}IndyCar.ts`),
    () => import(`./tracks/tracks${y}IndyCar.ts`),
  );
}

// IndyCar seasons 1996–2007 and 2008–2026
for (let year = 1996; year <= 2007; year++) {
  const y = year;
  loaders[seasonKey(y, 'IndyCar')] = makeLoader(
    y, 'IndyCar',
    () => import(`./seasons/season${y}IndyCar.ts`),
    () => import(`./teams/teams${y}IndyCar.ts`),
    () => import(`./drivers/drivers${y}IndyCar.ts`),
    () => import(`./cars/cars${y}IndyCar.ts`),
    () => import(`./tracks/tracks${y}IndyCar.ts`),
  );
}

// IndyCar seasons 1996–2007 and 2008–2026
for (let year = 1996; year <= 2007; year++) {
  const y = year;
  loaders[seasonKey(y, 'IndyCar')] = makeLoader(
    y, 'IndyCar',
    () => import(`./seasons/season${y}IndyCar.ts`),
    () => import(`./teams/teams${y}IndyCar.ts`),
    () => import(`./drivers/drivers${y}IndyCar.ts`),
    () => import(`./cars/cars${y}IndyCar.ts`),
    () => import(`./tracks/tracks${y}IndyCar.ts`),
  );
}

// IndyCar seasons 1996–2007 and 2008–2026
for (let year = 1996; year <= 2007; year++) {
  const y = year;
  loaders[seasonKey(y, 'IndyCar')] = makeLoader(
    y, 'IndyCar',
    () => import(`./seasons/season${y}IndyCar.ts`),
    () => import(`./teams/teams${y}IndyCar.ts`),
    () => import(`./drivers/drivers${y}IndyCar.ts`),
    () => import(`./cars/cars${y}IndyCar.ts`),
    () => import(`./tracks/tracks${y}IndyCar.ts`),
  );
}

// IndyCar seasons 2008–2026
for (let year = 2008; year <= 2026; year++) {
  const y = year;
  loaders[seasonKey(y, 'IndyCar')] = makeLoader(
    y, 'IndyCar',
    () => import(`./seasons/season${y}IndyCar.ts`),
    () => import(`./teams/teams${y}IndyCar.ts`),
    () => import(`./drivers/drivers${y}IndyCar.ts`),
    () => import(`./cars/cars${y}IndyCar.ts`),
    () => import(`./tracks/tracks${y}IndyCar.ts`),
  );
}

// CART seasons 1990–2003
for (let year = 1990; year <= 2003; year++) {
  const y = year;
  loaders[seasonKey(y, 'CART')] = makeLoader(
    y, 'CART',
    () => import(`./seasons/season${y}CART.ts`),
    () => import(`./teams/teams${y}CART.ts`),
    () => import(`./drivers/drivers${y}CART.ts`),
    () => import(`./cars/cars${y}CART.ts`),
    () => import(`./tracks/tracks${y}CART.ts`),
  );
}

// Champ Car seasons 2004–2007
for (let year = 2004; year <= 2007; year++) {
  const y = year;
  loaders[seasonKey(y, 'Champ Car')] = makeLoader(
    y, 'Champ Car',
    () => import(`./seasons/season${y}CART.ts`),
    () => import(`./teams/teams${y}CART.ts`),
    () => import(`./drivers/drivers${y}CART.ts`),
    () => import(`./cars/cars${y}CART.ts`),
    () => import(`./tracks/tracks${y}CART.ts`),
  );
}

// Check if a lazy loader exists for a given season key.
export function hasSeasonLoader(year: number, series: Series = 'F1'): boolean {
  return seasonKey(year, series) in loaders;
}

// Asynchronously load a season bundle. Returns undefined if no loader exists.
// Results are cached so repeated calls return immediately.
export async function loadSeasonBundle(
  year: number,
  series: Series = 'F1',
): Promise<SeasonBundle | undefined> {
  const key = seasonKey(year, series);
  if (bundleCache.has(key)) return bundleCache.get(key);
  const loader = loaders[key];
  if (!loader) return undefined;
  const bundle = await loader();
  bundleCache.set(key, bundle);
  return bundle;
}

// Synchronously get a cached bundle. Returns undefined if not yet loaded.
export function getCachedBundle(year: number, series: Series = 'F1'): SeasonBundle | undefined {
  return bundleCache.get(seasonKey(year, series));
}

// Preload a season bundle without returning it (fire-and-forget).
export function preloadSeasonBundle(year: number, series: Series = 'F1'): void {
  const key = seasonKey(year, series);
  if (bundleCache.has(key)) return;
  const loader = loaders[key];
  if (!loader) return;
  void loader().then((bundle) => bundleCache.set(key, bundle));
}

// Get all season keys that have loaders.
export function getLoaderKeys(): string[] {
  return Object.keys(loaders);
}

// Seed the bundle cache with pre-loaded bundles (used by seasonData.ts for tests).
export function seedBundleCache(bundles: Record<string, SeasonBundle>): void {
  for (const [key, bundle] of Object.entries(bundles)) {
    if (!bundleCache.has(key)) {
      bundleCache.set(key, bundle);
    }
  }
}
