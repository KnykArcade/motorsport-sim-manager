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
  _series: Series | string | undefined | null,
  _year: number | undefined | null,
): boolean {
  void _series;
  void _year;
  return true;
}
