import { describe, it, expect } from 'vitest';
import { hasLazyLoader, lazyGetSeasonBundle, preloadSeasonBundle } from './lazySeasonData';

describe('lazySeasonData', () => {
  describe('hasLazyLoader', () => {
    it('returns true for 1990 F1', () => {
      expect(hasLazyLoader(1990, 'F1')).toBe(true);
    });
    it('returns true for 2000 F1', () => {
      expect(hasLazyLoader(2000, 'F1')).toBe(true);
    });
    it('returns false for seasons without lazy loaders', () => {
      expect(hasLazyLoader(2026, 'F1')).toBe(false);
    });
    it('returns false for IndyCar seasons', () => {
      expect(hasLazyLoader(2024, 'IndyCar')).toBe(false);
    });
  });

  describe('lazyGetSeasonBundle', () => {
    it('loads a season bundle asynchronously', async () => {
      const bundle = await lazyGetSeasonBundle(1995, 'F1');
      expect(bundle).toBeDefined();
      expect(bundle!.season).toBeDefined();
      expect(bundle!.teams.length).toBeGreaterThan(0);
      expect(bundle!.drivers.length).toBeGreaterThan(0);
      expect(bundle!.cars.length).toBeGreaterThan(0);
    });

    it('returns undefined for seasons without loaders', async () => {
      const bundle = await lazyGetSeasonBundle(2026, 'F1');
      expect(bundle).toBeUndefined();
    });

    it('caches results for repeated calls', async () => {
      const first = await lazyGetSeasonBundle(1990, 'F1');
      const second = await lazyGetSeasonBundle(1990, 'F1');
      expect(first).toBe(second);
    });
  });

  describe('preloadSeasonBundle', () => {
    it('does not throw for valid seasons', () => {
      expect(() => preloadSeasonBundle(1991, 'F1')).not.toThrow();
    });
    it('does not throw for seasons without loaders', () => {
      expect(() => preloadSeasonBundle(2026, 'IndyCar')).not.toThrow();
    });
  });
});
