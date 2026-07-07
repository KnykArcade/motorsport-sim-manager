// Driver market & academy seed data, keyed by season.
// All seasons use dynamic import() so Vite code-splits each season's market data.

import type { MarketDriver, YouthProspect } from '../../types/marketTypes';
import { buildStaticMarketBundleMap } from './marketSeed';
import type { Series } from '../../types/gameTypes';

export type MarketBundle = {
  drivers: MarketDriver[];
  youth: YouthProspect[];
};

// Youth signing/academy costs in the raw season files are inconsistent: some
// were authored in $M (e.g. 0.2) while others came through as raw dollars
// (e.g. 550000), which the finance layer then multiplied by 1M. Unproven youth
// prospects should also simply be cheap — potential is not a guarantee. So we
// derive both costs from the prospect's potential on a single low $M scale,
// ignoring the unreliable source columns. Higher potential costs a little more.
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
export function youthSigningCost(potential: number): number {
  return round2(0.02 + (Math.max(0, Math.min(10, potential)) / 10) * 0.13);
}
export function youthYearlyAcademyCost(potential: number): number {
  return round2(0.01 + (Math.max(0, Math.min(10, potential)) / 10) * 0.09);
}

function normalizeYouth(youth: YouthProspect[]): YouthProspect[] {
  return youth.map((y) => ({
    ...y,
    signingCost: youthSigningCost(y.potential),
    yearlyAcademyCost: youthYearlyAcademyCost(y.potential),
  }));
}

function bundle(drivers: MarketDriver[], youth: YouthProspect[]): MarketBundle {
  return { drivers, youth: normalizeYouth(youth) };
}

// --- Lazy loader infrastructure ---

const bundleCache = new Map<string, MarketBundle>();

// Dynamic import factories for each season. Vite code-splits each into its own chunk.
const marketLoaders: Record<string, () => Promise<{ drivers: MarketDriver[]; youth: YouthProspect[] }>> = {};

function makeMarketLoader(year: number, series: Series) {
  const suffix = series === 'F1' ? '' : series === 'Champ Car' ? 'CART' : series;
  return async () => {
    const [driversMod, youthMod] = await Promise.all([
      import(`./driverMarket${year}${suffix}.ts`),
      import(`./youthProspects${year}${suffix}.ts`),
    ]);
    const drivers = driversMod[`driverMarket${year}${suffix}`] as MarketDriver[];
    const youth = youthMod[`youthProspects${year}${suffix}`] as YouthProspect[];
    return { drivers, youth };
  };
}

// F1 seasons 1990–2026
for (let year = 1990; year <= 2026; year++) {
  marketLoaders[`${year}-F1`] = makeMarketLoader(year, 'F1');
}

// IndyCar seasons 1996–2007 and 2008–2026
for (let year = 1996; year <= 2007; year++) {
  marketLoaders[`${year}-IndyCar`] = makeMarketLoader(year, 'IndyCar');
}

// IndyCar seasons 1996–2007 and 2008–2026
for (let year = 1996; year <= 2007; year++) {
  marketLoaders[`${year}-IndyCar`] = makeMarketLoader(year, 'IndyCar');
}

// IndyCar seasons 1996–2007 and 2008–2026
for (let year = 1996; year <= 2007; year++) {
  marketLoaders[`${year}-IndyCar`] = makeMarketLoader(year, 'IndyCar');
}

// IndyCar seasons 1996–2007 and 2008–2026
for (let year = 1996; year <= 2007; year++) {
  marketLoaders[`${year}-IndyCar`] = makeMarketLoader(year, 'IndyCar');
}

// IndyCar seasons 1996–2007 and 2008–2026
for (let year = 1996; year <= 2007; year++) {
  marketLoaders[`${year}-IndyCar`] = makeMarketLoader(year, 'IndyCar');
}

// IndyCar seasons 1996–2007 and 2008–2026
for (let year = 1996; year <= 2007; year++) {
  marketLoaders[`${year}-IndyCar`] = makeMarketLoader(year, 'IndyCar');
}

// IndyCar seasons 1996–2007 and 2008–2026
for (let year = 1996; year <= 2007; year++) {
  marketLoaders[`${year}-IndyCar`] = makeMarketLoader(year, 'IndyCar');
}

