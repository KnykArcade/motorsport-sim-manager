import { describe, expect, it } from 'vitest';
import { availableSeasons, getSeasonBundle, getMarketBundle, getTrackById } from './index';

const f1Seasons = availableSeasons.filter((s) => s.series === 'F1');

describe('F1 roster validation', () => {
  it('has F1 seasons to validate', () => {
    expect(f1Seasons.length).toBeGreaterThan(0);
  });

  for (const s of f1Seasons) {
    describe(`${s.year} F1`, () => {
      const bundle = getSeasonBundle(s.year, 'F1');
      const market = getMarketBundle(s.year, 'F1');

      // ── Preseason roster rules (save creation) ──
      it('every team has 0-3 assigned drivers at preseason', () => {
        for (const team of bundle!.teams) {
          expect(
            team.driverIds.length,
            `${team.id} has ${team.driverIds.length} drivers (must be 0-3)`
          ).toBeLessThanOrEqual(3);
        }
      });

      it('teams with fewer than 2 drivers are allowed (historical edge cases)', () => {
        for (const team of bundle!.teams) {
          if (team.driverIds.length < 2) {
            expect(team.driverIds.length).toBeGreaterThanOrEqual(0);
          }
        }
      });

      it('no team starts with more than 3 assigned drivers', () => {
        for (const team of bundle!.teams) {
          expect(
            team.driverIds.length,
            `${team.id} has ${team.driverIds.length} drivers`
          ).toBeLessThanOrEqual(3);
        }
      });

      it('no duplicate driver IDs within the same team roster', () => {
        for (const team of bundle!.teams) {
          const ids = team.driverIds;
          const unique = new Set(ids);
          expect(
            unique.size,
            `${team.id} has duplicate driverIds: ${ids.join(', ')}`
          ).toBe(ids.length);
        }
      });

      it('no driver is assigned as a starting race driver to more than 1 F1 team', () => {
        const driverToTeams = new Map<string, string[]>();
        for (const team of bundle!.teams) {
          for (const did of team.driverIds) {
            const teams = driverToTeams.get(did) || [];
            teams.push(team.id);
            driverToTeams.set(did, teams);
          }
        }
        for (const [did, teams] of driverToTeams) {
          // A driver may only be on 1 starting team. Mid-season swaps belong
          // in race entrant history / market context, not starting rosters.
          expect(
            teams.length,
            `Driver ${did} assigned to ${teams.length} starting teams: ${teams.join(', ')}`
          ).toBeLessThanOrEqual(1);
        }
      });

      it('all team driver references resolve to valid driver IDs', () => {
        const driverIds = new Set(bundle!.drivers.map((d) => d.id));
        for (const team of bundle!.teams) {
          for (const id of team.driverIds) {
            expect(
              driverIds.has(id),
              `${team.id} references unknown driver ${id}`
            ).toBe(true);
          }
        }
      });

      it('no duplicate driver IDs within the season driver list', () => {
        const ids = bundle!.drivers.map((d) => d.id);
        const unique = new Set(ids);
        expect(unique.size, `Duplicate driver IDs in ${s.year} F1`).toBe(ids.length);
      });

      it('no duplicate team IDs within the season', () => {
        const ids = bundle!.teams.map((t) => t.id);
        const unique = new Set(ids);
        expect(unique.size, `Duplicate team IDs in ${s.year} F1`).toBe(ids.length);
      });

      it('no duplicate car IDs within the season', () => {
        const ids = bundle!.cars.map((c) => c.id);
        const unique = new Set(ids);
        expect(unique.size, `Duplicate car IDs in ${s.year} F1`).toBe(ids.length);
      });

      it('no duplicate market driver IDs', () => {
        if (!market) return;
        const ids = market.drivers.map((d) => d.id);
        const unique = new Set(ids);
        expect(unique.size, `Duplicate market IDs in ${s.year} F1`).toBe(ids.length);
      });

      it('no duplicate youth prospect IDs', () => {
        if (!market) return;
        const ids = market.youth.map((y) => y.id);
        const unique = new Set(ids);
        expect(unique.size, `Duplicate youth IDs in ${s.year} F1`).toBe(ids.length);
      });

      // ── Calendar validation ──
      it('all calendar track IDs resolve', () => {
        for (const race of bundle!.season.calendar) {
          expect(getTrackById(race.trackId), `${s.year} F1 unresolvable track ${race.trackId}`).toBeDefined();
        }
      });

      it('no duplicate race IDs within the season', () => {
        const ids = bundle!.season.calendar.map((r) => r.id);
        const unique = new Set(ids);
        expect(unique.size, `Duplicate race IDs in ${s.year} F1`).toBe(ids.length);
      });

      it('calendar races have laps > 0', () => {
        for (const race of bundle!.season.calendar) {
          expect(
            race.laps,
            `${s.year} F1 race ${race.round} (${race.gpName}) has laps=0`
          ).toBeGreaterThan(0);
        }
      });

      // ── Special character checks ──
      it('no unsafe special characters in driver IDs', () => {
        for (const d of bundle!.drivers) {
          expect(d.id, `${d.id} has non-ASCII`).toMatch(/^[\x20-\x7E]+$/);
        }
      });

      it('no unsafe special characters in team IDs', () => {
        for (const t of bundle!.teams) {
          expect(t.id, `${t.id} has non-ASCII`).toMatch(/^[\x20-\x7E]+$/);
        }
      });

      it('no unsafe special characters in car IDs', () => {
        for (const c of bundle!.cars) {
          expect(c.id, `${c.id} has non-ASCII`).toMatch(/^[\x20-\x7E]+$/);
        }
      });
    });
  }
});
