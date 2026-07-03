import type { Series } from '../../types/gameTypes';
import type { SeasonBundle } from '../seasonCatalog';
import { availableSeasons } from '../seasonCatalog';
import { loadSeasonBundle } from '../seasonLoader';
import { preloadMarketBundle } from '../market';
import { setSeasonBundles } from './masterRegistry';

let allSeasonBundlesPromise: Promise<Record<string, SeasonBundle>> | null = null;
const initializedMarketKeys = new Set<string>();
let registrySeeded = false;

function seasonKey(year: number, series: Series): string {
  return `${year}-${series}`;
}

async function loadAllSeasonBundles(): Promise<Record<string, SeasonBundle>> {
  if (!allSeasonBundlesPromise) {
    allSeasonBundlesPromise = Promise.all(
      availableSeasons.map(async (season) => {
        const bundle = await loadSeasonBundle(season.year, season.series);
        return bundle ? ([seasonKey(season.year, season.series), bundle] as const) : undefined;
      }),
    ).then((entries) => Object.fromEntries(entries.filter((entry): entry is readonly [string, SeasonBundle] => Boolean(entry))));
  }
  return allSeasonBundlesPromise;
}

export async function initializeMasterRegistry(
  marketYear?: number,
  marketSeries: Series = 'F1',
): Promise<void> {
  const marketKey = marketYear == null ? undefined : seasonKey(marketYear, marketSeries);
  const needsMarket = marketKey != null && !initializedMarketKeys.has(marketKey);

  if (registrySeeded && !needsMarket) return;

  if (marketYear != null) {
    await preloadMarketBundle(marketYear, marketSeries);
    initializedMarketKeys.add(seasonKey(marketYear, marketSeries));
  }

  const bundles = await loadAllSeasonBundles();
  setSeasonBundles(bundles);
  registrySeeded = true;
}
