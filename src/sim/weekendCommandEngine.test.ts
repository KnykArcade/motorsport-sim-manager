import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import {
  buildWeekendCommandRecommendations,
  ensureWeekendCommandRecommendations,
  resolveWeekendCommandRecommendation,
  weekendCommandRecommendations,
} from './weekendCommandEngine';

function weekendState() {
  const state = createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'weekend-command-test',
  });
  return {
    ...state,
    careerPhase: {
      ...state.careerPhase!,
      currentPhase: 'race_weekend' as const,
    },
  };
}

describe('weekend command engine', () => {
  it('creates two or three evidence-backed recommendations deterministically', () => {
    const state = weekendState();
    const first = buildWeekendCommandRecommendations(state);
    const second = buildWeekendCommandRecommendations(state);

    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThanOrEqual(2);
    expect(first.length).toBeLessThanOrEqual(3);
    expect(first.every((item) => item.evidence && item.evidence.length > 0)).toBe(true);
    expect(first.every((item) => item.expectedBenefit && item.risk)).toBe(true);
  });

  it('stores recommendations once for the active race', () => {
    const state = weekendState();
    const prepared = ensureWeekendCommandRecommendations(state);
    const preparedAgain = ensureWeekendCommandRecommendations(prepared);

    expect(weekendCommandRecommendations(prepared)).toHaveLength(3);
    expect(preparedAgain.phase18?.advisorRecommendations).toEqual(
      prepared.phase18?.advisorRecommendations,
    );
  });

  it('records the visible resolution and bounded department trust effect', () => {
    const prepared = ensureWeekendCommandRecommendations(weekendState());
    const recommendation = weekendCommandRecommendations(prepared)[0];
    const department = recommendation.departmentId!;
    const before = prepared.phase18!.departmentMoods[prepared.selectedTeamId][department].trustInPrincipal;
    const resolved = resolveWeekendCommandRecommendation(
      prepared,
      recommendation.id,
      'Delegated',
    );
    const item = weekendCommandRecommendations(resolved).find(
      (candidate) => candidate.id === recommendation.id,
    )!;
    const after = resolved.phase18!.departmentMoods[resolved.selectedTeamId][department].trustInPrincipal;

    expect(item.resolutionMode).toBe('Delegated');
    expect(item.status).toBe('Accepted');
    expect(item.trustChange).toBe(2);
    expect(after).toBe(Math.min(100, before + 2));
  });
});
