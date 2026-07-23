import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { getStaffPool } from '../data';
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

  it('routes an active market negotiation to the exact seat negotiation screen', () => {
    const base = newState();
    const driver = careerMarketBundle(base).drivers[0];
    const seat = base.drivers.find((entry) => entry.teamId === base.selectedTeamId);
    if (!seat) throw new Error('Expected a selected-team seat');
    const state: GameState = {
      ...base,
      marketContractNegotiation: {
        marketId: driver.id,
        seatDriverId: seat.id,
        offeredBid: 4,
        askingBid: 5,
        offeredSalary: 1,
        askingSalary: 1.2,
        years: 3,
        clauseType: 'EqualTreatment',
        acceptanceLikelihood: 50,
        attemptsRemaining: 2,
        response: 'countered',
        counterBid: 4.5,
      },
    };

    expect(recruitmentPipeline(state)).toContainEqual(expect.objectContaining({
      entityId: driver.id,
      stage: 'Negotiation active',
      negotiationState: 'countered',
      attemptsRemaining: 2,
      nextAction: {
        label: 'Review Counter',
        route: `/market/${encodeURIComponent(driver.id)}/negotiate/${encodeURIComponent(seat.id)}`,
      },
    }));
  });

  it('routes an active staff refusal back to the exact staff negotiation', () => {
    const base = newState();
    const staff = getStaffPool(base.seasonYear, base.series)[0];
    if (!staff) throw new Error('Expected a staff member');
    const state: GameState = {
      ...base,
      scouting: {
        ...base.scouting!,
        shortlist: [{ entityId: staff.id, entityType: 'Staff' }],
      },
      staffContractNegotiation: {
        staffId: staff.id,
        mode: 'hire',
        offerMultiplier: 1,
        askingMultiplier: 1.4,
        years: 2,
        acceptanceLikelihood: 30,
        attemptsRemaining: 0,
        response: 'refused',
      },
    };

    expect(recruitmentPipeline(state)).toContainEqual(expect.objectContaining({
      entityId: staff.id,
      stage: 'Negotiation active',
      negotiationState: 'refused',
      nextAction: {
        label: 'Improve Offer',
        route: `/staff/${encodeURIComponent(staff.id)}/negotiate`,
      },
    }));
  });

  it('moves signed market drivers into history instead of active work', () => {
    const base = newState();
    const driver = careerMarketBundle(base).drivers[0];
    const state: GameState = {
      ...base,
      signedMarketIds: [driver.id],
      scouting: {
        ...base.scouting!,
        shortlist: [{ entityId: driver.id, entityType: 'Driver' }],
      },
    };

    expect(recruitmentPipeline(state)).toContainEqual(expect.objectContaining({
      entityId: driver.id,
      stage: 'Confirmed move',
      lifecycle: 'history',
      needsAction: false,
    }));
  });

  it('keeps confirmed rival movement in history with no active decision', () => {
    const base = newState();
    const driver = careerMarketBundle(base).drivers[0];
    const state: GameState = {
      ...base,
      transferCalendar: {
        lastProcessedRound: 1,
        stories: [{
          id: 'pipeline-confirmed',
          targetType: 'MarketDriver',
          targetId: driver.id,
          targetName: driver.name,
          destinationTeamId: 'rival-team',
          destinationTeamName: 'Rival GP',
          outcome: 'RivalOffer',
          stage: 'Confirmed',
          startedRound: 1,
          deadlineRound: 2,
        }],
      },
    };

    expect(recruitmentPipeline(state)).toContainEqual(expect.objectContaining({
      entityId: driver.id,
      lifecycle: 'history',
      needsAction: false,
      nextAction: { label: 'Review Market Outcome', route: `/market?target=${encodeURIComponent(driver.id)}` },
    }));
  });
});
