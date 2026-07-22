import { describe, expect, it } from 'vitest';
import type { GameState } from '../game/careerState';
import { isResumableWorkspace, resumeDestination, workflowDestination } from './layoutWorkflow';

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
    expect(workflowDestination(state).phase).toBe(phase);
    expect(state).toEqual(snapshot);
  });

  it('uses action-specific labels for the phase handoff', () => {
    expect(workflowDestination(stateFor('pre_season_setup')).label).toBe('Open Preseason Review');
    expect(workflowDestination(stateFor('pre_race_briefing')).label).toBe('Review Race Briefing');
    expect(workflowDestination(stateFor('race_weekend')).label).toBe('Continue Race Weekend');
  });

  it('routes Continue to the first required paddock decision', () => {
    const state = stateFor('paddock_week', {
      careerPhase: {
        currentPhase: 'paddock_week',
        paddockEvents: [{
          id: 'required-focus',
          isRequiredDecision: true,
          resolvedOptionId: undefined,
          characterRequest: undefined,
          characterDispute: undefined,
          characterInitiative: undefined,
          characterBreakingPoint: undefined,
        }],
      },
    });

    expect(workflowDestination(state)).toMatchObject({
      to: '/paddock?tab=decisions&focus=required-focus',
      label: 'Open Operations Agenda',
      blocked: true,
      blockerCount: 1,
    });
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

  it('resumes the last valid workspace without advancing the career', () => {
    const state = stateFor('race_weekend', { lastWorkspace: '/technical?section=parts' });

    expect(resumeDestination(state)).toBe('/technical?section=parts');
    expect(state.careerPhase?.currentPhase).toBe('race_weekend');
  });

  it('falls back to the phase workspace for non-game routes', () => {
    expect(resumeDestination(stateFor('race_weekend', { lastWorkspace: '/settings' }))).toBe('/weekend');
    expect(isResumableWorkspace('/post-race/race-1')).toBe(true);
    expect(isResumableWorkspace('/live-race/race-1')).toBe(false);
  });
});
