import { getRaceWeekendEraTheme } from '../../../components/raceWeekend/eraThemes/getRaceWeekendEraTheme';
import type { Series } from '../../../types/gameTypes';
import type { MotorsportEraTheme } from '../../../theme/eraTheme';

export type LiveRaceEraTheme = MotorsportEraTheme;

export function getLiveRaceEraTheme(
  series: Series | string | undefined | null,
  year: number | undefined | null,
): LiveRaceEraTheme {
  return getRaceWeekendEraTheme(series, year);
}

export function shouldUseF11990sLiveRaceScreen(
  series: Series | string | undefined | null,
  year: number | undefined | null,
): boolean {
  return getLiveRaceEraTheme(series, year) === 'f1-1990s';
}
