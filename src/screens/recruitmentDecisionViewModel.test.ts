import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import type { GameState } from '../game/careerState';
import { careerMarketBundle } from '../sim/careerMarketEngine';
import { recruitmentDecisionDesk } from './recruitmentDecisionViewModel';

function newState(): GameState {
  return createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'recruitment-decision-desk-test',
  });
}

describe('recruitmentDecisionDesk', () => {
  it('keeps an uncertain target in scouting until the report is complete', () => {
    const base = newState();
    const driver = base.drivers.find((candidate) => candidate.teamId !== base.selectedTeamId);
    if (!driver || !base.scouting) throw new Error('Expected a market driver and scouting state');
    const state: GameState = {
      ...base,
      scouting: {
        ...base.scouting,
        reports: {
          ...base.scouting.reports,
          [driver.id]: {
            entityId: driver.id,
            entityType: 'Driver',
            scoutingLevel: 40,
            accuracy: 0.5,
            visibleRatings: {},
            notes: [],
            lastUpdated: '1995-01-01T00:00:00.000Z',
          },
        },
        activeAssignments: [{ entityId: driver.id, entityType: 'Driver' }],
      },
    };

    expect(recruitmentDecisionDesk(state, driver.id)).toMatchObject({
      status: 'Scouting in progress',
      recommendation: 'Keep building knowledge before committing budget or a contract.',
      nextAction: {
        label: 'Continue Scouting',
        route: `/scouting?tab=senior&target=${encodeURIComponent(driver.id)}`,
      },
    });
  });

  it('moves a full senior report to the market decision route', () => {
    const base = newState();
    const driver = base.drivers.find((candidate) => candidate.teamId !== base.selectedTeamId);
    if (!driver || !base.scouting) throw new Error('Expected a market driver and scouting state');
    const state: GameState = {
      ...base,
      scouting: {
        ...base.scouting,
        reports: {
          ...base.scouting.reports,
          [driver.id]: {
            entityId: driver.id,
            entityType: 'Driver',
            scoutingLevel: 100,
            accuracy: 1,
            visibleRatings: {},
            notes: [],
            lastUpdated: '1995-01-01T00:00:00.000Z',
          },
        },
      },
    };

    expect(recruitmentDecisionDesk(state, driver.id)).toMatchObject({
      status: 'Full report ready',
      knowledgePercentage: 90,
      nextAction: {
        label: 'Review Market Target',
        route: `/market?target=${encodeURIComponent(driver.id)}`,
      },
    });
  });

  it('keeps a shortlisted youth target in the scouting decision desk', () => {
    const base = newState();
    const prospect = careerMarketBundle(base).youth[0];
    if (!prospect || !base.scouting) throw new Error('Expected a youth scouting report');
    const state: GameState = {
      ...base,
      scouting: {
        ...base.scouting,
        reports: {
          ...base.scouting.reports,
          [prospect.id]: {
            entityId: prospect.id,
            entityType: 'YouthProspect',
            scoutingLevel: 20,
            accuracy: 0.3,
            visibleRatings: {},
            notes: [],
            lastUpdated: '1995-01-01T00:00:00.000Z',
          },
        },
        shortlist: [{ entityId: prospect.id, entityType: 'YouthProspect' }],
      },
    };

    expect(recruitmentDecisionDesk(state, prospect.id)).toMatchObject({
      status: 'Shortlisted',
      nextAction: {
        label: 'Review Youth Target',
        route: `/scouting?tab=youth&target=${encodeURIComponent(prospect.id)}`,
      },
    });
  });
});
