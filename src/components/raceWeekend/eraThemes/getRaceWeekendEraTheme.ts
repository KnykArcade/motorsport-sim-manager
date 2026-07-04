import type { Series } from '../../../types/gameTypes';
import { getEraTheme, type MotorsportEraTheme } from '../../../theme/eraTheme';

export type RaceWeekendEraTheme = MotorsportEraTheme;

export function getRaceWeekendEraTheme(
  series: Series | string | undefined | null,
  year: number | undefined | null,
): RaceWeekendEraTheme {
  return getEraTheme(series, year);
}

export function shouldUseF11990sRaceWeekendHub(
  series: Series | string | undefined | null,
  year: number | undefined | null,
): boolean {
  return getRaceWeekendEraTheme(series, year) === 'f1-1990s';
}
