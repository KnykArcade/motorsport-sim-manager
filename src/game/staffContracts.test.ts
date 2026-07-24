import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { getStaffPool } from '../data';
import { staffReleaseCost } from '../sim/staffEngine';
import type { GameState } from './careerState';
import { gameReducer } from './gameReducer';
import { createNewGame } from './initialCareer';
import { staffEmployer, staffPoachingCompensation } from '../sim/aiStaffRosterEngine';

function freshState(gameMode: GameState['gameMode'] = 'Career'): GameState {
  return createNewGame({ gameMode, seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'staff-contract-test' });
}

function hireFirst(state: GameState): GameState {
  const candidate = getStaffPool(state.seasonYear, state.series).find((member) => !staffEmployer(state.aiStaff, member.id))!;
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
  it('adds a specialist to a department with legacy contract terms', () => {
    const hired = hireFirst(freshState());
    expect(hired.staff).toHaveLength(1);
    expect(hired.staff![0].contractYearsRemaining).toBe(2);
    expect(hired.news[0].body).toContain('department with a new specialist');
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

  it('charges compensation for an early release and returns the department to baseline', () => {
    const state = hireFirst(freshState());
    const member = state.staff![0];
    const expected = staffReleaseCost(member);
    const beforeBudget = state.teams.find((team) => team.id === state.selectedTeamId)!.budget;
    const released = gameReducer(state, { type: 'FIRE_STAFF', staffId: member.id })!;
    expect(released.staff).toHaveLength(0);
    expect(released.teams.find((team) => team.id === state.selectedTeamId)!.budget).toBe(beforeBudget - expected);
    expect(released.news[0].body).toContain('department returns to its baseline rating');
  });

  it('lets the player poach a named rival specialist with compensation and no duplicate roster entry', () => {
    const base = freshState();
    const [employerTeamId, rivalRoster] = Object.entries(base.aiStaff!).find(([, staff]) => staff.length > 0)!;
    const candidate = rivalRoster[0];
    const compensation = staffPoachingCompensation(candidate);
    const funded: GameState = {
      ...base,
      teams: base.teams.map((team) => team.id === base.selectedTeamId ? { ...team, budget: 1_000_000_000 } : team),
    };
    const employerBudget = funded.teams.find((team) => team.id === employerTeamId)!.budget;
    const hired = gameReducer(funded, { type: 'HIRE_STAFF', staffId: candidate.id })!;
    expect(hired.staff?.find((member) => member.id === candidate.id)).toMatchObject({ contractYearsRemaining: 2 });
    expect(hired.aiStaff?.[employerTeamId].some((member) => member.id === candidate.id)).toBe(false);
    expect(Object.values(hired.aiStaff ?? {}).flat().some((member) => member.id === candidate.id)).toBe(false);
    expect(hired.teams.find((team) => team.id === employerTeamId)!.budget).toBe(employerBudget + compensation);
    expect(hired.news[0].body).toContain('transition compensation');
    const career = hired.personnelCareerHistory?.filter((tenure) => tenure.kind === 'Staff' && tenure.personId === candidate.id) ?? [];
    expect(career).toHaveLength(2);
    expect(career.find((tenure) => tenure.teamId === employerTeamId)?.endedSeason).toBe(base.seasonYear);
    expect(career.find((tenure) => tenure.teamId === base.selectedTeamId)?.endedSeason).toBeUndefined();
  });

  it('does not offer future staff extensions in single-season mode', () => {
    const state = hireFirst(freshState('SingleSeason'));
    const member = state.staff![0];
    expect(gameReducer(state, { type: 'EXTEND_STAFF_CONTRACT', staffId: member.id, years: 1 })).toEqual(state);
  });
});
