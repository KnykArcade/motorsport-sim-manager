import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import type { GameState } from '../game/careerState';
import { createNewGame } from '../game/initialCareer';
import { migrateGameState } from '../game/saveSystem';
import type { CharacterInteractionTarget } from '../types/characterInteractionTypes';
import { createCharacterInitiative, generateCharacterInitiativeEvents, resolveCharacterInitiative } from './characterInitiativeEngine';
import {
  activeCharacterMandates,
  advanceCharacterMandates,
  generateCharacterMandateEvents,
  mandatesForTarget,
} from './characterMandateEngine';
import { characterMemoriesForTarget, currentCharacterTargets } from './characterOpinionEngine';

function freshState(): GameState {
  return createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'character-mandate-test' });
}

function withChampion(state: GameState, target: CharacterInteractionTarget): GameState {
  return {
    ...state,
    characterInteractions: {
      ...state.characterInteractions!,
      influence: state.characterInteractions!.influence.map((profile) => profile.target.type === target.type && profile.target.id === target.id
        ? { ...profile, support: 80, stance: 'Champion' as const }
        : { ...profile, support: 0, stance: 'Neutral' as const }),
    },
  };
}

function atRound(state: GameState, round: number): GameState {
  return { ...state, careerPhase: { ...state.careerPhase!, currentRound: round } };
}

function delegatedDriverMandate(): { state: GameState; target: CharacterInteractionTarget } {
  const base = freshState();
  const target = currentCharacterTargets(base).find((entry) => entry.type === 'Driver')!;
  const initiativeState = createCharacterInitiative(withChampion(base, target));
  const event = generateCharacterInitiativeEvents(initiativeState)[0];
  return { state: resolveCharacterInitiative(initiativeState, event, 'empower'), target };
}

describe('character mandate engine', () => {
  it('turns delegated initiative authority into a persistent measurable mandate', () => {
    const { state, target } = delegatedDriverMandate();
    const mandate = mandatesForTarget(state, target)[0];
    expect(mandate.kind).toBe('GarageLeadership');
    expect(mandate.authority).toBe('Full');
    expect(mandate.targetValue).toBe(mandate.currentValue + 4);
    expect(activeCharacterMandates(state)).toHaveLength(1);
  });

  it('applies one bounded contribution per round and never applies it twice', () => {
    const { state, target } = delegatedDriverMandate();
    const mandate = mandatesForTarget(state, target)[0];
    const roundOne = advanceCharacterMandates(atRound(state, mandate.createdRound + 1));
    const firstValue = mandatesForTarget(roundOne, target)[0].currentValue;
    expect(firstValue).toBeGreaterThan(mandate.currentValue);
    expect(advanceCharacterMandates(roundOne).characterInteractions!.mandates[0].currentValue).toBe(firstValue);
  });

  it('rewards a delivered mandate at the deadline and records accountability', () => {
    const { state, target } = delegatedDriverMandate();
    const mandate = mandatesForTarget(state, target)[0];
    let advanced = state;
    for (let round = mandate.createdRound + 1; round <= mandate.dueRound; round += 1) advanced = advanceCharacterMandates(atRound(advanced, round));
    const resolved = mandatesForTarget(advanced, target)[0];
    expect(resolved.status).toBe('Succeeded');
    expect(characterMemoriesForTarget(advanced, target)[0].source).toBe('Mandate');
    expect(generateCharacterMandateEvents(advanced)[0].title).toContain('delivered');
  });

  it('imposes accountability when a mandate misses its target', () => {
    const { state, target } = delegatedDriverMandate();
    const mandate = mandatesForTarget(state, target)[0];
    const impossible: GameState = {
      ...state,
      characterInteractions: {
        ...state.characterInteractions!,
        mandates: state.characterInteractions!.mandates.map((entry) => entry.id === mandate.id ? { ...entry, targetValue: 100, dueRound: mandate.createdRound + 1 } : entry),
      },
    };
    const trustBefore = impossible.driverRelationships![target.id].teamTrustInDriver;
    const failed = advanceCharacterMandates(atRound(impossible, mandate.createdRound + 1));
    expect(mandatesForTarget(failed, target)[0].status).toBe('Failed');
    expect(failed.driverRelationships![target.id].teamTrustInDriver).toBeLessThan(trustBefore + 2);
  });

  it('revokes a mandate when the character leaves and migrates old saves to version 10', () => {
    const { state, target } = delegatedDriverMandate();
    const mandate = mandatesForTarget(state, target)[0];
    const departed = { ...state, drivers: state.drivers.map((driver) => driver.id === target.id ? { ...driver, teamId: 'free-agent' } : driver) };
    const revoked = advanceCharacterMandates(atRound(departed, mandate.createdRound + 1));
    expect(mandatesForTarget(revoked, target)[0].status).toBe('Revoked');

    const legacy = structuredClone(freshState());
    delete (legacy.characterInteractions as Partial<typeof legacy.characterInteractions>)?.mandates;
    const migrated = migrateGameState(legacy);
    expect(migrated.characterInteractions!.version).toBe(10);
    expect(migrated.characterInteractions!.mandates).toEqual([]);
  });
});
