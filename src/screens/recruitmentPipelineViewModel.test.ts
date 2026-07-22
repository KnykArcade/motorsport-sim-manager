import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import { careerMarketBundle } from '../sim/careerMarketEngine';
import type { GameState } from '../game/careerState';
import { recruitmentPipeline } from './recruitmentPipelineViewModel';

function newState(): GameState {
  return createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'recruitment-pipeline-test',
  });
}

describe('recruitmentPipeline', () => {
  it('groups a shortlisted target as decision ready with its exact market action', () => {
    const base = newState();
    const driver = careerMarketBundle(base).drivers[0];
    const state: GameState = {
      ...base,
      scouting: {
        ...base.scouting!,
        shortlist: [{ entityId: driver.id, entityType: 'Driver' }],
        reports: {
          ...base.scouting!.reports,
          [driver.id]: {
            entityId: driver.id,
            entityType: 'Driver',
            scoutingLevel: 100,
            accuracy: 0.9,
            visibleRatings: {},
            notes: [],
            lastUpdated: '1995-01-01T00:00:00.000Z',
          },
        },
      },
    };

    expect(recruitmentPipeline(state)).toContainEqual(expect.objectContaining({
      entityId: driver.id,
      stage: 'Decision ready',
      nextAction: { label: 'Review Market Target', route: `/market?target=${encodeURIComponent(driver.id)}` },
    }));
  });

  it('promotes a rival market offer above scouting work and exposes its deadline', () => {
    const base = newState();
    const driver = careerMarketBundle(base).drivers[0];
    const state: GameState = {
      ...base,
      scouting: {
        ...base.scouting!,
        activeAssignments: [{ entityId: driver.id, entityType: 'Driver' }],
      },
      transferCalendar: {
        lastProcessedRound: 1,
        stories: [{
          id: 'pipeline-offer',
          targetType: 'MarketDriver',
          targetId: driver.id,
          targetName: driver.name,
          destinationTeamId: 'rival-team',
          destinationTeamName: 'Rival GP',
          outcome: 'RivalOffer',
          stage: 'Offer',
          startedRound: 1,
          deadlineRound: 3,
        }],
      },
    };

    expect(recruitmentPipeline(state)[0]).toMatchObject({
      name: driver.name,
      stage: 'Rival pressure',
      deadline: 'Round 3',
      rivalTeam: 'Rival GP',
      nextAction: { label: 'Review Rival Offer', route: `/market?target=${encodeURIComponent(driver.id)}` },
    });
  });

  it('shows queued market signings as season-end lineup work', () => {
    const base = newState();
    const driver = careerMarketBundle(base).drivers[0];
    const seat = base.drivers.find((entry) => entry.teamId === base.selectedTeamId);
    if (!seat) throw new Error('Expected a selected-team seat');
    const state: GameState = {
      ...base,
      pendingSignings: [{
        seatDriverId: seat.id,
        source: 'market',
        sourceId: driver.id,
        name: driver.name,
        bid: 5,
      }],
    };

    expect(recruitmentPipeline(state)).toContainEqual(expect.objectContaining({
      entityId: driver.id,
      stage: 'Queued signing',
      deadline: 'Season end',
      nextAction: { label: 'Confirm Lineup', route: '/offseason' },
    }));
  });
});
