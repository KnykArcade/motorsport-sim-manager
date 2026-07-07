import { describe, expect, it, beforeAll } from 'vitest';
import { availableSeasons, getTrackById, getMarketBundle, preloadMarketBundle } from './index';
import { getSeasonBundle } from './seasonData';
import { pointsSystems } from './pointsSystems/pointsSystems';

describe('season bundles', () => {
  beforeAll(async () => {
    await Promise.all(
      availableSeasons.map((s) => preloadMarketBundle(s.year, s.series))
    );
  });

  it('exposes more than one startable season', () => {
    expect(availableSeasons.length).toBeGreaterThan(1);
  });

  for (const s of availableSeasons) {
    describe(`${s.year} ${s.series}`, () => {
      const bundle = getSeasonBundle(s.year, s.series);

      it('is registered with a non-empty grid', () => {
        expect(bundle).toBeDefined();
        expect(bundle!.teams.length).toBeGreaterThan(0);
        expect(bundle!.drivers.length).toBeGreaterThan(0);
        expect(bundle!.cars.length).toBe(bundle!.teams.length);
      });

      it('links every team to a car and resolvable drivers', () => {
        const driverIds = new Set(bundle!.drivers.map((d) => d.id));
        for (const team of bundle!.teams) {
          expect(bundle!.cars.find((c) => c.id === team.carId)).toBeDefined();
          for (const id of team.driverIds) expect(driverIds.has(id)).toBe(true);
        }
      });

      it('resolves every calendar track', () => {
        expect(bundle!.season.calendar.length).toBeGreaterThan(0);
        for (const race of bundle!.season.calendar) {
          expect(getTrackById(race.trackId)).toBeDefined();
        }
      });

      it('references a registered points system', () => {
        expect(pointsSystems[bundle!.season.pointsSystemId]).toBeDefined();
      });

      it('uses the sim 1-100 scale for every car rating', () => {
        for (const c of bundle!.cars) {
          for (const [key, value] of Object.entries(c.ratings)) {
            expect(value, `${c.id} ${key}=${value}`).toBeGreaterThanOrEqual(0);
            expect(value, `${c.id} ${key}=${value}`).toBeLessThanOrEqual(100);
          }
        }
      });

      it('has a market + youth pool', () => {
        const market = getMarketBundle(s.year, s.series);
        expect(market).toBeDefined();
        expect(market!.drivers.length).toBeGreaterThan(0);
        expect(market!.youth.length).toBeGreaterThan(0);
      });
    });
  }
});
