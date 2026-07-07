import type { Series, Phase0SeasonBundle, Track } from '../types/gameTypes';
import type { SeasonBundle } from './seasonCatalog';
import { availableSeasons } from './seasonCatalog';
import * as generatedPhase0 from './phase0/generated';
import { buildPhase0SeasonBundle, seasonExportKey } from './phase0/phase0Runtime';
import { registerTracks, seedBundleCache } from './seasonLoader';
import { setSeasonBundles } from './registry/masterRegistry';

const seasonBundles: Record<string, SeasonBundle> = {};
const registeredTracks = new Map<string, Track>();

for (const { year, series } of availableSeasons) {
  const phase0Season = ((generatedPhase0 as unknown) as Record<string, Phase0SeasonBundle>)[seasonExportKey(year, series)];
  if (!phase0Season) continue;
  const { bundle, tracks } = buildPhase0SeasonBundle(phase0Season);
  seasonBundles[`${year}-${series}`] = bundle;
  for (const track of tracks) registeredTracks.set(track.id, track);
}

registerTracks([...registeredTracks.values()]);
seedBundleCache(seasonBundles);
setSeasonBundles(seasonBundles);

export function getSeasonBundle(year: number, series: Series = 'F1'): SeasonBundle | undefined {
  return seasonBundles[`${year}-${series}`];
}

export { seasonBundles };
