import '../../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../../game/initialCareer';
import type { GameState } from '../../game/careerState';
import { relationshipAttentionForTarget } from '../../sim/relationshipAttentionEngine';
import type { CharacterInteractionTarget } from '../../types/characterInteractionTypes';
import { characterGameplayEffect } from './relationshipCharacterEffectViewModel';

function freshState(): GameState {
  return createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'relationship-character-effect' });
}

function withStance(state: GameState, target: CharacterInteractionTarget, stance: 'Supportive' | 'Resistant'): GameState {
  return {
    ...state,
    characterInteractions: {
      ...state.characterInteractions!,
      influence: state.characterInteractions!.influence.map((entry) =>
        entry.target.type === target.type && entry.target.id === target.id
          ? { ...entry, stance }
          : entry),
    },
  };
}

describe('character gameplay effect summaries', () => {
  it('summarizes owner pressure without exact thresholds or drift math', () => {
    const base = freshState();
    const target: CharacterInteractionTarget = {
      type: 'Owner',
      id: `owner-${base.selectedTeamId}`,
      name: 'Team Owner',
      teamId: base.selectedTeamId,
    };
    const state = withStance({
      ...base,
      principal: { ...base.principal!, jobSecurity: 21 },
      teamReputations: {
        ...base.teamReputations!,
        [base.selectedTeamId]: { ...base.teamReputations![base.selectedTeamId], ownerPatience: 35 },
      },
    }, target, 'Resistant');

    const effect = characterGameplayEffect(state, relationshipAttentionForTarget(state, target));

    expect(effect).toMatchObject({ label: 'Career position', value: 'Job looks immediately vulnerable', tone: 'Negative' });
    expect(`${effect?.value} ${effect?.detail}`).not.toMatch(/\/100|threshold|by [+-]?\d/i);
    expect(effect?.detail).toContain('patience');
  });

  it('summarizes driver pace pressure without exact simulation modifiers', () => {
    const base = freshState();
    const driver = base.drivers.find((entry) => entry.teamId === base.selectedTeamId)!;
    const relationship = base.driverRelationships![driver.id];
    const target: CharacterInteractionTarget = { type: 'Driver', id: driver.id, name: driver.name, teamId: driver.teamId };
    const state = withStance({
      ...base,
      driverRelationships: {
        ...base.driverRelationships!,
        [driver.id]: {
          ...relationship,
          selfConfidence: 90,
          trustInCar: 90,
          trustInTeam: 90,
          trustInPrincipal: 90,
          morale: 90,
          frustration: 10,
        },
      },
    }, target, 'Supportive');

    const effect = characterGameplayEffect(state, relationshipAttentionForTarget(state, target));

    expect(effect).toMatchObject({ label: 'Qualifying and race pace', value: 'Pace may lift if the race weekend starts cleanly', tone: 'Positive' });
    expect(effect?.detail).toContain('Inspired confidence');
    expect(`${effect?.value} ${effect?.detail}`).not.toMatch(/[+-]\d|% pace|by [+-]?\d/i);
  });
});
