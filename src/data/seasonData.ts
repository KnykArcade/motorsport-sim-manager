import type { Series, Phase0SeasonBundle, Track } from '../types/gameTypes';
import type { SeasonBundle } from './seasonCatalog';
import { availableSeasons } from './seasonCatalog';
import {
  buildPhase0SeasonBundle,
  registerLegacyModule,
  registerPhase0GlobalModule,
  seasonExportKey,
} from './phase0/phase0Runtime';
import { registerTracks, seedBundleCache } from './seasonLoader';
import { setSeasonBundles } from './registry/masterRegistry';

const seasonBundles: Record<string, SeasonBundle> = {};
const registeredTracks = new Map<string, Track>();
const generatedSeasonModules = import.meta.glob('./phase0/generated/season*.ts', { eager: true }) as Record<
  string,
  Record<string, Phase0SeasonBundle>
>;
const generatedNascarGlobalModules = import.meta.glob('./phase0/generated/globalNASCAR*.ts', { eager: true }) as Record<
  string,
  Record<string, unknown>
>;
for (const module of Object.values(generatedNascarGlobalModules)) registerPhase0GlobalModule(module);
const generatedLegacyModules = {
  teams: import.meta.glob('./teams/teams*.ts', { eager: true }),
  drivers: import.meta.glob('./drivers/drivers*.ts', { eager: true }),
  cars: import.meta.glob('./cars/cars*.ts', { eager: true }),
} as Record<'teams' | 'drivers' | 'cars', Record<string, Record<string, unknown>>>;
for (const kind of ['teams', 'drivers', 'cars'] as const) {
  const modules = generatedLegacyModules[kind];
  for (const [path, module] of Object.entries(modules)) {
    registerLegacyModule(kind, path.replace('./', '../'), module);
  }
}
const generatedPhase0 = Object.assign({}, ...Object.values(generatedSeasonModules)) as Record<
  string,
  Phase0SeasonBundle
>;

for (const { year, series } of availableSeasons) {
  const phase0Season = generatedPhase0[seasonExportKey(year, series)];
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
