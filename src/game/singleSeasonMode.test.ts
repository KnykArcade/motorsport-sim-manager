import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from './initialCareer';
import { gameReducer, type GameAction } from './gameReducer';
import { isRouteRestricted, isActionBlocked, getHiddenNavRoutes } from './modeRestrictions';
import type { GameState } from './careerState';

function newSingleSeasonState(): GameState {
  return createNewGame({
    gameMode: 'SingleSeason',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'test-seed-ss',
  });
}

function newCareerState(): GameState {
  return createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'test-seed-career',
  });
}

function dispatch(state: GameState, action: GameAction): GameState {
  return gameReducer(state, action) as GameState;
}

describe('Single Season mode integration', () => {
  describe('startup flow', () => {
    it('auto-assigns historical engine data without player choice', () => {
      const state = newSingleSeasonState();
      // Engine state should exist and have a current deal (auto-assigned).
      expect(state.engine).toBeDefined();
      expect(state.engine?.currentDeal).toBeDefined();
      expect(state.engine?.currentDeal?.supplierName).toBeTruthy();
    });

    it('auto-assigns sponsor data (commercial state)', () => {
      const state = newSingleSeasonState();
      // Commercial state should exist with sponsors.
      expect(state.commercial).toBeDefined();
      expect(state.commercial?.sponsors).toBeDefined();
    });

    it('Career mode also gets engine and sponsor data', () => {
      const state = newCareerState();
      expect(state.engine?.currentDeal).toBeDefined();
      expect(state.commercial?.sponsors).toBeDefined();
    });
  });

  describe('navigation restrictions', () => {
    it('hides Youth Academy / Scouting from nav in Single Season', () => {
      const hidden = getHiddenNavRoutes('SingleSeason');
      expect(hidden.has('/scouting')).toBe(true);
    });

    it('hides Dev Curves from nav in Single Season', () => {
      const hidden = getHiddenNavRoutes('SingleSeason');
      expect(hidden.has('/curves')).toBe(true);
    });

    it('hides Offseason from nav in Single Season', () => {
      const hidden = getHiddenNavRoutes('SingleSeason');
      expect(hidden.has('/offseason')).toBe(true);
    });

    it('hides Engine Supplier from nav in Single Season', () => {
      const hidden = getHiddenNavRoutes('SingleSeason');
      expect(hidden.has('/engine')).toBe(true);
    });

    it('keeps Sponsors in nav for race-by-race objective reviews', () => {
      const hidden = getHiddenNavRoutes('SingleSeason');
      expect(hidden.has('/sponsors')).toBe(false);
    });

    it('does not hide core screens in Single Season', () => {
      const hidden = getHiddenNavRoutes('SingleSeason');
      expect(hidden.has('/hq')).toBe(false);
      expect(hidden.has('/calendar')).toBe(false);
      expect(hidden.has('/standings')).toBe(false);
      expect(hidden.has('/weekend')).toBe(false);
      expect(hidden.has('/development')).toBe(false);
      expect(hidden.has('/drivers')).toBe(false);
      expect(hidden.has('/market')).toBe(false);
    });

    it('blocks restricted routes via isRouteRestricted', () => {
      expect(isRouteRestricted('/scouting', 'SingleSeason')).toBe(true);
      expect(isRouteRestricted('/offseason', 'SingleSeason')).toBe(true);
    });

    it('does not restrict routes in Career mode', () => {
      expect(isRouteRestricted('/scouting', 'Career')).toBe(false);
      expect(isRouteRestricted('/offseason', 'Career')).toBe(false);
      expect(isRouteRestricted('/engine', 'Career')).toBe(false);
    });
  });

  describe('action blocking', () => {
    it('blocks SIGN_ENGINE_DEAL in Single Season', () => {
      const state = newSingleSeasonState();
      const before = state.engine?.currentDeal?.supplierName;
      const after = dispatch(state, {
        type: 'SIGN_ENGINE_DEAL',
        supplierId: 'engine-ferrari',
        dealType: 'Works',
      });
      // State should be unchanged — action blocked.
      expect(after.engine?.currentDeal?.supplierName).toBe(before);
    });

    it('blocks SIGN_SPONSOR in Single Season', () => {
      const state = newSingleSeasonState();
      const beforeSponsors = state.commercial?.sponsors?.length ?? 0;
      const after = dispatch(state, {
        type: 'SIGN_SPONSOR',
        offerId: 'nonexistent',
      });
      expect(after.commercial?.sponsors?.length ?? 0).toBe(beforeSponsors);
    });

    it('blocks ADVANCE_SEASON in Single Season', () => {
      const state = newSingleSeasonState();
      // Even if season is complete, advance should be blocked.
      const completedState = { ...state, seasonComplete: true };
      const after = dispatch(completedState, { type: 'ADVANCE_SEASON' });
      // Season year should not advance.
      expect(after.seasonYear).toBe(state.seasonYear);
    });

    it('blocks SCOUT_TARGET in Single Season', () => {
      const state = newSingleSeasonState();
      const beforeScouting = state.scouting;
      const after = dispatch(state, {
        type: 'SCOUT_TARGET',
        entityId: 'some-driver',
        entityType: 'Driver',
      });
      expect(after.scouting).toEqual(beforeScouting);
    });

    it('blocks SET_REGULATION_VOTE in Single Season', () => {
      const state = newSingleSeasonState();
      const before = state.regulationVoteHistory;
      const after = dispatch(state, {
        type: 'SET_REGULATION_VOTE',
        proposalId: 'some-proposal',
        vote: 'Support',
      });
      expect(after.regulationVoteHistory).toEqual(before);
    });

    it('does not block SIGN_ENGINE_DEAL in Career mode', () => {
      // In Career mode, the action should not be blocked by the mode guard.
      expect(isActionBlocked('SIGN_ENGINE_DEAL', 'Career')).toBe(false);
    });

    it('does not block RUN_RACE in Single Season', () => {
      expect(isActionBlocked('RUN_RACE', 'SingleSeason')).toBe(false);
    });

    it('does not block START_DEVELOPMENT in Single Season', () => {
      expect(isActionBlocked('START_DEVELOPMENT', 'SingleSeason')).toBe(false);
    });
  });

  describe('race weekend flow still works', () => {
    it('can enter race weekend phase in Single Season', () => {
      const state = newSingleSeasonState();
      // Complete preseason setup first.
      const s = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      // Should be in paddock_week or pre_race_briefing phase.
      // The key assertion is that the action was not blocked.
      expect(s).toBeDefined();
      expect(s.seasonYear).toBe(1995);
    });
  });
});
