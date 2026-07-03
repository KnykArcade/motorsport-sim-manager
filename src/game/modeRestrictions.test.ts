import { describe, it, expect } from 'vitest';
import {
  isSingleSeasonMode,
  isCareerMode,
  isRouteRestricted,
  getHiddenNavRoutes,
  isActionBlocked,
} from './modeRestrictions';

describe('modeRestrictions', () => {
  describe('isSingleSeasonMode', () => {
    it('returns true for SingleSeason', () => {
      expect(isSingleSeasonMode('SingleSeason')).toBe(true);
    });
    it('returns false for Career', () => {
      expect(isSingleSeasonMode('Career')).toBe(false);
    });
    it('returns false for undefined', () => {
      expect(isSingleSeasonMode(undefined)).toBe(false);
    });
  });

  describe('isCareerMode', () => {
    it('returns true for Career', () => {
      expect(isCareerMode('Career')).toBe(true);
    });
    it('returns false for SingleSeason', () => {
      expect(isCareerMode('SingleSeason')).toBe(false);
    });
  });

  describe('isRouteRestricted', () => {
    it('restricts scouting in Single Season', () => {
      expect(isRouteRestricted('/scouting', 'SingleSeason')).toBe(true);
    });
    it('restricts dev curves in Single Season', () => {
      expect(isRouteRestricted('/curves', 'SingleSeason')).toBe(true);
    });
    it('restricts politics in Single Season', () => {
      expect(isRouteRestricted('/politics', 'SingleSeason')).toBe(true);
    });
    it('restricts offseason in Single Season', () => {
      expect(isRouteRestricted('/offseason', 'SingleSeason')).toBe(true);
    });
    it('restricts engine supplier in Single Season', () => {
      expect(isRouteRestricted('/engine', 'SingleSeason')).toBe(true);
    });
    it('restricts sponsors in Single Season', () => {
      expect(isRouteRestricted('/sponsors', 'SingleSeason')).toBe(true);
    });
    it('does not restrict HQ in Single Season', () => {
      expect(isRouteRestricted('/hq', 'SingleSeason')).toBe(false);
    });
    it('does not restrict calendar in Single Season', () => {
      expect(isRouteRestricted('/calendar', 'SingleSeason')).toBe(false);
    });
    it('does not restrict weekend in Single Season', () => {
      expect(isRouteRestricted('/weekend', 'SingleSeason')).toBe(false);
    });
    it('does not restrict development in Single Season', () => {
      expect(isRouteRestricted('/development', 'SingleSeason')).toBe(false);
    });
    it('does not restrict anything in Career mode', () => {
      expect(isRouteRestricted('/scouting', 'Career')).toBe(false);
      expect(isRouteRestricted('/offseason', 'Career')).toBe(false);
      expect(isRouteRestricted('/engine', 'Career')).toBe(false);
    });
  });

  describe('getHiddenNavRoutes', () => {
    it('returns restricted set for Single Season', () => {
      const hidden = getHiddenNavRoutes('SingleSeason');
      expect(hidden.has('/scouting')).toBe(true);
      expect(hidden.has('/curves')).toBe(true);
      expect(hidden.has('/politics')).toBe(true);
      expect(hidden.has('/offseason')).toBe(true);
      expect(hidden.has('/engine')).toBe(true);
      expect(hidden.has('/sponsors')).toBe(true);
      // Core screens are NOT hidden.
      expect(hidden.has('/hq')).toBe(false);
      expect(hidden.has('/calendar')).toBe(false);
      expect(hidden.has('/standings')).toBe(false);
      expect(hidden.has('/weekend')).toBe(false);
      expect(hidden.has('/development')).toBe(false);
    });
    it('returns empty set for Career mode', () => {
      const hidden = getHiddenNavRoutes('Career');
      expect(hidden.size).toBe(0);
    });
  });

  describe('isActionBlocked', () => {
    it('blocks SIGN_ENGINE_DEAL in Single Season', () => {
      expect(isActionBlocked('SIGN_ENGINE_DEAL', 'SingleSeason')).toBe(true);
    });
    it('blocks SIGN_SPONSOR in Single Season', () => {
      expect(isActionBlocked('SIGN_SPONSOR', 'SingleSeason')).toBe(true);
    });
    it('blocks ADVANCE_SEASON in Single Season', () => {
      expect(isActionBlocked('ADVANCE_SEASON', 'SingleSeason')).toBe(true);
    });
    it('blocks SIGN_YOUTH in Single Season', () => {
      expect(isActionBlocked('SIGN_YOUTH', 'SingleSeason')).toBe(true);
    });
    it('blocks SCOUT_TARGET in Single Season', () => {
      expect(isActionBlocked('SCOUT_TARGET', 'SingleSeason')).toBe(true);
    });
    it('blocks SET_REGULATION_VOTE in Single Season', () => {
      expect(isActionBlocked('SET_REGULATION_VOTE', 'SingleSeason')).toBe(true);
    });
    it('does not block RUN_QUALIFYING in Single Season', () => {
      expect(isActionBlocked('RUN_QUALIFYING', 'SingleSeason')).toBe(false);
    });
    it('does not block RUN_RACE in Single Season', () => {
      expect(isActionBlocked('RUN_RACE', 'SingleSeason')).toBe(false);
    });
    it('does not block START_DEVELOPMENT in Single Season', () => {
      expect(isActionBlocked('START_DEVELOPMENT', 'SingleSeason')).toBe(false);
    });
    it('does not block actions in Career mode', () => {
      expect(isActionBlocked('SIGN_ENGINE_DEAL', 'Career')).toBe(false);
      expect(isActionBlocked('ADVANCE_SEASON', 'Career')).toBe(false);
    });
  });
});
