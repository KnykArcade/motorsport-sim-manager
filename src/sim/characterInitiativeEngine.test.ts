import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import type { GameState } from '../game/careerState';
import { createNewGame } from '../game/initialCareer';
import { migrateGameState } from '../game/saveSystem';
import { defaultCareerPhaseState } from '../game/careerPhaseEngine';
import { gameReducer } from '../game/gameReducer';
import type { CharacterInfluenceStance, CharacterInteractionTarget } from '../types/characterInteractionTypes';
import {
  advanceCharacterInitiatives,
  createCharacterInitiative,
  generateCharacterInitiativeEvents,
  initiativesForTarget,
  resolveCharacterInitiative,
} from './characterInitiativeEngine';
import { characterMemoriesForTarget, currentCharacterTargets } from './characterOpinionEngine';

function freshState(): GameState {
  return createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'character-initiative-test' });
}

function withProfile(state: GameState, target: CharacterInteractionTarget, support: number, stance: CharacterInfluenceStance): GameState {
  return {
    ...state,
    characterInteractions: {
      ...state.characterInteractions!,
      influence: state.characterInteractions!.influence.map((profile) => profile.target.type === target.type && profile.target.id === target.id
        ? { ...profile, support, stance }
        : { ...profile, support: 0, stance: 'Neutral' as const }),
    },
  };
}

describe('character initiative engine', () => {
  it('lets a powerful character autonomously create one explainable Paddock Week initiative', () => {
    const base = freshState();
    const owner = currentCharacterTargets(base).find((target) => target.type === 'Owner')!;
    const created = createCharacterInitiative(withProfile(base, owner, -80, 'Obstructive'));
    const initiative = initiativesForTarget(created, owner)[0];
    expect(initiative.kind).toBe('OwnerIntervention');
    expect(initiative.powerAtStart).toBe(95);
    expect(initiative.motive.length).toBeGreaterThan(10);
    const event = generateCharacterInitiativeEvents(created)[0];
    expect(event.characterInitiative?.initiativeId).toBe(initiative.id);
    expect(event.isRequiredDecision).toBe(true);
  });

  it('enforces a global two-round cadence and does not duplicate the current initiative', () => {
    const base = freshState();
    const owner = currentCharacterTargets(base).find((target) => target.type === 'Owner')!;
    const created = createCharacterInitiative(withProfile(base, owner, 80, 'Champion'));
    expect(createCharacterInitiative(created).characterInteractions!.initiatives).toHaveLength(1);
    const nextRound = { ...created, currentRaceIndex: created.currentRaceIndex + 1 };
    expect(createCharacterInitiative(nextRound).characterInteractions!.initiatives).toHaveLength(1);
  });

  it('turns an accepted driver initiative into real relationship effects, memory, and a persistent outcome', () => {
    const base = freshState();
    const driver = currentCharacterTargets(base).find((target) => target.type === 'Driver')!;
    const created = createCharacterInitiative(withProfile(base, driver, 80, 'Champion'));
    const event = generateCharacterInitiativeEvents(created)[0];
    const trust = created.driverRelationships![driver.id].trustInPrincipal;
    const resolved = resolveCharacterInitiative(created, event, 'empower');
    expect(resolved.driverRelationships![driver.id].trustInPrincipal).toBe(trust + 4);
    expect(initiativesForTarget(resolved, driver)[0].status).toBe('Accepted');
    expect(characterMemoriesForTarget(resolved, driver)[0].source).toBe('Initiative');
    expect(resolveCharacterInitiative(resolved, event, 'empower').driverRelationships![driver.id].trustInPrincipal).toBe(trust + 4);
  });

  it('makes rejecting an ownership intervention reduce existing board backing', () => {
    const base = freshState();
    const owner = currentCharacterTargets(base).find((target) => target.type === 'Owner')!;
    const created = createCharacterInitiative(withProfile(base, owner, -80, 'Obstructive'));
    const event = generateCharacterInitiativeEvents(created)[0];
    const security = created.principal!.jobSecurity;
    const resolved = resolveCharacterInitiative(created, event, 'assert-authority');
    expect(resolved.principal!.jobSecurity).toBe(security - 4);
    expect(initiativesForTarget(resolved, owner)[0].status).toBe('Rejected');
  });

  it('resolves initiatives through the normal Paddock Week reducer path', () => {
    const base = freshState();
    const owner = currentCharacterTargets(base).find((target) => target.type === 'Owner')!;
    const created = createCharacterInitiative(withProfile(base, owner, -80, 'Obstructive'));
    const event = generateCharacterInitiativeEvents(created)[0];
    const paddockState: GameState = {
      ...created,
      careerPhase: {
        ...defaultCareerPhaseState(),
        currentPhase: 'paddock_week',
        currentRound: event.round,
        generatedEventsForCurrentWeek: true,
        paddockEvents: [event],
      },
    };
    const resolved = gameReducer(paddockState, { type: 'RESOLVE_PADDOCK_EVENT', eventId: event.id, optionId: 'negotiate-boundaries' })!;
    expect(resolved.careerPhase!.paddockEvents[0].resolvedOptionId).toBe('negotiate-boundaries');
    expect(initiativesForTarget(resolved, owner)[0].status).toBe('Compromised');
  });

  it('expires an unanswered optional initiative and migrates old saves to version 9', () => {
    const base = freshState();
    const driver = currentCharacterTargets(base).find((target) => target.type === 'Driver')!;
    const created = createCharacterInitiative(withProfile(base, driver, 80, 'Champion'));
    const expired = advanceCharacterInitiatives({ ...created, currentRaceIndex: created.currentRaceIndex + 1 });
    expect(initiativesForTarget(expired, driver)[0].status).toBe('Expired');
    expect(characterMemoriesForTarget(expired, driver)[0].label).toContain('ignored');

    const legacy = structuredClone(base);
    delete (legacy.characterInteractions as Partial<typeof legacy.characterInteractions>)?.initiatives;
    const migrated = migrateGameState(legacy);
    expect(migrated.characterInteractions!.version).toBe(11);
    expect(migrated.characterInteractions!.initiatives).toEqual([]);
  });
});
