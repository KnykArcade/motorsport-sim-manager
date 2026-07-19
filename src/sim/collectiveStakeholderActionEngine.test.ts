import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import type { GameState } from '../game/careerState';
import {
  collectiveStakeholderActionUsedThisRound,
  takeCollectiveStakeholderAction,
} from './collectiveStakeholderActionEngine';

function freshState(seed = 'collective-stakeholders'): GameState {
  return createNewGame({ gameMode: 'Career', seasonYear: 1998, series: 'F1', teamId: 't-ferrari', seed });
}

describe('collective stakeholder actions', () => {
  it('turns a department workload review into immediate committee effects and a recorded cost', () => {
    const state = freshState();
    const phase18 = state.phase18!;
    const departments = phase18.departmentMoods[state.selectedTeamId];
    const prepared: GameState = {
      ...state,
      phase18: {
        ...phase18,
        departmentMoods: {
          ...phase18.departmentMoods,
          [state.selectedTeamId]: {
            ...departments,
            Technical: { ...departments.Technical, workload: 92, morale: 30, trustInPrincipal: 35 },
          },
        },
      },
    };
    const budget = prepared.teams.find((team) => team.id === prepared.selectedTeamId)!.budget;
    const next = takeCollectiveStakeholderAction(prepared, 'ReviewWorkload');
    const technical = next.phase18!.departmentMoods[next.selectedTeamId].Technical;

    expect(technical.workload).toBe(80);
    expect(technical.morale).toBe(34);
    expect(technical.trustInPrincipal).toBe(37);
    expect(next.teams.find((team) => team.id === next.selectedTeamId)!.budget).toBe(budget - 200_000);
    expect(next.phase18!.collectiveStakeholderActions?.at(-1)?.effects).toContain('Technical workload -12');
    expect(collectiveStakeholderActionUsedThisRound(next, 'Departments')).toBe(true);
    expect(takeCollectiveStakeholderAction(next, 'ClarifyPriorities')).toEqual(next);
  });

  it('allows one separate commercial action in the same round and exposes the result immediately', () => {
    const state = freshState('collective-commercial');
    expect(state.commercial?.sponsors.length).toBeGreaterThan(0);
    const departmentAction = takeCollectiveStakeholderAction(state, 'ClarifyPriorities');
    const confidence = departmentAction.commercial!.sponsors[0].confidence;
    const reputation = departmentAction.commercial!.commercialReputation;
    const next = takeCollectiveStakeholderAction(departmentAction, 'BriefSponsors');

    expect(next.commercial!.sponsors[0].confidence).toBe(Math.min(100, confidence + 4));
    expect(next.commercial!.commercialReputation).toBe(Math.min(100, reputation + 1));
    expect(next.phase18!.collectiveStakeholderActions).toHaveLength(2);
    expect(next.news[0].headline).toContain('Brief sponsors');
  });

  it('resets committee availability next round and survives a save round trip', () => {
    const first = takeCollectiveStakeholderAction(freshState('collective-cadence'), 'ClarifyPriorities');
    const nextRound: GameState = {
      ...first,
      currentRaceIndex: first.currentRaceIndex + 1,
      careerPhase: first.careerPhase ? { ...first.careerPhase, currentRound: first.careerPhase.currentRound + 1 } : first.careerPhase,
    };
    const second = takeCollectiveStakeholderAction(nextRound, 'ClarifyPriorities');
    const restored = JSON.parse(JSON.stringify(second)) as GameState;

    expect(second.phase18!.collectiveStakeholderActions).toHaveLength(2);
    expect(restored.phase18?.collectiveStakeholderActions).toEqual(second.phase18?.collectiveStakeholderActions);
  });
});
