import { describe, expect, it } from 'vitest';
import type { RelationshipAttentionProfile } from '../../sim/relationshipAttentionEngine';
import type { CollectiveStakeholderProfile } from './relationshipStakeholderViewModel';
import {
  characterManagementMove,
  collectiveManagementMove,
  employerManagementMove,
  externalTalentManagementMove,
} from './relationshipActionViewModel';

function character(
  type: RelationshipAttentionProfile['target']['type'],
  status: RelationshipAttentionProfile['status'],
  reason: string,
): RelationshipAttentionProfile {
  return {
    target: { id: 'target-1', type, name: type },
    authorityRank: type === 'Owner' ? 1 : type === 'Driver' ? 2 : type === 'RivalPrincipal' ? 7 : 4,
    authorityLabel: 'Authority label',
    influence: 75,
    status,
    actionWindow: status === 'MustActNow' ? 'Immediate' : status === 'WatchClosely' ? 'Soon' : 'Background',
    reasons: [reason],
  };
}

function collective(id: CollectiveStakeholderProfile['id'], status: CollectiveStakeholderProfile['status']): CollectiveStakeholderProfile {
  return {
    id,
    title: id,
    authorityRank: id === 'Departments' ? 4 : 5,
    authorityLabel: 'Collective authority',
    status,
    health: 30,
    reasons: ['Trust is under pressure.'],
    metrics: [],
    gameplayEffect: { label: 'Effect', value: 'Neutral', detail: 'Test effect.' },
    actionLabel: 'Review',
  };
}

describe('relationship management moves', () => {
  it('turns active owner and driver signals into concrete player moves', () => {
    expect(characterManagementMove(character('Owner', 'MustActNow', 'Ownership confidence is critical.'))).toMatchObject({
      title: 'Hold an owner review before the next race',
      expectedEffect: expect.stringContaining('job security'),
    });
    expect(characterManagementMove(character('Driver', 'WatchClosely', 'A promise is due within 2 rounds.'))).toMatchObject({
      title: 'Resolve the driver commitment',
      expectedEffect: expect.stringContaining('trust in principal'),
    });
  });

  it('separates department delivery pressure from commercial resource pressure', () => {
    expect(collectiveManagementMove(collective('Departments', 'MustActNow'))).toMatchObject({
      title: 'Rebalance department workload now',
      expectedEffect: expect.stringContaining('upgrade delivery'),
    });
    expect(collectiveManagementMove(collective('Commercial', 'WatchClosely'))).toMatchObject({
      title: 'Review commercial expectations',
      expectedEffect: expect.stringContaining('sponsorship income'),
    });
  });

  it('keeps potential employers and external talent contextual', () => {
    expect(employerManagementMove({
      authorityRank: 6,
      authorityLabel: 'Potential employers',
      status: 'WatchClosely',
      marketStanding: 70,
      firmOffers: 1,
      rumors: 0,
      reasons: ['A rival owner has made a firm offer.'],
      opportunities: [],
    })).toMatchObject({
      title: 'Review active job offer leverage',
      expectedEffect: expect.stringContaining('career options'),
    });

    expect(externalTalentManagementMove({
      authorityRank: 8,
      authorityLabel: 'External talent',
      status: 'MustActNow',
      openRaceSeats: 1,
      staffVacancies: 0,
      targets: [],
      reasons: ['1 race seat must be filled before the season starts.'],
    })).toMatchObject({
      title: 'Fill the open race seat',
      expectedEffect: expect.stringContaining('lineup completeness'),
    });
  });
});
