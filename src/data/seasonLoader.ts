import type { Series, Track, Phase0SeasonBundle, TeamPrincipal } from '../types/gameTypes';
import type { SeasonBundle } from './seasonCatalog';
import { availableSeasons } from './seasonCatalog';
import { buildPhase0SeasonBundle, registerLegacySeasonModule, registerPhase0GlobalModule, seasonExportKey, seasonImportPath } from './phase0/phase0Runtime';

const bundleCache = new Map<string, SeasonBundle>();
const trackRegistry = new Map<string, Track>();
const generatedSeasonLoaders = import.meta.glob('./phase0/generated/season*.ts') as Record<
  string,
  () => Promise<Record<string, unknown>>
>;

function cacheKey(year: number, series: Series): string {
  return `${year}-${series}`;
}

function registerTrack(track: Track): void {
  trackRegistry.set(track.id, track);
}

export function registerTracks(tracks: Track[]): void {
  for (const track of tracks) registerTrack(track);
}

export function getTrackFromRegistry(id: string): Track | undefined {
  return trackRegistry.get(id);
}

const loaders: Record<string, () => Promise<SeasonBundle>> = {};
for (const { year, series } of availableSeasons) {
  loaders[cacheKey(year, series)] = async () => {
    const suffix = series === 'F1' ? '' : series === 'Champ Car' ? 'CART' : series;
    const generatedSeasonLoader = generatedSeasonLoaders[seasonImportPath(year, series)];
    if (!generatedSeasonLoader) {
      throw new Error(`Missing generated season module ${seasonImportPath(year, series)}`);
    }
    const [module, globalModule, principalModule, teamsModule, driversModule, carsModule] = await Promise.all([
      generatedSeasonLoader(),
      series === 'NASCAR'
        ? import(`./phase0/generated/globalNASCAR${year}.ts`) as Promise<Record<string, unknown>>
        : Promise.resolve(undefined),
      import('./phase0/generated/globalPrincipals.ts') as Promise<Record<string, unknown>>,
      import(`./teams/teams${year}${suffix}.ts`) as Promise<Record<string, unknown>>,
      import(`./drivers/drivers${year}${suffix}.ts`) as Promise<Record<string, unknown>>,
      import(`./cars/cars${year}${suffix}.ts`) as Promise<Record<string, unknown>>,
    ]);
    if (globalModule) registerPhase0GlobalModule(globalModule);
    registerLegacySeasonModule('teams', year, series, teamsModule);
    registerLegacySeasonModule('drivers', year, series, driversModule);
    registerLegacySeasonModule('cars', year, series, carsModule);
    const phase0Season = module[seasonExportKey(year, series)] as Phase0SeasonBundle | undefined;
    if (!phase0Season) {
      throw new Error(`Missing generated season export ${seasonExportKey(year, series)}`);
    }
    const { bundle, tracks } = buildPhase0SeasonBundle(
      phase0Season,
      (principalModule.globalPrincipalsPhase0 ?? []) as TeamPrincipal[],
    );
    registerTracks(tracks);
    return bundle;
  };
}

export function hasSeasonLoader(year: number, series: Series = 'F1'): boolean {
  return cacheKey(year, series) in loaders;
}

export async function loadSeasonBundle(year: number, series: Series = 'F1'): Promise<SeasonBundle | undefined> {
  const key = cacheKey(year, series);
  const cached = bundleCache.get(key);
  if (cached) return cached;
  const loader = loaders[key];
  if (!loader) return undefined;
  const bundle = await loader();
  bundleCache.set(key, bundle);
  return bundle;
}

export function getCachedBundle(year: number, series: Series = 'F1'): SeasonBundle | undefined {
  return bundleCache.get(cacheKey(year, series));
}

export async function preloadSeasonBundle(year: number, series: Series = 'F1'): Promise<void> {
  if (bundleCache.has(cacheKey(year, series))) return;
  await loadSeasonBundle(year, series);
}

export function getLoaderKeys(): string[] {
  return Object.keys(loaders);
}

export function seedBundleCache(bundles: Record<string, SeasonBundle>): void {
  for (const [key, bundle] of Object.entries(bundles)) {
    bundleCache.set(key, bundle);
  }
}
