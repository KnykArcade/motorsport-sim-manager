// Central access point for lightweight seed data and re-exports.
// Heavy historical season data (teams, drivers, cars, tracks for all 86 seasons)
// is NO LONGER imported here. It is loaded on demand via seasonLoader.ts.
//
// Season data must be loaded through loadSeasonBundle() or getCachedBundle().

import type { Track } from '../types/gameTypes';
import type { StaffMember } from '../types/staffTypes';
import { generateStaffPool } from '../sim/staffGenerator';
import { getTrackFromRegistry } from './seasonLoader';

// Re-export lightweight season catalog (no heavy data)
export {
  availableSeasons,
  availableSeries,
  seriesGroups,
  hasSeason,
  type SeasonBundle,
  type SeriesGroup,
} from './seasonCatalog';

// Re-export season loader API
export {
  loadSeasonBundle,
  getCachedBundle,
  preloadSeasonBundle,
  hasSeasonLoader,
  getLoaderKeys,
  seedBundleCache,
} from './seasonLoader';

// Lightweight game data (not season-specific)
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
  getMarketBundle,
  preloadMarketBundle,
  isMarketBundleReady,
  type MarketBundle,
} from './market';
export { staffPool1995 } from './staff/staffPool1995';
export {
  buildMasterRegistry,
  getMasterRegistry,
  registryList,
  normalizeName,
  slugifyName,
  setSeasonBundles,
} from './registry/masterRegistry';
export { initializeMasterRegistry } from './registry/initializeMasterRegistry';
export {
  getHistoricalWeatherRaceMeta,
  getHistoricalWeatherTimeline,
  getCachedHistoricalWeatherTimeline,
  preloadHistoricalWeatherSeason,
} from './weather';

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

// Maximum number of cars allowed to start a race, by series. F1 uses the
// historical 24-car cap; the other series use placeholder caps pending tuning.
// Cars slower than the cap in qualifying do not start (DNQ). Series without a
// cap return undefined.
export function getMaxQualifiers(series: string): number | undefined {
  switch (series) {
    case 'F1':
      return 24;
    case 'NASCAR':
      return 43;
    case 'IndyCar':
      return 28;
    case 'CART':
    case 'Champ Car':
      return 26;
    default:
      return undefined;
  }
}

// Track lookup — uses the global tracks registry populated by seasonLoader.
// Tracks are registered when a season bundle is loaded. If a track hasn't been
// registered yet (e.g. before any bundle is loaded), returns undefined.
export function getTrackById(id: string): Track | undefined {
  return getTrackFromRegistry(id);
}
