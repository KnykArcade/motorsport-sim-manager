import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import type { GameState } from '../game/careerState';
import type { RaceResult } from '../types/gameTypes';
import {
  applyMentalResilienceRecovery,
  assignDevelopmentFocus,
  assignDevelopmentMentor,
  assignTestingAllocation,
  closeDevelopmentPlanSeason,
  defaultDriverDevelopmentPlan,
  developmentPlanEffect,
  developmentRecommendation,
  mentorCandidates,
  progressDriverDevelopmentPlans,
  testingAllocationUsed,
} from './driverDevelopmentPlanEngine';

function career(seed = 'driver-development'): GameState {
  return createNewGame({ gameMode: 'Career', seasonYear: 1994, series: 'F1', teamId: 't-williams', seed });
}

function finish(driverId: string, teamId: string): RaceResult {
  return {
    driverId,
    teamId,
    position: 5,
    gridPosition: 8,
    lapsCompleted: 60,
    points: 2,
    raceScore: 75,
    gapText: '+20.000',
    status: 'Finished',
    incidents: [],
  };
}

describe('individual driver development plans', () => {
  it('persists a focus and enforces the finite team testing pool', () => {
    const state = career();
    const drivers = state.drivers.filter((driver) => driver.teamId === state.selectedTeamId);
    const focused = assignDevelopmentFocus(state, drivers[0].id, 'Racecraft');
    const first = assignTestingAllocation(focused, drivers[0].id, 70);
    const second = assignTestingAllocation(first, drivers[1].id, 40);
    expect(first.driverDevelopmentPlans?.[drivers[0].id].focus).toBe('Racecraft');
    expect(testingAllocationUsed(first)).toBe(70);
    expect(second).toBe(first);
  });

  it('only accepts a credible experienced teammate as mentor', () => {
    const state = career();
    const drivers = state.drivers.filter((driver) => driver.teamId === state.selectedTeamId);
    const mentee = drivers.sort((a, b) => (a.age ?? 0) - (b.age ?? 0))[0];
    const candidates = mentorCandidates(state, mentee.id);
    if (candidates.length === 0) {
      const rejected = assignDevelopmentMentor(state, mentee.id, 'not-a-mentor');
      expect(rejected).toBe(state);
      return;
    }
    const assigned = assignDevelopmentMentor(state, mentee.id, candidates[0].id);
    expect(assigned.driverDevelopmentPlans?.[mentee.id].mentorId).toBe(candidates[0].id);
  });

  it('progresses deterministically from testing, staff, facilities, morale, confidence, seat time, and mentorship inputs', () => {
    const state = career('progress');
    const driver = state.drivers.find((entry) => entry.teamId === state.selectedTeamId)!;
    const planned = assignTestingAllocation(assignDevelopmentFocus(state, driver.id, 'QualifyingPace'), driver.id, 50);
    const result = finish(driver.id, driver.teamId);
    const a = progressDriverDevelopmentPlans(planned, 1, [result]);
    const b = progressDriverDevelopmentPlans(planned, 1, [result]);
    expect(a.driverDevelopmentPlans?.[driver.id]).toEqual(b.driverDevelopmentPlans?.[driver.id]);
    expect(a.driverDevelopmentPlans?.[driver.id].progress).toBeGreaterThan(0);
  });

  it('turns season progress and satisfaction into a bounded offseason effect and history record', () => {
    const plan = { ...defaultDriverDevelopmentPlan('d1', 1994), progress: 90, satisfaction: 80, status: 'Progressing' as const };
    expect(developmentPlanEffect(plan)).toBeGreaterThan(0);
    expect(developmentPlanEffect({ ...plan, progress: 0, satisfaction: 10, status: 'Frustrated' })).toBeLessThan(0);
    const closed = closeDevelopmentPlanSeason(plan, 1995, 70, 72);
    expect(closed.progress).toBe(0);
    expect(closed.history.at(-1)?.overallAfter).toBe(72);
  });

  it('uses a mental-resilience plan to recover confidence after a clean finish but not a crash', () => {
    const state = career('resilience');
    const driver = state.drivers.find((entry) => entry.teamId === state.selectedTeamId)!;
    const planned = assignDevelopmentFocus(state, driver.id, 'MentalResilience');
    const relationships = planned.driverRelationships!;
    const clean = applyMentalResilienceRecovery(planned, relationships, [finish(driver.id, driver.teamId)])!;
    const crash = applyMentalResilienceRecovery(planned, relationships, [{ ...finish(driver.id, driver.teamId), status: 'DNF', position: null, incidents: ['Crash'] }])!;
    expect(clean[driver.id].selfConfidence).toBeGreaterThan(relationships[driver.id].selfConfidence);
    expect(crash[driver.id].selfConfidence).toBe(relationships[driver.id].selfConfidence);
  });

  it('keeps recommendations advisory and blocks long-term planning in Single Season', () => {
    const state = career('advisory');
    const driver = state.drivers.find((entry) => entry.teamId === state.selectedTeamId)!;
    const recommendation = developmentRecommendation(state, driver.id);
    expect(recommendation).toBeTruthy();
    expect(state.driverDevelopmentPlans?.[driver.id]).toBeUndefined();
    const single = { ...state, gameMode: 'SingleSeason' as const };
    expect(assignDevelopmentFocus(single, driver.id, recommendation)).toBe(single);
  });
});
