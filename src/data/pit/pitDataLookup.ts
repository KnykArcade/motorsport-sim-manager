import type { PitTransitRecord, PitTrackMapping, PitRulesBySeriesEraRecord } from '../../types/pitTypes';
import { PIT_RULES_BY_SERIES_ERA, PIT_TRANSIT_DATA } from './pitTransitData.generated';
import { PIT_TRACK_MAPPINGS } from './pitTrackMappings';
import { normalizePitSeries, seriesForPitData } from '../../types/seriesTypes';
import type { Series } from '../../types/gameTypes';

export type PitTransitLookupRequest = {
  gameTrackId: string;
  series: Series;
  year: number;
  configuration?: string;
};

export type PitTransitLookupResult =
  | { kind: 'matched'; record: PitTransitRecord; mapping: PitTrackMapping | null }
  | { kind: 'missing'; reason: string };

function yearMatches(start: number | null | undefined, end: number | null | undefined, year: number): boolean {
  return (start == null || year >= start) && (end == null || year <= end);
}

function boundedScore(start: number | null | undefined, end: number | null | undefined): number {
  return start != null || end != null ? 2 : 0;
}

export function findPitTransitRecord(request: PitTransitLookupRequest): PitTransitLookupResult {
  const series = seriesForPitData(request.series);
  const mappings = PIT_TRACK_MAPPINGS.filter((mapping) => {
    if (mapping.gameTrackId !== request.gameTrackId) return false;
    if (!yearMatches(mapping.startYear, mapping.endYear, request.year)) return false;
    return mapping.series === series || mapping.series === 'ALL';
  }).sort((a, b) => {
    const seriesScore = (b.series === series ? 4 : 0) - (a.series === series ? 4 : 0);
    if (seriesScore !== 0) return seriesScore;
    return boundedScore(b.startYear, b.endYear) - boundedScore(a.startYear, a.endYear);
  });

  const pitIds = mappings.length > 0 ? mappings.map((mapping) => mapping.pitDataTrackId) : [];
  const candidates = PIT_TRANSIT_DATA.filter((record) => {
    if (pitIds.length > 0 && !pitIds.includes(record.pitDataTrackId)) return false;
    if (pitIds.length === 0) return false;
    if (!yearMatches(record.startYear, record.endYear, request.year)) return false;
    return record.series === series || record.series === 'ALL';
  }).sort((a, b) => {
    const seriesScore = (b.series === series ? 4 : 0) - (a.series === series ? 4 : 0);
    if (seriesScore !== 0) return seriesScore;
    return boundedScore(b.startYear, b.endYear) - boundedScore(a.startYear, a.endYear);
  });

  const record = candidates[0];
  if (!record) return { kind: 'missing', reason: `No pit transit record for ${request.gameTrackId} ${series} ${request.year}` };
  return { kind: 'matched', record, mapping: mappings.find((mapping) => mapping.pitDataTrackId === record.pitDataTrackId) ?? null };
}

export function findPitRuleRecord(seriesValue: Series | string, year: number): PitRulesBySeriesEraRecord | null {
  const normalized = typeof seriesValue === 'string' ? normalizePitSeries(seriesValue) : seriesForPitData(seriesValue);
  if (!normalized || normalized === 'ALL') return null;
  return [...PIT_RULES_BY_SERIES_ERA]
    .filter((record) => record.series === normalized && yearMatches(record.startYear, record.endYear, year))
    .sort((a, b) => boundedScore(b.startYear, b.endYear) - boundedScore(a.startYear, a.endYear))[0] ?? null;
}
