import { describe, expect, it } from 'vitest';
import type { GameState } from '../game/careerState';
import { workflowDestination } from './layoutWorkflow';

function stateFor(currentPhase: string, overrides: Record<string, unknown> = {}): GameState {
  return {
    seasonComplete: false,
    careerPhase: { currentPhase },
    ...overrides,
  } as unknown as GameState;
}

describe('layout workflow destination', () => {
  it.each([
    ['pre_season_setup', '/preseason'],
    ['paddock_week', '/paddock'],
    ['pre_race_briefing', '/briefing'],
    ['race_weekend', '/weekend'],
  ])('opens the %s workspace without advancing state', (phase, expectedRoute) => {
    const state = stateFor(phase);
    const snapshot = structuredClone(state);

    expect(workflowDestination(state).to).toBe(expectedRoute);
    expect(state).toEqual(snapshot);
  });

  it('opens the active post-race review', () => {
    const state = stateFor('post_race_review', {
      careerPhase: { currentPhase: 'post_race_review', lastCompletedRaceId: 'race-6' },
    });

    expect(workflowDestination(state).to).toBe('/post-race/race-6');
  });

  it('prioritizes season review after the season is complete', () => {
    expect(workflowDestination(stateFor('race_weekend', { seasonComplete: true })).to).toBe('/season-review');
  });
});
