import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import { gameReducer } from '../game/gameReducer';
import type { GameState } from '../game/careerState';
import type { RaceResult } from '../types/gameTypes';
import {
  applyPublicReaction,
  processRacePublicReaction,
  publicConfidenceLabel,
  publicExpectationLabel,
  publicMomentumLabel,
  publicReputationFor,
} from './publicReputationEngine';

function career(seed = 'public-reputation'): GameState {
  return createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed,
  });
}

function result(
  state: GameState,
  driverId: string,
  position: number | null,
  status: RaceResult['status'],
  incidents: string[] = [],
): RaceResult {
  return {
    position,
    driverId,
    teamId: state.selectedTeamId,
    gridPosition: 5,
    status,
    lapsCompleted: status === 'Finished' ? 60 : 20,
    points: position !== null && position <= 6 ? 10 : 0,
    raceScore: 70,
    gapText: status === 'Finished' ? '+10.000' : 'Retired',
    incidents,
  };
}

describe('public reputation engine', () => {
  it('creates distinct persisted team, principal, fan, expectation, and identity state', () => {
    const state = career();
    expect(state.publicReputation).toBeDefined();
    expect(state.publicReputation).toMatchObject({
      recentReactions: [],
      lastUpdatedRound: 0,
    });
    expect(state.publicReputation!.teamStanding).toBeGreaterThan(0);
    expect(state.publicReputation!.principalStanding).toBeGreaterThan(0);
    expect(state.publicReputation!.fanConfidence).toBeGreaterThan(0);
    expect(state.publicReputation!.fanExpectation).toBeGreaterThan(0);
  });

  it('turns sustained supporter momentum into existing commercial and organization effects', () => {
    const state = career('public-commercial');
    const beforeCommercial = state.commercial!.commercialReputation;
    const beforeAppeal = state.teamOrgRatings![state.selectedTeamId].sponsorAppeal;
    const next = applyPublicReaction(state, {
      trigger: 'RaceResult',
      delta: 8,
      headline: 'Breakthrough win',
      detail: 'Supporters believe the team has taken a major step.',
      round: 1,
      idSuffix: 'breakthrough',
    });

    expect(next.publicReputation!.fanConfidence).toBeGreaterThan(state.publicReputation!.fanConfidence);
    expect(next.publicReputation!.momentum).toBeGreaterThan(0);
    expect(next.commercial!.commercialReputation).toBeGreaterThan(beforeCommercial);
    expect(next.teamOrgRatings![state.selectedTeamId].sponsorAppeal).toBeGreaterThan(beforeAppeal);
  });

  it('judges the same result through team identity and expectation', () => {
    const state = career('public-identity');
    const underdog: GameState = {
      ...state,
      publicReputation: { ...state.publicReputation!, identity: 'Underdog', fanConfidence: 50 },
    };
    const established: GameState = {
      ...state,
      publicReputation: { ...state.publicReputation!, identity: 'Established', fanConfidence: 50 },
    };
    const input = {
      trigger: 'RaceResult' as const,
      delta: 4,
      headline: 'Unexpected podium',
      detail: 'The team exceeded expectations.',
      round: 1,
      idSuffix: 'podium',
    };
    expect(applyPublicReaction(underdog, input).publicReputation!.fanConfidence)
      .toBeGreaterThan(applyPublicReaction(established, input).publicReputation!.fanConfidence);
  });

  it('creates reliability and team-order reactions from real race evidence', () => {
    const state = career('public-race');
    const drivers = state.drivers.filter((driver) => driver.teamId === state.selectedTeamId);
    const prepared: GameState = {
      ...state,
      constructorStandings: [{ entityId: state.selectedTeamId, points: 0, wins: 0, podiums: 0, dnfs: 2 }],
    };
    const next = processRacePublicReaction(
      prepared,
      drivers.map((driver) => result(prepared, driver.id, null, 'DNF', ['Engine failure'])),
      1,
      1,
      'race-one',
    );

    expect(next.publicReputation!.recentReactions.map((reaction) => reaction.trigger))
      .toEqual(expect.arrayContaining(['Reliability', 'TeamOrders']));
    expect(next.publicReputation!.fanConfidence).toBeLessThan(prepared.publicReputation!.fanConfidence);
  });

  it('records board ambition while keeping public feedback descriptive', () => {
    const state = career('public-mandate');
    const next = gameReducer(state, { type: 'SELECT_BOARDROOM_MANDATE', mandate: 'Ambitious' })!;
    expect(next.publicReputation!.recentReactions[0]).toMatchObject({
      trigger: 'BoardMandate',
      sentiment: 'Positive',
    });
    expect(next.publicReputation!.recentReactions[0].detail).not.toMatch(/[+-]\d|%/);
  });

  it('lazily supports older saves and provides descriptive bands', () => {
    const state = career('public-legacy');
    delete state.publicReputation;
    const fallback = publicReputationFor(state);
    expect(fallback.recentReactions).toEqual([]);
    expect(publicConfidenceLabel(fallback.fanConfidence)).toEqual(expect.any(String));
    expect(publicExpectationLabel(fallback.fanExpectation)).toEqual(expect.any(String));
    expect(publicMomentumLabel(fallback.momentum)).toBe('Steady');
  });
});
