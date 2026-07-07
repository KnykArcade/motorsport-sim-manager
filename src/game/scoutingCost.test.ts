import { describe, expect, it } from 'vitest';
import { createNewGame } from './initialCareer';
import { gameReducer } from './gameReducer';
import { careerMarketBundle } from '../sim/careerMarketEngine';
import { scoutingCost } from '../sim/scoutingEngine';
import { teamById } from './careerState';
import type { GameState } from './careerState';

function newGame(budget?: number): GameState {
  const state = createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'scouting-cost-seed',
  });
  if (budget === undefined) return state;
  return {
    ...state,
    teams: state.teams.map((t) =>
      t.id === state.selectedTeamId ? { ...t, budget } : t,
    ),
  };
}

describe('scouting costs', () => {
  it('charges the team budget when scouting a target', () => {
    let state = newGame(1_000_000_000);
    const driver = careerMarketBundle(state).drivers.find(
      (d) => !state.drivers.some((s) => s.id === d.id || s.name === d.name),
    )!;
    const before = teamById(state, state.selectedTeamId)!.budget;
    const cost = scoutingCost('Driver', 0);

    state = gameReducer(state, {
      type: 'SCOUT_TARGET',
      entityId: driver.id,
      entityType: 'Driver',
    })!;

    const after = teamById(state, state.selectedTeamId)!.budget;
    expect(after).toBe(before - cost);
    expect(state.scouting!.reports[driver.id]).toBeDefined();
    // A scouting line item is recorded in the finance ledger.
    expect((state.finance ?? []).some((t) => t.category === 'Scouting')).toBe(true);
  });

  it('blocks scouting when the team cannot afford it', () => {
    const state = newGame(0);
    const driver = careerMarketBundle(state).drivers.find(
      (d) => !state.drivers.some((s) => s.id === d.id || s.name === d.name),
    )!;

    const after = gameReducer(state, {
      type: 'SCOUT_TARGET',
      entityId: driver.id,
      entityType: 'Driver',
    })!;

    expect(after.scouting!.reports[driver.id]).toBeUndefined();
    expect(teamById(after, after.selectedTeamId)!.budget).toBe(0);
  });
});
