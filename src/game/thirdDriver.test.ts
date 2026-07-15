import '../testDataSetup';
import { describe, it, expect, beforeAll } from 'vitest';
import { createNewGame } from './initialCareer';
import { gameReducer } from './gameReducer';
import { advanceSeason } from './seasonRollover';
import {
  activeDriversForTeam,
  driversForTeam,
  reserveDriversForTeam,
  teamById,
  type GameState,
} from './careerState';
import { preloadMarketBundle } from '../data';
import { careerMarketBundle } from '../sim/careerMarketEngine';
import { driverExtensionSigningFee, thirdDriverSalary, thirdDriverAmbitions } from '../sim/contractEngine';
import type { StandingsEntry } from '../types/gameTypes';

const TEAM = 't-williams';

function newGame(): GameState {
  return createNewGame({
    gameMode: 'Career',
    seasonYear: 1994,
    series: 'F1',
    teamId: TEAM,
    seed: 'third-seed',
  });
}

function freeAgentId(state: GameState): string {
  const signed = new Set(state.signedMarketIds ?? []);
  const m = careerMarketBundle(state).drivers.find(
    (d) => !signed.has(d.id) && !state.drivers.some((x) => x.id === d.id || x.name === d.name),
  );
  if (!m) throw new Error('no free agent');
  return m.id;
}

function entry(entityId: string, points: number): StandingsEntry {
  return { entityId, points, wins: 0, podiums: 0, dnfs: 0 };
}

