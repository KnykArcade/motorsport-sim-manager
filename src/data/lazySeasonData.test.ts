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
    it('returns true for 2026 F1', () => {
      expect(hasLazyLoader(2026, 'F1')).toBe(true);
    });
    it('returns true for 2024 IndyCar', () => {
      expect(hasLazyLoader(2024, 'IndyCar')).toBe(true);
    });
    it('returns false for seasons outside the range', () => {
      expect(hasLazyLoader(1989, 'F1')).toBe(false);
      expect(hasLazyLoader(2027, 'F1')).toBe(false);
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
      const bundle = await lazyGetSeasonBundle(1989, 'F1');
      expect(bundle).toBeUndefined();
    });

    it('caches results for repeated calls', async () => {
      const first = await lazyGetSeasonBundle(1990, 'F1');
      const second = await lazyGetSeasonBundle(1990, 'F1');
      expect(first).toBe(second);
    });
  });

  describe('preloadSeasonBundle', () => {
    it('does not throw for valid seasons', async () => {
      preloadSeasonBundle(1991, 'F1');
      // Await the preload to complete so it doesn't resolve after teardown
      await lazyGetSeasonBundle(1991, 'F1');
    });
    it('does not throw for seasons without loaders', () => {
      expect(() => preloadSeasonBundle(1989, 'F1')).not.toThrow();
    });
  });
});