// IndyCar seasons 1996–2007 and 2008–2026
for (let year = 1996; year <= 2007; year++) {
  marketLoaders[`${year}-IndyCar`] = makeMarketLoader(year, 'IndyCar');
}

// IndyCar seasons 1996–2007 and 2008–2026
for (let year = 1996; year <= 2007; year++) {
  marketLoaders[`${year}-IndyCar`] = makeMarketLoader(year, 'IndyCar');
}

// IndyCar seasons 1996–2007 and 2008–2026
for (let year = 1996; year <= 2007; year++) {
  marketLoaders[`${year}-IndyCar`] = makeMarketLoader(year, 'IndyCar');
}

// IndyCar seasons 1996–2007 and 2008–2026
for (let year = 1996; year <= 2007; year++) {
  marketLoaders[`${year}-IndyCar`] = makeMarketLoader(year, 'IndyCar');
}

// IndyCar seasons 1996–2007 and 2008–2026
for (let year = 1996; year <= 2007; year++) {
  marketLoaders[`${year}-IndyCar`] = makeMarketLoader(year, 'IndyCar');
}

// IndyCar seasons 1996–2007 and 2008–2026
for (let year = 1996; year <= 2007; year++) {
  marketLoaders[`${year}-IndyCar`] = makeMarketLoader(year, 'IndyCar');
}

// IndyCar seasons 1996–2007 and 2008–2026
for (let year = 1996; year <= 2007; year++) {
  marketLoaders[`${year}-IndyCar`] = makeMarketLoader(year, 'IndyCar');
}

// IndyCar seasons 1996–2007 and 2008–2026
for (let year = 1996; year <= 2007; year++) {
  marketLoaders[`${year}-IndyCar`] = makeMarketLoader(year, 'IndyCar');
}

// IndyCar seasons 1996–2007 and 2008–2026
for (let year = 1996; year <= 2007; year++) {
  marketLoaders[`${year}-IndyCar`] = makeMarketLoader(year, 'IndyCar');
}

// IndyCar seasons 1996–2007 and 2008–2026
for (let year = 1996; year <= 2007; year++) {
  marketLoaders[`${year}-IndyCar`] = makeMarketLoader(year, 'IndyCar');
}

// IndyCar seasons 2008–2026
for (let year = 2008; year <= 2026; year++) {
  marketLoaders[`${year}-IndyCar`] = makeMarketLoader(year, 'IndyCar');
}

// CART seasons 1990–2003
for (let year = 1990; year <= 2003; year++) {
  marketLoaders[`${year}-CART`] = makeMarketLoader(year, 'CART');
}

// Champ Car seasons 2004–2007
for (let year = 2004; year <= 2007; year++) {
  marketLoaders[`${year}-Champ Car`] = makeMarketLoader(year, 'Champ Car');
}

seedMarketBundleCache(buildStaticMarketBundleMap());

// Synchronous lookup — returns cached bundle or undefined if not yet loaded.
export function getMarketBundle(year: number, series: Series = 'F1'): MarketBundle | undefined {
  const key = `${year}-${series}`;
  return bundleCache.get(key);
}

export function seedMarketBundleCache(
  bundles: Record<string, { drivers: MarketDriver[]; youth: YouthProspect[] }>,
): void {
  for (const [key, marketBundle] of Object.entries(bundles)) {
    bundleCache.set(key, bundle(marketBundle.drivers, marketBundle.youth));
  }
}

// Asynchronously load and cache a market bundle. Call this when a season starts
// to ensure getMarketBundle returns data synchronously later.
export async function preloadMarketBundle(year: number, series: Series = 'F1'): Promise<void> {
  const key = `${year}-${series}`;
  if (bundleCache.has(key)) return;
  const loader = marketLoaders[key];
  if (!loader) return;
  const { drivers, youth } = await loader();
  bundleCache.set(key, bundle(drivers, youth));
}

// Check if a market bundle is cached and ready for sync access.
export function isMarketBundleReady(year: number, series: Series = 'F1'): boolean {
  return bundleCache.has(`${year}-${series}`);
}
