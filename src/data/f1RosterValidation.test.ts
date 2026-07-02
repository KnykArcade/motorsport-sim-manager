import { describe, expect, it } from 'vitest';
import { availableSeasons, getSeasonBundle } from './index';

const f1Seasons = availableSeasons.filter((s) => s.series === 'F1');

describe('F1 roster validation', () => {
  it('has F1 seasons to validate', () => {
    expect(f1Seasons.length).toBeGreaterThan(0);
  });

  for (const s of f1Seasons) {
    describe(`${s.year} F1`, () => {
      const bundle = getSeasonBundle(s.year, 'F1');

      it('every team has at most 2 primary race drivers', () => {
        for (const team of bundle!.teams) {
          expect(
            team.driverIds.length,
            `${team.id} has ${team.driverIds.length} driverIds`
          ).toBeLessThanOrEqual(2);
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
