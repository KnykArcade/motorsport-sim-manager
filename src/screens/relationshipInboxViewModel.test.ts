import { describe, expect, it } from 'vitest';
import type { RelationshipActionWindow } from '../sim/relationshipAttentionEngine';
import type { RelationshipCommandSummary } from './relationships/relationshipCommandViewModel';
import { relationshipInboxMessage } from './relationshipInboxViewModel';

function summary(
  id: string,
  status: NonNullable<RelationshipCommandSummary['topSignal']>['status'],
  title = 'Target',
  reason = 'An active relationship issue needs attention.',
  actionWindow: RelationshipActionWindow = status === 'MustActNow' ? 'Immediate' : status === 'WatchClosely' ? 'Soon' : 'Background',
): RelationshipCommandSummary {
  return {
    mustActNow: status === 'MustActNow' ? 1 : 0,
    watchClosely: status === 'WatchClosely' ? 1 : 0,
    active: status === 'Stable' ? 0 : 1,
    stable: status === 'Stable' ? 1 : 0,
    total: 1,
    topSignal: { id, status, actionWindow, rank: 1, title, reason, influence: 80 },
  };
}

describe('relationship Inbox alert', () => {
  it('routes the single top active relationship signal to the command center', () => {
    const message = relationshipInboxMessage(
      summary('Owner:owner', 'MustActNow', 'Team Owner', 'Ownership confidence is critical.'),
      { duePromise: false, jobOpportunity: false },
    );

    expect(message).toMatchObject({
      severity: 'critical',
      category: 'people',
      title: 'Relationship priority: Team Owner',
      route: '/relationships',
      actionable: true,
    });
    expect(message?.body).toContain('risk if ignored');
    expect(message?.body).toContain('Act before advancing');
    expect(message?.whyItMatters).toContain('decision, deadline, or crisis');
  });

  it('does not add noise when every relationship is stable', () => {
    expect(relationshipInboxMessage(
      summary('Owner:owner', 'Stable'),
      { duePromise: false, jobOpportunity: false },
    )).toBeUndefined();
  });

  it('does not duplicate a specific promise or job-offer message', () => {
    expect(relationshipInboxMessage(
      summary('Driver:driver-1', 'WatchClosely', 'Driver', 'A promise to Driver is due within 2 rounds.'),
      { duePromise: true, jobOpportunity: false },
    )).toBeUndefined();
    expect(relationshipInboxMessage(
      summary('PotentialEmployers', 'WatchClosely'),
      { duePromise: false, jobOpportunity: true },
    )).toBeUndefined();
  });

  it('classifies rival and commercial signals for useful Inbox filtering', () => {
    expect(relationshipInboxMessage(
      summary('RivalPrincipal:rival', 'WatchClosely'),
      { duePromise: false, jobOpportunity: false },
    )?.category).toBe('paddock');
    expect(relationshipInboxMessage(
      summary('Collective:Commercial', 'WatchClosely'),
      { duePromise: false, jobOpportunity: false },
    )?.category).toBe('business');
  });

  it('keeps near-term relationship timing visible before opening the command center', () => {
    const message = relationshipInboxMessage(
      summary('Driver:driver-1', 'WatchClosely', 'Driver', 'A promise is due within 1 round.', 'NextRound'),
      { duePromise: false, jobOpportunity: false },
    );

    expect(message?.severity).toBe('action');
    expect(message?.body).toContain('Handle next round');
    expect(message?.whyItMatters).toContain('waiting risks escalation');
  });
});
