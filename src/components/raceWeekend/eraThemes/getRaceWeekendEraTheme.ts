import type { Series } from '../../../types/gameTypes';

export type RaceWeekendEraTheme =
  | 'f1-1990s'
  | 'f1-2000s'
  | 'f1-2010s'
  | 'f1-2020s'
  | 'indycar-2008-2011'
  | 'indycar-2012-2017'
  | 'indycar-2018-2023'
  | 'indycar-modern'
  | 'fallback';

function isValidYear(year: number | undefined | null): year is number {
  return typeof year === 'number' && Number.isFinite(year);
}

export function getRaceWeekendEraTheme(
  series: Series | string | undefined | null,
  year: number | undefined | null,
): RaceWeekendEraTheme {
  if (!series || !isValidYear(year)) return 'fallback';

  if (series === 'F1') {
    if (year >= 1990 && year <= 1999) return 'f1-1990s';
    if (year >= 2000 && year <= 2009) return 'f1-2000s';
    if (year >= 2010 && year <= 2019) return 'f1-2010s';
    if (year >= 2020 && year <= 2026) return 'f1-2020s';
    return 'fallback';
  }

  if (series === 'IndyCar') {
    if (year >= 2008 && year <= 2011) return 'indycar-2008-2011';
    if (year >= 2012 && year <= 2017) return 'indycar-2012-2017';
    if (year >= 2018 && year <= 2023) return 'indycar-2018-2023';
    if (year >= 2024 && year <= 2026) return 'indycar-modern';
  }

  return 'fallback';
}

export function shouldUseF11990sRaceWeekendHub(
  series: Series | string | undefined | null,
  year: number | undefined | null,
): boolean {
  return getRaceWeekendEraTheme(series, year) === 'f1-1990s';
}
