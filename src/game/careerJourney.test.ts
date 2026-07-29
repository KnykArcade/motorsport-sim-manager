import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { getSeasonBundle } from '../data/seasonData';
import type { GameMode } from '../types/gameTypes';
import type { TeamPrincipal } from '../types/principalTypes';
import { workflowDestination } from '../components/layoutWorkflow';
import { gameReducer } from './gameReducer';
import { createCareerCreationCoordinator } from '../screens/newCareerCreation';
import {
  offseasonResumeDestination,
  seasonEndingPlan,
  singleSeasonReplayOptions,
  supportsOffseason,
  validateSeasonBundle,
} from './careerJourney';

const createdPrincipal: TeamPrincipal = {
  id: 'principal-player',
  name: 'Alex Morgan',
  nationality: 'American',
  age: 41,
  background: 'Engineer',
  managementStyle: 'Collaborative',
  primaryStrength: 'Development',
  secondaryStrength: 'Driver management',
  weakness: 'Politics',
  mediaPersonality: 'Measured',
  driverManagementStyle: 'Supportive',
  developmentPhilosophy: 'Long term',
  raceStrategyPhilosophy: 'Calculated',
  riskTolerance: 54,
  driverManagement: 66,
  developmentFocus: 72,
  raceStrategy: 63,
  commercialSkill: 48,
  politicalSkill: 42,
  reputation: 58,
};

function newGame(mode: GameMode) {
  return gameReducer(null, {
    type: 'NEW_GAME',
    options: {
      gameMode: mode,
      seasonYear: 1995,
      series: 'F1',
      teamId: 't-benetton',
      teamPrincipal: createdPrincipal,
      seed: `phase27-${mode}`,
      bundle: getSeasonBundle(1995, 'F1'),
    },
  })!;
}

