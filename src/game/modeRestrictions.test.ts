import { describe, it, expect } from 'vitest';
import {
  isSingleSeasonMode,
  isCareerMode,
  isSandboxMode,
  isRouteRestricted,
  isRouteAllowedForMode,
  getHiddenNavRoutes,
  isActionBlocked,
  isFeatureAllowedForMode,
  getModeRestrictions,
  getRouteRestrictionReason,
} from './modeRestrictions';

describe('modeRestrictions', () => {
  describe('isSingleSeasonMode', () => {
    it('returns true for SingleSeason', () => {
      expect(isSingleSeasonMode('SingleSeason')).toBe(true);
    });
    it('returns false for Career', () => {
      expect(isSingleSeasonMode('Career')).toBe(false);
    });
    it('returns false for Sandbox', () => {
      expect(isSingleSeasonMode('Sandbox')).toBe(false);
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
    it('returns false for Sandbox', () => {
      expect(isCareerMode('Sandbox')).toBe(false);
    });
  });

  describe('isSandboxMode', () => {
    it('returns true for Sandbox', () => {
      expect(isSandboxMode('Sandbox')).toBe(true);
    });
    it('returns false for Career', () => {
      expect(isSandboxMode('Career')).toBe(false);
    });
    it('returns false for SingleSeason', () => {
      expect(isSandboxMode('SingleSeason')).toBe(false);
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
    it('does not restrict anything in Sandbox mode', () => {
      expect(isRouteRestricted('/scouting', 'Sandbox')).toBe(false);
      expect(isRouteRestricted('/offseason', 'Sandbox')).toBe(false);
      expect(isRouteRestricted('/engine', 'Sandbox')).toBe(false);
      expect(isRouteRestricted('/sponsors', 'Sandbox')).toBe(false);
    });
  });

  describe('isRouteAllowedForMode', () => {
    it('returns false for restricted routes in Single Season', () => {
      expect(isRouteAllowedForMode('/scouting', 'SingleSeason')).toBe(false);
    });
    it('returns true for allowed routes in Single Season', () => {
      expect(isRouteAllowedForMode('/hq', 'SingleSeason')).toBe(true);
    });
    it('returns true for all routes in Career', () => {
      expect(isRouteAllowedForMode('/scouting', 'Career')).toBe(true);
    });
    it('returns true for all routes in Sandbox', () => {
      expect(isRouteAllowedForMode('/scouting', 'Sandbox')).toBe(true);
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
    it('returns empty set for Sandbox mode', () => {
      const hidden = getHiddenNavRoutes('Sandbox');
      expect(hidden.size).toBe(0);
    });
  });

  describe('isFeatureAllowedForMode', () => {
    it('blocks youth_academy in Single Season', () => {
      expect(isFeatureAllowedForMode('youth_academy', 'SingleSeason')).toBe(false);
    });
    it('blocks scouting in Single Season', () => {
      expect(isFeatureAllowedForMode('scouting', 'SingleSeason')).toBe(false);
    });
    it('blocks future_contracts in Single Season', () => {
      expect(isFeatureAllowedForMode('future_contracts', 'SingleSeason')).toBe(false);
    });
    it('allows all features in Career', () => {
      expect(isFeatureAllowedForMode('youth_academy', 'Career')).toBe(true);
      expect(isFeatureAllowedForMode('scouting', 'Career')).toBe(true);
      expect(isFeatureAllowedForMode('future_contracts', 'Career')).toBe(true);
    });
    it('allows all features in Sandbox', () => {
      expect(isFeatureAllowedForMode('youth_academy', 'Sandbox')).toBe(true);
      expect(isFeatureAllowedForMode('scouting', 'Sandbox')).toBe(true);
      expect(isFeatureAllowedForMode('future_contracts', 'Sandbox')).toBe(true);
    });
  });

  describe('getModeRestrictions', () => {
    it('returns restrictions for Single Season', () => {
      const r = getModeRestrictions('SingleSeason');
      expect(r.restrictedFeatures.has('scouting')).toBe(true);
      expect(r.restrictedFeatures.has('youth_academy')).toBe(true);
      expect(r.hiddenNavRoutes.has('/scouting')).toBe(true);
    });
    it('returns no restrictions for Career', () => {
      const r = getModeRestrictions('Career');
      expect(r.restrictedFeatures.size).toBe(0);
      expect(r.hiddenNavRoutes.size).toBe(0);
    });
    it('returns no restrictions for Sandbox', () => {
      const r = getModeRestrictions('Sandbox');
      expect(r.restrictedFeatures.size).toBe(0);
      expect(r.hiddenNavRoutes.size).toBe(0);
    });
  });

  describe('getRouteRestrictionReason', () => {
    it('returns a reason for restricted routes in Single Season', () => {
      const reason = getRouteRestrictionReason('/scouting', 'SingleSeason');
      expect(reason).toBeDefined();
      expect(reason).toContain('Single Season Mode');
    });
    it('returns undefined for allowed routes', () => {
      expect(getRouteRestrictionReason('/hq', 'SingleSeason')).toBeUndefined();
    });
    it('returns undefined for Career mode', () => {
      expect(getRouteRestrictionReason('/scouting', 'Career')).toBeUndefined();
    });
    it('returns undefined for Sandbox mode', () => {
      expect(getRouteRestrictionReason('/scouting', 'Sandbox')).toBeUndefined();
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
    it('does not block actions in Sandbox mode', () => {
      expect(isActionBlocked('SIGN_ENGINE_DEAL', 'Sandbox')).toBe(false);
      expect(isActionBlocked('ADVANCE_SEASON', 'Sandbox')).toBe(false);
      expect(isActionBlocked('SIGN_SPONSOR', 'Sandbox')).toBe(false);
    });
  });
});
