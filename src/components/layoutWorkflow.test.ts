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
    ['pre_race_briefing', '/briefing?tab=preparation'],
    ['race_weekend', '/weekend?stage=overview'],
  ])('opens the %s workspace without advancing state', (phase, expectedRoute) => {
    const state = stateFor(phase);
    const snapshot = structuredClone(state);

    expect(workflowDestination(state).to).toBe(expectedRoute);
    expect(workflowDestination(state).phase).toBe(phase);
    expect(state).toEqual(snapshot);
  });

  it('uses action-specific labels for the phase handoff', () => {
    expect(workflowDestination(stateFor('pre_season_setup')).label).toBe('Open Preseason Review');
    expect(workflowDestination(stateFor('pre_race_briefing')).label).toBe('Set Preparation Focus');
    expect(workflowDestination(stateFor('race_weekend')).label).toBe('Open Weekend Overview');
  });

  it('prioritizes a missing race lineup before the normal race workflow', () => {
    const state = stateFor('pre_season_setup', {
      gameMode: 'Career',
      series: 'F1',
      selectedTeamId: 'player-team',
      teams: [{ id: 'player-team' }],
      drivers: [],
    });

    expect(workflowDestination(state)).toMatchObject({
      to: '/market',
      label: 'Complete Race Lineup',
      priority: 'race_lineup',
      blocked: true,
    });
    expect(resumeDestination({
      ...state,
      lastWorkspace: '/technical',
    })).toBe('/market');
  });

  it('keeps an incomplete first-day appointment ahead of saved workspace history', () => {
    const state = stateFor('pre_season_setup', {
      lastWorkspace: '/technical?section=parts',
      careerPhase: {
        currentPhase: 'pre_season_setup',
        careerLaunch: {
          required: true,
          currentStep: 'teamHandover',
          welcomePackAcknowledged: false,
        },
      },
    });

    expect(workflowDestination(state)).toMatchObject({
      to: '/career-launch',
      label: 'Review Team Handover',
    });
    expect(resumeDestination(state)).toBe('/career-launch');
    expect(isResumableWorkspace('/career-launch')).toBe(true);
  });

  it('routes Continue through the Inbox for the first mandatory decision', () => {
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
      to: '/inbox?section=must_respond&message=inbox-paddock-required-focus',
      label: 'Respond in Inbox',
      priority: 'must_respond',
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

  it('deep-links to the reached race-weekend stage', () => {
    const state = stateFor('race_weekend', {
      currentRaceIndex: 0,
      calendar: [{ id: 'race-1' }],
      qualifyingResults: { 'race-1': [{ position: 1 }] },
      weekendPlans: [],
    });

    expect(workflowDestination(state)).toMatchObject({
      to: '/weekend?stage=qualifying',
      label: 'Review Qualifying',
    });

    expect(workflowDestination({
      ...state,
      weekendPlans: [{ raceId: 'race-1' }],
    } as unknown as GameState)).toMatchObject({
      to: '/weekend?stage=race-plan',
      label: 'Deliver Garage Address',
    });
  });

  it('prioritizes season review after the season is complete', () => {
    expect(workflowDestination(stateFor('race_weekend', { seasonComplete: true })).to).toBe('/season-review');
  });

  it('resumes the last valid workspace during ordinary management time', () => {
    const state = stateFor('paddock_week', { lastWorkspace: '/technical?section=parts' });

    expect(resumeDestination(state)).toBe('/technical?section=parts');
    expect(state.careerPhase?.currentPhase).toBe('paddock_week');
  });

  it('puts active race transitions ahead of an optional saved workspace', () => {
    expect(resumeDestination(stateFor('pre_race_briefing', {
      lastWorkspace: '/technical?section=parts',
    }))).toBe('/briefing?tab=preparation');
    expect(resumeDestination(stateFor('race_weekend', {
      lastWorkspace: '/technical?section=parts',
    }))).toBe('/weekend?stage=overview');
    expect(resumeDestination(stateFor('post_race_review', {
      lastWorkspace: '/technical?section=parts',
      careerPhase: { currentPhase: 'post_race_review', lastCompletedRaceId: 'race-4' },
    }))).toBe('/post-race/race-4');
  });

  it('resumes an entered offseason but otherwise requires the completed-season review', () => {
    const completed = stateFor('post_race_review', {
      gameMode: 'Career',
      seasonComplete: true,
      lastWorkspace: '/technical?section=parts',
    });
    expect(resumeDestination(completed)).toBe('/season-review');
    expect(resumeDestination({
      ...completed,
      lastWorkspace: '/offseason?tab=lineup',
    })).toBe('/offseason?tab=lineup');
    expect(resumeDestination({
      ...completed,
      gameMode: 'SingleSeason',
      lastWorkspace: '/offseason',
    })).toBe('/season-review');
  });

  it('falls back to the phase workspace for non-game routes', () => {
    expect(resumeDestination(stateFor('race_weekend', { lastWorkspace: '/settings' }))).toBe('/weekend?stage=overview');
    expect(isResumableWorkspace('/post-race/race-1')).toBe(true);
    expect(isResumableWorkspace('/live-race/race-1')).toBe(false);
  });

  it('distinguishes race-plan leadership from the live-race handoff', () => {
    const plan = { raceId: 'race-1' };
    const base = stateFor('race_weekend', {
      currentRaceIndex: 0,
      calendar: [{ id: 'race-1' }],
      weekendPlans: [plan],
    });

    expect(workflowDestination(base)).toMatchObject({
      to: '/weekend?stage=race-plan',
      label: 'Deliver Garage Address',
    });
    expect(workflowDestination({
      ...base,
      garageAddresses: [{ raceId: 'race-1' }],
    } as unknown as GameState)).toMatchObject({
      to: '/weekend?stage=race-plan',
      label: 'Start Live Race',
      context: 'Race ready',
    });
  });
});
