import { describe, expect, it } from 'vitest';
import { getSeasonBundle } from '../data/seasonData';
import { canonicalNameOf } from '../data/registry/masterRegistry';
import { createNewGame } from '../game/initialCareer';
import { advanceSeason } from '../game/seasonRollover';
import type { GameState } from '../game/careerState';
import { careerMarketBundle } from './careerMarketEngine';
import {
  ensureMotorsportUniverse,
  performanceRenewalProbability,
  simulateOffscreenChampionshipSeason,
  universeOccupiedNames,
} from './motorsportUniverseEngine';

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

  it('simulates deterministic off-screen standings using the real season length', () => {
    const championship = career().motorsportUniverse!.championships.NASCAR!;
    const first = simulateOffscreenChampionshipSeason(championship, 'standings-seed');
    const second = simulateOffscreenChampionshipSeason(championship, 'standings-seed');
    expect(second).toEqual(first);
    expect(first.completedRaces).toBe(getSeasonBundle(1998, 'NASCAR')!.season.calendar.length);
    expect(first.driverStandings).toHaveLength(championship.drivers.length);
    expect(first.teamStandings).toHaveLength(championship.teams.length);
    expect(first.driverChampionId).toBe(first.driverStandings[0].entityId);
    expect(first.teamChampionId).toBe(first.teamStandings[0].entityId);
    expect(first.driverStandings.reduce((wins, standing) => wins + standing.wins, 0)).toBe(first.completedRaces);
  });

  it('gives stronger performers a better renewal chance', () => {
    const championship = career().motorsportUniverse!.championships.CART!;
    const summary = simulateOffscreenChampionshipSeason(championship, 'renewal-seed');
    const champion = championship.drivers.find((driver) => driver.driverId === summary.driverStandings[0].entityId)!;
    const last = championship.drivers.find((driver) => driver.driverId === summary.driverStandings.at(-1)!.entityId)!;
    const championTeam = championship.teams.find((team) => team.teamId === champion.teamId);
    const lastTeam = championship.teams.find((team) => team.teamId === last.teamId);
    expect(performanceRenewalProbability(champion, summary, championTeam)).toBeGreaterThan(
      performanceRenewalProbability(last, summary, lastTeam),
    );
  });

  it('advances off-screen contracts and keeps the selected series synchronized', () => {
    const before = career();
    const after = advanceSeason({ ...before, seasonComplete: true });
    expect(after.motorsportUniverse?.seasonYear).toBe(1999);
    for (const championship of Object.values(after.motorsportUniverse!.championships)) {
      expect(championship!.seasonYear).toBe(1999);
      expect(championship!.drivers.every((driver) => driver.contractYearsRemaining >= 1)).toBe(true);
    }
    expect(after.motorsportUniverse!.championships.NASCAR!.seasonHistory).toHaveLength(1);
    expect(after.motorsportUniverse!.championships.CART!.seasonHistory?.[0].seasonYear).toBe(1998);
    const selectedNames = new Set(after.drivers.map((driver) => canonicalNameOf(driver.name)));
    const universeSelectedNames = new Set(
      after.motorsportUniverse!.championships.F1!.drivers.map((driver) => canonicalNameOf(driver.name)),
    );
    expect(universeSelectedNames).toEqual(selectedNames);
    for (const championship of Object.values(after.motorsportUniverse!.championships)) {
      const names = championship!.drivers.map((driver) => canonicalNameOf(driver.name));
      expect(new Set(names).size).toBe(names.length);
    }
    expect(after.motorsportUniverse!.championships.NASCAR!.movementHistory?.length).toBeGreaterThan(0);
    expect(
      after.motorsportUniverse!.championships.NASCAR!.movementHistory?.every(
        (movement) => movement.effectiveYear === 1999 && movement.driverName.length > 0,
      ),
    ).toBe(true);
  });

  it('does not create new cross-series double-signings during rollover', () => {
    const before = career();
    const memberships = (state: GameState) => {
      const result = new Map<string, Set<string>>();
      for (const [series, championship] of Object.entries(state.motorsportUniverse!.championships)) {
        for (const driver of championship!.drivers) {
          const name = canonicalNameOf(driver.name);
          const seriesSet = result.get(name) ?? new Set<string>();
          seriesSet.add(series);
          result.set(name, seriesSet);
        }
      }
      return result;
    };
    const beforeMemberships = memberships(before);
    const after = advanceSeason({ ...before, seasonComplete: true });
    for (const [name, seriesSet] of memberships(after)) {
      if (seriesSet.size <= 1) continue;
      const priorSeries = beforeMemberships.get(name) ?? new Set<string>();
      expect(priorSeries.size).toBeGreaterThan(1);
      expect([...seriesSet].every((series) => priorSeries.has(series))).toBe(true);
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
