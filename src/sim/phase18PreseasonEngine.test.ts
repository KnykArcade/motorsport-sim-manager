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
} from './phase18PreseasonEngine';

function freshState(gameMode: GameState['gameMode'] = 'Career', seed = 'phase18-preseason'): GameState {
  return createNewGame({
    gameMode,
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed,
  });
}

describe('Phase 18 preseason hub', () => {
  it('seeds every team deterministically and completes rival AI programmes', () => {
    const first = freshState();
    const second = freshState();

    expect(first.phase18?.preseason).toEqual(second.phase18?.preseason);
    expect(Object.keys(first.phase18!.preseason!.programs)).toHaveLength(first.teams.length);
    expect(preseasonProgramFor(first)?.testingCompleted).toBe(false);
    for (const team of first.teams.filter((entry) => entry.id !== first.selectedTeamId)) {
      const programme = preseasonProgramFor(first, team.id)!;
      expect(programme.launchCompleted).toBe(true);
      expect(programme.testingCompleted).toBe(true);
      expect(programme.testingReports).toHaveLength(3);
      expect(programme.aiDecisionReason).toContain('principal identity');
    }
    expect(first.phase18!.preseason!.rivalReports.length).toBeGreaterThan(0);
    expect(ensurePreseasonHubState(first).phase18?.preseason).toEqual(first.phase18?.preseason);
  });

  it('turns launch and testing choices into visible readiness, finance, and sponsor effects', () => {
    const initial = freshState('Career', 'preseason-player-actions');
    const teamBefore = initial.teams.find((team) => team.id === initial.selectedTeamId)!;
    const confidenceBefore = initial.commercial?.sponsors[0]?.confidence ?? 0;

    const launched = completeCarLaunch(initial, 'CommercialShowcase');
    const teamAfterLaunch = launched.teams.find((team) => team.id === launched.selectedTeamId)!;
    expect(preseasonProgramFor(launched)?.launchApproach).toBe('CommercialShowcase');
    expect(teamAfterLaunch.morale).toBeGreaterThan(teamBefore.morale);
    expect(launched.commercial?.sponsors[0]?.confidence ?? 0).toBeGreaterThan(confidenceBefore);
    expect(launched.news[0].headline).toContain('launches');

    const tested = completePreseasonTesting(launched, 'Performance');
    const programme = preseasonProgramFor(tested)!;
    const teamAfterTesting = tested.teams.find((team) => team.id === tested.selectedTeamId)!;
    expect(programme.testingFocus).toBe('Performance');
    expect(programme.testingReports).toHaveLength(3);
    expect(programme.readiness.pace).toBeGreaterThan(preseasonProgramFor(launched)!.readiness.pace);
    expect(teamAfterTesting.budget).toBe(teamAfterLaunch.budget - PRESEASON_TESTING_COST.Performance);
    expect(tested.finance?.at(-1)?.amount).toBe(-PRESEASON_TESTING_COST.Performance);
    const repeated = completePreseasonTesting(tested, 'Reliability');
    expect(preseasonProgramFor(repeated)).toEqual(programme);
    expect(repeated.teams.find((team) => team.id === repeated.selectedTeamId)!.budget).toBe(teamAfterTesting.budget);
  });

  it('makes testing free in single-season mode', () => {
    const initial = freshState('SingleSeason', 'preseason-single-season');
    const launched = completeCarLaunch(initial, 'Measured');
    const budget = launched.teams.find((team) => team.id === launched.selectedTeamId)!.budget;
    const tested = completePreseasonTesting(launched, 'Experimental');

    expect(preseasonProgramFor(tested)?.testingCompleted).toBe(true);
    expect(tested.teams.find((team) => team.id === tested.selectedTeamId)!.budget).toBe(budget);
  });

  it('allows a discovered flaw to be corrected and removes its Race 1 reliability penalty', () => {
    const tested = completePreseasonTesting(
      completeCarLaunch(freshState('Career', 'preseason-flaw-fix'), 'Measured'),
      'Balanced',
    );
    const programme = preseasonProgramFor(tested)!;
    const plantedFlaw = {
      id: 'test-discovered-flaw',
      area: 'Reliability' as const,
      severity: 12,
      discovered: true,
      resolved: false,
      description: 'A deterministic test flaw.',
    };
    const prepared: GameState = {
      ...tested,
      phase18: {
        ...tested.phase18!,
        preseason: {
          ...tested.phase18!.preseason!,
          programs: {
            ...tested.phase18!.preseason!.programs,
            [tested.selectedTeamId]: { ...programme, hiddenFlaws: [plantedFlaw] },
          },
        },
      },
    };
    const car = prepared.cars.find((entry) => entry.teamId === prepared.selectedTeamId)!;
    const penalized = applyPreseasonCarModifier(prepared, car);
    const budgetBefore = prepared.teams.find((team) => team.id === prepared.selectedTeamId)!.budget;
    const repaired = resolvePreseasonFlaw(prepared, plantedFlaw.id);
    const corrected = applyPreseasonCarModifier(repaired, car);

    expect(preseasonProgramFor(repaired)?.hiddenFlaws[0].resolved).toBe(true);
    expect(repaired.teams.find((team) => team.id === repaired.selectedTeamId)!.budget).toBe(budgetBefore - PRESEASON_FLAW_FIX_COST);
    expect(corrected.ratings.reliability).toBeGreaterThan(penalized.ratings.reliability);
    expect(applyPreseasonCarModifier({ ...repaired, currentRaceIndex: 1 }, car)).toBe(car);
  });

  it('survives JSON save serialization with player and AI decisions intact', () => {
    const completed = completePreseasonTesting(
      completeCarLaunch(freshState('Career', 'preseason-save'), 'PerformanceStatement'),
      'RaceOperations',
    );
    const restored = JSON.parse(JSON.stringify(completed)) as GameState;

    expect(preseasonProgramFor(restored)).toEqual(preseasonProgramFor(completed));
    expect(restored.phase18?.preseason?.rivalReports).toEqual(completed.phase18?.preseason?.rivalReports);
  });

  it('creates a fresh decision window for the player and fresh AI programmes after rollover', () => {
    const next = advanceSeason({ ...freshState('Career', 'preseason-rollover'), seasonComplete: true });

    expect(next.phase18?.preseason?.seasonYear).toBe(1996);
    expect(preseasonProgramFor(next)?.launchCompleted).toBe(false);
    expect(preseasonProgramFor(next)?.testingCompleted).toBe(false);
    for (const team of next.teams.filter((entry) => entry.id !== next.selectedTeamId)) {
      expect(preseasonProgramFor(next, team.id)?.testingCompleted).toBe(true);
    }
  });
});
