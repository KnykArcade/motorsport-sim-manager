import { describe, expect, it } from 'vitest';
import type { RelationshipAttentionProfile } from '../../sim/relationshipAttentionEngine';
import {
  RELATIONSHIP_HIERARCHY,
  relationshipActionWindowDetail,
  relationshipActionWindowLabel,
  relationshipPrioritySummary,
  stableInternalRelationships,
  visibleRelationshipPriorities,
} from './relationshipPriorityViewModel';

function profile(
  id: string,
  type: RelationshipAttentionProfile['target']['type'],
  status: RelationshipAttentionProfile['status'],
  authorityRank: RelationshipAttentionProfile['authorityRank'],
): RelationshipAttentionProfile {
  return {
    target: { id, type, name: id },
    authorityRank,
    authorityLabel: `${type} authority`,
    influence: 50,
    status,
    actionWindow: status === 'MustActNow' ? 'Immediate' : status === 'WatchClosely' ? 'Soon' : 'Background',
    reasons: ['Test reason.'],
  };
}

describe('relationship priority view model', () => {
  it('summarizes the attention states without changing their meaning', () => {
    const summary = relationshipPrioritySummary([
      profile('owner', 'Owner', 'Stable', 1),
      profile('driver', 'Driver', 'WatchClosely', 2),
      profile('rival', 'RivalPrincipal', 'MustActNow', 7),
    ]);

    expect(summary).toEqual({ mustActNow: 1, watchClosely: 1, stable: 1, total: 3 });
  });

  it('reserves full priority cards for relationships that need attention', () => {
    const profiles = [
      profile('rival-urgent', 'RivalPrincipal', 'MustActNow', 7),
      profile('driver-watch', 'Driver', 'WatchClosely', 2),
      profile('owner', 'Owner', 'Stable', 1),
      profile('staff', 'Staff', 'Stable', 4),
      profile('rival-stable', 'RivalPrincipal', 'Stable', 7),
    ];
    const visible = visibleRelationshipPriorities(profiles);

    expect(visible.map((entry) => entry.target.id)).toEqual([
      'rival-urgent',
      'driver-watch',
    ]);
    expect(stableInternalRelationships(profiles).map((entry) => entry.target.id)).toEqual(['owner', 'staff']);
  });

  it('keeps stable owners, drivers, and staff accessible without returning stable rivals', () => {
    const stable = stableInternalRelationships([
      profile('owner', 'Owner', 'Stable', 1),
      profile('driver', 'Driver', 'Stable', 2),
      profile('staff', 'Staff', 'Stable', 4),
      profile('rival', 'RivalPrincipal', 'Stable', 7),
      profile('driver-watch', 'Driver', 'WatchClosely', 2),
    ]);

    expect(stable.map((entry) => entry.target.id)).toEqual(['owner', 'driver', 'staff']);
  });

  it('documents the complete management hierarchy including collective relationships', () => {
    expect(RELATIONSHIP_HIERARCHY.map((row) => row.rank)).toEqual(['1', '2–3', '4', '5', '6', '7', '8']);
    expect(RELATIONSHIP_HIERARCHY.find((row) => row.rank === '5')?.coverage).toBe('Collective team systems');
    expect(RELATIONSHIP_HIERARCHY.find((row) => row.rank === '6')?.coverage).toBe('Live career-market standing');
    expect(RELATIONSHIP_HIERARCHY.find((row) => row.rank === '8')?.coverage).toBe('Live recruitment context');
  });

  it('turns action windows into clear player-facing timing labels', () => {
    expect(relationshipActionWindowLabel('Immediate')).toBe('Act before advancing');
    expect(relationshipActionWindowLabel('NextRound')).toBe('Handle next round');
    expect(relationshipActionWindowDetail('Soon')).toContain('Schedule attention soon');
    expect(relationshipActionWindowDetail('Background')).toContain('No active intervention');
  });
});
