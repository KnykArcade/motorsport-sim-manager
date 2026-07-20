import '../../testDataSetup';
import { describe, expect, it } from 'vitest';
import { defaultCareerPhaseState } from '../../game/careerPhaseEngine';
import type { GameState } from '../../game/careerState';
import { createNewGame } from '../../game/initialCareer';
import type { RelationshipAttentionProfile } from '../../sim/relationshipAttentionEngine';
import { DEPARTMENT_IDS, type DepartmentMood } from '../../types/phase18Types';
import type { CollectiveStakeholderProfile } from './relationshipStakeholderViewModel';
import type { ExternalTalentContext } from './relationshipTalentViewModel';
import { currentRelationshipCommandSnapshot, relationshipCommandSummary } from './relationshipCommandViewModel';

function character(status: RelationshipAttentionProfile['status'], rank: RelationshipAttentionProfile['authorityRank']): RelationshipAttentionProfile {
  return {
    target: { id: `character-${rank}`, type: rank === 1 ? 'Owner' : 'Driver', name: rank === 1 ? 'Owner' : 'Driver' },
    authorityRank: rank,
    authorityLabel: 'Test authority',
    influence: 70,
    status,
    actionWindow: status === 'MustActNow' ? 'Immediate' : status === 'WatchClosely' ? 'Soon' : 'Background',
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
    gameplayEffect: { label: 'Effect', value: 'Neutral', detail: 'Test effect.' },
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

function freshState(teamId = 't-benetton'): GameState {
  const state = createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId,
    seed: `relationship-command-${teamId}`,
  });
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
    expect(summary.topSignal?.actionWindow).toBe('Immediate');
  });

  it('uses authority to break ties at the same attention level', () => {
    const summary = relationshipCommandSummary({
      characterProfiles: [character('WatchClosely', 1)],
      collectiveProfiles: [collective('WatchClosely', 4)],
      externalTalent: externalTalent('WatchClosely'),
    });

    expect(summary.topSignal).toMatchObject({ title: 'Owner', rank: 1 });
    expect(summary.topSignal?.actionWindow).toBe('Soon');
  });

  it('infers near-term timing for collective, employer, and external signals', () => {
    expect(relationshipCommandSummary({
      characterProfiles: [],
      collectiveProfiles: [{
        ...collective('WatchClosely', 4),
        reasons: ['Department commitment is due within 1 round.'],
      }],
      externalTalent: externalTalent('Stable'),
    }).topSignal?.actionWindow).toBe('NextRound');

    expect(relationshipCommandSummary({
      characterProfiles: [],
      collectiveProfiles: [],
      employerStanding: {
        authorityRank: 6,
        authorityLabel: 'Potential employers',
        status: 'WatchClosely',
        marketStanding: 65,
        firmOffers: 1,
        rumors: 0,
        reasons: ['A rival owner has made a firm offer.'],
        opportunities: [],
      },
      externalTalent: externalTalent('Stable'),
    }).topSignal?.actionWindow).toBe('NextRound');

    expect(relationshipCommandSummary({
      characterProfiles: [],
      collectiveProfiles: [],
      externalTalent: externalTalent('WatchClosely'),
    }).topSignal?.actionWindow).toBe('Soon');
  });

  it('keeps an owner confidence crisis ahead of a same-urgency driver promise', () => {
    const base = freshState();
    const driver = base.drivers.find((candidate) => candidate.teamId === base.selectedTeamId)!;
    const state: GameState = {
      ...base,
      principal: {
        ...base.principal!,
        jobSecurity: 15,
      },
      driverPromises: [{
        id: 'same-urgency-driver-promise',
        driverId: driver.id,
        promiseType: 'number_one_status',
        madeRound: 1,
        madeSeason: base.seasonYear,
        dueRound: 1,
        dueSeason: base.seasonYear,
        status: 'active',
        trustImpact: 8,
        moraleImpact: 6,
      }],
    };

    const snapshot = currentRelationshipCommandSnapshot(state);

    expect(snapshot.summary.topSignal).toMatchObject({
      id: `Owner:owner-${base.selectedTeamId}`,
      status: 'MustActNow',
      rank: 1,
    });
    expect(snapshot.summary.mustActNow).toBeGreaterThanOrEqual(2);
    expect(snapshot.characterProfiles.find((profile) => profile.target.id === driver.id)?.status).toBe('MustActNow');
  });

  it('puts a critical department committee ahead of commercial pressure at the same urgency', () => {
    const base = freshState();
    const departments = Object.fromEntries(DEPARTMENT_IDS.map((departmentId) => [departmentId, {
      departmentId,
      morale: departmentId === 'Technical' ? 18 : 55,
      trustInPrincipal: departmentId === 'Technical' ? 16 : 55,
      strategicAlignment: 55,
      workload: departmentId === 'Technical' ? 94 : 50,
      conflictReasons: departmentId === 'Technical' ? ['Upgrade promises keep moving.'] : [],
    }])) as Record<string, DepartmentMood>;
    const state: GameState = {
      ...base,
      phase18: {
        ...base.phase18!,
        departmentMoods: {
          ...base.phase18!.departmentMoods,
          [base.selectedTeamId]: departments,
        },
      },
      commercial: {
        ...base.commercial!,
        sponsors: (base.commercial?.sponsors ?? []).map((sponsor, index) => ({
          ...sponsor,
          confidence: index === 0 ? 10 : 20,
        })),
      },
    };

    const snapshot = currentRelationshipCommandSnapshot(state);

    expect(snapshot.summary.topSignal).toMatchObject({
      id: 'Collective:Departments',
      status: 'MustActNow',
      rank: 4,
    });
    expect(snapshot.collectiveProfiles.map((profile) => profile.id)).toEqual(['Departments', 'Commercial']);
  });

  it('surfaces external talent when a preseason race seat is the only active relationship problem', () => {
    const base = freshState('t-minardi');
    const activeDrivers = base.drivers.filter((driver) => driver.teamId === base.selectedTeamId);
    const state: GameState = {
      ...base,
      drivers: base.drivers.map((driver) => driver.id === activeDrivers[0]?.id
        ? { ...driver, teamId: 'free-agent' }
        : driver),
    };

    const snapshot = currentRelationshipCommandSnapshot(state);

    expect(snapshot.externalTalent.status).toBe('MustActNow');
    expect(snapshot.summary.topSignal).toMatchObject({
      id: 'ExternalTalent',
      status: 'MustActNow',
      rank: 8,
    });
    expect(snapshot.summary.topSignal?.reason).toContain('race seat');
  });
});
