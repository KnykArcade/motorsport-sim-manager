import type { Series } from '../types/gameTypes';
import type { SeriesPreference } from '../types/marketTypes';

// No preference is an exclusion. A driver without an explicit link to the
// offering championship remains open to it, but treats it as a weaker fit.
export const OPEN_SERIES_INTEREST = 45;

export function seriesPreferenceWeight(
  preferences: SeriesPreference[] | undefined,
  series: Series,
): number {
  return preferences?.find((preference) => preference.series === series)?.weight
    ?? OPEN_SERIES_INTEREST;
}

export function preferredSeries(
  preferences: SeriesPreference[] | undefined,
): Series | undefined {
  return [...(preferences ?? [])]
    .sort((left, right) => right.weight - left.weight || left.series.localeCompare(right.series))[0]
    ?.series;
}

// A preference nudges AI selection without making any driver unavailable.
// Preferred-series candidates gain up to 7.5 rating-equivalent points; an
// unrelated series is still viable when talent, cost, or team fit is stronger.
export function seriesPreferenceBonus(
  preferences: SeriesPreference[] | undefined,
  series: Series,
): number {
  return (seriesPreferenceWeight(preferences, series) - 50) * 0.15;
}
