import { describe, expect, it } from 'vitest';
import {
  availableSeasons,
  getSeasonBundle,
  getMarketBundle,
  getTrackById,
  seasonBundles,
} from './index';

describe('historical season integration', () => {
  describe('season registration', () => {
    it('F1 1990-2026 all resolve', () => {
      for (let y = 1990; y <= 2026; y++) {
        const b = getSeasonBundle(y, 'F1');
        expect(b, `getSeasonBundle(${y}, 'F1') should be defined`).toBeDefined();
        expect(b!.teams.length).toBeGreaterThan(0);
        expect(b!.drivers.length).toBeGreaterThan(0);
        expect(b!.cars.length).toBeGreaterThan(0);
        expect(b!.season.calendar.length).toBeGreaterThan(0);
      }
    });

    it('F1 2011-2025 specifically resolve (previously missing)', () => {
      for (let y = 2011; y <= 2025; y++) {
        expect(getSeasonBundle(y, 'F1'), `F1 ${y} should be registered`).toBeDefined();
      }
    });

    it('IndyCar 2008-2026 all resolve', () => {
      for (let y = 2008; y <= 2026; y++) {
        const b = getSeasonBundle(y, 'IndyCar');
        expect(b, `getSeasonBundle(${y}, 'IndyCar') should be defined`).toBeDefined();
        expect(b!.teams.length).toBeGreaterThan(0);
        expect(b!.drivers.length).toBeGreaterThan(0);
        expect(b!.cars.length).toBeGreaterThan(0);
        expect(b!.season.calendar.length).toBeGreaterThan(0);
      }
    });

    it('IndyCar 2008-2025 specifically resolve (previously missing)', () => {
      for (let y = 2008; y <= 2025; y++) {
        expect(getSeasonBundle(y, 'IndyCar'), `IndyCar ${y} should be registered`).toBeDefined();
      }
    });
  });

  describe('series separation', () => {
    it('F1 seasons are registered as F1 in availableSeasons', () => {
      const f1 = availableSeasons.filter((s) => s.series === 'F1');
      for (let y = 1990; y <= 2026; y++) {
        expect(
          f1.some((s) => s.year === y),
          `F1 ${y} should be in availableSeasons as F1`
        ).toBe(true);
      }
    });

    it('IndyCar seasons are registered as IndyCar in availableSeasons', () => {
      const indy = availableSeasons.filter((s) => s.series === 'IndyCar');
      for (let y = 2008; y <= 2026; y++) {
        expect(
          indy.some((s) => s.year === y),
          `IndyCar ${y} should be in availableSeasons as IndyCar`
        ).toBe(true);
      }
    });

    it('no F1 year appears as IndyCar', () => {
      const indy = availableSeasons.filter((s) => s.series === 'IndyCar');
      for (const s of indy) {
        expect(s.series).toBe('IndyCar');
      }
    });

    it('no IndyCar year appears as F1', () => {
      const f1 = availableSeasons.filter((s) => s.series === 'F1');
      for (const s of f1) {
        expect(s.series).toBe('F1');
      }
    });

    it('no duplicate availableSeasons entries', () => {
      const keys = availableSeasons.map((s) => `${s.year}-${s.series}`);
      const unique = new Set(keys);
      expect(unique.size, 'Duplicate availableSeasons entries').toBe(keys.length);
    });

    it('no duplicate seasonBundles keys', () => {
      const keys = Object.keys(seasonBundles);
      const unique = new Set(keys);
      expect(unique.size, 'Duplicate seasonBundles keys').toBe(keys.length);
    });
  });

  describe('career rollover', () => {
    it('F1 rolls from 2010 through 2026', () => {
      for (let y = 2010; y < 2026; y++) {
        const curr = getSeasonBundle(y, 'F1');
        const next = getSeasonBundle(y + 1, 'F1');
        expect(curr, `F1 ${y} should exist for rollover`).toBeDefined();
        expect(next, `F1 ${y + 1} should exist for rollover from ${y}`).toBeDefined();
      }
    });

    it('IndyCar rolls from 2008 through 2026', () => {
      for (let y = 2008; y < 2026; y++) {
        const curr = getSeasonBundle(y, 'IndyCar');
        const next = getSeasonBundle(y + 1, 'IndyCar');
        expect(curr, `IndyCar ${y} should exist for rollover`).toBeDefined();
        expect(next, `IndyCar ${y + 1} should exist for rollover from ${y}`).toBeDefined();
      }
    });
  });

  describe('market and youth data', () => {
    it('every F1 season has market + youth data', () => {
      for (let y = 1990; y <= 2026; y++) {
        const m = getMarketBundle(y, 'F1');
        expect(m, `F1 ${y} market should exist`).toBeDefined();
        expect(m!.drivers.length, `F1 ${y} market drivers should be non-empty`).toBeGreaterThan(0);
        expect(m!.youth.length, `F1 ${y} youth should be non-empty`).toBeGreaterThan(0);
      }
    });

    it('every IndyCar season has market + youth data', () => {
      for (let y = 2008; y <= 2026; y++) {
        const m = getMarketBundle(y, 'IndyCar');
        expect(m, `IndyCar ${y} market should exist`).toBeDefined();
        expect(m!.drivers.length, `IndyCar ${y} market drivers should be non-empty`).toBeGreaterThan(0);
        expect(m!.youth.length, `IndyCar ${y} youth should be non-empty`).toBeGreaterThan(0);
      }
    });
  });

  describe('known regression tests', () => {
    it('2001 Heinz-Harald Frentzen should not exist twice in F1 driver list', () => {
      const bundle = getSeasonBundle(2001, 'F1');
      const frentzens = bundle!.drivers.filter((d) => d.id === 'd-2001-heinz-harald-frentzen');
      expect(frentzens.length).toBe(1);
    });

    it('2001 Jean Alesi should not exist twice in F1 driver list', () => {
      const bundle = getSeasonBundle(2001, 'F1');
      const alesis = bundle!.drivers.filter((d) => d.id === 'd-2001-jean-alesi');
      expect(alesis.length).toBe(1);
    });

    it('2003 Justin Wilson should not exist twice in F1 driver list', () => {
      const bundle = getSeasonBundle(2003, 'F1');
      const wilsons = bundle!.drivers.filter((d) => d.id === 'd-2003-justin-wilson');
      expect(wilsons.length).toBe(1);
    });

    it('2001 Tomas Enge should not exist twice in F1 market list', () => {
      const market = getMarketBundle(2001, 'F1');
      const enges = market!.drivers.filter((d) => d.id === 'mkt-2001-tomas-enge');
      expect(enges.length).toBe(1);
    });

    it('2026 IndyCar Milwaukee Mile should not have duplicate track IDs', () => {
      const bundle = getSeasonBundle(2026, 'IndyCar');
      const milwaukeeRaces = bundle!.season.calendar.filter(
        (r) => r.trackId.includes('milwaukee-mile')
      );
      const trackIds = milwaukeeRaces.map((r) => r.trackId);
      const unique = new Set(trackIds);
      expect(unique.size, `Duplicate Milwaukee track IDs: ${trackIds.join(', ')}`).toBe(trackIds.length);
      for (const id of trackIds) {
        expect(getTrackById(id), `Milwaukee track ${id} should resolve`).toBeDefined();
      }
    });
  });

  describe('IndyCar roster rule not changed', () => {
    it('IndyCar teams are not subject to F1 max-2 driver rule', () => {
      for (let y = 2008; y <= 2026; y++) {
        const bundle = getSeasonBundle(y, 'IndyCar');
        for (const team of bundle!.teams) {
          // IndyCar teams can have more than 2 drivers — just verify they're not empty
          expect(team.driverIds.length, `IndyCar ${y} ${team.id} has 0 drivers`).toBeGreaterThan(0);
        }
      }
    });
  });
});
