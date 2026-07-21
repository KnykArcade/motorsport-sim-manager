import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import { getTrackById } from '../data';
import { weekendForecast } from '../sim/weatherEngine';
import { buildWeekendPlan, nextWeekendPhase } from './weekendPlanViewModel';

describe('weekendPlanViewModel', () => {
  it('keeps the minimum package on the shortest valid path', () => {
    expect(nextWeekendPhase('briefing', true, false)).toBe('quali-run');
    expect(nextWeekendPhase('quali-review', true, true)).toBe('race-strategy');
  });

  it('prioritizes the largest knowledge gap and exposes advisor context', () => {
    const state = createNewGame({
      gameMode: 'SingleSeason',
      seasonYear: 1995,
      series: 'F1',
      teamId: 't-benetton',
      seed: 'weekend-plan-test',
    });
    const race = state.calendar[0];
    const track = getTrackById(race.trackId)!;
    const forecast = weekendForecast(track, `${state.randomSeed}-r${race.round}`);
    const plan = buildWeekendPlan({
      phase: 'hub',
      isMinPackage: false,
      qualifyingComplete: false,
      track,
      forecast,
      knowledgeGaps: { setup: 0.2, tire: 0.8, reliability: 0.5 },
    });

    expect(plan.nextPhase).toBe('briefing');
    expect(plan.nextLabel).toBe('Track Briefing');
    expect(plan.knowledgePriority).toBe('Setup');
    expect(plan.qualifyingRecommendation.length).toBeGreaterThan(0);
    expect(plan.raceRecommendation.length).toBeGreaterThan(0);
    expect(plan.instructionRecommendation.length).toBeGreaterThan(0);
  });

  it('shows a staff-prepared recommendation without taking race decisions away', () => {
    const state = createNewGame({
      gameMode: 'SingleSeason',
      seasonYear: 1995,
      series: 'F1',
      teamId: 't-benetton',
      seed: 'weekend-plan-staff',
    });
    const raceEngineer = {
      id: 'staff-race-engineer',
      name: 'Test Race Engineer',
      role: 'Race Engineer' as const,
      nationality: 'British',
      rating: 82,
      salary: 1,
      signingFee: 0,
      bio: 'Weekend specialist',
    };
    const race = state.calendar[0];
    const track = getTrackById(race.trackId)!;
    const forecast = weekendForecast(track, `${state.randomSeed}-r${race.round}`);
    const plan = buildWeekendPlan({
      phase: 'hub',
      isMinPackage: false,
      qualifyingComplete: false,
      track,
      forecast,
      knowledgeGaps: { setup: 0.2, tire: 0.8, reliability: 0.5 },
      raceEngineer,
      racePreparationPolicy: 'staff_prepare_player_approval',
    });

    expect(plan.staffRecommendation?.owner).toContain(raceEngineer.name);
    expect(plan.staffRecommendation?.confidence).toBeGreaterThan(0);
    expect(plan.staffRecommendation?.approvalBoundary).toContain('approve');
  });
});
