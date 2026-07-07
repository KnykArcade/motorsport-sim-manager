import type { Series, Track, Phase0SeasonBundle } from '../types/gameTypes';
import type { SeasonBundle } from './seasonCatalog';
import { availableSeasons } from './seasonCatalog';
import { buildPhase0SeasonBundle, seasonExportKey, seasonImportPath } from './phase0/phase0Runtime';

const bundleCache = new Map<string, SeasonBundle>();
const trackRegistry = new Map<string, Track>();

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
    const module = (await import(/* @vite-ignore */ seasonImportPath(year, series))) as Record<string, unknown>;
    const phase0Season = module[seasonExportKey(year, series)] as Phase0SeasonBundle | undefined;
    if (!phase0Season) {
      throw new Error(`Missing generated season export ${seasonExportKey(year, series)}`);
    }
    const { bundle, tracks } = buildPhase0SeasonBundle(phase0Season);
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
