import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import type { GameState } from '../game/careerState';
import { createNewGame } from '../game/initialCareer';
import type { RaceResult } from '../types/gameTypes';
import type { RivalRelationship } from '../types/phase18Types';
import {
  addRivalRelationshipEvent,
  ensureRivalRelationships,
  evolveRivalRelationshipsAfterRace,
  recordStaffPoach,
  rivalActionContext,
  rivalActionUsedThisRound,
  rivalRelationship,
  takeRivalAction,
} from './phase18RivalRelationshipEngine';

function freshState(seed = 'phase18-rivals'): GameState {
  return createNewGame({ gameMode: 'Career', seasonYear: 1998, series: 'F1', teamId: 't-ferrari', seed });
}

function result(teamId: string, driverId: string, position: number): RaceResult {
  return { teamId, driverId, position, gridPosition: position, status: 'Finished', lapsCompleted: 60, points: 0, raceScore: 70, gapText: '', incidents: [] };
}

function prepareRival(state: GameState, rivalId: string, overrides: Partial<RivalRelationship>): GameState {
  const relationship = rivalRelationship(state, state.selectedTeamId, rivalId)!;
  return {
    ...state,
    phase18: {
      ...state.phase18!,
      rivalRelationships: {
        ...state.phase18!.rivalRelationships,
        [relationship.id]: { ...relationship, ...overrides },
      },
    },
  };
}

