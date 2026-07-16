import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { getStaffPool } from '../data';
import { createNewGame } from '../game/initialCareer';
import { migrateGameState } from '../game/saveSystem';
import type { GameState } from '../game/careerState';
import type { CharacterInteractionTarget } from '../types/characterInteractionTypes';
import { performCharacterInteraction } from './characterInteractionEngine';
import { generateCharacterRequestEvents, resolveCharacterRequest } from './characterRequestEngine';
import {
  characterMemoriesForTarget,
  characterOpinionFor,
  characterOpinionKey,
  ensureCharacterOpinions,
  recordCharacterMemory,
} from './characterOpinionEngine';

function freshState(): GameState {
  return createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'character-opinion-test',
  });
}

describe('character opinion engine', () => {
  it('seeds distinct persistent profiles for the people around the player', () => {
    const base = freshState();
    const member = getStaffPool(base.seasonYear, base.series)[0];
    const state = ensureCharacterOpinions({ ...base, staff: [member] });
    const driver = state.drivers.find((candidate) => candidate.teamId === state.selectedTeamId)!;
    const rivalTeam = state.teams.find((team) => team.id !== state.selectedTeamId)!;
    const rival = state.aiPrincipals![rivalTeam.id];

    expect(characterOpinionFor(state, { type: 'Driver', id: driver.id, name: driver.name, teamId: driver.teamId }).traits.length).toBeGreaterThan(0);
    expect(characterOpinionFor(state, { type: 'Staff', id: member.id, name: member.name, teamId: state.selectedTeamId }).agenda).toBeTruthy();
    expect(characterOpinionFor(state, { type: 'Owner', id: `owner-${state.selectedTeamId}`, name: 'Ownership', teamId: state.selectedTeamId }).traits).toHaveLength(1);
    expect(characterOpinionFor(state, { type: 'RivalPrincipal', id: rival.principalId, name: rival.name, teamId: rivalTeam.id }).agenda).toBeTruthy();
  });

  it('makes personality change how strongly a character remembers the same decision', () => {
    const state = freshState();
    const drivers = state.drivers.filter((candidate) => candidate.teamId === state.selectedTeamId);
    const resilient = drivers[0];
    const demanding = drivers[1];
    const resilientTarget: CharacterInteractionTarget = { type: 'Driver', id: resilient.id, name: resilient.name, teamId: resilient.teamId };
    const demandingTarget: CharacterInteractionTarget = { type: 'Driver', id: demanding.id, name: demanding.name, teamId: demanding.teamId };
    const withoutSeededProfiles: GameState = {
      ...state,
      driverRelationships: {
        ...state.driverRelationships!,
        [resilient.id]: { ...state.driverRelationships![resilient.id], personalityTraits: ['Resilient'] },
        [demanding.id]: { ...state.driverRelationships![demanding.id], personalityTraits: ['Demanding'] },
      },
      characterInteractions: {
        ...state.characterInteractions!,
        opinions: {},
      },
    };
    const resilientResult = recordCharacterMemory(withoutSeededProfiles, resilientTarget, {
      source: 'Request', label: 'Boundary set', description: 'Management rejected the request.', tone: 'Negative', effects: ['-4 trust'],
    });
    const demandingResult = recordCharacterMemory(withoutSeededProfiles, demandingTarget, {
      source: 'Request', label: 'Boundary set', description: 'Management rejected the request.', tone: 'Negative', effects: ['-4 trust'],
    });

    expect(characterMemoriesForTarget(resilientResult, resilientTarget)[0].opinionDelta).toBe(-5);
    expect(characterMemoriesForTarget(demandingResult, demandingTarget)[0].opinionDelta).toBe(-9);
  });

  it('records one lasting memory for direct interactions and character requests', () => {
    const state = freshState();
    const request = generateCharacterRequestEvents(state).find((event) => event.characterRequest?.targetType === 'Driver');
    if (!request?.characterRequest) throw new Error('Expected a driver request');
    const driver = state.drivers.find((candidate) => candidate.id === request.characterRequest!.targetId)!;
    const target: CharacterInteractionTarget = { type: 'Driver', id: driver.id, name: driver.name, teamId: driver.teamId };
    const before = characterOpinionFor(state, target).score;
    const interacted = performCharacterInteraction(state, target, 'PrivateConversation');

    expect(characterMemoriesForTarget(interacted, target)).toHaveLength(1);
    expect(characterOpinionFor(interacted, target).score).toBeGreaterThan(before);

    const resolved = resolveCharacterRequest(interacted, request, 'listen-honestly');
    expect(characterMemoriesForTarget(resolved, target)).toHaveLength(2);
    expect(resolveCharacterRequest(resolved, request, 'set-boundary')).toBe(resolved);
  });

  it('backfills current opinions on old saves without losing existing memories', () => {
    const state = freshState();
    const driver = state.drivers.find((candidate) => candidate.teamId === state.selectedTeamId)!;
    const target: CharacterInteractionTarget = { type: 'Driver', id: driver.id, name: driver.name, teamId: driver.teamId };
    const remembered = recordCharacterMemory(state, target, {
      source: 'Interaction', label: 'Honest meeting', description: 'The driver felt heard.', tone: 'Positive', effects: ['+3 trust'],
    });
    const legacy = structuredClone(remembered);
    (legacy.characterInteractions!.version as number) = 4;
    delete legacy.characterInteractions!.opinions[characterOpinionKey(target)];
    const migrated = migrateGameState(legacy);

    expect(migrated.characterInteractions?.version).toBe(13);
    expect(characterOpinionFor(migrated, target)).toBeTruthy();
    expect(characterMemoriesForTarget(migrated, target)).toHaveLength(1);
  });

  it('turns a seriously negative opinion into a required driver meeting', () => {
    const state = freshState();
    const driver = state.drivers.find((candidate) => candidate.teamId === state.selectedTeamId)!;
    const target: CharacterInteractionTarget = { type: 'Driver', id: driver.id, name: driver.name, teamId: driver.teamId };
    const key = characterOpinionKey(target);
    const opinion = characterOpinionFor(state, target);
    const strained: GameState = {
      ...state,
      characterInteractions: {
        ...state.characterInteractions!,
        opinions: { ...state.characterInteractions!.opinions, [key]: { ...opinion, score: -35 } },
      },
    };
    const event = generateCharacterRequestEvents(strained).find((candidate) => candidate.characterRequest?.targetId === driver.id);
    expect(event?.isRequiredDecision).toBe(true);
  });
});
