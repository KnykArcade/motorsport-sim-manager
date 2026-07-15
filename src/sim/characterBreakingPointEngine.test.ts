import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import type { GameState } from '../game/careerState';
import { gameReducer } from '../game/gameReducer';
import { createNewGame } from '../game/initialCareer';
import { migrateGameState } from '../game/saveSystem';
import type { CharacterInteractionTarget } from '../types/characterInteractionTypes';
import {
  activeCharacterBreakingPoints,
  advanceCharacterBreakingPoints,
  breakingPointsForTarget,
  generateCharacterBreakingPointEvents,
  refreshCharacterStability,
  resolveCharacterBreakingPoint,
  stabilityForTarget,
} from './characterBreakingPointEngine';
import { characterOpinionKey, currentCharacterTargets } from './characterOpinionEngine';

function freshState(): GameState {
  return createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'character-breaking-point-test' });
}

function atPaddockWeek(state: GameState): GameState {
  return {
    ...state,
    careerPhase: {
      ...state.careerPhase!,
      currentPhase: 'paddock_week',
      currentRound: 3,
      paddockWeekId: 'pw-1995-3',
      paddockEvents: [],
      generatedEventsForCurrentWeek: true,
    },
  };
}

function hostileDriverState(): { state: GameState; target: CharacterInteractionTarget } {
  const base = atPaddockWeek(freshState());
  const target = currentCharacterTargets(base).find((entry) => entry.type === 'Driver')!;
  const key = characterOpinionKey(target);
  return {
    target,
    state: {
      ...base,
      characterInteractions: {
        ...base.characterInteractions!,
        opinions: {
          ...base.characterInteractions!.opinions,
          [key]: { ...base.characterInteractions!.opinions[key], score: -100, trust: 0, respect: 20 },
        },
      },
    },
  };
}

describe('character breaking point engine', () => {
  it('combines relationship history into a visible cross-role stability profile', () => {
    const base = freshState();
    const refreshed = refreshCharacterStability(base);
    expect(refreshed.characterInteractions!.stability).toHaveLength(currentCharacterTargets(refreshed).length);
    expect(refreshed.characterInteractions!.stability.every((entry) => entry.score >= 0 && entry.score <= 100)).toBe(true);
  });

  it('opens one required breaking-point decision when stability collapses', () => {
    const { state, target } = hostileDriverState();
    const advanced = advanceCharacterBreakingPoints(state);
    expect(stabilityForTarget(advanced, target)?.band).toBe('BreakingPoint');
    expect(activeCharacterBreakingPoints(advanced)).toHaveLength(1);
    const event = generateCharacterBreakingPointEvents(advanced)[0];
    expect(event.isRequiredDecision).toBe(true);
    expect(event.characterBreakingPoint?.target.id).toBe(target.id);
    expect(event.options).toHaveLength(3);
  });

  it('defuses a crisis through the normal paddock reducer and records the choice', () => {
    const { state, target } = hostileDriverState();
    const advanced = advanceCharacterBreakingPoints(state);
    const event = generateCharacterBreakingPointEvents(advanced)[0];
    const withEvent = { ...advanced, careerPhase: { ...advanced.careerPhase!, paddockEvents: [event] } };
    const trustBefore = withEvent.driverRelationships![target.id].trustInPrincipal;
    const resolved = gameReducer(withEvent, { type: 'RESOLVE_PADDOCK_EVENT', eventId: event.id, optionId: 'repair-trust' })!;
    expect(resolved.driverRelationships![target.id].trustInPrincipal).toBe(trustBefore + 10);
    expect(breakingPointsForTarget(resolved, target)[0].status).toBe('Defused');
    expect(resolved.characterInteractions!.memories.at(-1)?.source).toBe('BreakingPoint');
  });

  it('makes accepting the fallout worsen retention indicators without removing the driver mid-season', () => {
    const { state, target } = hostileDriverState();
    const advanced = advanceCharacterBreakingPoints(state);
    const event = generateCharacterBreakingPointEvents(advanced)[0];
    const loyaltyBefore = advanced.driverRelationships![target.id].teamLoyalty;
    const resolved = resolveCharacterBreakingPoint(advanced, event, 'accept-fallout');
    expect(resolved.driverRelationships![target.id].teamLoyalty).toBeLessThan(loyaltyBefore);
    expect(resolved.drivers.some((driver) => driver.id === target.id && driver.teamId === state.selectedTeamId)).toBe(true);
    expect(breakingPointsForTarget(resolved, target)[0].status).toBe('Escalated');
  });

  it('does not duplicate active crises and migrates older saves to the current version', () => {
    const { state } = hostileDriverState();
    const once = advanceCharacterBreakingPoints(state);
    expect(advanceCharacterBreakingPoints(once).characterInteractions!.breakingPoints).toHaveLength(1);

    const legacy = structuredClone(freshState());
    delete (legacy.characterInteractions as Partial<typeof legacy.characterInteractions>)?.stability;
    delete (legacy.characterInteractions as Partial<typeof legacy.characterInteractions>)?.breakingPoints;
    const migrated = migrateGameState(legacy);
    expect(migrated.characterInteractions!.version).toBe(13);
    expect(migrated.characterInteractions!.stability.length).toBeGreaterThan(0);
    expect(migrated.characterInteractions!.breakingPoints).toEqual([]);
  });
});
