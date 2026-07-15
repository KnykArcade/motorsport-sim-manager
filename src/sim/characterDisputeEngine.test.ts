import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import type { GameState } from '../game/careerState';
import { createNewGame } from '../game/initialCareer';
import { migrateGameState } from '../game/saveSystem';
import type { CharacterInteractionTarget } from '../types/characterInteractionTypes';
import { refreshCharacterConnections } from './characterConnectionEngine';
import {
  disputesForTarget,
  generateCharacterDisputeEvents,
  refreshCharacterDisputes,
  resolveCharacterDispute,
} from './characterDisputeEngine';
import { characterMemoriesForTarget, characterOpinionFor } from './characterOpinionEngine';

function freshState(): GameState {
  return createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'character-dispute-test' });
}

function drivers(state: GameState): [CharacterInteractionTarget, CharacterInteractionTarget] {
  return state.drivers.filter((driver) => driver.teamId === state.selectedTeamId).slice(0, 2)
    .map((driver) => ({ type: 'Driver', id: driver.id, name: driver.name, teamId: driver.teamId })) as [CharacterInteractionTarget, CharacterInteractionTarget];
}

function strainedState(): GameState {
  const state = freshState();
  const [a, b] = drivers(state);
  const strained: GameState = {
    ...state,
    driverRelationships: {
      ...state.driverRelationships,
      [a.id]: { ...state.driverRelationships![a.id], teammateRelationship: 15 },
      [b.id]: { ...state.driverRelationships![b.id], teammateRelationship: 15 },
    },
  };
  return refreshCharacterDisputes(refreshCharacterConnections(strained));
}

describe('character dispute engine', () => {
  it('turns a hostile live connection into a persistent dispute and a required weekly decision', () => {
    const state = strainedState();
    const [a, b] = drivers(state);
    const dispute = disputesForTarget(state, a)[0];
    expect(new Set([dispute.characterA.id, dispute.characterB.id])).toEqual(new Set([a.id, b.id]));
    expect(dispute.status).toBe('Escalating');
    const event = generateCharacterDisputeEvents(state)[0];
    expect(event.isRequiredDecision).toBe(true);
    expect(event.options).toHaveLength(4);
    expect(event.characterDispute?.disputeId).toBe(dispute.id);
  });

  it('private mediation improves both opinions and the underlying relationship', () => {
    const state = strainedState();
    const event = generateCharacterDisputeEvents(state)[0];
    const a = event.characterDispute!.characterA;
    const b = event.characterDispute!.characterB;
    const aBefore = characterOpinionFor(state, a).score;
    const bBefore = characterOpinionFor(state, b).score;
    const dispute = state.characterInteractions!.disputes.find((entry) => entry.id === event.characterDispute!.disputeId)!;
    const connectionBefore = state.characterInteractions!.connections.find((entry) => entry.id === dispute.connectionId)!;
    const resolved = resolveCharacterDispute(state, event, 'mediate-private');
    const connectionAfter = resolved.characterInteractions!.connections.find((entry) => entry.id === connectionBefore.id)!;
    expect(connectionAfter.affinity).toBeGreaterThan(connectionBefore.affinity);
    expect(connectionAfter.manualAffinityAdjustment).toBe(20);
    expect(characterOpinionFor(resolved, a).score).toBeGreaterThan(aBefore);
    expect(characterOpinionFor(resolved, b).score).toBeGreaterThan(bBefore);
    expect(characterMemoriesForTarget(resolved, a)[0].source).toBe('Dispute');
    expect(generateCharacterDisputeEvents(resolved)).toHaveLength(0);
    const nextRound = { ...resolved, currentRaceIndex: resolved.currentRaceIndex + 1 };
    expect(generateCharacterDisputeEvents(refreshCharacterDisputes(refreshCharacterConnections(nextRound)))).toHaveLength(0);
  });

  it('backing one side creates opposite personal reactions and escalates the conflict', () => {
    const state = strainedState();
    const event = generateCharacterDisputeEvents(state)[0];
    const a = event.characterDispute!.characterA;
    const b = event.characterDispute!.characterB;
    const aBefore = characterOpinionFor(state, a).score;
    const bBefore = characterOpinionFor(state, b).score;
    const resolved = resolveCharacterDispute(state, event, 'back-a');
    expect(characterOpinionFor(resolved, a).score).toBeGreaterThan(aBefore);
    expect(characterOpinionFor(resolved, b).score).toBeLessThan(bBefore);
    expect(resolved.characterInteractions!.disputes.find((entry) => entry.id === event.characterDispute!.disputeId)?.status).toBe('Escalating');
  });

  it('preserves mediation adjustments when live connections refresh next week', () => {
    const state = strainedState();
    const event = generateCharacterDisputeEvents(state)[0];
    const resolved = resolveCharacterDispute(state, event, 'mediate-private');
    const dispute = resolved.characterInteractions!.disputes.find((entry) => entry.id === event.characterDispute!.disputeId)!;
    const before = resolved.characterInteractions!.connections.find((entry) => entry.id === dispute.connectionId)!;
    const refreshed = refreshCharacterConnections(resolved);
    const after = refreshed.characterInteractions!.connections.find((entry) => entry.id === before.id)!;
    expect(after.affinity).toBe(before.affinity);
    expect(after.manualAffinityAdjustment).toBe(20);
  });

  it('backfills the dispute collection when loading an older save', () => {
    const legacy = structuredClone(freshState());
    delete (legacy.characterInteractions as Partial<typeof legacy.characterInteractions>)?.disputes;
    const migrated = migrateGameState(legacy);
    expect(migrated.characterInteractions!.version).toBe(6);
    expect(migrated.characterInteractions!.disputes).toEqual([]);
  });
});
