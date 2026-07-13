// Driver market & academy seed data, keyed by season.
// All seasons use dynamic import() so Vite code-splits each season's market data.

import type { MarketDriver, YouthProspect } from '../../types/marketTypes';
import type { Series } from '../../types/gameTypes';
import { availableSeasons } from '../seasonCatalog';

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
  return round2(0.02 + (Math.max(0, Math.min(100, potential)) / 100) * 0.13);
}
export function youthYearlyAcademyCost(potential: number): number {
  return round2(0.01 + (Math.max(0, Math.min(100, potential)) / 100) * 0.09);
}

function normalizeYouth(youth: YouthProspect[]): YouthProspect[] {
  return youth.map((y) => ({
    ...y,
    signingCost: youthSigningCost(y.potential),
    yearlyAcademyCost: youthYearlyAcademyCost(y.potential),
  }));
}

function bundle(drivers: MarketDriver[], youth: YouthProspect[]): MarketBundle {
  const adultNames = new Set(drivers.map((driver) => normalizeIdentity(driver.name)));
  return { drivers, youth: normalizeYouth(youth.filter((prospect) => !adultNames.has(normalizeIdentity(prospect.name)))) };
}

const releasedMarketDrivers = new Map<string, MarketDriver[]>();

function seasonKey(year: number, series: Series): string {
  void series;
  return String(year);
}

function dedupeMarketDrivers(drivers: MarketDriver[]): MarketDriver[] {
  const seen = new Set<string>();
  const deduped: MarketDriver[] = [];
  for (const driver of drivers) {
    if (seen.has(driver.id)) continue;
    seen.add(driver.id);
    deduped.push(driver);
  }
  return deduped;
}

export function seedReleasedMarketDrivers(year: number, series: Series, drivers: MarketDriver[]): void {
  const key = seasonKey(year, series);
  const preferred = drivers.map((driver) => ({
    ...driver,
    seriesPreferences: mergePreferences(driver.seriesPreferences ?? [], [{ series, weight: 100 }]),
  }));
  const merged = [...(releasedMarketDrivers.get(key) ?? []), ...preferred];
  releasedMarketDrivers.set(key, dedupeMarketDrivers(merged));
}

export function getReleasedMarketDrivers(year: number, series: Series): MarketDriver[] {
  return releasedMarketDrivers.get(seasonKey(year, series)) ?? [];
}

// --- Lazy loader infrastructure ---

const bundleCache = new Map<number, MarketBundle>();

// Dynamic import factories for each season. Vite code-splits each into its own chunk.
const marketLoaders: Record<string, () => Promise<{ drivers: MarketDriver[]; youth: YouthProspect[] }>> = {};

function normalizeIdentity(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function mergePreferences(
  left: NonNullable<MarketDriver['seriesPreferences']>,
  right: NonNullable<MarketDriver['seriesPreferences']>,
): NonNullable<MarketDriver['seriesPreferences']> {
  const weights = new Map<Series, number>();
  for (const preference of [...left, ...right]) {
    weights.set(preference.series, Math.max(weights.get(preference.series) ?? 0, preference.weight));
  }
  return [...weights.entries()]
    .map(([series, weight]) => ({ series, weight }))
    .sort((a, b) => b.weight - a.weight || a.series.localeCompare(b.series));
}

function mergeUniverseEntries<T extends MarketDriver | YouthProspect>(entries: Array<{ entry: T; source: Series }>): T[] {
  const byName = new Map<string, T>();
  for (const { entry, source } of entries) {
    const key = normalizeIdentity(entry.name);
    const preference = [{ series: source, weight: 100 }];
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, { ...entry, seriesPreferences: mergePreferences(entry.seriesPreferences ?? [], preference) });
      continue;
    }
    existing.seriesPreferences = mergePreferences(existing.seriesPreferences ?? [], preference);
  }
  return [...byName.values()];
}

