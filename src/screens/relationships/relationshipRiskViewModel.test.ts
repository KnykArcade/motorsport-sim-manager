import { describe, expect, it } from 'vitest';
import type { RelationshipAttentionProfile } from '../../sim/relationshipAttentionEngine';
import { externalTalentContext } from './relationshipTalentViewModel';
import {
  characterRiskIfIgnored,
  collectiveRiskIfIgnored,
  employerRiskIfIgnored,
  externalTalentRiskIfIgnored,
} from './relationshipRiskViewModel';

function character(
  type: RelationshipAttentionProfile['target']['type'],
  status: RelationshipAttentionProfile['status'],
  reason: string,
): RelationshipAttentionProfile {
  return {
    target: { id: 'target', type, name: 'Target' },
    authorityRank: type === 'Owner' ? 1 : type === 'Driver' ? 2 : type === 'Staff' ? 4 : type === 'RivalPrincipal' ? 7 : 8,
    authorityLabel: 'Test authority',
    influence: 50,
    status,
    reasons: [reason],
  };
}

describe('relationship risk guidance', () => {
  it('does not add management noise to stable relationships', () => {
    expect(characterRiskIfIgnored(character('Owner', 'Stable', 'No concern.'))).toBeUndefined();
  });

  it('connects driver deadlines and breaking points to different visible risks', () => {
    expect(characterRiskIfIgnored(character('Driver', 'MustActNow', 'A promise is due now.'))).toContain('missed commitment');
    expect(characterRiskIfIgnored(character('Driver', 'WatchClosely', 'Target wants to leave.'))).toContain('commit to leaving');
  });

  it('keeps collective consequences tied to the system the committee represents', () => {
    expect(collectiveRiskIfIgnored({
      id: 'Departments', title: 'Departments', authorityRank: 4, authorityLabel: 'Internal',
      status: 'WatchClosely', health: 35, reasons: ['Low trust.'], metrics: [], actionLabel: 'Review',
    })).toContain('departmental productivity');
    expect(collectiveRiskIfIgnored({
      id: 'Commercial', title: 'Commercial', authorityRank: 5, authorityLabel: 'Partners',
      status: 'MustActNow', health: 20, reasons: ['Low confidence.'], metrics: [], actionLabel: 'Review',
    })).toContain('renewals');
  });

  it('explains career-market and recruitment-window exposure without inventing outcomes', () => {
    expect(employerRiskIfIgnored({
      authorityRank: 6, authorityLabel: 'Employers', status: 'WatchClosely', marketStanding: 60,
      firmOffers: 1, rumors: 0, reasons: ['Offer active.'], opportunities: [],
    })).toContain('offers can lapse');
    const talent = externalTalentContext({
      preseason: true, openRaceSeats: 1, staffVacancies: 0,
      pendingDrivers: [], scoutedDrivers: [], approachedStaff: [],
    });
    expect(externalTalentRiskIfIgnored(talent)).toContain('complete race lineup');
  });
});
