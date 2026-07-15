import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import { defaultCareerPhaseState, resolvePaddockEvent } from '../game/careerPhaseEngine';
import type { GameState } from '../game/careerState';
import type { PaddockEvent } from '../types/careerPhaseTypes';
import {
  applyAILeadershipDirection,
  applyLeadershipDecision,
  applyLeadershipPreparationModifier,
  leadershipDecisionPreview,
  leadershipGameplayModifiers,
} from './phase18IdentityCultureEngine';

function freshState(seed = 'phase18-identity-culture'): GameState {
  return createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed,
  });
}

function preparationEvent(optionId: string): PaddockEvent {
  return {
    id: 'leadership-race-prep',
    weekId: 'pw-1995-1',
    season: 1995,
    series: 'F1',
    round: 1,
    category: 'general_team',
    title: 'Select race preparation focus',
    description: 'Choose a focus.',
    severity: 'minor',
    isRequiredDecision: true,
    options: [{ id: optionId, label: `${optionId} focus`, description: 'Test option.' }],
    effectsApplied: false,
    createdAt: '1995-01-01T00:00:00.000Z',
  };
}

describe('Phase 18 identity and culture gameplay', () => {
  it('turns a reliability decision into identity XP, culture drift, and department confidence', () => {
    const state = freshState();
    const event = preparationEvent('reliability');
    const next = applyLeadershipDecision(state, event, event.options![0]);
    const identity = next.phase18!.principalIdentity;
    const culture = next.phase18!.teamCultures[state.selectedTeamId];
    const technical = next.phase18!.departmentMoods[state.selectedTeamId].Technical;

    expect(identity.scores.TechnicalVisionary).toBe(4);
    expect(identity.dominantIdentity).toBe('TechnicalVisionary');
    expect(identity.history.at(-1)?.reason).toContain('reliability focus');
    expect(culture.axes.Discipline).toBe(52);
    expect(culture.axes.RiskAppetite).toBe(49);
    expect(culture.stability).toBe(52);
    expect(technical.trustInPrincipal).toBe(52);
    expect(technical.preferredPriority).toBe('reliability focus');
  });

  it('applies a resolved paddock decision exactly once', () => {
    const state = freshState('phase18-idempotent');
    const event = preparationEvent('power');
    const prepared: GameState = {
      ...state,
      careerPhase: {
        ...defaultCareerPhaseState(),
        currentPhase: 'paddock_week',
        currentRound: 1,
        paddockEvents: [event],
      },
    };
    const once = resolvePaddockEvent(prepared, event.id, 'power');
    const twice = resolvePaddockEvent(once, event.id, 'power');

    expect(once.phase18!.principalIdentity.scores.RiskTakingInnovator).toBe(4);
    expect(twice.phase18).toEqual(once.phase18);
  });

  it('derives bounded gameplay modifiers from earned identity and team culture', () => {
    const state = freshState('phase18-modifiers');
    const event = preparationEvent('reliability');
    let evolved = state;
    for (let index = 0; index < 20; index += 1) {
      evolved = applyLeadershipDecision(
        evolved,
        { ...event, id: `${event.id}-${index}` },
        event.options![0],
      );
    }
    const modifiers = leadershipGameplayModifiers(evolved);

    expect(modifiers.developmentSuccessBonus).toBeGreaterThan(0);
    expect(modifiers.developmentSuccessBonus).toBeLessThanOrEqual(0.08);
    expect(modifiers.preparationEffectMultiplier).toBeGreaterThan(1);
    expect(modifiers.preparationEffectMultiplier).toBeLessThanOrEqual(1.1);
  });

  it('scales real race-preparation effects using the culture modifier', () => {
    const state = freshState('phase18-preparation');
    const culture = state.phase18!.teamCultures[state.selectedTeamId];
    const disciplined: GameState = {
      ...state,
      phase18: {
        ...state.phase18!,
        teamCultures: {
          ...state.phase18!.teamCultures,
          [state.selectedTeamId]: {
            ...culture,
            axes: { ...culture.axes, Discipline: 80 },
            stability: 70,
          },
        },
      },
    };
    const scaled = applyLeadershipPreparationModifier(disciplined, {
      paceModifier: 0.2,
      reliabilityModifier: 0.05,
      qualifyingModifier: -0.1,
      mistakeRiskMultiplier: 0.95,
    });

    expect(scaled.paceModifier).toBeGreaterThan(0.2);
    expect(scaled.mistakeRiskMultiplier).toBeLessThan(0.95);
  });

  it('shows the leadership and culture consequences before a choice is made', () => {
    const event = preparationEvent('budget');
    const preview = leadershipDecisionPreview(event, event.options![0]);
    expect(preview.identityLabel).toBe('Commercial Strategist');
    expect(preview.xp).toBe(4);
    expect(preview.cultureChanges).toContain('+3 Commercial Focus');
    expect(preview.cultureChanges).toContain('-1 People Focus');
  });

  it('lets AI principals and their teams build distinct identities too', () => {
    const state = freshState('phase18-ai-culture');
    const aiTeam = state.teams.find((team) => team.id !== state.selectedTeamId)!;
    const next = applyAILeadershipDirection(state, aiTeam.id, 'YouthFocused', 2);
    const identity = next.phase18!.aiPrincipalIdentities[aiTeam.id];
    const culture = next.phase18!.teamCultures[aiTeam.id];

    expect(identity.scores.PeopleManager).toBe(1);
    expect(identity.dominantIdentity).toBe('PeopleManager');
    expect(culture.axes.PeopleFocus).toBe(51);
    expect(culture.cohesion).toBe(51);
  });
});
