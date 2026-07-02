import { describe, it, expect } from 'vitest';
import { getMarketBundle, youthSigningCost, youthYearlyAcademyCost } from './index';

describe('youth market costs', () => {
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

  it('scales cost with potential', () => {
    expect(youthSigningCost(9)).toBeGreaterThan(youthSigningCost(5));
    expect(youthYearlyAcademyCost(9)).toBeGreaterThan(youthYearlyAcademyCost(5));
  });
});
