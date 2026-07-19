import { describe, expect, it } from 'vitest';
import type { RelationshipAttentionProfile } from '../../sim/relationshipAttentionEngine';
import type { CollectiveStakeholderProfile } from './relationshipStakeholderViewModel';
import type { ExternalTalentContext } from './relationshipTalentViewModel';
import { relationshipCommandSummary } from './relationshipCommandViewModel';

function character(status: RelationshipAttentionProfile['status'], rank: RelationshipAttentionProfile['authorityRank']): RelationshipAttentionProfile {
  return {
    target: { id: `character-${rank}`, type: rank === 1 ? 'Owner' : 'Driver', name: rank === 1 ? 'Owner' : 'Driver' },
    authorityRank: rank,
    authorityLabel: 'Test authority',
    influence: 70,
    status,
    reasons: [`Character rank ${rank} reason.`],
  };
}

function collective(status: CollectiveStakeholderProfile['status'], rank: 4 | 5): CollectiveStakeholderProfile {
  return {
    id: rank === 4 ? 'Departments' : 'Commercial',
    title: rank === 4 ? 'Team & departments' : 'Commercial partners & supporters',
    authorityRank: rank,
    authorityLabel: 'Test collective',
    status,
    health: 50,
    reasons: [`Collective rank ${rank} reason.`],
    metrics: [],
    actionLabel: 'Review',
  };
}

function externalTalent(status: ExternalTalentContext['status']): ExternalTalentContext {
  return {
    authorityRank: 8,
    authorityLabel: 'External talent',
    status,
    openRaceSeats: status === 'MustActNow' ? 1 : 0,
    staffVacancies: 0,
    targets: [],
    reasons: ['External talent reason.'],
  };
}

describe('relationship command summary', () => {
  it('counts every hierarchy source in one consistent headline total', () => {
    const summary = relationshipCommandSummary({
      characterProfiles: [character('WatchClosely', 1)],
      collectiveProfiles: [collective('MustActNow', 4)],
      employerStanding: {
        authorityRank: 6,
        authorityLabel: 'Potential employers',
        status: 'WatchClosely',
        marketStanding: 65,
        firmOffers: 1,
        rumors: 0,
        reasons: ['Employer reason.'],
        opportunities: [],
      },
      externalTalent: externalTalent('MustActNow'),
    });

    expect(summary).toMatchObject({ mustActNow: 2, watchClosely: 2, active: 4, stable: 0, total: 4 });
  });

  it('lets urgency outrank hierarchy without changing the displayed authority rank', () => {
    const summary = relationshipCommandSummary({
      characterProfiles: [character('Stable', 1)],
      collectiveProfiles: [],
      externalTalent: externalTalent('MustActNow'),
    });

    expect(summary.topSignal).toMatchObject({ title: 'External talent', status: 'MustActNow', rank: 8 });
  });

  it('uses authority to break ties at the same attention level', () => {
    const summary = relationshipCommandSummary({
      characterProfiles: [character('WatchClosely', 1)],
      collectiveProfiles: [collective('WatchClosely', 4)],
      externalTalent: externalTalent('WatchClosely'),
    });

    expect(summary.topSignal).toMatchObject({ title: 'Owner', rank: 1 });
  });
});