describe('rival relationship engine', () => {
  it('deterministically seeds one relationship for every unique team pairing', () => {
    const first = ensureRivalRelationships(freshState('stable-rivals'));
    const second = ensureRivalRelationships(freshState('stable-rivals'));
    const expected = first.teams.length * (first.teams.length - 1) / 2;

    expect(Object.keys(first.phase18!.rivalRelationships)).toHaveLength(expected);
    expect(first.phase18!.rivalRelationships).toEqual(second.phase18!.rivalRelationships);
  });

  it('tracks dimension changes, tags, and persistent history', () => {
    const state = freshState();
    const rival = state.teams.find((team) => team.id !== state.selectedTeamId)!;
    const before = rivalRelationship(state, state.selectedTeamId, rival.id)!;
    const after = addRivalRelationshipEvent(state, state.selectedTeamId, rival.id, {
      amount: -8,
      trustDelta: -6,
      suspicionDelta: 9,
      reason: 'A test dispute escalated.',
      category: 'Technical',
      tags: ['HistoricRival'],
    });
    const updated = rivalRelationship(after, state.selectedTeamId, rival.id)!;

    expect(updated.score).toBe(before.score - 8);
    expect(updated.commercialTrust).toBe(before.commercialTrust - 6);
    expect(updated.technicalSuspicion).toBe(before.technicalSuspicion + 9);
    expect(updated.tags).toContain('HistoricRival');
    expect(updated.history.at(-1)?.reason).toBe('A test dispute escalated.');
    expect(JSON.parse(JSON.stringify(after)).phase18.rivalRelationships[updated.id].history).toHaveLength(1);
  });

  it('turns close on-track competition into sporting respect', () => {
    const state = freshState('race-rivals');
    const rival = state.teams.find((team) => team.id !== state.selectedTeamId)!;
    const playerDriver = state.drivers.find((driver) => driver.teamId === state.selectedTeamId)!;
    const rivalDriver = state.drivers.find((driver) => driver.teamId === rival.id)!;
    const before = rivalRelationship(state, state.selectedTeamId, rival.id)!;
    const after = evolveRivalRelationshipsAfterRace(state, 3, [
      result(state.selectedTeamId, playerDriver.id, 4),
      result(rival.id, rivalDriver.id, 5),
    ]);
    const updated = rivalRelationship(after, state.selectedTeamId, rival.id)!;

    expect(updated.sportingRespect).toBe(before.sportingRespect + 3);
    expect(updated.history.at(-1)?.category).toBe('Sporting');
  });

  it('charges management actions and prevents repeating an action against the same rival in one round', () => {
    const state = freshState('action-rivals');
    const rival = state.teams.find((team) => team.id !== state.selectedTeamId)!;
    const playerBudget = state.teams.find((team) => team.id === state.selectedTeamId)!.budget;
    const protested = takeRivalAction(state, rival.id, 'FileProtest');
    const repeated = takeRivalAction(protested, rival.id, 'FileProtest');
    const relation = rivalRelationship(protested, state.selectedTeamId, rival.id)!;

    expect(protested.teams.find((team) => team.id === state.selectedTeamId)!.budget).toBe(playerBudget - 400_000);
    expect(relation.history.at(-1)?.reason).toContain('formal protest');
    expect(relation.history.at(-1)?.action).toBe('FileProtest');
    expect(rivalActionUsedThisRound(protested, rival.id, 'FileProtest')).toBe(true);
    expect(protested.news[0].headline).toContain('protest');
    expect(repeated).toEqual(protested);
  });

  it('allows a different rival action in the same round and resets the action cooldown next round', () => {
    const state = freshState('action-cadence');
    const rival = state.teams.find((team) => team.id !== state.selectedTeamId)!;
    const dialogue = takeRivalAction(state, rival.id, 'OpenDialogue');
    const repeatedDialogue = takeRivalAction(dialogue, rival.id, 'OpenDialogue');
    const exchange = takeRivalAction(repeatedDialogue, rival.id, 'TechnicalExchange');
    const nextRound = { ...exchange, currentRaceIndex: exchange.currentRaceIndex + 1, careerPhase: exchange.careerPhase ? { ...exchange.careerPhase, currentRound: exchange.careerPhase.currentRound + 1 } : exchange.careerPhase };
    const nextDialogue = takeRivalAction(nextRound, rival.id, 'OpenDialogue');

    expect(repeatedDialogue).toEqual(dialogue);
    expect(rivalRelationship(exchange, state.selectedTeamId, rival.id)!.history).toHaveLength(2);
    expect(rivalRelationship(nextDialogue, state.selectedTeamId, rival.id)!.history).toHaveLength(3);
  });

  it('explains and amplifies dialogue when tension is high but sporting respect remains', () => {
    const state = freshState('rival-dialogue-context');
    const rival = state.teams.find((team) => team.id !== state.selectedTeamId)!;
    const prepared = prepareRival(state, rival.id, { score: -25, technicalSuspicion: 68, sportingRespect: 62 });
    const context = rivalActionContext(prepared, rival.id, 'OpenDialogue');
    const after = takeRivalAction(prepared, rival.id, 'OpenDialogue');
    const updated = rivalRelationship(after, state.selectedTeamId, rival.id)!;

    expect(context?.fit).toBe('Favored');
    expect(updated.score).toBe(-18);
    expect(updated.commercialTrust).toBe(rivalRelationship(prepared, state.selectedTeamId, rival.id)!.commercialTrust + 6);
    expect(updated.technicalSuspicion).toBe(64);
  });

  it('limits technical exchange upside when suspicion and mistrust are severe', () => {
    const state = freshState('rival-exchange-context');
    const rival = state.teams.find((team) => team.id !== state.selectedTeamId)!;
    const prepared = prepareRival(state, rival.id, {
      score: -28,
      commercialTrust: 25,
      technicalSuspicion: 82,
      tags: ['TechnicalRival'],
    });
    const context = rivalActionContext(prepared, rival.id, 'TechnicalExchange');
    const after = takeRivalAction(prepared, rival.id, 'TechnicalExchange');
    const updated = rivalRelationship(after, state.selectedTeamId, rival.id)!;

    expect(context?.fit).toBe('Risky');
    expect(updated.score).toBe(-27);
    expect(updated.commercialTrust).toBe(27);
    expect(updated.technicalSuspicion).toBe(79);
  });

  it('flags personnel scouting as risky when it would damage a useful ally', () => {
    const state = freshState('rival-scout-context');
    const rival = state.teams.find((team) => team.id !== state.selectedTeamId)!;
    const prepared = prepareRival(state, rival.id, {
      score: 24,
      commercialTrust: 70,
      technicalSuspicion: 35,
      tags: ['PoliticalBlocAlly'],
    });
    const context = rivalActionContext(prepared, rival.id, 'ScoutPersonnel');
    const after = takeRivalAction(prepared, rival.id, 'ScoutPersonnel');
    const updated = rivalRelationship(after, state.selectedTeamId, rival.id)!;

    expect(context?.fit).toBe('Risky');
    expect(updated.score).toBe(17);
    expect(updated.commercialTrust).toBe(64);
    expect(updated.technicalSuspicion).toBe(41);
  });

  it('marks a formal protest as favored only when technical suspicion supports it', () => {
    const state = freshState('rival-protest-context');
    const rival = state.teams.find((team) => team.id !== state.selectedTeamId)!;
    const favored = prepareRival(state, rival.id, { technicalSuspicion: 78, sportingRespect: 45 });
    const risky = prepareRival(state, rival.id, { technicalSuspicion: 35, sportingRespect: 75 });

    expect(rivalActionContext(favored, rival.id, 'FileProtest')?.fit).toBe('Favored');
    expect(rivalActionContext(risky, rival.id, 'FileProtest')?.fit).toBe('Risky');
  });

  it('does not carry a rival action cooldown into the same round number of a later season', () => {
    const state = freshState('action-new-season');
    const rival = state.teams.find((team) => team.id !== state.selectedTeamId)!;
    const dialogue = takeRivalAction(state, rival.id, 'OpenDialogue');
    const followingSeason = { ...dialogue, seasonYear: dialogue.seasonYear + 1 };
    const nextDialogue = takeRivalAction(followingSeason, rival.id, 'OpenDialogue');

    expect(rivalRelationship(nextDialogue, state.selectedTeamId, rival.id)!.history).toHaveLength(2);
  });

  it('records staff poaching as a durable team rivalry event', () => {
    const state = freshState('staff-rivals');
    const rival = state.teams.find((team) => team.id !== state.selectedTeamId)!;
    const updated = recordStaffPoach(state, rival.id, state.selectedTeamId);
    const relation = rivalRelationship(updated, rival.id, state.selectedTeamId)!;

    expect(relation.tags).toContain('StaffPoachingRival');
    expect(relation.history.at(-1)?.category).toBe('Staff');
    expect(relation.score).toBeLessThan(rivalRelationship(state, rival.id, state.selectedTeamId)!.score);
  });
});
