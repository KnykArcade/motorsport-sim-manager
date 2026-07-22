import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from './initialCareer';
import { gameReducer } from './gameReducer';
import { careerMarketBundle } from '../sim/careerMarketEngine';
import { scoutingCost } from '../sim/scoutingEngine';
import { teamById } from './careerState';
import type { GameState } from './careerState';
import { getStaffPool } from '../data';

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
    expect(state.scouting!.activeAssignments).toContainEqual({ entityId: driver.id, entityType: 'Driver' });
    // A scouting line item is recorded in the finance ledger.
    expect((state.finance ?? []).some((t) => t.category === 'Scouting')).toBe(true);
  });

  it('cancels an assignment without deleting the knowledge already purchased', () => {
    let state = newGame(1_000_000_000);
    const driver = careerMarketBundle(state).drivers[0];
    state = gameReducer(state, { type: 'SCOUT_TARGET', entityId: driver.id, entityType: 'Driver' })!;
    const report = state.scouting!.reports[driver.id];
    state = gameReducer(state, { type: 'CANCEL_SCOUTING_ASSIGNMENT', entityId: driver.id, entityType: 'Driver' })!;
    expect(state.scouting!.activeAssignments).not.toContainEqual({ entityId: driver.id, entityType: 'Driver' });
    expect(state.scouting!.reports[driver.id]).toEqual(report);
  });

  it('adds and removes targets from the persisted shortlist', () => {
    let state = newGame();
    const driver = careerMarketBundle(state).drivers[0];
    const action = { type: 'TOGGLE_SCOUTING_SHORTLIST' as const, entityId: driver.id, entityType: 'Driver' as const };
    state = gameReducer(state, action)!;
    expect(state.scouting!.shortlist).toEqual([{ entityId: driver.id, entityType: 'Driver' }]);
    state = gameReducer(state, action)!;
    expect(state.scouting!.shortlist).toEqual([]);
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

  it('scouts, shortlists, and automatically progresses staff targets', () => {
    let state = newGame(1_000_000_000);
    const staff = getStaffPool(state.seasonYear, state.series)[0];
    state = gameReducer(state, { type: 'SCOUT_TARGET', entityId: staff.id, entityType: 'Staff' })!;
    expect(state.scouting?.reports[staff.id]).toMatchObject({ entityType: 'Staff' });
    expect(state.scouting?.activeAssignments).toContainEqual({ entityId: staff.id, entityType: 'Staff' });
    state = gameReducer(state, { type: 'TOGGLE_SCOUTING_SHORTLIST', entityId: staff.id, entityType: 'Staff' })!;
    expect(state.scouting?.shortlist).toContainEqual({ entityId: staff.id, entityType: 'Staff' });
  });

  it('persists recruitment focus controls in scouting state', () => {
    const state = gameReducer(newGame(), { type: 'SET_RECRUITMENT_FOCUS', focus: { maxAge: 28, affordableOnly: true, staffRole: 'Strategist' } })!;
    expect(state.scouting?.recruitmentFocus).toEqual({ maxAge: 28, affordableOnly: true, staffRole: 'Strategist' });
  });
});
