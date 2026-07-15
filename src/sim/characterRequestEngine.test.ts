import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { getStaffPool } from '../data';
import type { GameState } from '../game/careerState';
import { defaultCareerPhaseState, generateAndStorePaddockEvents } from '../game/careerPhaseEngine';
import { createNewGame } from '../game/initialCareer';
import { generateCharacterRequestEvents, resolveCharacterRequest } from './characterRequestEngine';

function paddockState(round = 1): GameState {
  const state = createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'character-request-test',
  });
  return {
    ...state,
    careerPhase: {
      ...defaultCareerPhaseState(),
      currentPhase: 'paddock_week',
      currentRound: round,
      paddockWeekId: `pw-${state.seasonYear}-${round}`,
    },
  };
}

describe('character request engine', () => {
  it('generates a required driver conversation with live relationship context', () => {
    const state = paddockState(1);
    const urgent: GameState = {
      ...state,
      driverRelationships: Object.fromEntries(Object.entries(state.driverRelationships!).map(([id, relationship]) => [
        id,
        relationship.teamId === state.selectedTeamId
          ? { ...relationship, frustration: 80, trustInPrincipal: 20 }
          : relationship,
      ])),
    };
    const events = generateCharacterRequestEvents(urgent);
    expect(events).toHaveLength(1);
    expect(events[0].characterRequest?.requestKind).toBe('DriverConcern');
    expect(events[0].isRequiredDecision).toBe(true);
    expect(events[0].options?.map((option) => option.id)).toEqual(['listen-honestly', 'make-commitment', 'set-boundary']);
  });

  it('applies and remembers a driver response exactly once', () => {
    const state = paddockState(1);
    const event = generateCharacterRequestEvents(state)[0];
    const driverId = event.characterRequest!.targetId;
    const before = state.driverRelationships![driverId];
    const resolved = resolveCharacterRequest(state, event, 'listen-honestly');

    expect(resolved.driverRelationships![driverId].trustInPrincipal).toBe(Math.min(100, before.trustInPrincipal + 4));
    expect(resolved.driverRelationships![driverId].frustration).toBe(Math.max(0, before.frustration - 4));
    expect(resolved.characterInteractions?.requestHistory).toHaveLength(1);
    expect(resolved.characterInteractions?.requestHistory[0].optionLabel).toBe('Listen without promising');
    expect(resolveCharacterRequest(resolved, event, 'set-boundary')).toBe(resolved);
  });

  it('turns a commitment into an existing promise-system obligation when possible', () => {
    const state = paddockState(1);
    const event = generateCharacterRequestEvents(state)[0];
    const driverId = event.characterRequest!.targetId;
    const withContractWant: GameState = {
      ...state,
      driverRelationships: {
        ...state.driverRelationships!,
        [driverId]: { ...state.driverRelationships![driverId], wants: ['contract_renewal'] },
      },
    };
    const resolved = resolveCharacterRequest(withContractWant, event, 'make-commitment');
    expect(resolved.driverPromises?.some((promise) => promise.driverId === driverId && promise.promiseType === 'contract_renewal')).toBe(true);
  });

  it('lets staff requests spend real budget to reduce department workload', () => {
    const state = paddockState(2);
    const member = getStaffPool(state.seasonYear, state.series)[0];
    const staffed = { ...state, staff: [member] };
    const event = generateCharacterRequestEvents(staffed)[0];
    expect(event.characterRequest?.requestKind).toBe('StaffSupport');
    const department = member.role === 'Technical Director' ? 'Technical' : member.role === 'Race Engineer' ? 'Engineering' : 'RaceOperations';
    const beforeMood = staffed.phase18!.departmentMoods[state.selectedTeamId][department];
    const beforeBudget = staffed.teams.find((team) => team.id === staffed.selectedTeamId)!.budget;
    const resolved = resolveCharacterRequest(staffed, event, 'fund-support');
    expect(resolved.teams.find((team) => team.id === state.selectedTeamId)!.budget).toBe(beforeBudget - 500_000);
    expect(resolved.phase18!.departmentMoods[state.selectedTeamId][department].workload).toBe(Math.max(0, beforeMood.workload - 8));
  });

  it('alternates to ownership and can add an optional rival approach', () => {
    expect(generateCharacterRequestEvents(paddockState(3))[0].characterRequest?.requestKind).toBe('OwnerReview');
    const roundFour = generateCharacterRequestEvents(paddockState(4));
    expect(roundFour.some((event) => event.characterRequest?.requestKind === 'RivalApproach' && !event.isRequiredDecision)).toBe(true);
  });

  it('integrates character requests into the existing Paddock Week decision gate', () => {
    const generated = generateAndStorePaddockEvents(paddockState(1));
    const request = generated.careerPhase!.paddockEvents.find((event) => !!event.characterRequest);
    expect(request).toBeDefined();
    expect(generated.careerPhase!.requiredDecisionsComplete).toBe(false);
    expect(generated.careerPhase!.generatedEventsForCurrentWeek).toBe(true);
  });
});
