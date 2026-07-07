import type { Series } from '../../types/gameTypes';
import type { HistoricalWeatherTimeline } from '../../sim/historicalWeather';
import { historicalWeatherRaceMeta } from './generated/raceMeta';
import type { HistoricalWeatherRaceMeta } from './weatherTypes';

export { historicalWeatherRaceMeta } from './generated/raceMeta';

const historicalWeatherRaceMetaMap = historicalWeatherRaceMeta as Record<string, HistoricalWeatherRaceMeta>;
const timelineCache = new Map<string, HistoricalWeatherTimeline>();
const seasonModuleCache = new Map<string, Record<string, unknown>>();

function seriesToken(series: Series): string {
  return series === 'Champ Car' ? 'ChampCar' : series;
}

function seasonCacheKey(year: number, series: Series): string {
  return `${year}-${series}`;
}

function weatherExportKey(year: number, series: Series): string {
  return `season${year}${seriesToken(series)}Weather`;
}

export function getHistoricalWeatherRaceMeta(raceId: string): HistoricalWeatherRaceMeta | undefined {
  return historicalWeatherRaceMetaMap[raceId];
}

export async function preloadHistoricalWeatherSeason(year: number, series: Series): Promise<void> {
  const key = seasonCacheKey(year, series);
  if (seasonModuleCache.has(key)) return;
  const module = (await import(/* @vite-ignore */ `./generated/season${year}${seriesToken(series)}.ts`)) as Record<
    string,
    unknown
  >;
  seasonModuleCache.set(key, module);
}

export async function getHistoricalWeatherTimeline(raceId: string): Promise<HistoricalWeatherTimeline | undefined> {
  const cached = timelineCache.get(raceId);
  if (cached) return cached;
  const meta = historicalWeatherRaceMetaMap[raceId];
  if (!meta) return undefined;
  const seasonKey = seasonCacheKey(meta.seasonYear, meta.series);
  let module = seasonModuleCache.get(seasonKey);
  if (!module) {
    module = (await import(/* @vite-ignore */ `./generated/season${meta.seasonYear}${seriesToken(meta.series)}.ts`)) as Record<
      string,
      unknown
    >;
    seasonModuleCache.set(seasonKey, module);
  }
  const timeline = module[weatherExportKey(meta.seasonYear, meta.series)] as
    | Record<string, HistoricalWeatherTimeline>
    | undefined;
  const entry = timeline?.[raceId];
  if (entry) timelineCache.set(raceId, entry);
  return entry;
}

export function getCachedHistoricalWeatherTimeline(raceId: string): HistoricalWeatherTimeline | undefined {
  return timelineCache.get(raceId);
}
