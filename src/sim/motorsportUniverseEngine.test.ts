import { describe, expect, it } from 'vitest';
import { getSeasonBundle } from '../data/seasonData';
import { canonicalNameOf } from '../data/registry/masterRegistry';
import { createNewGame } from '../game/initialCareer';
import { advanceSeason } from '../game/seasonRollover';
import type { GameState } from '../game/careerState';
import { careerMarketBundle } from './careerMarketEngine';
import { ensureMotorsportUniverse, universeOccupiedNames } from './motorsportUniverseEngine';

function career(year = 1998): GameState {
  const bundle = getSeasonBundle(year, 'F1')!;
  return createNewGame({
    gameMode: 'Career',
    seasonYear: year,
    series: 'F1',
    teamId: bundle.teams[0].id,
    seed: `universe-${year}`,
  });
}

describe('persistent multi-series universe', () => {
  it('seeds every championship active in the starting year', () => {
    const state = career();
    expect(Object.keys(state.motorsportUniverse?.championships ?? {}).sort()).toEqual(
      ['CART', 'F1', 'IndyCar', 'NASCAR'].sort(),
    );
    for (const championship of Object.values(state.motorsportUniverse!.championships)) {
      expect(championship!.seasonYear).toBe(1998);
      expect(championship!.teams.length).toBeGreaterThan(0);
      expect(championship!.drivers.length).toBeGreaterThan(0);
      expect(championship!.drivers.every((driver) => driver.contractYearsRemaining >= 1)).toBe(true);
    }
  });

  it('preserves documented drivers who start in more than one championship', () => {
    const state = career();
    const cartNames = new Set(
      state.motorsportUniverse!.championships.CART!.drivers.map((driver) => canonicalNameOf(driver.name)),
    );
    const nascarNames = new Set(
      state.motorsportUniverse!.championships.NASCAR!.drivers.map((driver) => canonicalNameOf(driver.name)),
    );
    expect(cartNames.has('robby gordon')).toBe(true);
    expect(nascarNames.has('robby gordon')).toBe(true);
  });

  it('keeps an existing concurrent contract in each series while both remain active', () => {
    const state = career();
    const universe = structuredClone(state.motorsportUniverse!);
    for (const series of ['CART', 'NASCAR'] as const) {
      const contract = universe.championships[series]!.drivers.find(
        (driver) => canonicalNameOf(driver.name) === 'robby gordon',
      )!;
      contract.contractYearsRemaining = 2;
    }
    const after = advanceSeason({ ...state, motorsportUniverse: universe, seasonComplete: true });
    for (const series of ['CART', 'NASCAR'] as const) {
      expect(
        after.motorsportUniverse!.championships[series]!.drivers.some(
          (driver) => canonicalNameOf(driver.name) === 'robby gordon',
        ),
      ).toBe(true);
    }
  });

  it('removes every live universe seat holder from the shared market', () => {
    const state = career();
    const occupied = universeOccupiedNames(state.motorsportUniverse);
    const market = careerMarketBundle(state);
    for (const driver of [...market.drivers, ...market.youth]) {
      expect(occupied.has(canonicalNameOf(driver.name))).toBe(false);
    }
  });

  it('advances off-screen contracts and keeps the selected series synchronized', () => {
    const before = career();
    const after = advanceSeason({ ...before, seasonComplete: true });
    expect(after.motorsportUniverse?.seasonYear).toBe(1999);
    for (const championship of Object.values(after.motorsportUniverse!.championships)) {
      expect(championship!.seasonYear).toBe(1999);
      expect(championship!.drivers.every((driver) => driver.contractYearsRemaining >= 1)).toBe(true);
    }
    const selectedNames = new Set(after.drivers.map((driver) => canonicalNameOf(driver.name)));
    const universeSelectedNames = new Set(
      after.motorsportUniverse!.championships.F1!.drivers.map((driver) => canonicalNameOf(driver.name)),
    );
    expect(universeSelectedNames).toEqual(selectedNames);
    for (const championship of Object.values(after.motorsportUniverse!.championships)) {
      const names = championship!.drivers.map((driver) => canonicalNameOf(driver.name));
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it('backfills a legacy save after registry initialization', () => {
    const state = career();
    const legacy = { ...state, motorsportUniverse: undefined };
    const migrated = ensureMotorsportUniverse(legacy);
    expect(migrated.motorsportUniverse?.championships.F1?.drivers.length).toBe(state.drivers.length);
    expect(migrated.motorsportUniverse?.championships.NASCAR?.drivers.length).toBeGreaterThan(0);
  });

  it('keeps off-screen championships alive beyond the historical data window', () => {
    const state = career(2026);
    const after = advanceSeason({ ...state, seasonComplete: true });
    expect(after.seasonYear).toBe(2027);
    expect(after.motorsportUniverse?.championships.IndyCar?.seasonYear).toBe(2027);
    expect(after.motorsportUniverse?.championships.NASCAR?.seasonYear).toBe(2027);
  });
});
