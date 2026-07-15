import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { getStaffPool } from '../data';
import type { GameState } from '../game/careerState';
import { createNewGame } from '../game/initialCareer';
import { migrateGameState } from '../game/saveSystem';
import type { PaddockEvent } from '../types/careerPhaseTypes';
import type { CharacterInteractionTarget } from '../types/characterInteractionTypes';
import { resolveCharacterRequest } from './characterRequestEngine';
import {
  advanceCharacterCommitments,
  commitmentsForTarget,
  generateCharacterCommitmentEvents,
} from './characterCommitmentEngine';
import { characterMemoriesForTarget, characterOpinionFor } from './characterOpinionEngine';

function freshState(): GameState {
  return createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'character-commitment-test' });
}

function request(state: GameState, target: CharacterInteractionTarget, kind: NonNullable<PaddockEvent['characterRequest']>['requestKind'], optionId: string): PaddockEvent {
  return {
    id: `commitment-request-${kind}-${target.id}`,
    weekId: 'pw-test', season: state.seasonYear, series: state.series, round: state.currentRaceIndex + 1,
    category: target.type === 'Staff' ? 'staff' : target.type === 'Owner' ? 'finance' : target.type === 'RivalPrincipal' ? 'regulation' : 'driver_morale',
    title: 'Commitment test', description: 'A test request.', severity: 'major', isRequiredDecision: true,
    options: [{ id: optionId, label: 'Make commitment', description: 'Create a measurable obligation.' }],
    effectsApplied: false, createdAt: new Date(0).toISOString(),
    characterRequest: { requestKind: kind, targetType: target.type, targetId: target.id, targetName: target.name, teamId: target.teamId },
  };
}

describe('character commitment engine', () => {
  it('turns an ownership target into a persistent measurable commitment', () => {
    const state = freshState();
    const team = state.teams.find((entry) => entry.id === state.selectedTeamId)!;
    const target: CharacterInteractionTarget = { type: 'Owner', id: `owner-${team.id}`, name: `${team.name} Ownership`, teamId: team.id };
    const resolved = resolveCharacterRequest(state, request(state, target, 'OwnerReview', 'commit-target'), 'commit-target');
    const commitment = commitmentsForTarget(resolved, target)[0];
    expect(commitment.kind).toBe('CompetitiveTarget');
    expect(commitment.status).toBe('Active');
    expect(commitment.targetValue).toBeGreaterThan(commitment.currentValue);
  });

  it('fulfills a commitment at its deadline and records the outcome in character memory', () => {
    const state = freshState();
    const team = state.teams.find((entry) => entry.id === state.selectedTeamId)!;
    const target: CharacterInteractionTarget = { type: 'Owner', id: `owner-${team.id}`, name: `${team.name} Ownership`, teamId: team.id };
    const created = resolveCharacterRequest(state, request(state, target, 'OwnerReview', 'commit-target'), 'commit-target');
    const commitment = commitmentsForTarget(created, target)[0];
    const atDeadline: GameState = {
      ...created,
      currentRaceIndex: commitment.dueRound - 1,
      principal: { ...created.principal!, attributes: { ...created.principal!.attributes, boardConfidence: commitment.targetValue } },
    };
    const before = characterOpinionFor(atDeadline, target).score;
    const advanced = advanceCharacterCommitments(atDeadline);
    expect(commitmentsForTarget(advanced, target)[0].status).toBe('Fulfilled');
    expect(characterOpinionFor(advanced, target).score).toBeGreaterThan(before);
    expect(characterMemoriesForTarget(advanced, target)[0].source).toBe('Commitment');
    expect(generateCharacterCommitmentEvents(advanced)[0].title).toContain('delivered');
  });

  it('breaks a missed commitment and damages trust', () => {
    const state = freshState();
    const team = state.teams.find((entry) => entry.id === state.selectedTeamId)!;
    const target: CharacterInteractionTarget = { type: 'Owner', id: `owner-${team.id}`, name: `${team.name} Ownership`, teamId: team.id };
    const created = resolveCharacterRequest(state, request(state, target, 'OwnerReview', 'commit-target'), 'commit-target');
    const commitment = commitmentsForTarget(created, target)[0];
    const atDeadline = { ...created, currentRaceIndex: commitment.dueRound - 1 };
    const before = characterOpinionFor(atDeadline, target).score;
    const advanced = advanceCharacterCommitments(atDeadline);
    expect(commitmentsForTarget(advanced, target)[0].status).toBe('Broken');
    expect(characterOpinionFor(advanced, target).score).toBeLessThan(before);
  });

  it('tracks funded staff support as an obligation to keep workload sustainable', () => {
    const state = freshState();
    const staff = getStaffPool(state.seasonYear, state.series)[0];
    const staffed = { ...state, staff: [staff] };
    const target: CharacterInteractionTarget = { type: 'Staff', id: staff.id, name: staff.name, teamId: state.selectedTeamId };
    const resolved = resolveCharacterRequest(staffed, request(staffed, target, 'StaffSupport', 'fund-support'), 'fund-support');
    expect(commitmentsForTarget(resolved, target)[0].kind).toBe('DepartmentSupport');
  });

  it('backfills commitments on older saves without losing character history', () => {
    const legacy = structuredClone(freshState());
    delete (legacy.characterInteractions as Partial<typeof legacy.characterInteractions>)?.commitments;
    const migrated = migrateGameState(legacy);
    expect(migrated.characterInteractions!.version).toBe(13);
    expect(migrated.characterInteractions!.commitments).toEqual([]);
  });
});
