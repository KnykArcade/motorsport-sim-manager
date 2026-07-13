import { describe, expect, it } from 'vitest';
import {
  OPEN_SERIES_INTEREST,
  preferredSeries,
  seriesPreferenceBonus,
  seriesPreferenceWeight,
} from './seriesPreferenceEngine';

const preferences = [
  { series: 'NASCAR' as const, weight: 100 },
  { series: 'IndyCar' as const, weight: 65 },
];

describe('seriesPreferenceEngine', () => {
  it('keeps every series open when no explicit preference exists', () => {
    expect(seriesPreferenceWeight(preferences, 'F1')).toBe(OPEN_SERIES_INTEREST);
    expect(seriesPreferenceBonus(preferences, 'F1')).toBeGreaterThan(-1);
  });

  it('rewards the preferred championship without making it eligibility', () => {
    expect(preferredSeries(preferences)).toBe('NASCAR');
    expect(seriesPreferenceBonus(preferences, 'NASCAR'))
      .toBeGreaterThan(seriesPreferenceBonus(preferences, 'IndyCar'));
    expect(seriesPreferenceBonus(preferences, 'IndyCar'))
      .toBeGreaterThan(seriesPreferenceBonus(preferences, 'F1'));
  });
});
