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

  it('exposes the third IndyCar driver as a reserve', () => {
    const state = newGame(2026, 'IndyCar', 't-team-penske');
    const roster = state.drivers.filter((d) => d.teamId === 't-team-penske');
    expect(roster.length).toBe(3);
    expect(activeDriversForTeam(state, 't-team-penske').length).toBe(2);
    expect(reserveDriversForTeam(state, 't-team-penske').length).toBe(1);
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
    const reserve = reserveDriversForTeam(state, 't-team-penske')[0];
    const seat1Before = activeDriversForTeam(state, 't-team-penske')[1].id;

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