describe('Phase 27 complete career journey contract', () => {
  it.each<GameMode>(['Career', 'Sandbox', 'SingleSeason'])(
    'starts %s at the persistent first-day checkpoint',
    (mode) => {
      let state = newGame(mode);
      expect(workflowDestination(state).to).toBe('/career-launch');

      for (let step = 0; step < 3; step += 1) {
        state = gameReducer(state, { type: 'ADVANCE_CAREER_LAUNCH' })!;
      }
      state = gameReducer(state, { type: 'COMPLETE_CAREER_LAUNCH' })!;

      expect(state.careerPhase?.careerLaunch).toMatchObject({
        required: false,
        welcomePackAcknowledged: true,
      });
      expect(workflowDestination(state).to).toBe('/preseason');
    },
  );

  it('sends Career and Sandbox through offseason while Single Season finishes or replays', () => {
    expect(supportsOffseason('Career')).toBe(true);
    expect(supportsOffseason('Sandbox')).toBe(true);
    expect(supportsOffseason('SingleSeason')).toBe(false);
    expect(seasonEndingPlan('Career')).toMatchObject({
      kind: 'multi-season',
      nextRoute: '/offseason',
    });
    expect(seasonEndingPlan('Sandbox')).toMatchObject({
      kind: 'multi-season',
      heading: 'Continue the sandbox',
      nextRoute: '/offseason',
    });
    expect(seasonEndingPlan('SingleSeason')).toMatchObject({
      kind: 'single-season',
      nextRoute: '/',
    });
  });

  it.each<GameMode>(['Career', 'Sandbox', 'SingleSeason'])(
    'keeps every visible %s handoff on the owning journey route',
    (mode) => {
      let state = newGame(mode);
      for (let step = 0; step < 3; step += 1) {
        state = gameReducer(state, { type: 'ADVANCE_CAREER_LAUNCH' })!;
      }
      state = gameReducer(state, { type: 'COMPLETE_CAREER_LAUNCH' })!;

      const routeFor = (
        phase: NonNullable<typeof state.careerPhase>['currentPhase'],
        extra: Record<string, unknown> = {},
      ) => {
        const { careerPhase: phaseOverride, ...stateOverride } = extra;
        return workflowDestination({
          ...state,
          ...stateOverride,
          seasonComplete: false,
          careerPhase: {
            ...state.careerPhase!,
            currentPhase: phase,
            paddockEvents: [],
            ...phaseOverride as object,
          },
        }).to;
      };

      expect(routeFor('pre_season_setup')).toBe('/preseason');
      expect(routeFor('paddock_week')).toBe('/paddock');
      expect(routeFor('pre_race_briefing')).toBe('/briefing?tab=preparation');
      expect(routeFor('race_weekend')).toBe('/weekend?stage=overview');
      expect(routeFor('post_race_review', {
        careerPhase: { lastCompletedRaceId: state.calendar[0].id },
      })).toBe(`/post-race/${state.calendar[0].id}`);
      expect(workflowDestination({
        ...state,
        seasonComplete: true,
      }).to).toBe('/season-review');
    },
  );

  it('rebuilds Single Season from the verified historical bundle and preserves identity and team', () => {
    const completed = {
      ...newGame('SingleSeason'),
      seasonComplete: true,
      currentRaceIndex: 15,
    };
    const bundle = getSeasonBundle(1995, 'F1')!;
    const options = singleSeasonReplayOptions(completed, bundle);
    const replayed = gameReducer(completed, { type: 'NEW_GAME', options })!;

    expect(options).toMatchObject({
      gameMode: 'SingleSeason',
      seasonYear: 1995,
      series: 'F1',
      teamId: 't-benetton',
      teamPrincipal: createdPrincipal,
    });
    expect(replayed.teamPrincipal).toEqual(createdPrincipal);
    expect(replayed.principal?.name).toBe(createdPrincipal.name);
    expect(replayed.selectedTeamId).toBe(completed.selectedTeamId);
    expect(replayed.seasonComplete).toBe(false);
    expect(replayed.currentRaceIndex).toBe(0);
    expect(replayed.completedRaceResults).toEqual({});
    expect(workflowDestination(replayed).to).toBe('/career-launch');
  });

  it('preserves a legacy principal name when creator credentials are absent', () => {
    const completed = {
      ...newGame('SingleSeason'),
      teamPrincipal: undefined,
      principal: {
        ...newGame('SingleSeason').principal!,
        name: 'Legacy Principal',
      },
      seasonComplete: true,
    };
    const bundle = getSeasonBundle(1995, 'F1')!;
    const replayed = gameReducer(completed, {
      type: 'NEW_GAME',
      options: singleSeasonReplayOptions(completed, bundle),
    })!;

    expect(replayed.principal?.name).toBe('Legacy Principal');
  });

  it('rejects missing, mismatched, and empty next-season data before rollover', () => {
    const bundle = getSeasonBundle(1995, 'F1')!;
    expect(validateSeasonBundle(undefined, 1996, 'F1')).toMatchObject({ valid: false });
    expect(validateSeasonBundle(bundle, 1996, 'F1')).toMatchObject({ valid: false });
    expect(validateSeasonBundle({
      ...bundle,
      season: { ...bundle.season, calendar: [] },
    }, 1995, 'F1')).toMatchObject({ valid: false });
    expect(validateSeasonBundle(bundle, 1995, 'F1')).toEqual({ valid: true, bundle });
  });

  it('treats an entered offseason as a resumable required checkpoint', () => {
    const completed = {
      ...newGame('Sandbox'),
      seasonComplete: true,
      lastWorkspace: '/offseason?tab=advance',
    };
    expect(offseasonResumeDestination(completed)).toBe('/offseason?tab=advance');
    expect(offseasonResumeDestination({
      ...completed,
      gameMode: 'SingleSeason',
    })).toBeUndefined();
  });

  it('prevents duplicate replay or rollover starts while an async transition is active', () => {
    const coordinator = createCareerCreationCoordinator();
    expect(coordinator.tryAcquire()).toBe(true);
    expect(coordinator.tryAcquire()).toBe(false);
    coordinator.release();
    expect(coordinator.tryAcquire()).toBe(true);
  });
});
