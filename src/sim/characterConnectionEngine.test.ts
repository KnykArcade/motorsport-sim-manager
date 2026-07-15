import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import type { GameState } from '../game/careerState';
import { createNewGame } from '../game/initialCareer';
import { migrateGameState } from '../game/saveSystem';
import type { CharacterConnection, CharacterInteractionTarget } from '../types/characterInteractionTypes';
import { characterOpinionFor } from './characterOpinionEngine';
import {
  ensureCharacterConnections,
  generateCharacterConnectionEvents,
  propagateCharacterReaction,
  refreshCharacterConnections,
} from './characterConnectionEngine';

function freshState(): GameState {
  return createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'character-connection-test',
  });
}

function driverTargets(state: GameState): [CharacterInteractionTarget, CharacterInteractionTarget] {
  const drivers = state.drivers.filter((driver) => driver.teamId === state.selectedTeamId).slice(0, 2);
  return drivers.map((driver) => ({ type: 'Driver', id: driver.id, name: driver.name, teamId: driver.teamId })) as [CharacterInteractionTarget, CharacterInteractionTarget];
}

function withDriverConnection(state: GameState, patch: Partial<CharacterConnection>): GameState {
  const [first, second] = driverTargets(state);
  return {
    ...state,
    characterInteractions: {
      ...state.characterInteractions!,
      connections: state.characterInteractions!.connections.map((connection) => {
        const ids = new Set([connection.characterA.id, connection.characterB.id]);
        return ids.has(first.id) && ids.has(second.id) ? { ...connection, ...patch } : connection;
      }),
    },
  };
}

describe('character connection engine', () => {
  it('seeds persistent working relationships and influential factions', () => {
    const state = ensureCharacterConnections(freshState());
    const [first, second] = driverTargets(state);
    expect(state.characterInteractions!.version).toBe(6);
    expect(state.characterInteractions!.connections.some((connection) => {
      const ids = new Set([connection.characterA.id, connection.characterB.id]);
      return ids.has(first.id) && ids.has(second.id);
    })).toBe(true);
    expect(Array.isArray(state.characterInteractions!.factions)).toBe(true);
  });

  it('lets allies share a reaction to how another character is treated', () => {
    const base = withDriverConnection(ensureCharacterConnections(freshState()), { affinity: 80, band: 'Allied', strength: 90 });
    const [target, observer] = driverTargets(base);
    const before = characterOpinionFor(base, observer).score;
    const reacted = propagateCharacterReaction(base, target, 'Positive', 'Private conversation');
    expect(characterOpinionFor(reacted, observer).score).toBeGreaterThan(before);
    expect(reacted.characterInteractions!.memories.some((memory) => memory.source === 'Connection' && memory.targetId === observer.id)).toBe(true);
  });

  it('lets rivals react in the opposite direction while neutral contacts stay quiet', () => {
    const seeded = ensureCharacterConnections(freshState());
    const [target, observer] = driverTargets(seeded);
    const hostile = withDriverConnection(seeded, { affinity: -80, band: 'Hostile', strength: 90 });
    const before = characterOpinionFor(hostile, observer).score;
    const rivalReaction = propagateCharacterReaction(hostile, target, 'Positive', 'Public praise');
    expect(characterOpinionFor(rivalReaction, observer).score).toBeLessThan(before);

    const neutral = withDriverConnection(seeded, { affinity: 0, band: 'Neutral', strength: 90 });
    const quiet = propagateCharacterReaction(neutral, target, 'Negative', 'Performance challenge');
    expect(characterOpinionFor(quiet, observer).score).toBe(characterOpinionFor(neutral, observer).score);
    expect(quiet.characterInteractions!.memories.filter((memory) => memory.source === 'Connection')).toHaveLength(0);
  });

  it('reports a relationship-band change once during Paddock Week', () => {
    let state = ensureCharacterConnections(freshState());
    const [first, second] = driverTargets(state);
    state = {
      ...state,
      driverRelationships: {
        ...state.driverRelationships,
        [first.id]: { ...state.driverRelationships![first.id], teammateRelationship: 50 },
        [second.id]: { ...state.driverRelationships![second.id], teammateRelationship: 50 },
      },
    };
    state = refreshCharacterConnections(state);
    state = {
      ...state,
      driverRelationships: {
        ...state.driverRelationships,
        [first.id]: { ...state.driverRelationships![first.id], teammateRelationship: 100 },
        [second.id]: { ...state.driverRelationships![second.id], teammateRelationship: 100 },
      },
    };
    const changed = refreshCharacterConnections(state);
    expect(generateCharacterConnectionEvents(changed).some((event) => event.title.includes(first.name) && event.title.includes(second.name))).toBe(true);
    expect(generateCharacterConnectionEvents(refreshCharacterConnections(changed))).toHaveLength(0);
  });

  it('backfills old saves without discarding the rest of the character history', () => {
    const state = freshState();
    const legacy = structuredClone(state);
    delete (legacy.characterInteractions as Partial<typeof legacy.characterInteractions>)?.connections;
    delete (legacy.characterInteractions as Partial<typeof legacy.characterInteractions>)?.factions;
    const migrated = migrateGameState(legacy);
    expect(migrated.characterInteractions!.connections.length).toBeGreaterThan(0);
    expect(migrated.characterInteractions!.factions.length).toBeGreaterThan(0);
  });
});
