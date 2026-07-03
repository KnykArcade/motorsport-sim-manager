// Central access point for lightweight seed data and re-exports.
// Heavy historical season data (teams, drivers, cars, tracks for all 56 seasons)
// is NO LONGER imported here. It is loaded on demand via seasonLoader.ts.
//
// Only 1995-specific data is still imported here for test compatibility and
// legacy screens that reference it directly. All other season data must be
// loaded through loadSeasonBundle() or getCachedBundle().

import type { Track } from '../types/gameTypes';
import type { StaffMember } from '../types/staffTypes';
import { tracks1995 } from './tracks/tracks1995';
import { generateStaffPool } from '../sim/staffGenerator';
import { getTrackFromRegistry, registerTracks } from './seasonLoader';

// Re-export lightweight season catalog (no heavy data)
export {
  availableSeasons,
  availableSeries,
  hasSeason,
  type SeasonBundle,
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

// 1995-specific data (used by tests and some legacy screens)
export { tracks1995 } from './tracks/tracks1995';
export { teams1995 } from './teams/teams1995';
export { drivers1995 } from './drivers/drivers1995';
export { cars1995 } from './cars/cars1995';
export { season1995, calendar1995 } from './seasons/season1995';

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
  setSeasonBundles,
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

// Maximum number of cars allowed to start a race. F1 has historically capped the
// grid (e.g. 24 cars in the early-mid 1990s); cars slower than the cap in
// qualifying do not start (DNQ). Series without a cap return undefined.
export function getMaxQualifiers(series: string): number | undefined {
  return series === 'F1' ? 24 : undefined;
}

// Track lookup — uses the global tracks registry populated by seasonLoader.
// Tracks are registered when a season bundle is loaded. If a track hasn't been
// registered yet (e.g. before any bundle is loaded), returns undefined.
export function getTrackById(id: string): Track | undefined {
  return getTrackFromRegistry(id);
}

// Register 1995 tracks eagerly so they're available for tests and legacy screens.
registerTracks(tracks1995);
