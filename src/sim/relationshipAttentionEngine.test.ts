import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { defaultCareerPhaseState } from '../game/careerPhaseEngine';
import type { GameState } from '../game/careerState';
import { createNewGame } from '../game/initialCareer';
import type { CharacterInteractionTarget } from '../types/characterInteractionTypes';
import { currentCharacterTargets } from './characterOpinionEngine';
import {
  currentRelationshipAttention,
  relationshipAttentionForTarget,
  relationshipAuthorityFor,
} from './relationshipAttentionEngine';

function freshState(): GameState {
  const state = createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'relationship-attention-test' });
  return {
    ...state,
    careerPhase: {
      ...defaultCareerPhaseState(),
      currentPhase: 'paddock_week',
      currentRound: 1,
      paddockWeekId: `pw-${state.seasonYear}-1`,
    },
  };
}

function targetOf(state: GameState, type: CharacterInteractionTarget['type']): CharacterInteractionTarget {
  return currentCharacterTargets(state).find((target) => target.type === type)!;
}

describe('relationship attention engine', () => {
  it('keeps authority, influence, and urgency as separate readable signals', () => {
    const state = freshState();
    const owner = targetOf(state, 'Owner');
    const driver = targetOf(state, 'Driver');

    expect(relationshipAuthorityFor(owner)).toEqual({ rank: 1, label: 'Owner — controls your position' });
    expect(relationshipAuthorityFor(driver).rank).toBe(2);
    expect(relationshipAttentionForTarget(state, owner).influence).toBe(95);
    expect(relationshipAttentionForTarget(state, owner).status).toBe('Stable');
    expect(relationshipAttentionForTarget(state, owner).reasons[0]).toContain('No active deadline');
  });

  it('classifies a targeted unresolved decision as must act now and explains why', () => {
    const base = freshState();
    const driver = targetOf(base, 'Driver');
    const state: GameState = {
      ...base,
      careerPhase: {
        ...base.careerPhase!,
        paddockEvents: [{
          id: 'required-driver-decision',
          weekId: 'test-week',
          season: base.seasonYear,
          series: base.series,
          round: base.careerPhase!.currentRound,
          category: 'driver_morale',
          title: 'Driver contract response required',
          description: 'A direct response is required.',
          severity: 'major',
          isRequiredDecision: true,
          effectsApplied: false,
          createdAt: '1995-01-01T00:00:00.000Z',
          characterRequest: {
            requestKind: 'DriverConcern',
            targetType: 'Driver',
            targetId: driver.id,
            targetName: driver.name,
          },
        }],
      },
    };

    const attention = relationshipAttentionForTarget(state, driver);
    expect(attention.status).toBe('MustActNow');
    expect(attention.reasons[0]).toContain('Driver contract response required');
  });

  it('puts urgent relationships ahead of higher authority without changing authority rank', () => {
    const base = freshState();
    const owner = targetOf(base, 'Owner');
    const driver = targetOf(base, 'Driver');
    const state: GameState = {
      ...base,
      characterInteractions: {
        ...base.characterInteractions!,
        breakingPoints: [{
          id: 'driver-breaking-point',
          target: driver,
          trigger: 'Trust has collapsed',
          reasons: ['Broken promises'],
          stabilityAtStart: 10,
          startedSeason: base.seasonYear,
          startedRound: base.careerPhase!.currentRound,
          status: 'Active',
        }],
      },
    };

    const queue = currentRelationshipAttention(state);
    expect(queue[0].target.id).toBe(driver.id);
    expect(queue[0].status).toBe('MustActNow');
    expect(queue[0].authorityRank).toBe(2);
    expect(queue.find((entry) => entry.target.id === owner.id)?.authorityRank).toBe(1);
  });

  it('classifies market risk as watch closely with a plain-language reason', () => {
    const base = freshState();
    const driver = targetOf(base, 'Driver');
    const existing = base.characterInteractions!.futureIntentions.find((entry) => entry.target.id === driver.id)!;
    const state: GameState = {
      ...base,
      characterInteractions: {
        ...base.characterInteractions!,
        futureIntentions: base.characterInteractions!.futureIntentions.map((entry) => entry.target.id === driver.id
          ? { ...existing, status: 'TestingMarket', reason: 'The driver wants clearer competitive progress.' }
          : entry),
      },
    };

    const attention = relationshipAttentionForTarget(state, driver);
    expect(attention.status).toBe('WatchClosely');
    expect(attention.reasons.some((reason) => reason.includes('testing alternatives'))).toBe(true);
  });
});
