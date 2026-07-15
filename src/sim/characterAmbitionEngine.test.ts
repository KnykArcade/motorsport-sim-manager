import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import type { GameState } from '../game/careerState';
import { createNewGame } from '../game/initialCareer';
import { migrateGameState } from '../game/saveSystem';
import type { CharacterAmbition, CharacterInteractionTarget } from '../types/characterInteractionTypes';
import {
  activeAmbitionForTarget,
  advanceCharacterAmbitions,
  ensureCharacterAmbitions,
  generateCharacterAmbitionEvents,
} from './characterAmbitionEngine';
import { characterMemoriesForTarget, characterOpinionKey } from './characterOpinionEngine';

function freshState(): GameState {
  return createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'character-ambition-test',
  });
}

function driverTarget(state: GameState): CharacterInteractionTarget {
  const driver = state.drivers.find((candidate) => candidate.teamId === state.selectedTeamId)!;
  return { type: 'Driver', id: driver.id, name: driver.name, teamId: driver.teamId };
}

function replaceAmbition(state: GameState, ambition: CharacterAmbition): GameState {
  return {
    ...state,
    characterInteractions: {
      ...state.characterInteractions!,
      ambitions: state.characterInteractions!.ambitions.map((entry) => entry.targetType === ambition.targetType && entry.targetId === ambition.targetId ? ambition : entry),
    },
  };
}

describe('character ambition engine', () => {
  it('seeds one measurable active ambition for each current character', () => {
    const state = ensureCharacterAmbitions(freshState());
    const active = state.characterInteractions!.ambitions.filter((entry) => entry.status === 'Active');
    const expectedMinimum = state.drivers.filter((driver) => driver.teamId === state.selectedTeamId).length + state.teams.length;

    expect(active.length).toBeGreaterThanOrEqual(expectedMinimum);
    expect(active.every((entry) => entry.targetValue > entry.currentValue || entry.targetValue === 100)).toBe(true);
    expect(active.every((entry) => entry.deadlineRound > 0)).toBe(true);
  });

  it('satisfies an objective, rewards the relationship, and records a lasting memory', () => {
    const state = freshState();
    const target = driverTarget(state);
    const ambition = activeAmbitionForTarget(state, target)!;
    const relationship = state.driverRelationships![target.id];
    const prepared = replaceAmbition({
      ...state,
      currentRaceIndex: 1,
      driverRelationships: {
        ...state.driverRelationships!,
        [target.id]: { ...relationship, teammateRelationship: 75 },
      },
    }, {
      ...ambition,
      agenda: 'TeamHarmony',
      measureLabel: 'Teammate relationship',
      currentValue: 50,
      targetValue: 65,
      startedRound: 1,
      deadlineRound: 5,
    });

    const resolved = advanceCharacterAmbitions(prepared);
    const result = resolved.characterInteractions!.ambitions.find((entry) => entry.id === ambition.id)!;

    expect(result.status).toBe('Satisfied');
    expect(resolved.driverRelationships![target.id].trustInPrincipal).toBe(relationship.trustInPrincipal + 3);
    expect(characterMemoriesForTarget(resolved, target)[0].source).toBe('Ambition');
    expect(characterMemoriesForTarget(resolved, target)[0].tone).toBe('Positive');
  });

  it('fails a missed deadline and escalates relationship consequences', () => {
    const state = freshState();
    const target = driverTarget(state);
    const ambition = activeAmbitionForTarget(state, target)!;
    const relationship = state.driverRelationships![target.id];
    const prepared = replaceAmbition({ ...state, currentRaceIndex: 2 }, {
      ...ambition,
      agenda: 'TeamHarmony',
      measureLabel: 'Teammate relationship',
      targetValue: 95,
      startedRound: 1,
      deadlineSeason: state.seasonYear,
      deadlineRound: 3,
    });

    const resolved = advanceCharacterAmbitions(prepared);
    const result = resolved.characterInteractions!.ambitions.find((entry) => entry.id === ambition.id)!;

    expect(result.status).toBe('Failed');
    expect(result.pressure).toBe('Ultimatum');
    expect(resolved.driverRelationships![target.id].trustInPrincipal).toBe(relationship.trustInPrincipal - 5);
    expect(characterMemoriesForTarget(resolved, target)[0].tone).toBe('Negative');
  });

  it('surfaces critical pressure during Paddock Week without creating another blocking decision', () => {
    const state = freshState();
    const target = driverTarget(state);
    const ambition = activeAmbitionForTarget(state, target)!;
    const key = characterOpinionKey(target);
    const prepared = replaceAmbition({
      ...state,
      currentRaceIndex: 1,
      characterInteractions: {
        ...state.characterInteractions!,
        opinions: {
          ...state.characterInteractions!.opinions,
          [key]: { ...state.characterInteractions!.opinions[key], score: -70 },
        },
      },
    }, { ...ambition, startedRound: 1, targetValue: 95 });
    const advanced = advanceCharacterAmbitions(prepared);
    const active = activeAmbitionForTarget(advanced, target)!;
    const event = generateCharacterAmbitionEvents(advanced).find((entry) => entry.title.includes(target.name));

    expect(active.pressure).toBe('Ultimatum');
    expect(event?.severity).toBe('critical');
    expect(event?.isRequiredDecision).toBe(false);
  });

  it('backfills ambitions on old saves and preserves existing objectives', () => {
    const state = freshState();
    const existingIds = state.characterInteractions!.ambitions.map((entry) => entry.id);
    const migrated = migrateGameState(structuredClone(state));
    expect(migrated.characterInteractions?.version).toBe(4);
    expect(migrated.characterInteractions?.ambitions.map((entry) => entry.id)).toEqual(existingIds);

    const legacy = structuredClone(state) as GameState;
    delete (legacy.characterInteractions as Partial<typeof legacy.characterInteractions>)?.ambitions;
    expect(migrateGameState(legacy).characterInteractions!.ambitions.length).toBeGreaterThan(0);
  });
});
