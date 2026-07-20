import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { getStaffPool } from '../data';
import { createNewGame } from '../game/initialCareer';
import { gameReducer } from '../game/gameReducer';
import { migrateGameState } from '../game/saveSystem';
import type { GameState } from '../game/careerState';
import type { CharacterInteractionTarget } from '../types/characterInteractionTypes';
import type { DriverRelationship } from '../types/relationshipTypes';
import {
  driverActionRelationshipContext,
  interactionHistoryForTarget,
  isCharacterInteractionAvailable,
  ownerActionPersonalityContext,
  performCharacterInteraction,
  recruitmentSigningDiscount,
  staffActionDepartmentContext,
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

  it('warns when challenging a vulnerable driver and records the stronger negative reaction', () => {
    const state = freshState();
    const driver = state.drivers.find((candidate) => candidate.teamId === state.selectedTeamId)!;
    const target: CharacterInteractionTarget = { type: 'Driver', id: driver.id, name: driver.name, teamId: driver.teamId };
    const relationship = state.driverRelationships![driver.id];
    const vulnerable = {
      ...state,
      driverRelationships: {
        ...state.driverRelationships!,
        [driver.id]: { ...relationship, selfConfidence: 35, morale: 38, personalityTraits: ['Pressure Sensitive'] as DriverRelationship['personalityTraits'] },
      },
    };

    expect(driverActionRelationshipContext(vulnerable, target, 'ChallengePerformance')).toMatchObject({ fit: 'Risky' });
    const result = performCharacterInteraction(vulnerable, target, 'ChallengePerformance');
    expect(result.driverRelationships![driver.id]).toMatchObject({
      morale: 34,
      frustration: relationship.frustration + 4,
      trustInPrincipal: relationship.trustInPrincipal - 3,
    });
    expect(interactionHistoryForTarget(result, target)[0].tone).toBe('Negative');
  });

  it('rewards a future discussion when the driver has an active status concern', () => {
    const state = freshState();
    const driver = state.drivers.find((candidate) => candidate.teamId === state.selectedTeamId)!;
    const target: CharacterInteractionTarget = { type: 'Driver', id: driver.id, name: driver.name, teamId: driver.teamId };
    const relationship = state.driverRelationships![driver.id];
    const concerned = {
      ...state,
      driverRelationships: {
        ...state.driverRelationships!,
        [driver.id]: { ...relationship, wants: ['contract_renewal'] as DriverRelationship['wants'] },
      },
    };

    expect(driverActionRelationshipContext(concerned, target, 'DiscussFuture')).toMatchObject({ fit: 'Favored' });
    const result = performCharacterInteraction(concerned, target, 'DiscussFuture');
    expect(result.driverRelationships![driver.id].trustInPrincipal).toBe(relationship.trustInPrincipal + 4);
    expect(result.driverRelationships![driver.id].frustration).toBe(Math.max(0, relationship.frustration - 3));
  });

  it('lets staff conversations affect their department mood', () => {
    const state = freshState();
    const member = getStaffPool(state.seasonYear, state.series)[0];
    const staffed = { ...state, staff: [member] };
    const target: CharacterInteractionTarget = { type: 'Staff', id: member.id, name: member.name, teamId: state.selectedTeamId };
    const department = member.role === 'Technical Director' ? 'Technical' : member.role === 'Race Engineer' ? 'Engineering' : 'RaceOperations';
    const before = staffed.phase18!.departmentMoods[state.selectedTeamId][department];
    const after = performCharacterInteraction(staffed, target, 'PraiseStaffWork');

    expect(after.phase18!.departmentMoods[state.selectedTeamId][department].morale).toBe(before.morale + 4);
    expect(after.phase18!.departmentMoods[state.selectedTeamId][department].trustInPrincipal).toBe(before.trustInPrincipal + 3);
  });

  it('warns against adding expectations to an overloaded department', () => {
    const state = freshState();
    const member = getStaffPool(state.seasonYear, state.series)[0];
    const department = member.role === 'Technical Director' ? 'Technical' : member.role === 'Race Engineer' ? 'Engineering' : 'RaceOperations';
    const mood = state.phase18!.departmentMoods[state.selectedTeamId][department];
    const overloaded: GameState = {
      ...state,
      staff: [member],
      phase18: {
        ...state.phase18!,
        departmentMoods: {
          ...state.phase18!.departmentMoods,
          [state.selectedTeamId]: {
            ...state.phase18!.departmentMoods[state.selectedTeamId],
            [department]: { ...mood, workload: 82, trustInPrincipal: 32 },
          },
        },
      },
    };
    const target: CharacterInteractionTarget = { type: 'Staff', id: member.id, name: member.name, teamId: state.selectedTeamId };

    expect(staffActionDepartmentContext(overloaded, target, 'SetExpectations')).toMatchObject({ fit: 'Risky' });
    const result = performCharacterInteraction(overloaded, target, 'SetExpectations');
    expect(result.phase18!.departmentMoods[state.selectedTeamId][department]).toMatchObject({
      strategicAlignment: mood.strategicAlignment + 2,
      workload: 86,
      trustInPrincipal: 29,
    });
    expect(interactionHistoryForTarget(result, target)[0].tone).toBe('Negative');
  });

  it('makes recognition more effective when department morale is low', () => {
    const state = freshState();
    const member = getStaffPool(state.seasonYear, state.series)[0];
    const department = member.role === 'Technical Director' ? 'Technical' : member.role === 'Race Engineer' ? 'Engineering' : 'RaceOperations';
    const mood = state.phase18!.departmentMoods[state.selectedTeamId][department];
    const lowMorale: GameState = {
      ...state,
      staff: [member],
      phase18: {
        ...state.phase18!,
        departmentMoods: {
          ...state.phase18!.departmentMoods,
          [state.selectedTeamId]: {
            ...state.phase18!.departmentMoods[state.selectedTeamId],
            [department]: { ...mood, morale: 38 },
          },
        },
      },
    };
    const target: CharacterInteractionTarget = { type: 'Staff', id: member.id, name: member.name, teamId: state.selectedTeamId };

    expect(staffActionDepartmentContext(lowMorale, target, 'PraiseStaffWork')).toMatchObject({ fit: 'Favored' });
    const result = performCharacterInteraction(lowMorale, target, 'PraiseStaffWork');
    expect(result.phase18!.departmentMoods[state.selectedTeamId][department].morale).toBe(42);
  });

  it('turns owner and rival-principal conversations into persistent management consequences', () => {
    const state = freshState();
    const owner: CharacterInteractionTarget = { type: 'Owner', id: `owner-${state.selectedTeamId}`, name: 'Ownership', teamId: state.selectedTeamId };
    const ownerBefore = state.teamReputations![state.selectedTeamId].ownerPatience;
    const afterOwner = performCharacterInteraction(state, owner, 'PresentLongTermPlan');
    expect(afterOwner.teamReputations![state.selectedTeamId].ownerPatience).toBe(ownerBefore + 3);
    expect(afterOwner.principal!.jobSecurity).toBe(state.principal!.jobSecurity + 3);

    const rivalTeam = state.teams.find((team) => team.id !== state.selectedTeamId)!;
    const rivalPrincipal = state.aiPrincipals![rivalTeam.id];
    const rival: CharacterInteractionTarget = { type: 'RivalPrincipal', id: rivalPrincipal.principalId, name: rivalPrincipal.name, teamId: rivalTeam.id };
    const afterPressure = performCharacterInteraction(state, rival, 'ApplyPublicPressure');
    expect(afterPressure.aiPrincipals![rivalTeam.id].pressure).toBe(rivalPrincipal.pressure + 4);
    expect(interactionHistoryForTarget(afterPressure, rival)[0].tone).toBe('Negative');
  });

  it('makes owner personality change both the visible fit and the resulting owner response', () => {
    const base = freshState();
    const owner: CharacterInteractionTarget = { type: 'Owner', id: `owner-${base.selectedTeamId}`, name: 'Ownership', teamId: base.selectedTeamId };
    const withPersonality = (ownerPersonality: NonNullable<GameState['teamReputations']>[string]['ownerPersonality']) => ({
      ...base,
      teamReputations: {
        ...base.teamReputations!,
        [base.selectedTeamId]: { ...base.teamReputations![base.selectedTeamId], ownerPersonality },
      },
    });

    const patient = withPersonality('PatientBuilder');
    const tycoon = withPersonality('WinNowTycoon');
    expect(ownerActionPersonalityContext(patient, 'PresentLongTermPlan')).toMatchObject({ fit: 'Favored', ownerLabel: 'Patient Builder' });
    expect(ownerActionPersonalityContext(tycoon, 'PresentLongTermPlan')).toMatchObject({ fit: 'Skeptical', ownerLabel: 'Win-Now Tycoon' });

    const patientResult = performCharacterInteraction(patient, owner, 'PresentLongTermPlan');
    const tycoonResult = performCharacterInteraction(tycoon, owner, 'PresentLongTermPlan');
    expect(patientResult.teamReputations![base.selectedTeamId].ownerPatience).toBe(base.teamReputations![base.selectedTeamId].ownerPatience + 3);
    expect(tycoonResult.teamReputations![base.selectedTeamId].ownerPatience).toBe(base.teamReputations![base.selectedTeamId].ownerPatience + 1);
    expect(interactionHistoryForTarget(tycoonResult, owner)[0]).toMatchObject({ tone: 'Mixed' });
  });

  it('makes a Budget Hawk reward proof and punish a weak financial review more strongly', () => {
    const base = freshState();
    const owner: CharacterInteractionTarget = { type: 'Owner', id: `owner-${base.selectedTeamId}`, name: 'Ownership', teamId: base.selectedTeamId };
    const budgetHawk = {
      ...base,
      teamReputations: {
        ...base.teamReputations!,
        [base.selectedTeamId]: { ...base.teamReputations![base.selectedTeamId], ownerPersonality: 'BudgetHawk' as const },
      },
    };
    const disciplined = {
      ...budgetHawk,
      principal: { ...budgetHawk.principal!, attributes: { ...budgetHawk.principal!.attributes, financialDiscipline: 70 } },
    };
    const careless = {
      ...budgetHawk,
      principal: { ...budgetHawk.principal!, attributes: { ...budgetHawk.principal!.attributes, financialDiscipline: 30 } },
    };

    expect(performCharacterInteraction(disciplined, owner, 'ReviewBudgetDiscipline').teamReputations![base.selectedTeamId].ownerPatience)
      .toBe(base.teamReputations![base.selectedTeamId].ownerPatience + 4);
    expect(performCharacterInteraction(careless, owner, 'ReviewBudgetDiscipline').teamReputations![base.selectedTeamId].ownerPatience)
      .toBe(base.teamReputations![base.selectedTeamId].ownerPatience - 3);
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
      version: 13,
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
      personnelMoves: [],
    });

    const driver = state.drivers.find((candidate) => candidate.teamId === state.selectedTeamId)!;
    const target: CharacterInteractionTarget = { type: 'Driver', id: driver.id, name: driver.name, teamId: driver.teamId };
    const interacted = performCharacterInteraction(state, target, 'DiscussFuture');
    expect(migrateGameState(interacted).characterInteractions).toEqual(interacted.characterInteractions);
  });
});
