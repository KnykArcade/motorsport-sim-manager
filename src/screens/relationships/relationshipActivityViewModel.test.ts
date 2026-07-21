import { describe, expect, it } from 'vitest';
import type { CharacterMemory } from '../../types/characterInteractionTypes';
import type { AdvisorRecommendation } from '../../types/phase18Types';
import {
  relationshipActivityFollowUp,
  relationshipActivityFromSources,
  relationshipActivityHierarchy,
  relationshipActivitySummary,
  relationshipFollowUpAgenda,
} from './relationshipActivityViewModel';

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
      [],
      'team-1',
    );

    expect(activity.map((item) => item.id)).toEqual(['advisor:advisor-1', 'memory:memory-1']);
    expect(activity[0]).toMatchObject({
      targetName: 'Taylor Technical',
      targetType: 'Department',
      hierarchyRank: '4',
      hierarchyLabel: 'Team & department relationship',
      source: 'AdvisorCouncil',
      tone: 'Positive',
      effects: ['Technical confidence may steady'],
      followUp: {
        cadence: 'Monitor',
        label: 'Let the operating gain settle',
        style: {
          label: 'Operational relief',
          detail: expect.stringContaining('workload'),
        },
        stakes: {
          priority: 'Track without forcing a new intervention · hierarchy #4',
          riskIfIgnored: 'Staff and department frustration can become workload drag, morale loss, or slower delivery.',
          payoffIfHandled: 'Clarifying priorities protects execution without turning every department signal into a crisis.',
        },
        recommendedAction: {
          label: 'Review staff/department signals',
          destination: 'Staff & departments',
          route: '/staff',
        },
      },
    });
    expect(activity[1]).toMatchObject({
      tone: 'Mixed',
      hierarchyRank: '2–3',
      hierarchyLabel: 'Driver relationship',
      opinionDelta: -2,
      effects: ['Trust -2'],
      followUp: {
        cadence: 'NextRound',
        label: 'Watch for second-order effects',
        style: {
          label: 'Negotiation',
          detail: expect.stringContaining('compromise'),
        },
        stakes: {
          priority: 'Review in the next management window · hierarchy #2–3',
          riskIfIgnored: 'Driver trust can leak into confidence, promise pressure, contract leverage, and race-week focus.',
          payoffIfHandled: 'A targeted check-in keeps confidence usable and makes promises or team orders feel explainable.',
        },
        recommendedAction: {
          label: 'Schedule driver check-in',
          destination: 'Driver relationship file',
          route: '/relationships',
        },
      },
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
      [],
      'team-1',
    );

    expect(activity.map((item) => item.id).sort()).toEqual(['advisor:accepted', 'advisor:overruled']);
    expect(activity.find((item) => item.id === 'advisor:overruled')).toMatchObject({
      tone: 'Negative',
      effects: ['Technical confidence may cool'],
      followUp: {
        cadence: 'NextRound',
        label: 'Review department impact',
        style: {
          label: 'Operational relief',
        },
        stakes: {
          priority: 'Review in the next management window · hierarchy #4',
        },
        recommendedAction: {
          label: 'Review staff/department signals',
          route: '/staff',
        },
      },
    });
  });

  it('does not duplicate a memory when the same record appears twice', () => {
    const repeated = memory();
    const activity = relationshipActivityFromSources([repeated, repeated], [], [], 'team-1');

    expect(activity).toHaveLength(1);
    expect(activity[0].id).toBe('memory:memory-1');
  });

  it('includes visible committee action outcomes', () => {
    const activity = relationshipActivityFromSources([], [], [{
      id: 'collective-1',
      stakeholderId: 'Departments',
      action: 'ReviewWorkload',
      label: 'Review workload',
      outcome: 'Technical received workload relief.',
      seasonYear: 2026,
      round: 4,
      cost: 200_000,
      effects: ['Technical workload -12', 'Technical morale +4'],
    }], 'team-1');

    expect(activity[0]).toMatchObject({
      id: 'collective:collective-1',
      targetName: 'Team & departments',
      targetType: 'Collective',
      hierarchyRank: '4',
      hierarchyLabel: 'Team & department relationship',
      source: 'CommitteeAction',
      tone: 'Positive',
      effects: ['Technical workload -12', 'Technical morale +4'],
      followUp: {
        cadence: 'Monitor',
        label: 'Let the operating gain settle',
        style: {
          label: 'Operational relief',
        },
        stakes: {
          priority: 'Track without forcing a new intervention · hierarchy #4–5',
          riskIfIgnored: 'Committee pressure can spread into operations, commercial confidence, or fan/sponsor expectations.',
        },
        recommendedAction: {
          destination: 'Stakeholder board',
          route: '/relationships',
        },
      },
    });
  });

  it('derives follow-up cadence from relationship outcome context', () => {
    expect(relationshipActivityFollowUp({
      targetType: 'Owner',
      tone: 'Negative',
      opinionDelta: -4,
      effects: ['Patience -4'],
      source: 'Interaction',
    })).toMatchObject({
      cadence: 'Immediate',
      label: 'Repair before next race',
      style: {
        label: 'Damage control',
        detail: expect.stringContaining('authority'),
      },
      stakes: {
        priority: 'Act before the next race weekend · hierarchy #1',
        riskIfIgnored: 'Owner patience can slide into job-security pressure even when other relationships look healthy.',
        payoffIfHandled: 'A clean owner update buys time, budget confidence, and political cover for the next performance swing.',
      },
      recommendedAction: {
        label: 'Open owner review',
        destination: 'Team / owner screen',
        route: '/teams',
      },
    });

    expect(relationshipActivityFollowUp({
      targetType: 'Driver',
      tone: 'Positive',
      opinionDelta: 3,
      effects: ['Trust +3'],
      source: 'Interaction',
    })).toMatchObject({
      cadence: 'Monitor',
      label: 'Convert trust into performance',
      style: {
        label: 'Reassurance',
      },
      stakes: {
        priority: 'Track without forcing a new intervention · hierarchy #2–3',
      },
      recommendedAction: {
        label: 'Schedule driver check-in',
        route: '/relationships',
      },
    });

    expect(relationshipActivityFollowUp({
      targetType: 'RivalPrincipal',
      tone: 'Informational',
      effects: [],
      source: 'Interaction',
    })).toMatchObject({
      cadence: 'Background',
      label: 'No follow-up needed',
      style: {
        label: 'Maintenance',
      },
      stakes: {
        priority: 'Keep for context only · hierarchy #7',
        riskIfIgnored: 'Paddock friction can harden into protest risk, political isolation, or avoidable escalation.',
      },
      recommendedAction: {
        destination: 'Rival matrix',
        route: '/rivals',
      },
    });
  });

  it('summarizes outcomes without treating unlike effects as one score', () => {
    const activity = relationshipActivityFromSources(
      [
        memory({ id: 'negative', tone: 'Negative', opinionDelta: -4, round: 5 }),
        memory({ id: 'mixed', tone: 'Mixed', opinionDelta: 1, round: 4 }),
      ],
      [recommendation({ id: 'positive', trustChange: 2, createdRound: 3 })],
      [],
      'team-1',
    );

    expect(relationshipActivitySummary(activity)).toMatchObject({
      total: 3,
      positive: 1,
      negative: 1,
      mixed: 1,
      informational: 0,
      immediateFollowUps: 1,
      nextRoundFollowUps: 1,
      activeFollowUps: 2,
      netOpinionDelta: -3,
      latest: { id: 'memory:negative' },
    });
  });

  it('builds a follow-up agenda with immediate items before next-round items', () => {
    const activity = relationshipActivityFromSources(
      [
        memory({ id: 'driver-next', tone: 'Mixed', opinionDelta: -1, round: 7 }),
        memory({ id: 'owner-now', targetType: 'Owner', targetName: 'Owner', tone: 'Negative', opinionDelta: -5, round: 4 }),
        memory({ id: 'driver-now', tone: 'Negative', opinionDelta: -4, round: 6 }),
        memory({ id: 'background', targetType: 'RivalPrincipal', targetName: 'Rival', tone: 'Informational', opinionDelta: 0, effects: [], round: 8 }),
      ],
      [],
      [],
      'team-1',
    );

    expect(relationshipFollowUpAgenda(activity).map((item) => item.id)).toEqual([
      'memory:driver-now',
      'memory:owner-now',
      'memory:driver-next',
    ]);
    expect(relationshipFollowUpAgenda(activity, 2)).toHaveLength(2);
  });

  it('maps activity targets back to the relationship management hierarchy', () => {
    expect(relationshipActivityHierarchy('Owner')).toEqual({ hierarchyRank: '1', hierarchyLabel: 'Owner relationship' });
    expect(relationshipActivityHierarchy('Driver')).toEqual({ hierarchyRank: '2–3', hierarchyLabel: 'Driver relationship' });
    expect(relationshipActivityHierarchy('Department')).toEqual({ hierarchyRank: '4', hierarchyLabel: 'Team & department relationship' });
    expect(relationshipActivityHierarchy('Collective', 'Commercial partners & supporters')).toEqual({ hierarchyRank: '5', hierarchyLabel: 'Commercial relationship' });
    expect(relationshipActivityHierarchy('RivalPrincipal')).toEqual({ hierarchyRank: '7', hierarchyLabel: 'Rival principal relationship' });
    expect(relationshipActivityHierarchy('StaffCandidate')).toEqual({ hierarchyRank: '8', hierarchyLabel: 'External talent relationship' });
  });

  it('returns an empty summary when no relationship outcome exists', () => {
    expect(relationshipActivitySummary([])).toEqual({
      total: 0,
      positive: 0,
      negative: 0,
      mixed: 0,
      informational: 0,
      immediateFollowUps: 0,
      nextRoundFollowUps: 0,
      activeFollowUps: 0,
      netOpinionDelta: 0,
    });
  });
});
