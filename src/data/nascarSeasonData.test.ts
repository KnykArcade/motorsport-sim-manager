import { describe, expect, it } from 'vitest';
import { getSeasonBundle } from './seasonData';
import { availableSeasons, availableSeries } from './seasonCatalog';

describe('playable NASCAR season data', () => {
  it('exposes NASCAR as a selectable series with playable historical and current seasons', () => {
    expect(availableSeries.some((series) => series.id === 'NASCAR')).toBe(true);
    for (const year of Array.from({ length: 37 }, (_, i) => 1990 + i)) {
      expect(availableSeasons).toContainEqual(expect.objectContaining({ year, series: 'NASCAR' }));
      const bundle = getSeasonBundle(year, 'NASCAR');
      expect(bundle?.season.series).toBe('NASCAR');
      expect(bundle?.season.calendar.length).toBeGreaterThan(0);
      expect(bundle?.teams.length).toBeGreaterThan(0);
      expect(bundle?.drivers.length).toBeGreaterThan(0);
      expect(bundle?.cars.length).toBeGreaterThan(0);
    }
  });
});