// The shared-market workbook is the curator's source of truth for generated
// placeholders. The reviewed workbook removes these team-named CART/IndyCar
// reserve and academy fillers (1990-2007), so keep them out of every series'
// shared market even though their original seed files remain for history.
function isCuratorRemovedGeneratedPlaceholder(year: number, name: string): boolean {
  return /^(?:199\d|200[0-7]) (?:CART|IndyCar) .+ (?:Reserve|Prospect) [A-E]$/.test(name)
    && Number(name.slice(0, 4)) === year;
}

function applyCuratorMarketExclusions<T extends MarketDriver | YouthProspect>(year: number, entries: T[]): T[] {
  return entries.filter((entry) => !isCuratorRemovedGeneratedPlaceholder(year, entry.name));
}

// Real-driver migration guard: historical seed files can still contain openly
// generated filler. Such entries are never eligible for the shared universe.
function applyDocumentedOnlyFilter<T extends MarketDriver | YouthProspect>(entries: T[]): T[] {
  return entries.filter((entry) => !/generated|synthetic|filler|placeholder/i.test(`${entry.name} ${entry.notes ?? ''}`));
}

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

for (const { year, series } of availableSeasons) marketLoaders[`${year}-${series}`] = makeMarketLoader(year, series);

// Synchronous lookup — returns cached bundle or undefined if not yet loaded.
export function getMarketBundle(year: number, series: Series = 'F1'): MarketBundle | undefined {
  void series;
  return bundleCache.get(year);
}

export function seedMarketBundleCache(
  bundles: Record<string, { drivers: MarketDriver[]; youth: YouthProspect[] }>,
): void {
  const byYear = new Map<number, Array<{ series: Series; marketBundle: { drivers: MarketDriver[]; youth: YouthProspect[] } }>>();
  for (const [key, marketBundle] of Object.entries(bundles)) {
    const year = Number(key.split('-')[0]);
    const series = key.slice(key.indexOf('-') + 1) as Series;
    const entries = byYear.get(year) ?? [];
    entries.push({ series, marketBundle });
    byYear.set(year, entries);
  }
  for (const [year, entries] of byYear) {
    const drivers = mergeUniverseEntries(entries.flatMap(({ series, marketBundle }) => marketBundle.drivers
      .filter((entry) => !(series === 'NASCAR' && entry.id.startsWith('market-youth-nascar-')))
      .map((entry) => ({ entry, source: series }))));
    const youth = mergeUniverseEntries(entries.flatMap(({ series, marketBundle }) => marketBundle.youth
      .map((entry) => ({ entry, source: series }))));
    bundleCache.set(year, bundle(
      applyDocumentedOnlyFilter(applyCuratorMarketExclusions(year, drivers)),
      applyDocumentedOnlyFilter(applyCuratorMarketExclusions(year, youth)),
    ));
  }
}

// Asynchronously load and cache a market bundle. Call this when a season starts
// to ensure getMarketBundle returns data synchronously later.
export async function preloadMarketBundle(year: number, series: Series = 'F1'): Promise<void> {
  void series;
  if (bundleCache.has(year)) return;
  const sources = availableSeasons.filter((season) => season.year === year && marketLoaders[`${year}-${season.series}`]);
  const loaded = await Promise.all(sources.map(async (source) => ({ source: source.series, ...(await marketLoaders[`${year}-${source.series}`]()) })));
  const drivers = mergeUniverseEntries(loaded.flatMap(({ source, drivers: sourceDrivers }) => sourceDrivers
    .filter((entry) => !(source === 'NASCAR' && entry.id.startsWith('market-youth-nascar-')))
    .map((entry) => ({ entry, source }))));
  const youth = mergeUniverseEntries(loaded.flatMap(({ source, youth: sourceYouth }) => sourceYouth
    .map((entry) => ({ entry, source }))));
  bundleCache.set(year, bundle(
    applyDocumentedOnlyFilter(applyCuratorMarketExclusions(year, drivers)),
    applyDocumentedOnlyFilter(applyCuratorMarketExclusions(year, youth)),
  ));
}

// Check if a market bundle is cached and ready for sync access.
export function isMarketBundleReady(year: number, series: Series = 'F1'): boolean {
  void series;
  return bundleCache.has(year);
}
