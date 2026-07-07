import { describe, expect, it } from 'vitest';
import { availableSeasons } from '../data';
import { getSeasonBundle } from '../data/seasonData';
import { createNewGame } from './initialCareer';
import { activeDriversForTeam, MAX_RACE_DRIVERS } from './careerState';
import {
  canEnterRaceWeekend,
  enforceF1Rosters,
  isPreseason,
  signRaceDriver,
  validateRaceSeatSigning,
} from './rosterEnforcement';
import { careerMarketBundle } from '../sim/careerMarketEngine';
import type { GameState } from './careerState';
import { getReleasedMarketDrivers } from '../data/market';

const f1Seasons = availableSeasons.filter((s) => s.series === 'F1');
const aowSeasons = availableSeasons.filter((s) => s.series === 'IndyCar' || s.series === 'CART' || s.series === 'Champ Car');

// Helper: create a game state for a given year/team, picking the first team.
function makeGameState(year: number, teamId?: string): GameState {
  const bundle = getSeasonBundle(year, 'F1')!;
  const team = teamId ?? bundle.teams[0].id;
  return createNewGame({
    gameMode: 'SingleSeason',
    seasonYear: year,
    series: 'F1',
    teamId: team,
    seed: `test-${year}`,
  });
}

describe('F1 starting roster duplicate regression tests', () => {
  // Known mid-season transfer cases that should NOT appear as duplicate
  // starting roster assignments.
  const cases: { year: number; driverName: string; teams: string[] }[] = [
    { year: 2001, driverName: 'Heinz-Harald Frentzen', teams: ['Jordan', 'Prost'] },
    { year: 2003, driverName: 'Justin Wilson', teams: ['Jaguar', 'Minardi'] },
    { year: 2016, driverName: 'Max Verstappen', teams: ['Red Bull', 'Toro Rosso'] },
    { year: 2017, driverName: 'Carlos Sainz', teams: ['Renault', 'Toro Rosso'] },
    { year: 2019, driverName: 'Pierre Gasly', teams: ['Red Bull', 'Toro Rosso'] },
    { year: 2025, driverName: 'Yuki Tsunoda', teams: ['Red Bull', 'Racing Bulls'] },
  ];

  for (const c of cases) {
    it(`${c.year} ${c.driverName} is not a starting driver for both ${c.teams.join(' and ')}`, () => {
      const bundle = getSeasonBundle(c.year, 'F1')!;
      const driver = bundle.drivers.find(
        (d) => d.name.toLowerCase().includes(c.driverName.toLowerCase().split(' ').pop()!),
      );
      if (!driver) return; // skip if driver not found

      const teamsWithDriver = bundle.teams.filter((t) => t.driverIds.includes(driver.id));
      expect(
        teamsWithDriver.length,
        `${c.driverName} is on ${teamsWithDriver.length} starting teams: ${teamsWithDriver.map((t) => t.name).join(', ')}`
      ).toBeLessThanOrEqual(1);
    });
  }
});

