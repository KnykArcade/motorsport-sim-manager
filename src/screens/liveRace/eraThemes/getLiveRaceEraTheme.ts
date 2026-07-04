import { getRaceWeekendEraTheme } from '../../../components/raceWeekend/eraThemes/getRaceWeekendEraTheme';
import type { Series } from '../../../types/gameTypes';

export type LiveRaceEraTheme =
  | 'f1-1990s'
  | 'f1-2000s'
  | 'f1-2010s'
  | 'f1-2020s'
  | 'indycar-2008-2011'
  | 'indycar-2012-2017'
  | 'indycar-2018-2023'
  | 'indycar-modern'
  | 'fallback';

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
