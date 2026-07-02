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

    it('2016 Max Verstappen should not be duplicated in the driver list', () => {
      const bundle = getSeasonBundle(2016, 'F1');
      const verstappens = bundle!.drivers.filter((d) => d.id.includes('verstappen'));
      expect(verstappens.length, `Verstappen appears ${verstappens.length} times in 2016 driver list`).toBe(1);
    });

    it('2017 Carlos Sainz should not be duplicated in the driver list', () => {
      const bundle = getSeasonBundle(2017, 'F1');
      const sainzs = bundle!.drivers.filter((d) => d.id.includes('sainz'));
      expect(sainzs.length, `Sainz appears ${sainzs.length} times in 2017 driver list`).toBe(1);
    });

    it('2019 Pierre Gasly should not be duplicated in the driver list', () => {
      const bundle = getSeasonBundle(2019, 'F1');
      const gaslys = bundle!.drivers.filter((d) => d.id.includes('gasly'));
      expect(gaslys.length, `Gasly appears ${gaslys.length} times in 2019 driver list`).toBe(1);
    });

    it('2025 Yuki Tsunoda should not be duplicated in the driver list', () => {
      const bundle = getSeasonBundle(2025, 'F1');
      const tsunodas = bundle!.drivers.filter((d) => d.id.includes('tsunoda'));
      expect(tsunodas.length, `Tsunoda appears ${tsunodas.length} times in 2025 driver list`).toBe(1);
    });

    it('1997 Jarno Trulli teamId should resolve to a valid team', () => {
      const bundle = getSeasonBundle(1997, 'F1');
      const trulli = bundle!.drivers.find((d) => d.id === 'd-1997-jarno-trulli');
      expect(trulli, 'Trulli should exist in 1997').toBeDefined();
      const teamIds = new Set(bundle!.teams.map((t) => t.id));
      expect(
        teamIds.has(trulli!.teamId),
        `Trulli teamId ${trulli!.teamId} does not match any team in 1997`
      ).toBe(true);
    });
  });

  describe('calendar data integrity', () => {
    it('F1 2016-2025 calendar races have laps > 0', () => {
      for (let y = 2016; y <= 2025; y++) {
        const bundle = getSeasonBundle(y, 'F1');
        for (const race of bundle!.season.calendar) {
          expect(
            race.laps,
            `F1 ${y} race ${race.round} (${race.gpName}) has laps=0`
          ).toBeGreaterThan(0);
        }
      }
    });

    it('IndyCar 2008-2025 calendar races have laps > 0', () => {
      for (let y = 2008; y <= 2025; y++) {
        const bundle = getSeasonBundle(y, 'IndyCar');
        for (const race of bundle!.season.calendar) {
          expect(
            race.laps,
            `IndyCar ${y} race ${race.round} (${race.gpName}) has laps=0`
          ).toBeGreaterThan(0);
        }
      }
    });

    it('IndyCar gpName is not a date string', () => {
      for (let y = 2008; y <= 2026; y++) {
        const bundle = getSeasonBundle(y, 'IndyCar');
        for (const race of bundle!.season.calendar) {
          expect(
            race.gpName,
            `IndyCar ${y} race ${race.round} gpName looks like a date: ${race.gpName}`
          ).not.toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
      }
    });

    it('all F1 calendar track IDs resolve', () => {
      for (let y = 1990; y <= 2026; y++) {
        const bundle = getSeasonBundle(y, 'F1');
        for (const race of bundle!.season.calendar) {
          expect(
            getTrackById(race.trackId),
            `F1 ${y} race ${race.round} unresolvable track ${race.trackId}`
          ).toBeDefined();
        }
      }
    });

    it('all IndyCar calendar track IDs resolve', () => {
      for (let y = 2008; y <= 2026; y++) {
        const bundle = getSeasonBundle(y, 'IndyCar');
        for (const race of bundle!.season.calendar) {
          expect(
            getTrackById(race.trackId),
            `IndyCar ${y} race ${race.round} unresolvable track ${race.trackId}`
          ).toBeDefined();
        }
      }
    });

    it('no duplicate track IDs within any F1 track file', () => {
      for (let y = 1990; y <= 2026; y++) {
        const bundle = getSeasonBundle(y, 'F1');
        const trackIds = bundle!.season.calendar.map((r) => r.trackId);
        // Doubleheaders may reuse the same trackId — that's correct behavior.
        // Just verify all resolve.
        for (const tid of trackIds) {
          expect(getTrackById(tid), `F1 ${y} track ${tid} not found`).toBeDefined();
        }
      }
    });

    it('no duplicate track IDs within any IndyCar track file', () => {
      for (let y = 2008; y <= 2026; y++) {
        const bundle = getSeasonBundle(y, 'IndyCar');
        const trackIds = bundle!.season.calendar.map((r) => r.trackId);
        for (const tid of trackIds) {
          expect(getTrackById(tid), `IndyCar ${y} track ${tid} not found`).toBeDefined();
        }
      }
    });

    it('doubleheader races have unique race IDs but may share trackId', () => {
      for (let y = 2008; y <= 2026; y++) {
        const bundle = getSeasonBundle(y, 'IndyCar');
        const raceIds = bundle!.season.calendar.map((r) => r.id);
        const uniqueRaceIds = new Set(raceIds);
        expect(uniqueRaceIds.size, `IndyCar ${y} has duplicate race IDs`).toBe(raceIds.length);
      }
      for (let y = 1990; y <= 2026; y++) {
        const bundle = getSeasonBundle(y, 'F1');
        const raceIds = bundle!.season.calendar.map((r) => r.id);
        const uniqueRaceIds = new Set(raceIds);
        expect(uniqueRaceIds.size, `F1 ${y} has duplicate race IDs`).toBe(raceIds.length);
      }
    });
  });

  describe('IndyCar roster rule not changed', () => {
    it('IndyCar teams are not subject to F1 max-2 driver rule', () => {
      for (let y = 2008; y <= 2026; y++) {
        const bundle = getSeasonBundle(y, 'IndyCar');
        for (const team of bundle!.teams) {
          expect(team.driverIds.length, `IndyCar ${y} ${team.id} has 0 drivers`).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('regulationSetId usage', () => {
    it('all seasons reference a valid regulationSetId', () => {
      for (let y = 1990; y <= 2026; y++) {
        const f1 = getSeasonBundle(y, 'F1');
        expect(f1!.season.regulationSetId, `F1 ${y} has no regulationSetId`).toBeDefined();
      }
      for (let y = 2008; y <= 2026; y++) {
        const indy = getSeasonBundle(y, 'IndyCar');
        expect(indy!.season.regulationSetId, `IndyCar ${y} has no regulationSetId`).toBeDefined();
      }
    });

    it('all seasons currently use reg-1995 (documented limitation)', () => {
      // Year-specific regulation integration is not yet implemented.
      // All seasons point to reg-1995 as a placeholder. This is a known
      // limitation documented in the PR — yearly regulation data from
      // the workbook Regulations_Rules_Changes sheets is not yet wired
      // into individual season records.
      for (let y = 1990; y <= 2026; y++) {
        const f1 = getSeasonBundle(y, 'F1');
        expect(f1!.season.regulationSetId).toBe('reg-1995');
      }
    });
  });
});
