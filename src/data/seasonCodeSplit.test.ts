import { describe, expect, it } from 'vitest';
import {
  availableSeasons,
  loadSeasonBundle,
  getCachedBundle,
  hasSeasonLoader,
  getLoaderKeys,
  preloadSeasonBundle,
  hasSeason,
  availableSeries,
  getTrackById,
} from './index';

describe('season code-splitting', () => {
  describe('season catalog (lightweight, no heavy data)', () => {
    it('exposes all 86 seasons (37 F1 + 31 IndyCar + 14 CART + 4 Champ Car)', () => {
      const f1 = availableSeasons.filter((s) => s.series === 'F1');
      const indy = availableSeasons.filter((s) => s.series === 'IndyCar');
      const cart = availableSeasons.filter((s) => s.series === 'CART');
      const champCar = availableSeasons.filter((s) => s.series === 'Champ Car');
      expect(f1.length).toBe(37);
      expect(indy.length).toBe(31);
      expect(cart.length).toBe(14);
      expect(champCar.length).toBe(4);
      expect(availableSeasons.length).toBe(86);
    });

    it('exposes available series', () => {
      expect(availableSeries.length).toBe(4);
      expect(availableSeries.map((s) => s.id).sort()).toEqual(['CART', 'Champ Car', 'F1', 'IndyCar']);
    });

    it('hasSeason checks catalog membership', () => {
      expect(hasSeason(1995, 'F1')).toBe(true);
      expect(hasSeason(2026, 'IndyCar')).toBe(true);
      expect(hasSeason(1989, 'F1')).toBe(false);
      expect(hasSeason(2027, 'F1')).toBe(false);
    });
  });

  describe('season loader (async, code-split)', () => {
    it('has loaders for all 86 seasons', () => {
      expect(getLoaderKeys().length).toBe(86);
    });

    it('hasSeasonLoader matches catalog', () => {
      for (const s of availableSeasons) {
        expect(hasSeasonLoader(s.year, s.series), `${s.year} ${s.series}`).toBe(true);
      }
    });

    it('returns false for out-of-range seasons', () => {
      expect(hasSeasonLoader(1989, 'F1')).toBe(false);
      expect(hasSeasonLoader(2027, 'F1')).toBe(false);
      expect(hasSeasonLoader(1995, 'IndyCar')).toBe(false);
    });

    it('loadSeasonBundle loads a bundle asynchronously', async () => {
      const bundle = await loadSeasonBundle(1995, 'F1');
      expect(bundle).toBeDefined();
      expect(bundle!.season).toBeDefined();
      expect(bundle!.teams.length).toBeGreaterThan(0);
      expect(bundle!.drivers.length).toBeGreaterThan(0);
      expect(bundle!.cars.length).toBeGreaterThan(0);
    });

    it('caches loaded bundles (getCachedBundle returns cached)', async () => {
      await loadSeasonBundle(1990, 'F1');
      const cached = getCachedBundle(1990, 'F1');
      expect(cached).toBeDefined();
      expect(cached!.season).toBeDefined();
    });

    it('getCachedBundle returns undefined for unloaded seasons', () => {
      expect(getCachedBundle(1989, 'F1')).toBeUndefined();
    });

    it('loadSeasonBundle returns undefined for non-existent seasons', async () => {
      const bundle = await loadSeasonBundle(1989, 'F1');
      expect(bundle).toBeUndefined();
    });

    it('preloadSeasonBundle does not throw', () => {
      expect(() => preloadSeasonBundle(1991, 'F1')).not.toThrow();
      expect(() => preloadSeasonBundle(1989, 'F1')).not.toThrow();
    });

    it('registers tracks when loading a bundle', async () => {
      await loadSeasonBundle(2000, 'F1');
      const season = getCachedBundle(2000, 'F1')!.season;
      const firstTrackId = season.calendar[0].trackId;
      const track = getTrackById(firstTrackId);
      expect(track).toBeDefined();
      expect(track!.id).toBe(firstTrackId);
    });
  });

  describe('lazySeasonData backward compatibility', () => {
    it('re-exports hasLazyLoader, lazyGetSeasonBundle, preloadSeasonBundle', async () => {
      const mod = await import('./lazySeasonData');
      expect(typeof mod.hasLazyLoader).toBe('function');
      expect(typeof mod.lazyGetSeasonBundle).toBe('function');
      expect(typeof mod.preloadSeasonBundle).toBe('function');
    });

    it('hasLazyLoader matches hasSeasonLoader', async () => {
      const mod = await import('./lazySeasonData');
      expect(mod.hasLazyLoader(1995, 'F1')).toBe(true);
      expect(mod.hasLazyLoader(1989, 'F1')).toBe(false);
    });
  });
});