describe('third-driver contracts', () => {
  beforeAll(async () => {
    await preloadMarketBundle(1994, 'F1');
  });

  it('discounts the 3rd-driver salary', () => {
    expect(thirdDriverSalary(10)).toBe(5);
    expect(thirdDriverSalary(0)).toBe(0.2); // floor
  });

  it('calculates an affordable in-season extension fee from salary and years', () => {
    const state = newGame();
    const driver = activeDriversForTeam(state, TEAM)[0];
    const oneYear = driverExtensionSigningFee(driver, 1, state.calendar.length, state.calendar.length);
    const twoYear = driverExtensionSigningFee(driver, 2, state.calendar.length, state.calendar.length);
    expect(oneYear).toBeGreaterThan(0);
    expect(twoYear).toBeGreaterThan(oneYear);
  });

  it('extends a current driver contract only when the driver accepts the offer', () => {
    let state = newGame();
    const driver = activeDriversForTeam(state, TEAM)[0];
    const beforeBudget = teamById(state, TEAM)!.budget;
    const beforeYears = driver.contractYearsRemaining ?? 1;
    state = {
      ...state,
      driverRelationships: {
        ...state.driverRelationships,
        [driver.id]: {
          ...state.driverRelationships![driver.id],
          morale: 88,
          teamLoyalty: 86,
          trustInPrincipal: 84,
          frustration: 8,
        },
      },
    };

    state = gameReducer(state, { type: 'EXTEND_DRIVER_CONTRACT', driverId: driver.id, years: 1, offerMultiplier: 1.35 })!;

    const extended = state.drivers.find((d) => d.id === driver.id)!;
    expect(extended.contractYearsRemaining).toBe(beforeYears + 1);
    expect(teamById(state, TEAM)!.budget).toBeLessThan(beforeBudget);
    expect(state.finance?.some((t) => t.category === 'Driver Signing' && t.label.includes(driver.name))).toBe(true);
    expect(state.news[0].headline).toContain('agrees');
  });

  it('lets an unhappy driver refuse a standard extension offer', () => {
    let state = newGame();
    const driver = activeDriversForTeam(state, TEAM)[0];
    const beforeBudget = teamById(state, TEAM)!.budget;
    const beforeYears = driver.contractYearsRemaining ?? 1;
    state = {
      ...state,
      driverRelationships: {
        ...state.driverRelationships,
        [driver.id]: {
          ...state.driverRelationships![driver.id],
          morale: 18,
          teamLoyalty: 12,
          trustInPrincipal: 10,
          frustration: 92,
        },
      },
    };

    state = gameReducer(state, { type: 'EXTEND_DRIVER_CONTRACT', driverId: driver.id, years: 1 })!;

    const unchanged = state.drivers.find((d) => d.id === driver.id)!;
    expect(unchanged.contractYearsRemaining ?? 1).toBe(beforeYears);
    expect(teamById(state, TEAM)!.budget).toBe(beforeBudget);
    expect(state.news[0].headline).toContain('turns down');
  });

  it('blocks driver extensions in single-season mode', () => {
    let state = createNewGame({
      gameMode: 'SingleSeason',
      seasonYear: 1994,
      series: 'F1',
      teamId: TEAM,
      seed: 'single-season-contract',
    });
    const driver = activeDriversForTeam(state, TEAM)[0];
    const beforeYears = driver.contractYearsRemaining ?? 1;

    state = gameReducer(state, { type: 'EXTEND_DRIVER_CONTRACT', driverId: driver.id, years: 1 })!;

    expect(state.drivers.find((d) => d.id === driver.id)!.contractYearsRemaining ?? 1).toBe(beforeYears);
  });

  it('signs a free agent mid-season as a 3rd driver (reserve)', () => {
    let state = newGame();
    const before = teamById(state, TEAM)!.budget;
    const marketId = freeAgentId(state);

    state = gameReducer(state, { type: 'SIGN_THIRD_DRIVER', marketId })!;

    const roster = driversForTeam(state, TEAM);
    expect(roster.length).toBe(3);
    const third = roster.find((d) => d.contractType === 'third');
    expect(third).toBeTruthy();
    // The 3rd driver is a reserve, not on track.
    expect(activeDriversForTeam(state, TEAM).length).toBe(2);
    expect(reserveDriversForTeam(state, TEAM).map((d) => d.id)).toContain(third!.id);
    // Charged a fee and hidden from the market.
    expect(teamById(state, TEAM)!.budget).toBeLessThan(before);
    expect(state.signedMarketIds).toContain(marketId);
  });

  it('allows only one 3rd driver at a time', () => {
    let state = newGame();
    state = gameReducer(state, { type: 'SIGN_THIRD_DRIVER', marketId: freeAgentId(state) })!;
    const after = driversForTeam(state, TEAM).length;
    state = gameReducer(state, { type: 'SIGN_THIRD_DRIVER', marketId: freeAgentId(state) })!;
    expect(driversForTeam(state, TEAM).length).toBe(after); // unchanged
  });

  it('flags a 3rd driver who outscored a seat driver as wanting a seat', () => {
    let state = newGame();
    state = gameReducer(state, { type: 'SIGN_THIRD_DRIVER', marketId: freeAgentId(state) })!;
    const third = driversForTeam(state, TEAM).find((d) => d.contractType === 'third')!;
    const seats = activeDriversForTeam(state, TEAM);

    state = {
      ...state,
      driverStandings: [entry(third.id, 20), entry(seats[0].id, 5), entry(seats[1].id, 30)],
    };

    const amb = thirdDriverAmbitions(state).find((a) => a.driverId === third.id)!;
    expect(amb.outperformed).toBe(true);
    expect(amb.wantsSeat).toBe(true);
  });

  it('promotes a 3rd driver into a seat at the rollover', () => {
    let state = newGame();
    state = gameReducer(state, { type: 'SIGN_THIRD_DRIVER', marketId: freeAgentId(state) })!;
    const third = driversForTeam(state, TEAM).find((d) => d.contractType === 'third')!;
    const seats = activeDriversForTeam(state, TEAM);
    const displaced = seats[1];

    state = { ...state, seasonComplete: true };
    state = gameReducer(state, {
      type: 'PROMOTE_THIRD_DRIVER',
      seatDriverId: displaced.id,
      thirdDriverId: third.id,
    })!;
    state = advanceSeason(state);

    const roster = driversForTeam(state, TEAM);
    expect(roster.length).toBe(2);
    expect(roster.find((d) => d.id === displaced.id)).toBeUndefined(); // displaced left
    const promoted = roster.find((d) => d.id === third.id)!;
    expect(promoted.contractType).toBe('seat');
    expect(activeDriversForTeam(state, TEAM).map((d) => d.id)).toContain(third.id);
  });

  it('loses an un-promoted out-performer to the market at the rollover', () => {
    let state = newGame();
    const marketId = freeAgentId(state);
    state = gameReducer(state, { type: 'SIGN_THIRD_DRIVER', marketId })!;
    const third = driversForTeam(state, TEAM).find((d) => d.contractType === 'third')!;
    const seats = activeDriversForTeam(state, TEAM);

    state = {
      ...state,
      seasonComplete: true,
      driverStandings: [entry(third.id, 20), entry(seats[0].id, 1), entry(seats[1].id, 1)],
    };
    state = advanceSeason(state);

    const roster = driversForTeam(state, TEAM);
    expect(roster.find((d) => d.id === third.id)).toBeUndefined(); // left the team
    expect(roster.length).toBe(2);
    expect(state.signedMarketIds).not.toContain(marketId); // back on the market
  });
});