describe('F1 preseason roster rules', () => {
  it('F1 teams may start preseason with 0, 1, or 2 active race drivers', () => {
    // Check a known incomplete-team year (2016 Red Bull has 1 driver after fix)
    const bundle = getSeasonBundle(2016, 'F1')!;
    const redbull = bundle.teams.find((t) => t.name.includes('Red Bull'));
    if (redbull) {
      const state = makeGameState(2016, redbull.id);
      const active = activeDriversForTeam(state, redbull.id);
      expect(active.length).toBeLessThanOrEqual(MAX_RACE_DRIVERS);
    }
  });

  it('no F1 team starts with more than 2 race drivers', () => {
    for (const s of f1Seasons) {
      const bundle = getSeasonBundle(s.year, 'F1')!;
      for (const team of bundle.teams) {
        expect(team.driverIds.length).toBeLessThanOrEqual(MAX_RACE_DRIVERS);
      }
    }
  });

  it('no F1 driver is assigned as a starting race driver to more than 1 F1 team', () => {
    for (const s of f1Seasons) {
      const bundle = getSeasonBundle(s.year, 'F1')!;
      const driverToTeams = new Map<string, string[]>();
      for (const team of bundle.teams) {
        for (const did of team.driverIds) {
          const teams = driverToTeams.get(did) || [];
          teams.push(team.id);
          driverToTeams.set(did, teams);
        }
      }
      for (const [, teams] of driverToTeams) {
        expect(teams.length).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('pre-Race-1 F1 roster enforcement', () => {
  it('canEnterRaceWeekend blocks player with < 2 active race drivers', () => {
    // Use 2016 Red Bull (known to have 1 driver after swap fix)
    const bundle = getSeasonBundle(2016, 'F1')!;
    const redbull = bundle.teams.find((t) => t.name.includes('Red Bull'));
    if (!redbull) return;

    const state = makeGameState(2016, redbull.id);
    const active = activeDriversForTeam(state, redbull.id);
    if (active.length < 2) {
      const check = canEnterRaceWeekend(state);
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('two race drivers');
    }
  });

  it('canEnterRaceWeekend allows player with 2 active race drivers', () => {
    // Use a team that has 2 drivers
    const bundle = getSeasonBundle(2024, 'F1')!;
    const ferrari = bundle.teams.find((t) => t.name.includes('Ferrari'));
    if (!ferrari) return;

    const state = makeGameState(2024, ferrari.id);
    const active = activeDriversForTeam(state, ferrari.id);
    expect(active.length).toBe(2);
    const check = canEnterRaceWeekend(state);
    expect(check.allowed).toBe(true);
  });

  it('canEnterRaceWeekend allows IndyCar (not F1)', () => {
    const bundle = getSeasonBundle(2024, 'IndyCar');
    if (!bundle) return;
    const team = bundle.teams[0];
    const state = createNewGame({
      gameMode: 'SingleSeason',
      seasonYear: 2024,
      series: 'IndyCar',
      teamId: team.id,
      seed: 'test-indycar',
    });
    const check = canEnterRaceWeekend(state);
    expect(check.allowed).toBe(true);
  });

  it('isPreseason returns true for a new game', () => {
    const state = makeGameState(2024);
    expect(isPreseason(state)).toBe(true);
  });

  it('AI autofill fills incomplete AI teams to exactly 2 active race drivers', () => {
    // Use 2016 which has incomplete teams (Red Bull has 1 driver)
    const state = makeGameState(2016);
    const result = enforceF1Rosters(state);

    // Check all AI teams have exactly 2 active drivers after enforcement
    for (const team of result.state.teams) {
      if (team.id === state.selectedTeamId) continue; // skip player team
      const active = activeDriversForTeam(result.state, team.id);
      expect(
        active.length,
        `${team.name} has ${active.length} active drivers after enforcement`
      ).toBe(MAX_RACE_DRIVERS);
    }
  });

  it('AI autofill does not create duplicate active drivers across teams', () => {
    const state = makeGameState(2016);
    const result = enforceF1Rosters(state);

    const driverTeams = new Map<string, string[]>();
    for (const team of result.state.teams) {
      for (const d of activeDriversForTeam(result.state, team.id)) {
        const teams = driverTeams.get(d.id) || [];
        teams.push(team.id);
        driverTeams.set(d.id, teams);
      }
    }
    for (const [driverId, teams] of driverTeams) {
      expect(teams.length, `Driver ${driverId} active on ${teams.length} teams`).toBe(1);
    }
  });

  it('AI autofill does not fill the player team', () => {
    const bundle = getSeasonBundle(2016, 'F1')!;
    const redbull = bundle.teams.find((t) => t.name.includes('Red Bull'));
    if (!redbull) return;

    const state = makeGameState(2016, redbull.id);
    const playerActiveBefore = activeDriversForTeam(state, redbull.id).length;
    const result = enforceF1Rosters(state);
    const playerActiveAfter = activeDriversForTeam(result.state, redbull.id).length;

    // Player team should NOT be auto-filled
    expect(playerActiveAfter).toBe(playerActiveBefore);
  });

  it('AI autofill does not exceed 3 total assigned drivers per team', () => {
    const state = makeGameState(2016);
    const result = enforceF1Rosters(state);

    for (const team of result.state.teams) {
      const roster = result.state.drivers.filter((d) => d.teamId === team.id);
      expect(roster.length).toBeLessThanOrEqual(3);
    }
  });

  it('all assigned race-driver IDs resolve to valid drivers after enforcement', () => {
    const state = makeGameState(2016);
    const result = enforceF1Rosters(state);
    const driverIds = new Set(result.state.drivers.map((d) => d.id));

    for (const team of result.state.teams) {
      for (const id of team.driverIds) {
        expect(driverIds.has(id)).toBe(true);
      }
    }
  });
});

describe('player race-seat signing', () => {
  it('validateRaceSeatSigning rejects non-F1 series', () => {
    const bundle = getSeasonBundle(2024, 'IndyCar');
    if (!bundle) return;
    const state = createNewGame({
      gameMode: 'SingleSeason',
      seasonYear: 2024,
      series: 'IndyCar',
      teamId: bundle.teams[0].id,
      seed: 'test-indycar-sign',
    });
    const result = validateRaceSeatSigning(state, 'fake-id');
    expect(result.valid).toBe(false);
  });

  it('validateRaceSeatSigning rejects when team has 2 active drivers', () => {
    const bundle = getSeasonBundle(2024, 'F1')!;
    const ferrari = bundle.teams.find((t) => t.name.includes('Ferrari'))!;
    const state = makeGameState(2024, ferrari.id);
    const active = activeDriversForTeam(state, ferrari.id);
    expect(active.length).toBe(2);

    const result = validateRaceSeatSigning(state, 'fake-id');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('2 active race drivers');
  });

  it('signRaceDriver adds a driver to an incomplete team', () => {
    const bundle = getSeasonBundle(2016, 'F1')!;
    const redbull = bundle.teams.find((t) => t.name.includes('Red Bull'));
    if (!redbull) return;

    const state = makeGameState(2016, redbull.id);
    const activeBefore = activeDriversForTeam(state, redbull.id).length;

    if (activeBefore >= 2) return; // skip if team already has 2

    // Get a market driver to sign
    const market = careerMarketBundle(state);
    const candidate = market.drivers[0];
    if (!candidate) return;

    const newState = signRaceDriver(state, candidate.id);
    const activeAfter = activeDriversForTeam(newState, redbull.id).length;
    expect(activeAfter).toBe(activeBefore + 1);
  });

  it('signRaceDriver does not create duplicate active drivers across teams', () => {
    const bundle = getSeasonBundle(2016, 'F1')!;
    const redbull = bundle.teams.find((t) => t.name.includes('Red Bull'));
    if (!redbull) return;

    const state = makeGameState(2016, redbull.id);
    const activeBefore = activeDriversForTeam(state, redbull.id).length;
    if (activeBefore >= 2) return;

    const market = careerMarketBundle(state);
    const candidate = market.drivers[0];
    if (!candidate) return;

    const newState = signRaceDriver(state, candidate.id);

    // Check no duplicates
    const driverTeams = new Map<string, string[]>();
    for (const team of newState.teams) {
      for (const d of activeDriversForTeam(newState, team.id)) {
        const teams = driverTeams.get(d.id) || [];
        teams.push(team.id);
        driverTeams.set(d.id, teams);
      }
    }
    for (const [driverId, teams] of driverTeams) {
      expect(teams.length, `Driver ${driverId} active on ${teams.length} teams`).toBe(1);
    }
  });

  it('player can enter Race 1 after signing enough race drivers', () => {
    const bundle = getSeasonBundle(2016, 'F1')!;
    const redbull = bundle.teams.find((t) => t.name.includes('Red Bull'));
    if (!redbull) return;

    let state = makeGameState(2016, redbull.id);
    let active = activeDriversForTeam(state, redbull.id).length;

    if (active < 2) {
      const market = careerMarketBundle(state);
      const candidate = market.drivers[0];
      if (candidate) {
        state = signRaceDriver(state, candidate.id);
        active = activeDriversForTeam(state, redbull.id).length;
      }
    }

    if (active >= 2) {
      const check = canEnterRaceWeekend(state);
      expect(check.allowed).toBe(true);
    }
  });

  it('validateRaceSeatSigning blocks when budget is insufficient', () => {
    const bundle = getSeasonBundle(2016, 'F1')!;
    const redbull = bundle.teams.find((t) => t.name.includes('Red Bull'));
    if (!redbull) return;

    let state = makeGameState(2016, redbull.id);
    const active = activeDriversForTeam(state, redbull.id).length;
    if (active >= 2) return;

    // Drain the team budget to 0.
    state = {
      ...state,
      teams: state.teams.map((t) =>
        t.id === redbull.id ? { ...t, budget: 0 } : t,
      ),
    };

    const market = careerMarketBundle(state);
    const candidate = market.drivers.find((d) => d.buyoutCost > 0);
    if (!candidate) return;

    const result = validateRaceSeatSigning(state, candidate.id);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Insufficient budget');
  });

  it('signRaceDriver deducts buyout cost from team budget', () => {
    const bundle = getSeasonBundle(2016, 'F1')!;
    const redbull = bundle.teams.find((t) => t.name.includes('Red Bull'));
    if (!redbull) return;

    let state = makeGameState(2016, redbull.id);
    const active = activeDriversForTeam(state, redbull.id).length;
    if (active >= 2) return;

    const market = careerMarketBundle(state);
    const candidate = market.drivers[0];
    if (!candidate) return;

    const budgetBefore = state.teams.find((t) => t.id === redbull.id)!.budget;
    state = signRaceDriver(state, candidate.id);
    const budgetAfter = state.teams.find((t) => t.id === redbull.id)!.budget;

    // Budget should have decreased by the buyout cost (in raw dollars).
    expect(budgetAfter).toBeLessThan(budgetBefore);
  });

  it('signRaceDriver records a finance transaction', () => {
    const bundle = getSeasonBundle(2016, 'F1')!;
    const redbull = bundle.teams.find((t) => t.name.includes('Red Bull'));
    if (!redbull) return;

    let state = makeGameState(2016, redbull.id);
    const active = activeDriversForTeam(state, redbull.id).length;
    if (active >= 2) return;

    const market = careerMarketBundle(state);
    const candidate = market.drivers[0];
    if (!candidate) return;

    const financeBefore = state.finance ?? [];
    state = signRaceDriver(state, candidate.id);
    const financeAfter = state.finance ?? [];

    expect(financeAfter.length).toBeGreaterThan(financeBefore.length);

    const txn = financeAfter[financeAfter.length - 1];
    expect(txn.category).toBe('Driver Signing');
    expect(txn.amount).toBeLessThan(0);
    expect(txn.label).toContain(candidate.name);
  });

  it('signRaceDriver marks the driver unavailable (signedMarketIds)', () => {
    const bundle = getSeasonBundle(2016, 'F1')!;
    const redbull = bundle.teams.find((t) => t.name.includes('Red Bull'));
    if (!redbull) return;

    let state = makeGameState(2016, redbull.id);
    const active = activeDriversForTeam(state, redbull.id).length;
    if (active >= 2) return;

    const market = careerMarketBundle(state);
    const candidate = market.drivers[0];
    if (!candidate) return;

    state = signRaceDriver(state, candidate.id);
    expect((state.signedMarketIds ?? []).includes(candidate.id)).toBe(true);

    // Signing the same driver again should be rejected (either because
    // the team now has 2 active drivers or because the driver is already signed).
    const validation = validateRaceSeatSigning(state, candidate.id);
    expect(validation.valid).toBe(false);
  });
});

describe('IndyCar roster enforcement', () => {
  it('enforceRosters normalizes IndyCar AI teams without changing the player team', () => {
    const bundle = getSeasonBundle(2024, 'IndyCar');
    if (!bundle) return;
    const state = createNewGame({
      gameMode: 'SingleSeason',
      seasonYear: 2024,
      series: 'IndyCar',
      teamId: bundle.teams[0].id,
      seed: 'test-indycar-enforce',
    });
    const result = enforceF1Rosters(state);
    expect(result.violations.length).toBe(0);

    for (const team of result.state.teams) {
      const active = activeDriversForTeam(result.state, team.id);
      expect(active.length).toBeLessThanOrEqual(MAX_RACE_DRIVERS);
      if (team.id !== state.selectedTeamId) {
        expect(active.length).toBe(MAX_RACE_DRIVERS);
      }
    }
  });
});

describe('universe roster normalization', () => {
  it('caps every loaded series to two race drivers per team and keeps driver ids unique within the series', () => {
    for (const season of aowSeasons) {
      const bundle = getSeasonBundle(season.year, season.series)!;
      const driverTeams = new Map<string, string[]>();

      for (const team of bundle.teams) {
        expect(team.driverIds.length).toBeLessThanOrEqual(MAX_RACE_DRIVERS);
        expect(new Set(team.driverIds).size).toBe(team.driverIds.length);

        for (const driverId of team.driverIds) {
          const teams = driverTeams.get(driverId) ?? [];
          teams.push(team.id);
          driverTeams.set(driverId, teams);
        }
      }

      for (const [driverId, teams] of driverTeams) {
        expect(teams.length, `${season.year} ${season.series} driver ${driverId} appears on multiple teams`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('moves released CART roster drivers into the market pool', () => {
    const state = createNewGame({
      gameMode: 'SingleSeason',
      seasonYear: 1992,
      series: 'CART',
      teamId: getSeasonBundle(1992, 'CART')!.teams[0].id,
      seed: 'test-cart-market-release',
    });
    const market = careerMarketBundle(state);
    const names = new Set(market.drivers.map((d) => d.name));
    const released = getReleasedMarketDrivers(1992, 'CART');

    expect(released.length).toBeGreaterThan(0);
    expect(names.has(released[0].name)).toBe(true);
  });

  it('shares one canonical driver record across CART and IndyCar when the same person appears in both series', () => {
    const cart = getSeasonBundle(1997, 'CART')!;
    const indy = getSeasonBundle(1997, 'IndyCar')!;
    const cartDriver = cart.drivers.find((d) => d.name === 'Robby Gordon');
    const indyDriver = indy.drivers.find((d) => d.name === 'Robby Gordon');

    expect(cartDriver).toBeDefined();
    expect(indyDriver).toBeDefined();
    expect(cartDriver!.id).toBe(indyDriver!.id);
  });
});
