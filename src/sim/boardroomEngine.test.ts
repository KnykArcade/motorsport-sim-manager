import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import { gameReducer } from '../game/gameReducer';
import type { GameState } from '../game/careerState';
import {
  adjustExpectationForMandate,
  chooseMandate,
  emptyBoardroom,
  processBoardroomAfterRace,
  requestBoardFunding,
} from './boardroomEngine';

function newGame(gameMode: GameState['gameMode'] = 'Career'): GameState {
  return createNewGame({
    gameMode,
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'boardroom-seed',
  });
}

describe('boardroomEngine', () => {
  it('turns preseason mandate choice into explicit funding and target risk', () => {
    const state = newGame();
    const expectation = state.teamExpectations![state.selectedTeamId];
    const conservative = adjustExpectationForMandate(expectation, 'Conservative');
    const ambitious = adjustExpectationForMandate(expectation, 'Ambitious');
    if (expectation.minimumConstructorPosition !== undefined) {
      expect(conservative.minimumConstructorPosition).toBeGreaterThanOrEqual(expectation.minimumConstructorPosition);
      expect(ambitious.minimumConstructorPosition).toBeLessThanOrEqual(expectation.minimumConstructorPosition);
    }

    const before = state.teams.find((team) => team.id === state.selectedTeamId)!.budget;
    const selected = chooseMandate(state, 'Ambitious');
    expect(selected.boardroom).toMatchObject({
      mandate: 'Ambitious',
      mandateFundingMillions: 3,
      mandateJobRisk: 'High',
    });
    expect(selected.teams.find((team) => team.id === state.selectedTeamId)!.budget).toBe(before + 3_000_000);
    expect(chooseMandate(selected, 'Conservative')).toBe(selected);
  });

  it('approves a request with strong owner backing and denies one after confidence collapses', () => {
    const state = newGame();
    const reputation = state.teamReputations![state.selectedTeamId];
    const backed = requestBoardFunding({
      ...state,
      teamReputations: {
        ...state.teamReputations,
        [state.selectedTeamId]: { ...reputation, ownerPatience: 100 },
      },
    }, 'TechnicalDevelopment');
    expect(backed.boardroom?.fundingRequests.at(-1)?.status).toBe('Approved');

    const denied = requestBoardFunding({
      ...state,
      teamReputations: {
        ...state.teamReputations,
        [state.selectedTeamId]: { ...reputation, ownerPatience: 0 },
      },
    }, 'EmergencySupport');
    expect(denied.boardroom?.fundingRequests.at(-1)?.status).toBe('Denied');
  });

  it('settles conditional promises once at their championship-round deadline', () => {
    const state = newGame();
    const position = state.teamExpectations![state.selectedTeamId].minimumConstructorPosition ?? 4;
    const prepared: GameState = {
      ...state,
      constructorStandings: state.teams.map((team, index) => ({
        entityId: team.id,
        points: team.id === state.selectedTeamId ? 50 : Math.max(0, 40 - index),
        wins: 0,
        podiums: 0,
        dnfs: 0,
      })).sort((a, b) => b.points - a.points),
      teamExpectations: {
        ...state.teamExpectations,
        [state.selectedTeamId]: {
          ...state.teamExpectations![state.selectedTeamId],
          minimumConstructorPosition: Math.max(position, 1),
        },
      },
      boardroom: {
        ...emptyBoardroom(),
        fundingRequests: [{
          id: 'conditional',
          category: 'Facilities',
          requestedMillions: 4,
          approvedMillions: 2,
          requestedRound: 1,
          status: 'Conditional',
          response: 'Conditional support.',
          condition: 'Match the current position.',
          deadlineRound: 3,
        }],
      },
    };
    const before = prepared.teams.find((team) => team.id === prepared.selectedTeamId)!.budget;
    const settled = processBoardroomAfterRace(prepared, 3);
    expect(settled.boardroom?.fundingRequests[0].status).toBe('Fulfilled');
    expect(settled.teams.find((team) => team.id === prepared.selectedTeamId)!.budget).toBe(before + 2_000_000);
    expect(processBoardroomAfterRace(settled, 3).teams).toEqual(settled.teams);
  });

  it('runs formal early, midseason and postseason reviews only on scheduled rounds', () => {
    const state = newGame();
    const earlyRound = Math.ceil(state.calendar.length * 0.25);
    const unscheduled = processBoardroomAfterRace(state, earlyRound - 1);
    expect(unscheduled.boardroom?.reviews ?? []).toHaveLength(0);

    const reviewed = processBoardroomAfterRace(state, earlyRound);
    expect(reviewed.boardroom?.reviews).toHaveLength(1);
    expect(reviewed.boardroom?.reviews[0]).toMatchObject({
      stage: 'EarlySeason',
      teamId: state.selectedTeamId,
    });
    expect(reviewed.boardroom?.reviews[0].assessments.map((item) => item.area)).toEqual([
      'Results',
      'Finances',
      'CarDevelopment',
      'DriverManagement',
      'Academy',
      'Sponsors',
      'Reputation',
    ]);
    expect(processBoardroomAfterRace(reviewed, earlyRound).boardroom?.reviews).toHaveLength(1);
  });

  it('turns a missed ultimatum into a real job-security consequence', () => {
    const state = newGame();
    const target = 1;
    const prepared: GameState = {
      ...state,
      teamExpectations: {
        ...state.teamExpectations,
        [state.selectedTeamId]: { ...state.teamExpectations![state.selectedTeamId], minimumConstructorPosition: target },
      },
      constructorStandings: state.teams.map((team, index) => ({
        entityId: team.id,
        points: team.id === state.selectedTeamId ? 0 : 100 - index,
        wins: 0,
        podiums: 0,
        dnfs: 0,
      })).sort((a, b) => b.points - a.points),
      boardroom: {
        ...emptyBoardroom(),
        ultimatum: { issuedRound: 1, deadlineRound: 3, requirement: 'Reach P1.' },
      },
    };
    const before = prepared.principal!.jobSecurity;
    const resolved = processBoardroomAfterRace(prepared, 3);
    expect(resolved.boardroom?.ultimatum).toBeUndefined();
    expect(resolved.principal!.jobSecurity).toBe(before - 15);
    expect(resolved.news[0].headline).toBe('Owner ultimatum failed');
  });

  it('keeps boardroom writes blocked in Single Season while reviews remain readable', () => {
    const state = newGame('SingleSeason');
    const mandate = gameReducer(state, { type: 'SELECT_BOARDROOM_MANDATE', mandate: 'Ambitious' })!;
    const funding = gameReducer(state, { type: 'REQUEST_BOARD_FUNDING', category: 'Facilities' })!;
    expect(mandate.boardroom?.mandate).toBeUndefined();
    expect(funding.boardroom?.fundingRequests ?? []).toHaveLength(0);
  });
});
