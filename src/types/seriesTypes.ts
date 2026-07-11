import type { Series } from './gameTypes';

export type CanonicalSeries = 'F1' | 'IndyCar' | 'CART' | 'Champ Car' | 'NASCAR';
export type PitDataSeries = CanonicalSeries | 'ChampCar' | 'ALL';
export type NormalizedPitSeries = 'F1' | 'IndyCar' | 'CART' | 'ChampCar' | 'NASCAR' | 'ALL';

const SERIES_ALIASES: Record<string, NormalizedPitSeries> = {
  f1: 'F1',
  formula1: 'F1',
  formulaone: 'F1',
  indycar: 'IndyCar',
  indy: 'IndyCar',
  irl: 'IndyCar',
  cart: 'CART',
  champcar: 'ChampCar',
  champ: 'ChampCar',
  champcarworldseries: 'ChampCar',
  nascar: 'NASCAR',
  cup: 'NASCAR',
  all: 'ALL',
};

function key(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function normalizePitSeries(value: string): NormalizedPitSeries | null {
  return SERIES_ALIASES[key(value)] ?? null;
}

export function normalizeGameSeries(value: string): Series | null {
  const normalized = normalizePitSeries(value);
  if (!normalized || normalized === 'ALL') return null;
  return normalized === 'ChampCar' ? 'Champ Car' : normalized;
}

export function isGameSeries(value: string): value is Series {
  return normalizeGameSeries(value) === value;
}

export function seriesForPitData(series: Series): Exclude<NormalizedPitSeries, 'ALL'> {
  return series === 'Champ Car' ? 'ChampCar' : series;
}
