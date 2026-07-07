import { describe, it, expect } from 'vitest';
import { createNewGame } from './initialCareer';
import { gameReducer } from './gameReducer';
import {
  activeDriversForTeam,
  reserveDriversForTeam,
  MAX_RACE_DRIVERS,
} from './careerState';

function newGame(seasonYear: number, series: 'F1' | 'IndyCar', teamId: string) {
  return createNewGame({ gameMode: 'Career', seasonYear, series, teamId, seed: 'test-seed' });
}

describe('race lineup (two cars per team)', () => {
  it('fields at most two active drivers per team in IndyCar 2026', () => {
    const state = newGame(2026, 'IndyCar', 't-team-penske');
    for (const team of state.teams) {
      const active = activeDriversForTeam(state, team.id);
      expect(active.length).toBeLessThanOrEqual(MAX_RACE_DRIVERS);
    }
  });

  it('keeps fresh IndyCar rosters at two race drivers with no reserve slot', () => {
    const state = newGame(2026, 'IndyCar', 't-team-penske');
    const roster = state.drivers.filter((d) => d.teamId === 't-team-penske');
    expect(roster.length).toBe(2);
    expect(activeDriversForTeam(state, 't-team-penske').length).toBe(2);
    expect(reserveDriversForTeam(state, 't-team-penske').length).toBe(0);
  });

  it('1994 grid has no duplicated driver and exactly two per team', () => {
    const state = newGame(1994, 'F1', 't-williams');
    const gridIds: string[] = [];
    for (const team of state.teams) {
      const active = activeDriversForTeam(state, team.id);
      expect(active.length).toBe(2);
      gridIds.push(...active.map((d) => d.id));
    }
    expect(new Set(gridIds).size).toBe(gridIds.length);
  });

  it('swaps a reserve into a race seat and demotes the displaced driver', () => {
    let state = newGame(2026, 'IndyCar', 't-team-penske');
    const teamId = 't-team-penske';
    const displaced = activeDriversForTeam(state, teamId)[1];
    const reserve = {
      ...displaced,
      id: `${displaced.id}-reserve`,
      contractType: 'reserve' as const,
    };
    state = {
      ...state,
      drivers: [...state.drivers, reserve],
      teams: state.teams.map((t) =>
        t.id === teamId ? { ...t, driverIds: [...t.driverIds, reserve.id] } : t,
      ),
    };
    const seat1Before = displaced.id;

    state = gameReducer(state, {
      type: 'SWAP_RACE_DRIVER',
      seatIndex: 1,
      reserveDriverId: reserve.id,
    })!;

    const activeAfter = activeDriversForTeam(state, 't-team-penske').map((d) => d.id);
    expect(activeAfter).toContain(reserve.id);
    expect(activeAfter).not.toContain(seat1Before);
    expect(reserveDriversForTeam(state, 't-team-penske').map((d) => d.id)).toContain(seat1Before);
  });

  it('excludes third/reserve/test contracts from the race seats', () => {
    const state = newGame(2026, 'IndyCar', 't-team-penske');
    const roster = state.drivers.filter((d) => d.teamId === 't-team-penske');
    // Force the first roster driver into a reserve tier; the race lineup should
    // then skip them and field the next two race-seat drivers instead.
    const firstId = state.teams.find((t) => t.id === 't-team-penske')!.driverIds[0];
    const tweaked = {
      ...state,
      drivers: state.drivers.map((d) =>
        d.id === firstId ? { ...d, contractType: 'reserve' as const } : d,
      ),
    };
    const active = activeDriversForTeam(tweaked, 't-team-penske');
    expect(active.map((d) => d.id)).not.toContain(firstId);
    for (const d of active) expect(d.contractType).not.toBe('reserve');
    expect(active.length).toBe(Math.min(2, roster.length - 1));
  });

  it('promotes a reserve into a race seat and flips contract tiers', () => {
    let state = newGame(2026, 'IndyCar', 't-team-penske');
    const teamId = 't-team-penske';
    const displaced = activeDriversForTeam(state, teamId)[1];
    const reserve = {
      ...displaced,
      id: `${displaced.id}-reserve`,
      contractType: 'reserve' as const,
    };
    state = {
      ...state,
      drivers: [...state.drivers, reserve],
      teams: state.teams.map((t) =>
        t.id === teamId ? { ...t, driverIds: [...t.driverIds, reserve.id] } : t,
      ),
    };
    const seat1Before = displaced.id;
    state = gameReducer(state, {
      type: 'SWAP_RACE_DRIVER',
      seatIndex: 1,
      reserveDriverId: reserve.id,
    })!;
    const promoted = state.drivers.find((d) => d.id === reserve.id)!;
    const displacedDriver = state.drivers.find((d) => d.id === seat1Before)!;
    expect(promoted.contractType).toBe('seat');
    expect(displacedDriver.contractType).toBe('reserve');
    expect(activeDriversForTeam(state, 't-team-penske').map((d) => d.id)).toContain(reserve.id);
  });

  it('ignores swaps for drivers not on the player roster', () => {
    const state = newGame(2026, 'IndyCar', 't-team-penske');
    const foreign = state.drivers.find((d) => d.teamId !== 't-team-penske')!;
    const next = gameReducer(state, {
      type: 'SWAP_RACE_DRIVER',
      seatIndex: 0,
      reserveDriverId: foreign.id,
    });
    expect(next).toEqual(state);
  });
});
