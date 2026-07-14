import { describe, expect, it } from 'vitest';
import type { GameState } from '../game/careerState';
import { createNewGame } from '../game/initialCareer';
import type { RaceResult } from '../types/gameTypes';
import {
  FAILURE_INVESTIGATION_COST,
  FAILURE_RESPONSE_COST,
  applyFailureRiskModifier,
  failureCasesForRace,
  investigateFailure,
  recordFailureInvestigations,
  respondToFailure,
} from './phase18FailureInvestigationEngine';

function freshState(seed = 'phase18-failure'): GameState {
  return createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed });
}

function dnf(driverId: string, teamId: string, incident: string): RaceResult {
  return { position: null, driverId, teamId, gridPosition: 4, status: 'DNF', lapsCompleted: 28, points: 0, raceScore: 0, gapText: 'DNF (lap 29)', incidents: [incident] };
}

describe('Phase 18 failure investigation', () => {
  it('creates player cases and automatically handles rival investigations', () => {
    const state = freshState();
    const player = state.drivers.find((driver) => driver.teamId === state.selectedTeamId)!;
    const rival = state.drivers.find((driver) => driver.teamId !== state.selectedTeamId)!;
    const recorded = recordFailureInvestigations(state, 'race-1', 1, [
      dnf(player.id, player.teamId, 'Gearbox failure'),
      dnf(rival.id, rival.teamId, 'Engine failure'),
    ]);
    const cases = failureCasesForRace(recorded, 'race-1');

    expect(cases).toHaveLength(2);
    expect(cases.find((item) => item.teamId === state.selectedTeamId)?.status).toBe('AwaitingInvestigation');
    const aiCase = cases.find((item) => item.teamId !== state.selectedTeamId)!;
    expect(aiCase.investigationLevel).toBeDefined();
    expect(aiCase.response).toBeDefined();
    expect(aiCase.aiDecisionReason).toContain('budget');
    expect(recorded.phase18?.failureInvestigations?.repeatedIssueCounters[`${player.teamId}:PartWear`]).toBe(1);
  });

  it('charges for investigation, reveals a confidence-rated finding, and prevents duplicate reviews', () => {
    const state = freshState('failure-investigation-choice');
    const driver = state.drivers.find((entry) => entry.teamId === state.selectedTeamId)!;
    const recorded = recordFailureInvestigations(state, 'race-1', 1, [dnf(driver.id, driver.teamId, 'Brake failure')]);
    const item = failureCasesForRace(recorded, 'race-1')[0];
    const budget = recorded.teams.find((team) => team.id === recorded.selectedTeamId)!.budget;
    const investigated = investigateFailure(recorded, item.id, 'FullTechnicalInvestigation');
    const finding = failureCasesForRace(investigated, 'race-1')[0];

    expect(finding.status).toBe('FindingsReady');
    expect(finding.finding).toBe(finding.hiddenRootCause);
    expect(finding.confidence).toBe(96);
    expect(investigated.teams.find((team) => team.id === investigated.selectedTeamId)!.budget).toBe(budget - FAILURE_INVESTIGATION_COST.FullTechnicalInvestigation);
    expect(investigateFailure(investigated, item.id, 'QuickReview').teams).toEqual(investigated.teams);
  });

  it('turns a proper response into car reliability and clears future failure risk', () => {
    const state = freshState('failure-response');
    const driver = state.drivers.find((entry) => entry.teamId === state.selectedTeamId)!;
    const recorded = recordFailureInvestigations(state, 'race-1', 1, [dnf(driver.id, driver.teamId, 'Cooling failure')]);
    const item = failureCasesForRace(recorded, 'race-1')[0];
    const investigated = investigateFailure(recorded, item.id, 'StandardInvestigation');
    const car = investigated.cars.find((entry) => entry.teamId === investigated.selectedTeamId)!;
    const penalized = applyFailureRiskModifier(investigated, car);
    const budget = investigated.teams.find((team) => team.id === investigated.selectedTeamId)!.budget;
    const resolved = respondToFailure(investigated, item.id, 'RepairProperly');
    const outcome = failureCasesForRace(resolved, 'race-1')[0];

    expect(outcome.status).toBe('Resolved');
    expect(outcome.unresolvedRisk).toBe(0);
    expect(resolved.teams.find((team) => team.id === resolved.selectedTeamId)!.budget).toBe(budget - FAILURE_RESPONSE_COST.RepairProperly);
    expect(applyFailureRiskModifier(resolved, car).ratings.reliability).toBe(car.ratings.reliability);
    expect(penalized.ratings.reliability).toBeLessThan(car.ratings.reliability);
  });

  it('makes hiding an issue cheaper now but increases persistent risk and sponsor concern', () => {
    const state = freshState('failure-cover-up');
    const driver = state.drivers.find((entry) => entry.teamId === state.selectedTeamId)!;
    const investigated = investigateFailure(
      recordFailureInvestigations(state, 'race-1', 1, [dnf(driver.id, driver.teamId, 'Engine failure')]),
      `failure-1995-race-1-${driver.id}`,
      'QuickReview',
    );
    const confidence = investigated.commercial?.sponsors[0]?.confidence ?? 0;
    const hidden = respondToFailure(investigated, `failure-1995-race-1-${driver.id}`, 'HideIssue');
    const outcome = failureCasesForRace(hidden, 'race-1')[0];

    expect(outcome.status).toBe('Minimized');
    expect(outcome.unresolvedRisk).toBeGreaterThan(failureCasesForRace(investigated, 'race-1')[0].unresolvedRisk);
    expect(hidden.commercial?.sponsors[0]?.confidence ?? 0).toBeLessThan(confidence);
  });

  it('persists cases and history through JSON save serialization', () => {
    const state = freshState('failure-save');
    const driver = state.drivers.find((entry) => entry.teamId === state.selectedTeamId)!;
    const recorded = recordFailureInvestigations(state, 'race-1', 1, [dnf(driver.id, driver.teamId, 'Suspension failure')]);
    const restored = JSON.parse(JSON.stringify(recorded)) as GameState;

    expect(restored.phase18?.failureInvestigations).toEqual(recorded.phase18?.failureInvestigations);
  });
});
