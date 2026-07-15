import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { getStaffPool } from '../data';
import { createNewGame } from '../game/initialCareer';
import { gameReducer } from '../game/gameReducer';
import { migrateGameState } from '../game/saveSystem';
import type { GameState } from '../game/careerState';
import type { CharacterInteractionTarget } from '../types/characterInteractionTypes';
import {
  interactionHistoryForTarget,
  isCharacterInteractionAvailable,
  performCharacterInteraction,
  recruitmentSigningDiscount,
} from './characterInteractionEngine';

function freshState(): GameState {
  return createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'character-interaction-test',
  });
}

describe('character interaction engine', () => {
  it('changes a driver relationship, records the outcome, and enforces a one-round cooldown', () => {
    const state = freshState();
    const driver = state.drivers.find((candidate) => candidate.teamId === state.selectedTeamId)!;
    const target: CharacterInteractionTarget = { type: 'Driver', id: driver.id, name: driver.name, teamId: driver.teamId };
    const before = state.driverRelationships![driver.id];

    const after = performCharacterInteraction(state, target, 'PrivateConversation');
    expect(after.driverRelationships![driver.id].trustInPrincipal).toBe(before.trustInPrincipal + 3);
    expect(after.driverRelationships![driver.id].frustration).toBe(Math.max(0, before.frustration - 2));
    expect(interactionHistoryForTarget(after, target)).toHaveLength(1);
    expect(isCharacterInteractionAvailable(after, target)).toBe(false);

    const blocked = performCharacterInteraction(after, target, 'PraisePerformance');
    expect(blocked).toBe(after);

    const nextRound = { ...after, currentRaceIndex: after.currentRaceIndex + 1 };
    expect(isCharacterInteractionAvailable(nextRound, target)).toBe(true);
    expect(interactionHistoryForTarget(performCharacterInteraction(nextRound, target, 'PraisePerformance'), target)).toHaveLength(2);
  });

  it('lets staff conversations affect their department mood', () => {
    const state = freshState();
    const member = getStaffPool(state.seasonYear, state.series)[0];
    const staffed = { ...state, staff: [member] };
    const target: CharacterInteractionTarget = { type: 'Staff', id: member.id, name: member.name, teamId: state.selectedTeamId };
    const department = member.role === 'Technical Director' ? 'Technical' : member.role === 'Race Engineer' ? 'Engineering' : 'RaceOperations';
    const before = staffed.phase18!.departmentMoods[state.selectedTeamId][department];
    const after = performCharacterInteraction(staffed, target, 'PraiseStaffWork');

    expect(after.phase18!.departmentMoods[state.selectedTeamId][department].morale).toBe(before.morale + 3);
    expect(after.phase18!.departmentMoods[state.selectedTeamId][department].trustInPrincipal).toBe(before.trustInPrincipal + 2);
  });

  it('turns owner and rival-principal conversations into persistent management consequences', () => {
    const state = freshState();
    const owner: CharacterInteractionTarget = { type: 'Owner', id: `owner-${state.selectedTeamId}`, name: 'Ownership', teamId: state.selectedTeamId };
    const ownerBefore = state.teamReputations![state.selectedTeamId].ownerPatience;
    const afterOwner = performCharacterInteraction(state, owner, 'PresentLongTermPlan');
    expect(afterOwner.teamReputations![state.selectedTeamId].ownerPatience).toBe(ownerBefore + 2);
    expect(afterOwner.principal!.jobSecurity).toBe(state.principal!.jobSecurity + 2);

    const rivalTeam = state.teams.find((team) => team.id !== state.selectedTeamId)!;
    const rivalPrincipal = state.aiPrincipals![rivalTeam.id];
    const rival: CharacterInteractionTarget = { type: 'RivalPrincipal', id: rivalPrincipal.principalId, name: rivalPrincipal.name, teamId: rivalTeam.id };
    const afterPressure = performCharacterInteraction(state, rival, 'ApplyPublicPressure');
    expect(afterPressure.aiPrincipals![rivalTeam.id].pressure).toBe(rivalPrincipal.pressure + 4);
    expect(interactionHistoryForTarget(afterPressure, rival)[0].tone).toBe('Negative');
  });

  it('rewards recruitment groundwork with a reduced staff signing fee', () => {
    const state = freshState();
    const candidate = getStaffPool(state.seasonYear, state.series)[0];
    const target: CharacterInteractionTarget = { type: 'StaffCandidate', id: candidate.id, name: candidate.name };
    const approached = performCharacterInteraction(state, target, 'ApproachRecruitment');
    expect(recruitmentSigningDiscount(approached, candidate.id)).toBe(0.05);

    const hired = gameReducer(approached, { type: 'HIRE_STAFF', staffId: candidate.id })!;
    const transaction = hired.finance?.find((entry) => entry.category === 'Staff' && entry.label.includes(candidate.name));
    expect(transaction?.amount).toBe(-Math.round(candidate.signingFee * 1_000_000 * 0.95));
    expect(transaction?.label).toContain('5% relationship discount');
  });

  it('backfills old saves and preserves interaction history during migration', () => {
    const state = freshState();
    const legacy = structuredClone(state);
    delete legacy.characterInteractions;
    expect(migrateGameState(legacy).characterInteractions).toEqual({
      version: 12,
      history: [],
      lastInteractionByTarget: {},
      recruitmentInterest: {},
      requestHistory: [],
      opinions: expect.any(Object),
      memories: [],
      ambitions: expect.any(Array),
      connections: expect.any(Array),
      factions: expect.any(Array),
      disputes: expect.any(Array),
      commitments: expect.any(Array),
      influence: expect.any(Array),
      initiatives: expect.any(Array),
      mandates: expect.any(Array),
      stability: expect.any(Array),
      breakingPoints: expect.any(Array),
      futureIntentions: expect.any(Array),
    });

    const driver = state.drivers.find((candidate) => candidate.teamId === state.selectedTeamId)!;
    const target: CharacterInteractionTarget = { type: 'Driver', id: driver.id, name: driver.name, teamId: driver.teamId };
    const interacted = performCharacterInteraction(state, target, 'DiscussFuture');
    expect(migrateGameState(interacted).characterInteractions).toEqual(interacted.characterInteractions);
  });
});
