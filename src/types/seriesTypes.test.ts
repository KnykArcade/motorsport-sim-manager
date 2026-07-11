import { describe, expect, it } from 'vitest';
import { normalizeGameSeries, normalizePitSeries, seriesForPitData } from './seriesTypes';

describe('series normalization', () => {
  it('normalizes ChampCar aliases deliberately', () => {
    expect(normalizePitSeries('ChampCar')).toBe('ChampCar');
    expect(normalizePitSeries('Champ Car')).toBe('ChampCar');
    expect(normalizeGameSeries('ChampCar')).toBe('Champ Car');
  });

  it('supports NASCAR as a central game series', () => {
    expect(normalizeGameSeries('NASCAR')).toBe('NASCAR');
    expect(seriesForPitData('NASCAR')).toBe('NASCAR');
  });
});
