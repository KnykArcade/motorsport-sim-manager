import { describe, it, expect, beforeAll } from 'vitest';
import { getMarketBundle, youthSigningCost, youthYearlyAcademyCost, preloadMarketBundle } from './index';

describe('youth market costs', () => {
  beforeAll(async () => {
    await Promise.all([
      preloadMarketBundle(1994, 'F1'),
      preloadMarketBundle(1996, 'F1'),
      preloadMarketBundle(1998, 'F1'),
      preloadMarketBundle(2000, 'F1'),
      preloadMarketBundle(2005, 'Champ Car'),
      preloadMarketBundle(2026, 'F1'),
      preloadMarketBundle(2026, 'IndyCar'),
    ]);
  });

  it('normalizes youth costs to a low, consistent $M scale across all seasons', () => {
    for (const [year, series] of [
      [1994, 'F1'],
      [1995, 'F1'],
      [1996, 'F1'],
      [1998, 'F1'],
      [2000, 'F1'],
      [2026, 'F1'],
      [2026, 'IndyCar'],
    ] as const) {
      const bundle = getMarketBundle(year, series);
      expect(bundle).toBeDefined();
      for (const y of bundle!.youth) {
        // Unproven prospects must be cheap: well under $0.2M either way.
        expect(y.signingCost).toBeGreaterThan(0);
        expect(y.signingCost).toBeLessThanOrEqual(0.16);
        expect(y.yearlyAcademyCost).toBeGreaterThan(0);
        expect(y.yearlyAcademyCost).toBeLessThanOrEqual(0.11);
      }
    }
  });

  it('loads one uncapped shared universe for every series in a year', () => {
    for (const [year, series] of [
      [1994, 'F1'],
      [2005, 'Champ Car'],
      [2026, 'IndyCar'],
    ] as const) {
      const bundle = getMarketBundle(year, series);
      expect(bundle).toBeDefined();
      expect(bundle!.drivers.length).toBeGreaterThan(0);
      expect(bundle!.youth.length).toBeGreaterThan(0);
      expect(getMarketBundle(year, 'F1')).toBe(getMarketBundle(year, series));
      const names = [...bundle!.drivers, ...bundle!.youth].map((entry) => entry.name
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim());
      expect(new Set(names).size).toBe(names.length);
      expect(bundle!.drivers.every((driver) => (driver.seriesPreferences?.length ?? 0) > 0)).toBe(true);
    }
  });

  it('scales cost with potential', () => {
    expect(youthSigningCost(90)).toBeGreaterThan(youthSigningCost(50));
    expect(youthYearlyAcademyCost(90)).toBeGreaterThan(youthYearlyAcademyCost(50));
  });
});
