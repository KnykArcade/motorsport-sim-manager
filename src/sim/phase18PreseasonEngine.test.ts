import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import type { GameState } from '../game/careerState';
import { createNewGame } from '../game/initialCareer';
import { advanceSeason } from '../game/seasonRollover';
import {
  PRESEASON_FLAW_FIX_COST,
  PRESEASON_TESTING_COST,
  applyPreseasonCarModifier,
  completeCarLaunch,
  completePreseasonTesting,
  ensurePreseasonHubState,
  preseasonProgramFor,
  resolvePreseasonFlaw,
  revisePreseasonTestSetup,
  runPreseasonTestSession,
  setPreseasonSessionProgram,
  startPreseasonTesting,
} from './phase18PreseasonEngine';

function freshState(gameMode: GameState['gameMode'] = 'Career', seed = 'phase18-preseason'): GameState {
  return createNewGame({ gameMode, seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed });
}

function launched(seed: string): GameState {
  return completeCarLaunch(freshState('Career', seed), 'Measured');
}

describe('Phase 10 preseason testing and correlation', () => {
  it('seeds equivalent finite AI programmes for every rival team', () => {
    const first = freshState();
    const second = freshState();
    expect(first.phase18?.preseason).toEqual(second.phase18?.preseason);
    expect(Object.keys(first.phase18!.preseason!.programs)).toHaveLength(first.teams.length);
    expect(preseasonProgramFor(first)?.testingCompleted).toBe(false);
    for (const team of first.teams.filter((entry) => entry.id !== first.selectedTeamId)) {
      const programme = preseasonProgramFor(first, team.id)!;
      const expectedSessions = programme.ruleProfile!.days * programme.ruleProfile!.sessionsPerDay;
      expect(programme.launchCompleted).toBe(true);
      expect(programme.testingCompleted).toBe(true);
      expect(programme.sessions).toHaveLength(expectedSessions);
      expect(programme.aiDecisionReason).toContain('session allocation');
      expect(programme.sessions!.every((session) => session.assignments.length <= programme.ruleProfile!.maxCarsPerSession)).toBe(true);
    }
    expect(first.setupArchive?.some((entry) => entry.evidenceOrigin === 'PreseasonTest' && entry.teamId !== first.selectedTeamId)).toBe(true);
  });

  it('requires the player to start and run each permitted session', () => {
    const initial = launched('preseason-player-sessions');
    const teamBefore = initial.teams.find((team) => team.id === initial.selectedTeamId)!;
    let state = startPreseasonTesting(initial, 'Performance');
    const started = preseasonProgramFor(state)!;
    expect(started.testingStarted).toBe(true);
    expect(started.testingCompleted).toBe(false);
    expect(started.sessions).toHaveLength(0);
    expect(state.teams.find((team) => team.id === state.selectedTeamId)!.budget).toBe(teamBefore.budget - PRESEASON_TESTING_COST.Performance);

    const driverId = Object.keys(started.pendingAssignments!)[0];
    state = setPreseasonSessionProgram(state, driverId, 'Correlation');
    const beforeWing = preseasonProgramFor(state)!.pendingAssignments![driverId].setup.frontWing;
    state = revisePreseasonTestSetup(state, driverId, 'frontWing', beforeWing + 0.5);
    expect(preseasonProgramFor(state)!.pendingAssignments![driverId].revision).toBe(1);
    state = runPreseasonTestSession(state);
    expect(preseasonProgramFor(state)!.sessions).toHaveLength(1);
    expect(preseasonProgramFor(state)!.testingCompleted).toBe(false);

    const total = started.ruleProfile!.days * started.ruleProfile!.sessionsPerDay;
    for (let index = 1; index < total; index += 1) state = runPreseasonTestSession(state);
    const completed = preseasonProgramFor(state)!;
    expect(completed.testingCompleted).toBe(true);
    expect(completed.sessions).toHaveLength(total);
    expect(Object.keys(completed.baselineByDriver!)).not.toHaveLength(0);
    expect(state.setupArchive?.filter((entry) => entry.teamId === state.selectedTeamId && entry.evidenceOrigin === 'PreseasonTest').every((entry) => entry.requiresWeekendVerification)).toBe(true);
  });

  it('rotates a one-car modern F1 test between drivers', () => {
    let state = createNewGame({ gameMode: 'Career', seasonYear: 2026, series: 'F1', teamId: 't-mclaren', seed: 'preseason-one-car' });
    state = completeCarLaunch(state, 'Measured');
    state = startPreseasonTesting(state, 'Balanced');
    state = runPreseasonTestSession(state);
    state = runPreseasonTestSession(state);
    const sessions = preseasonProgramFor(state)!.sessions!;
    expect(sessions[0].assignments).toHaveLength(1);
    expect(sessions[1].assignments).toHaveLength(1);
    expect(sessions[0].assignments[0].driverId).not.toBe(sessions[1].assignments[0].driverId);
  });

  it('removes the old generic pace boost and preserves only a real unresolved reliability flaw', () => {
    const completed = completePreseasonTesting(launched('preseason-no-pace-boost'), 'Experimental');
    const car = completed.cars.find((entry) => entry.teamId === completed.selectedTeamId)!;
    const programme = preseasonProgramFor(completed)!;
    const planted: GameState = {
      ...completed,
      phase18: { ...completed.phase18!, preseason: { ...completed.phase18!.preseason!, programs: { ...completed.phase18!.preseason!.programs, [completed.selectedTeamId]: { ...programme, hiddenFlaws: [{ id: 'reliability-flaw', area: 'Reliability', severity: 10, discovered: true, resolved: false, description: 'Known durability fault.' }] } } } },
    };
    const modified = applyPreseasonCarModifier(planted, car);
    expect(modified.ratings.enginePower).toBe(car.ratings.enginePower);
    expect(modified.ratings.aeroEfficiency).toBe(car.ratings.aeroEfficiency);
    expect(modified.ratings.mechanicalGrip).toBe(car.ratings.mechanicalGrip);
    expect(modified.ratings.pitCrewOperations).toBe(car.ratings.pitCrewOperations);
    expect(modified.ratings.reliability).toBeLessThan(car.ratings.reliability);
  });

  it('charges for a discovered correction, records repair time, and restores base reliability', () => {
    const tested = completePreseasonTesting(launched('preseason-flaw-fix'), 'Balanced');
    const programme = preseasonProgramFor(tested)!;
    const plantedFlaw = { id: 'test-discovered-flaw', area: 'Reliability' as const, severity: 12, discovered: true, resolved: false, description: 'A deterministic test flaw.' };
    const prepared: GameState = { ...tested, phase18: { ...tested.phase18!, preseason: { ...tested.phase18!.preseason!, programs: { ...tested.phase18!.preseason!.programs, [tested.selectedTeamId]: { ...programme, hiddenFlaws: [plantedFlaw] } } } } };
    const car = prepared.cars.find((entry) => entry.teamId === prepared.selectedTeamId)!;
    const budgetBefore = prepared.teams.find((team) => team.id === prepared.selectedTeamId)!.budget;
    const repaired = resolvePreseasonFlaw(prepared, plantedFlaw.id);
    expect(preseasonProgramFor(repaired)?.hiddenFlaws[0].resolved).toBe(true);
    expect(preseasonProgramFor(repaired)?.repairTimeLostMinutes).toBeGreaterThan(preseasonProgramFor(prepared)?.repairTimeLostMinutes ?? 0);
    expect(repaired.teams.find((team) => team.id === repaired.selectedTeamId)!.budget).toBe(budgetBefore - PRESEASON_FLAW_FIX_COST);
    expect(applyPreseasonCarModifier(repaired, car)).toBe(car);
  });

  it('keeps single-season testing included and migrates legacy programme fields deterministically', () => {
    const single = completeCarLaunch(freshState('SingleSeason', 'preseason-single-season'), 'Measured');
    const budget = single.teams.find((team) => team.id === single.selectedTeamId)!.budget;
    const started = startPreseasonTesting(single, 'Reliability');
    expect(started.teams.find((team) => team.id === started.selectedTeamId)!.budget).toBe(budget);

    const programme = preseasonProgramFor(started)!;
    const legacy: GameState = { ...started, phase18: { ...started.phase18!, preseason: { ...started.phase18!.preseason!, programs: { ...started.phase18!.preseason!.programs, [started.selectedTeamId]: { teamId: programme.teamId, seasonYear: programme.seasonYear, launchCompleted: true, testingCompleted: false, testingReports: [], hiddenFlaws: [], readiness: programme.readiness } } } } };
    const migrated = ensurePreseasonHubState(legacy);
    expect(preseasonProgramFor(migrated)?.ruleProfile).toBeDefined();
    expect(preseasonProgramFor(migrated)?.sessions).toEqual([]);
    expect(preseasonProgramFor(migrated)?.correlation?.status).toBe('Unverified');
  });

  it('survives save serialization and creates a fresh programme after rollover', () => {
    const completed = completePreseasonTesting(launched('preseason-save'), 'RaceOperations');
    const restored = JSON.parse(JSON.stringify(completed)) as GameState;
    expect(preseasonProgramFor(restored)).toEqual(preseasonProgramFor(completed));
    const next = advanceSeason({ ...completed, seasonComplete: true });
    expect(next.phase18?.preseason?.seasonYear).toBe(1996);
    expect(preseasonProgramFor(next)?.testingStarted).toBe(false);
    expect(preseasonProgramFor(next)?.testingCompleted).toBe(false);
    expect(next.setupArchive?.some((entry) => entry.seasonYear === 1995 && entry.evidenceOrigin === 'PreseasonTest')).toBe(true);
  });
});
