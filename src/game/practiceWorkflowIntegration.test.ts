import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from './initialCareer';
import { activeDriversForTeam, currentRace, type GameState } from './careerState';
import { gameReducer } from './gameReducer';
import { approvePreseasonTab } from './careerPhaseEngine';
import type { CarSetup } from '../types/setupTypes';

function enterWeekend(): GameState {
  let state = createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'practice-workflow',
  });
  for (const tab of ['teamOverview', 'budget', 'driverLineup', 'carDevelopment', 'sponsorsEngine', 'seasonObjectives', 'roundOnePreview'] as const) {
    state = approvePreseasonTab(state, tab);
  }
  state = gameReducer(state, { type: 'SELECT_RACE_WEEKEND_PACKAGE', packageType: 'Standard' })!;
  state = gameReducer(state, { type: 'COMPLETE_PRESEASON_SETUP' })!;
  return gameReducer(state, { type: 'ADVANCE_TO_RACE_WEEKEND' })!;
}

describe('iterative practice/setup weekend workflow', () => {
  it('records setup revisions and allows a verification stint in the same session', () => {
    let state = enterWeekend();
    const race = currentRace(state)!;
    const drivers = activeDriversForTeam(state, state.selectedTeamId);
    const assignments = drivers.map((driver) => ({
      driverId: driver.id,
      program: 'SetupExploration' as const,
      lapsPlanned: 12,
    }));

    state = gameReducer(state, {
      type: 'RUN_PRACTICE_SESSION',
      raceId: race.id,
      kind: 'Practice1',
      assignments,
    })!;
    const firstRun = state.weekendPractice!;
    expect(firstRun.sessions).toHaveLength(1);
    expect(firstRun.setupRevisionsByDriver?.[drivers[0].id]).toHaveLength(1);
    expect(firstRun.sessions[0].results?.[0].setupRevisionId).toContain('setup-r1');

    const priorSetup = state.carSetups?.[drivers[0].id];
    expect(priorSetup).toBeDefined();
    if (!priorSetup) throw new Error('Expected the player car to have a baseline setup');
    const changedSetup = Object.fromEntries(
      Object.entries(priorSetup).map(([key, value]) => [key, Math.min(10, value + 4)]),
    ) as CarSetup;
    state = gameReducer(state, {
      type: 'SET_CAR_SETUP',
      driverId: drivers[0].id,
      setup: changedSetup,
    })!;
    state = gameReducer(state, {
      type: 'RUN_PRACTICE_SESSION',
      raceId: race.id,
      kind: 'Practice1',
      assignments,
    })!;

    const verified = state.weekendPractice!;
    expect(verified.sessions).toHaveLength(2);
    expect(verified.sessions[1].id).not.toBe(verified.sessions[0].id);
    expect(verified.setupRevisionsByDriver?.[drivers[0].id]).toHaveLength(2);
    expect(verified.setupRevisionsByDriver?.[drivers[1].id]).toHaveLength(1);
    const changedResult = verified.sessions[1].results?.find((result) => result.driverId === drivers[0].id);
    expect(changedResult?.setupRevisionId).toContain('setup-r2');
    expect(changedResult?.setupEvidenceRelevance).toBeLessThan(1);
    expect(changedResult?.evidenceConfidence).toBeDefined();
    expect(verified.activeRevisionIdByDriver?.[drivers[0].id]).toBe(changedResult?.setupRevisionId);
  });
});
