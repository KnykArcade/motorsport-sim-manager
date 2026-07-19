import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import { defaultCareerPhaseState } from '../game/careerPhaseEngine';
import type { GameState } from '../game/careerState';
import type { PaddockEvent } from '../types/careerPhaseTypes';
import type { StaffMember } from '../types/staffTypes';
import {
  advisorPreparationEffectMultiplier,
  advisorRecommendationsForDecision,
  advisorTrustChangeForChoice,
  generateAdvisorRecommendations,
  hasAdvisorDisagreement,
  resolveAdvisorRecommendations,
} from './phase18AdvisorEngine';

function freshState(seed = 'phase18-advisors'): GameState {
  return createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed,
  });
}

function racePrepEvent(id = 'advisor-race-prep'): PaddockEvent {
  return {
    id,
    weekId: 'pw-1995-1',
    season: 1995,
    series: 'F1',
    round: 1,
    category: 'general_team',
    title: 'Select race preparation focus',
    description: 'Choose the team focus.',
    severity: 'minor',
    isRequiredDecision: true,
    options: [
      { id: 'balanced', label: 'Balanced Preparation', description: 'Balance every area.' },
      { id: 'qualifying', label: 'Qualifying Focus', description: 'Prioritize grid position.' },
      { id: 'race', label: 'Race Pace Focus', description: 'Prioritize long runs.' },
      { id: 'reliability', label: 'Reliability Focus', description: 'Prioritize durability.' },
    ],
    effectsApplied: false,
    createdAt: '1995-01-01T00:00:00.000Z',
  };
}

function withPaddockEvent(state: GameState, event: PaddockEvent): GameState {
  return {
    ...state,
    careerPhase: {
      ...defaultCareerPhaseState(),
      currentPhase: 'paddock_week',
      currentRound: event.round,
      paddockEvents: [event],
    },
  };
}

describe('Phase 18 advisor council', () => {
  it('uses hired staff names and produces visible, deterministic disagreement', () => {
    const technicalDirector: StaffMember = {
      id: 'staff-technical-test',
      name: 'Alex Technical',
      role: 'Technical Director',
      nationality: 'British',
      rating: 9,
      salary: 2,
      signingFee: 1,
      bio: 'Test technical director.',
    };
    const event = racePrepEvent();
    const state = withPaddockEvent({ ...freshState(), staff: [technicalDirector] }, event);
    const next = generateAdvisorRecommendations(state, [event]);
    const recommendations = advisorRecommendationsForDecision(next, event.id);

    expect(recommendations).toHaveLength(3);
    expect(recommendations.find((item) => item.advisorRole === 'TechnicalDirector')?.advisorName).toBe('Alex Technical');
    expect(recommendations.find((item) => item.advisorRole === 'TechnicalDirector')?.recommendedOptionId).toBe('reliability');
    expect(recommendations.find((item) => item.advisorRole === 'RaceEngineer')?.recommendedOptionId).toBe('race');
    expect(recommendations.find((item) => item.advisorRole === 'SportingDirector')?.recommendedOptionId).toBe('qualifying');
    expect(hasAdvisorDisagreement(recommendations)).toBe(true);
  });

  it('does not duplicate recommendations when generation is dispatched again', () => {
    const event = racePrepEvent();
    const state = withPaddockEvent(freshState('advisor-idempotent'), event);
    const once = generateAdvisorRecommendations(state, [event]);
    const twice = generateAdvisorRecommendations(once, [event]);
    expect(twice.phase18?.advisorRecommendations).toEqual(once.phase18?.advisorRecommendations);
  });

  it('records accepted and overruled advice with department trust consequences', () => {
    const event = racePrepEvent();
    const state = withPaddockEvent(freshState('advisor-consequences'), event);
    const generated = generateAdvisorRecommendations(state, [event]);
    const selected = event.options!.find((option) => option.id === 'race')!;
    const predictedTrustChange = advisorRecommendationsForDecision(generated, event.id)
      .reduce((sum, recommendation) => sum + advisorTrustChangeForChoice(recommendation, selected.id), 0);
    const resolved = resolveAdvisorRecommendations(generated, event, selected);
    const recommendations = advisorRecommendationsForDecision(resolved, event.id);

    expect(recommendations.find((item) => item.advisorRole === 'RaceEngineer')?.status).toBe('Accepted');
    expect(recommendations.find((item) => item.advisorRole === 'TechnicalDirector')?.status).toBe('Overruled');
    expect(recommendations.find((item) => item.advisorRole === 'SportingDirector')?.status).toBe('Overruled');
    expect(resolved.phase18!.departmentMoods[state.selectedTeamId].Engineering.trustInPrincipal).toBeGreaterThan(50);
    expect(resolved.phase18!.departmentMoods[state.selectedTeamId].Technical.trustInPrincipal).toBeLessThan(50);
    expect(resolved.phase18!.departmentMoods[state.selectedTeamId].Technical.conflictReasons.at(-1)).toContain('Advice overruled');
    expect(recommendations.reduce((sum, recommendation) => sum + (recommendation.trustChange ?? 0), 0)).toBe(predictedTrustChange);
  });

  it('expires unresolved advice when the decision leaves the active paddock week', () => {
    const firstEvent = racePrepEvent('advisor-old');
    const first = generateAdvisorRecommendations(withPaddockEvent(freshState('advisor-expiry'), firstEvent), [firstEvent]);
    const secondEvent = racePrepEvent('advisor-new');
    const next = generateAdvisorRecommendations(withPaddockEvent(first, secondEvent), [secondEvent]);

    expect(advisorRecommendationsForDecision(next, firstEvent.id).every((item) => item.status === 'Expired')).toBe(true);
    expect(advisorRecommendationsForDecision(next, secondEvent.id).every((item) => item.status === 'Pending')).toBe(true);
  });

  it('turns followed advice into a small, capped preparation execution bonus', () => {
    const event = racePrepEvent();
    const state = withPaddockEvent(freshState('advisor-gameplay'), event);
    const generated = generateAdvisorRecommendations(state, [event]);
    const selected = event.options!.find((option) => option.id === 'race')!;
    const resolved = resolveAdvisorRecommendations(generated, event, selected);
    const withResolvedEvent: GameState = {
      ...resolved,
      careerPhase: {
        ...resolved.careerPhase!,
        paddockEvents: [{ ...event, resolvedOptionId: selected.id, effectsApplied: true }],
      },
    };

    expect(advisorPreparationEffectMultiplier(withResolvedEvent)).toBeGreaterThan(1);
    expect(advisorPreparationEffectMultiplier(withResolvedEvent)).toBeLessThanOrEqual(1.03);
  });

  it('survives a JSON save round trip with resolution history intact', () => {
    const event = racePrepEvent();
    const state = withPaddockEvent(freshState('advisor-save'), event);
    const generated = generateAdvisorRecommendations(state, [event]);
    const resolved = resolveAdvisorRecommendations(generated, event, event.options![0]);
    const restored = JSON.parse(JSON.stringify(resolved)) as GameState;

    expect(restored.phase18?.advisorRecommendations).toEqual(resolved.phase18?.advisorRecommendations);
    expect(restored.phase18?.departmentMoods).toEqual(resolved.phase18?.departmentMoods);
  });
});
