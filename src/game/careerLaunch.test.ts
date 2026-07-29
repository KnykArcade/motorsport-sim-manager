import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { gameReducer } from './gameReducer';
import { createNewGame } from './initialCareer';
import {
  careerLaunchState,
  enterPreSeasonSetup,
  getPreseasonApprovals,
  needsCareerLaunch,
} from './careerPhaseEngine';
import { migrateGameState } from './saveSystem';
import { resumeDestination, workflowDestination } from '../components/layoutWorkflow';
import type { GameState } from './careerState';

const options = {
  gameMode: 'Career' as const,
  seasonYear: 1995,
  series: 'F1' as const,
  teamId: 't-benetton',
  seed: 'phase23-career-launch',
};

function newCareer(): GameState {
  return gameReducer(null, { type: 'NEW_GAME', options })!;
}

describe('Phase 23 career launch and first day', () => {
  it('starts every newly created game at the appointment instead of HQ', () => {
    const state = newCareer();

    expect(needsCareerLaunch(state)).toBe(true);
    expect(careerLaunchState(state)).toEqual({
      required: true,
      currentStep: 'appointment',
      welcomePackAcknowledged: false,
    });
    expect(workflowDestination(state)).toMatchObject({
      to: '/career-launch',
      label: 'Review Appointment',
      context: 'First day',
    });
    expect(resumeDestination({
      ...state,
      lastWorkspace: '/hq',
    })).toBe('/career-launch');
  });

  it('persists each first-day step and only completes from the final plan', () => {
    let state = newCareer();
    state = gameReducer(state, { type: 'COMPLETE_CAREER_LAUNCH' })!;
    expect(needsCareerLaunch(state)).toBe(true);

    state = gameReducer(state, { type: 'ADVANCE_CAREER_LAUNCH' })!;
    expect(careerLaunchState(state)?.currentStep).toBe('teamHandover');
    state = gameReducer(state, { type: 'ADVANCE_CAREER_LAUNCH' })!;
    expect(careerLaunchState(state)?.currentStep).toBe('ownerIntroduction');
    state = gameReducer(state, { type: 'ADVANCE_CAREER_LAUNCH' })!;
    expect(careerLaunchState(state)?.currentStep).toBe('firstWeekPlan');

    state = gameReducer(state, { type: 'COMPLETE_CAREER_LAUNCH' })!;
    expect(needsCareerLaunch(state)).toBe(false);
    expect(careerLaunchState(state)?.welcomePackAcknowledged).toBe(true);
  });

  it('turns four routine reports into one Welcome Pack without making consequential choices', () => {
    let state = newCareer();
    for (let index = 0; index < 3; index += 1) {
      state = gameReducer(state, { type: 'ADVANCE_CAREER_LAUNCH' })!;
    }
    state = gameReducer(state, { type: 'COMPLETE_CAREER_LAUNCH' })!;
    const approvals = getPreseasonApprovals(state);

    expect(approvals).toMatchObject({
      teamOverview: true,
      budget: true,
      sponsorsEngine: true,
      roundOnePreview: true,
      driverLineup: false,
      carDevelopment: false,
      seasonObjectives: false,
    });
    expect(state.boardroom?.mandate).toBeUndefined();
    expect(state.phase18?.preseason?.programs[state.selectedTeamId]?.launchCompleted).toBe(false);
    expect(state.phase18?.preseason?.programs[state.selectedTeamId]?.testingCompleted).toBe(false);
  });

  it('does not force existing saves or season rollovers through the new appointment', () => {
    const existing = enterPreSeasonSetup(createNewGame(options));
    const migrated = migrateGameState(existing);

    expect(needsCareerLaunch(existing)).toBe(false);
    expect(needsCareerLaunch(migrated)).toBe(false);
    expect(workflowDestination(existing).to).toBe('/preseason');
  });

  it('prioritizes a blocking Inbox decision over unrelated workspace history', () => {
    const base = enterPreSeasonSetup(createNewGame(options));
    const state: GameState = {
      ...base,
      lastWorkspace: '/technical?section=parts',
      careerPhase: {
        ...base.careerPhase!,
        currentPhase: 'paddock_week',
        paddockEvents: [{
          id: 'required-owner-answer',
          weekId: 'week-1',
          season: base.seasonYear,
          series: base.series,
          round: 1,
          category: 'general_team',
          title: 'Owner requires an answer',
          description: 'Ownership needs a decision before the week can advance.',
          severity: 'critical',
          isRequiredDecision: true,
          options: [{ id: 'answer', label: 'Respond', description: 'Give the owner an answer.' }],
          effectsApplied: false,
          createdAt: '2026-01-01T00:00:00.000Z',
        }],
      },
    };

    expect(resumeDestination(state)).toBe(
      '/inbox?section=must_respond&message=inbox-paddock-required-owner-answer',
    );
  });
});

