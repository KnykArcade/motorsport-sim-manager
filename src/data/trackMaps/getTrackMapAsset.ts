import { TRACK_MAP_GEOMETRIES, type TrackMapGeometry } from './trackMapGeometry';

export type TrackMapAssetRequest = {
  series?: string;
  year?: number;
  trackId?: string;
  trackName?: string;
};

export type TrackMapAssetMatch = {
  geometry: TrackMapGeometry;
  matchType: 'exact-id' | 'exact-name' | 'nearest-name';
};

const YEAR_SUFFIX_RE = /(?:-|_)?(?:19|20)\d{2}(?:indycar)?$/i;
const STOP_WORDS = new Set([
  'a',
  'and',
  'autodrome',
  'autodromo',
  'circuit',
  'course',
  'de',
  'del',
  'di',
  'do',
  'gp',
  'grand',
  'international',
  'park',
  'prix',
  'raceway',
  'racing',
  'ring',
  'street',
  'streets',
  'the',
]);

export function getTrackMapAsset(request: TrackMapAssetRequest): TrackMapAssetMatch | null {
  const series = normalizeSeries(request.series);
  if (!series || !request.year) return null;
  const year = request.year;

  const candidates = TRACK_MAP_GEOMETRIES.filter((geometry) => normalizeSeries(geometry.series) === series);
  if (candidates.length === 0) return null;

  const idKey = normalizeTrackKey(request.trackId);
  const nameKey = normalizeTrackKey(request.trackName);

  const exactId = idKey
    ? nearestByYear(candidates.filter((geometry) => candidateKeys(geometry).includes(idKey)), year)
    : null;
  if (exactId) return { geometry: exactId, matchType: 'exact-id' };

  const exactName = nameKey
    ? nearestByYear(candidates.filter((geometry) => candidateKeys(geometry).includes(nameKey)), year)
    : null;
  if (exactName) return { geometry: exactName, matchType: 'exact-name' };

  const inputTokens = unique([...tokensFor(request.trackId), ...tokensFor(request.trackName)]);
  if (inputTokens.length === 0) return null;

  const scored = candidates
    .map((geometry) => ({
      geometry,
      score: similarity(inputTokens, unique([...tokensFor(geometry.id), ...tokensFor(geometry.name), ...tokensFor(geometry.eventName)])),
    }))
    .filter((entry) => entry.score >= 0.55)
    .sort((a, b) => b.score - a.score || Math.abs(a.geometry.year - year) - Math.abs(b.geometry.year - year));

  const bestScore = scored[0]?.score;
  if (bestScore === undefined) return null;
  return {
    geometry: nearestByYear(
      scored.filter((entry) => entry.score === bestScore).map((entry) => entry.geometry),
      year,
    )!,
    matchType: 'nearest-name',
  };
}

export function normalizeTrackKey(value?: string): string {
  if (!value) return '';
  return stripYear(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function stripYear(value: string): string {
  return value.replace(YEAR_SUFFIX_RE, '');
}

function normalizeSeries(series?: string): string {
  const key = series?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? '';
  if (key === 'f1' || key === 'formula1') return 'f1';
  if (key === 'indycar' || key === 'indy') return 'indycar';
  return key;
}

function candidateKeys(geometry: TrackMapGeometry): string[] {
  return unique([
    normalizeTrackKey(geometry.id),
    normalizeTrackKey(geometry.name),
    normalizeTrackKey(geometry.eventName),
    normalizeTrackKey(geometry.svgFile.replace(/\.svg$/i, '')),
  ]);
}

function tokensFor(value?: string): string[] {
  return normalizeTrackKey(value)
    .split('-')
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function similarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const bSet = new Set(b);
  const overlap = a.filter((token) => bSet.has(token)).length;
  return overlap / Math.max(a.length, b.length);
}

function nearestByYear(geometries: readonly TrackMapGeometry[], year: number): TrackMapGeometry | null {
  if (geometries.length === 0) return null;
  return [...geometries].sort((a, b) => Math.abs(a.year - year) - Math.abs(b.year - year) || a.year - b.year)[0];
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values.filter(Boolean))];
}
