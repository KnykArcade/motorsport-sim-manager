import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import type { GameState } from '../game/careerState';
import { createNewGame } from '../game/initialCareer';
import type { RaceResult } from '../types/gameTypes';
import {
  addRivalRelationshipEvent,
  ensureRivalRelationships,
  evolveRivalRelationshipsAfterRace,
  recordStaffPoach,
  rivalRelationship,
  takeRivalAction,
} from './phase18RivalRelationshipEngine';

function freshState(seed = 'phase18-rivals'): GameState {
  return createNewGame({ gameMode: 'Career', seasonYear: 1998, series: 'F1', teamId: 't-ferrari', seed });
}

function result(teamId: string, driverId: string, position: number): RaceResult {
  return { teamId, driverId, position, gridPosition: position, status: 'Finished', lapsCompleted: 60, points: 0, raceScore: 70, gapText: '', incidents: [] };
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

  it('charges management actions and prevents duplicate same-round protests', () => {
    const state = freshState('action-rivals');
    const rival = state.teams.find((team) => team.id !== state.selectedTeamId)!;
    const playerBudget = state.teams.find((team) => team.id === state.selectedTeamId)!.budget;
    const protested = takeRivalAction(state, rival.id, 'FileProtest');
    const repeated = takeRivalAction(protested, rival.id, 'FileProtest');
    const relation = rivalRelationship(protested, state.selectedTeamId, rival.id)!;

    expect(protested.teams.find((team) => team.id === state.selectedTeamId)!.budget).toBe(playerBudget - 400_000);
    expect(relation.history.at(-1)?.reason).toContain('formal protest');
    expect(protested.news[0].headline).toContain('protest');
    expect(repeated).toEqual(protested);
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
