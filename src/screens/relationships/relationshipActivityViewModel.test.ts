import { describe, expect, it } from 'vitest';
import type { CharacterMemory } from '../../types/characterInteractionTypes';
import type { AdvisorRecommendation } from '../../types/phase18Types';
import { relationshipActivityFromSources } from './relationshipActivityViewModel';

function memory(overrides: Partial<CharacterMemory> = {}): CharacterMemory {
  return {
    id: 'memory-1',
    targetType: 'Driver',
    targetId: 'driver-1',
    targetName: 'Jamie Driver',
    teamId: 'team-1',
    seasonYear: 2026,
    round: 2,
    source: 'Commitment',
    label: 'Promise remembered',
    description: 'Jamie expects management to keep its word.',
    tone: 'Mixed',
    strength: 3,
    opinionDelta: -2,
    effects: ['Trust -2'],
    ...overrides,
  };
}

function recommendation(overrides: Partial<AdvisorRecommendation> = {}): AdvisorRecommendation {
  return {
    id: 'advisor-1',
    teamId: 'team-1',
    advisorRole: 'TechnicalDirector',
    advisorName: 'Taylor Technical',
    decisionType: 'RacePreparation',
    decisionId: 'decision-1',
    recommendedOptionId: 'reliability',
    recommendation: 'Prioritize reliability',
    rationale: 'Reliability is currently limiting results.',
    confidence: 82,
    urgency: 'High',
    status: 'Accepted',
    resolutionNote: 'Recommendation followed: reliability focus',
    trustChange: 2,
    createdSeasonYear: 2026,
    createdRound: 3,
    departmentId: 'Technical',
    ...overrides,
  };
}

describe('relationship activity view model', () => {
  it('combines memories and resolved advice in newest-first order', () => {
    const activity = relationshipActivityFromSources(
      [memory()],
      [recommendation()],
      'team-1',
    );

    expect(activity.map((item) => item.id)).toEqual(['advisor:advisor-1', 'memory:memory-1']);
    expect(activity[0]).toMatchObject({
      targetName: 'Taylor Technical',
      targetType: 'Department',
      source: 'AdvisorCouncil',
      tone: 'Positive',
      effects: ['Technical trust +2'],
    });
    expect(activity[1]).toMatchObject({
      tone: 'Mixed',
      opinionDelta: -2,
      effects: ['Trust -2'],
    });
  });

  it('shows advice only after resolution and only for the selected team', () => {
    const activity = relationshipActivityFromSources(
      [],
      [
        recommendation({ id: 'accepted' }),
        recommendation({ id: 'overruled', status: 'Overruled', trustChange: -2 }),
        recommendation({ id: 'pending', status: 'Pending' }),
        recommendation({ id: 'other-team', teamId: 'team-2' }),
      ],
      'team-1',
    );

    expect(activity.map((item) => item.id).sort()).toEqual(['advisor:accepted', 'advisor:overruled']);
    expect(activity.find((item) => item.id === 'advisor:overruled')).toMatchObject({
      tone: 'Negative',
      effects: ['Technical trust -2'],
    });
  });

  it('does not duplicate a memory when the same record appears twice', () => {
    const repeated = memory();
    const activity = relationshipActivityFromSources([repeated, repeated], [], 'team-1');

    expect(activity).toHaveLength(1);
    expect(activity[0].id).toBe('memory:memory-1');
  });
});
