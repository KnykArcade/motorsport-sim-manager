import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { getStaffPool } from '../data';
import { staffReleaseCost } from '../sim/staffEngine';
import type { GameState } from './careerState';
import { gameReducer } from './gameReducer';
import { createNewGame } from './initialCareer';

function freshState(gameMode: GameState['gameMode'] = 'Career'): GameState {
  return createNewGame({ gameMode, seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'staff-contract-test' });
}

function hireFirst(state: GameState): GameState {
  const candidate = getStaffPool(state.seasonYear, state.series)[0];
  return gameReducer(state, { type: 'HIRE_STAFF', staffId: candidate.id })!;
}

function withStaffOutlook(state: GameState, status: 'Committed' | 'WantsExit', modifier: number, trust: number): GameState {
  const member = state.staff![0];
  const key = `Staff:${member.id}`;
  return {
    ...state,
    characterInteractions: {
      ...state.characterInteractions!,
      opinions: {
        ...state.characterInteractions!.opinions,
        [key]: { ...state.characterInteractions!.opinions[key], trust, respect: trust, score: trust - 50 },
      },
      futureIntentions: state.characterInteractions!.futureIntentions.map((entry) =>
        entry.target.type === 'Staff' && entry.target.id === member.id
          ? { ...entry, status, negotiationModifier: modifier }
          : entry,
      ),
    },
  };
}

describe('staff contracts', () => {
  it('hires specialists on a visible two-year contract', () => {
    const hired = hireFirst(freshState());
    expect(hired.staff).toHaveLength(1);
    expect(hired.staff![0].contractYearsRemaining).toBe(2);
    expect(hired.news[0].body).toContain('two-year contract');
  });

  it('lets a committed specialist accept an extension', () => {
    const willing = withStaffOutlook(hireFirst(freshState()), 'Committed', 8, 80);
    const state: GameState = {
      ...willing,
      teams: willing.teams.map((team) => team.id === willing.selectedTeamId ? { ...team, budget: 100_000_000 } : team),
    };
    const member = state.staff![0];
    const beforeBudget = state.teams.find((team) => team.id === state.selectedTeamId)!.budget;
    const extended = gameReducer(state, { type: 'EXTEND_STAFF_CONTRACT', staffId: member.id, years: 1 })!;
    expect(extended.staff![0].contractYearsRemaining).toBe(3);
    expect(extended.teams.find((team) => team.id === state.selectedTeamId)!.budget).toBeLessThan(beforeBudget);
    expect(extended.news[0].headline).toContain('agrees');
  });

  it('lets a specialist who wants out refuse ordinary terms', () => {
    const state = withStaffOutlook(hireFirst(freshState()), 'WantsExit', -22, 20);
    const member = state.staff![0];
    const refused = gameReducer(state, { type: 'EXTEND_STAFF_CONTRACT', staffId: member.id, years: 1 })!;
    expect(refused.staff![0].contractYearsRemaining).toBe(2);
    expect(refused.news[0].headline).toContain('turns down');
  });

  it('charges compensation for an early release and leaves the role vacant', () => {
    const state = hireFirst(freshState());
    const member = state.staff![0];
    const expected = staffReleaseCost(member);
    const beforeBudget = state.teams.find((team) => team.id === state.selectedTeamId)!.budget;
    const released = gameReducer(state, { type: 'FIRE_STAFF', staffId: member.id })!;
    expect(released.staff).toHaveLength(0);
    expect(released.teams.find((team) => team.id === state.selectedTeamId)!.budget).toBe(beforeBudget - expected);
    expect(released.news[0].body).toContain('role is now vacant');
  });

  it('does not offer future staff extensions in single-season mode', () => {
    const state = hireFirst(freshState('SingleSeason'));
    const member = state.staff![0];
    expect(gameReducer(state, { type: 'EXTEND_STAFF_CONTRACT', staffId: member.id, years: 1 })).toEqual(state);
  });
});
