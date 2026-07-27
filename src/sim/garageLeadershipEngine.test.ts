import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { activeDriversForTeam, type GameState } from '../game/careerState';
import { createNewGame } from '../game/initialCareer';
import type { RaceResult } from '../types/gameTypes';
import type { ConfirmedWeekendPlan } from '../types/weekendLeadershipTypes';
import {
  addGarageFollowUp,
  deliverGarageAddress,
  evaluateGarageAddressAfterRace,
  garageAddressForRace,
  garageAddressRaceEffects,
  previewGarageAddress,
  recommendedGarageAddress,
} from './garageLeadershipEngine';

function preparedState(): GameState {
  const base = createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'garage-leadership-test',
  });
  const race = base.calendar[0];
  const drivers = activeDriversForTeam(base, base.selectedTeamId);
  const plan: ConfirmedWeekendPlan = {
    raceId: race.id,
    teamId: base.selectedTeamId,
    seasonYear: base.seasonYear,
    round: race.round,
    preparationFocus: 'balanced',
    packageType: 'Standard',
    weatherCondition: 'Dry',
    practiceKnowledge: { setup: 70, tyres: 65, reliability: 60 },
    drivers: drivers.map((driver, index) => ({
      driverId: driver.id,
      gridPosition: index + 3,
      qualifyingPlanId: 'StandardPush',
      qualifyingRuns: 2,
      qualifyingTyreApproach: 'Standard',
      raceStrategyId: 'AggressiveTwoStop',
      instructionId: 'Aggressive',
      setupConfidence: 70,
      parcFermeLocked: true,
    })),
    recommendationResolutions: [],
    unresolvedWarningCount: 0,
  };
  const [aggressive, cautious] = drivers;
  return {
    ...base,
    careerPhase: {
      ...base.careerPhase!,
      currentPhase: 'race_weekend',
    },
    weekendPlans: [plan],
    driverRelationships: {
      ...base.driverRelationships!,
      [aggressive.id]: {
        ...base.driverRelationships![aggressive.id],
        personalityTraits: ['Risk Taker', 'Ambitious'],
        selfConfidence: 78,
        trustInCar: 72,
      },
      [cautious.id]: {
        ...base.driverRelationships![cautious.id],
        personalityTraits: ['Pressure Sensitive'],
        selfConfidence: 38,
        trustInCar: 35,
      },
    },
  };
}

function playerResults(state: GameState): RaceResult[] {
  return activeDriversForTeam(state, state.selectedTeamId).map((driver, index) => ({
    driverId: driver.id,
    teamId: state.selectedTeamId,
    gridPosition: index + 3,
    position: index + 1,
    status: 'Finished',
    lapsCompleted: 60,
    points: index === 0 ? 10 : 6,
    raceScore: 90 - index,
    gapText: index === 0 ? '' : '+5.000',
    incidents: [],
  }));
}

describe('garage leadership engine', () => {
  it('produces deterministic recommendations and personality-based reactions', () => {
    const state = preparedState();
    const raceId = state.calendar[0].id;

    expect(recommendedGarageAddress(state, raceId)).toEqual(
      recommendedGarageAddress(state, raceId),
    );
    const reactions = previewGarageAddress(state, raceId, 'AttackOpportunity');
    expect(reactions).toHaveLength(2);
    expect(reactions[0].fit).toBeGreaterThan(reactions[1].fit);
    expect(reactions.every((reaction) => reaction.reason.length > 0)).toBe(true);
  });

  it('allows one team message and keeps its race effects tightly bounded', () => {
    const state = preparedState();
    const raceId = state.calendar[0].id;
    const delivered = deliverGarageAddress(state, raceId, 'AttackOpportunity');
    const duplicate = deliverGarageAddress(delivered, raceId, 'ProtectFinish');
    const effects = garageAddressRaceEffects(delivered, raceId);

    expect(garageAddressForRace(delivered, raceId)?.tone).toBe('AttackOpportunity');
    expect(duplicate).toBe(delivered);
    expect(Object.values(effects).every((effect) =>
      effect.performanceModifier >= -0.015
      && effect.performanceModifier <= 0.015
      && effect.mistakeRiskMultiplier >= 0.97
      && effect.mistakeRiskMultiplier <= 1.03)).toBe(true);
  });

  it('allows at most one optional individual follow-up', () => {
    const state = preparedState();
    const raceId = state.calendar[0].id;
    const driverId = activeDriversForTeam(state, state.selectedTeamId)[1].id;
    const delivered = deliverGarageAddress(state, raceId, 'AttackOpportunity');
    const followedUp = addGarageFollowUp(delivered, raceId, driverId, 'ClarifyPlan');
    const duplicate = addGarageFollowUp(followedUp, raceId, driverId, 'Reassure');

    expect(garageAddressForRace(followedUp, raceId)?.followUp).toMatchObject({
      driverId,
      type: 'ClarifyPlan',
    });
    expect(duplicate).toBe(followedUp);
    const effect = garageAddressRaceEffects(followedUp, raceId)[driverId];
    expect(effect.performanceModifier).toBeGreaterThanOrEqual(-0.018);
    expect(effect.performanceModifier).toBeLessThanOrEqual(0.018);
    expect(effect.mistakeRiskMultiplier).toBeGreaterThanOrEqual(0.964);
    expect(effect.mistakeRiskMultiplier).toBeLessThanOrEqual(1.036);
  });

  it('records post-race accountability once from the confirmed plan and result', () => {
    const state = preparedState();
    const raceId = state.calendar[0].id;
    const delivered = deliverGarageAddress(state, raceId, 'AttackOpportunity');
    const evaluated = evaluateGarageAddressAfterRace(
      delivered,
      raceId,
      playerResults(delivered),
    );
    const evaluatedAgain = evaluateGarageAddressAfterRace(
      evaluated,
      raceId,
      playerResults(evaluated),
    );

    expect(garageAddressForRace(evaluated, raceId)?.accountability).toMatchObject({
      trustOutcome: 'BuiltTrust',
    });
    expect(garageAddressForRace(evaluated, raceId)?.accountability?.supportingEvidence).toHaveLength(3);
    expect(evaluatedAgain).toBe(evaluated);
  });
});
