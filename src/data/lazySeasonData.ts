// Backward-compatible re-exports from seasonLoader.ts.
// The old lazySeasonData.ts had its own loader map; it has been superseded by
// the comprehensive seasonLoader.ts which covers all 56 seasons.

import type { Series } from '../types/gameTypes';
import type { SeasonBundle } from './seasonCatalog';
import { hasSeasonLoader, loadSeasonBundle, preloadSeasonBundle } from './seasonLoader';

export type { SeasonBundle };

export function hasLazyLoader(year: number, series: Series = 'F1'): boolean {
  return hasSeasonLoader(year, series);
}

export async function lazyGetSeasonBundle(
  year: number,
  series: Series = 'F1',
): Promise<SeasonBundle | undefined> {
  return loadSeasonBundle(year, series);
}

export { preloadSeasonBundle };
