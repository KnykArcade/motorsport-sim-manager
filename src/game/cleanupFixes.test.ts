import { describe, it, expect } from 'vitest';
import { isActionBlocked, getGameModeLabel, isRouteRestricted } from './modeRestrictions';
import { developmentProjectCatalog } from '../data/development/developmentProjects';

describe('Must Fix Next — cleanup tests', () => {

  // Fix #1: Academy actions blocked in Single Season
  describe('Fix #1: Single Season academy action blocking', () => {
    it('blocks SIGN_YOUTH in Single Season', () => {
      expect(isActionBlocked('SIGN_YOUTH', 'SingleSeason')).toBe(true);
    });
    it('blocks PROMOTE_ACADEMY in Single Season', () => {
      expect(isActionBlocked('PROMOTE_ACADEMY', 'SingleSeason')).toBe(true);
    });
    it('blocks RELEASE_ACADEMY in Single Season', () => {
      expect(isActionBlocked('RELEASE_ACADEMY', 'SingleSeason')).toBe(true);
    });
    it('blocks SET_ACADEMY_DECISION in Single Season', () => {
      expect(isActionBlocked('SET_ACADEMY_DECISION', 'SingleSeason')).toBe(true);
    });
    it('blocks CLEAR_ACADEMY_DECISION in Single Season', () => {
      expect(isActionBlocked('CLEAR_ACADEMY_DECISION', 'SingleSeason')).toBe(true);
    });
    it('blocks SCOUT_TARGET in Single Season', () => {
      expect(isActionBlocked('SCOUT_TARGET', 'SingleSeason')).toBe(true);
    });
    it('does not block academy actions in Career', () => {
      expect(isActionBlocked('SIGN_YOUTH', 'Career')).toBe(false);
      expect(isActionBlocked('PROMOTE_ACADEMY', 'Career')).toBe(false);
      expect(isActionBlocked('RELEASE_ACADEMY', 'Career')).toBe(false);
      expect(isActionBlocked('SET_ACADEMY_DECISION', 'Career')).toBe(false);
      expect(isActionBlocked('CLEAR_ACADEMY_DECISION', 'Career')).toBe(false);
    });
    it('does not block academy actions in Sandbox', () => {
      expect(isActionBlocked('SIGN_YOUTH', 'Sandbox')).toBe(false);
      expect(isActionBlocked('PROMOTE_ACADEMY', 'Sandbox')).toBe(false);
      expect(isActionBlocked('RELEASE_ACADEMY', 'Sandbox')).toBe(false);
      expect(isActionBlocked('SET_ACADEMY_DECISION', 'Sandbox')).toBe(false);
      expect(isActionBlocked('CLEAR_ACADEMY_DECISION', 'Sandbox')).toBe(false);
    });
    it('blocks scouting route in Single Season', () => {
      expect(isRouteRestricted('/scouting', 'SingleSeason')).toBe(true);
    });
    it('does not block scouting route in Sandbox', () => {
      expect(isRouteRestricted('/scouting', 'Sandbox')).toBe(false);
    });
    it('does not block driver market route in Single Season', () => {
      expect(isRouteRestricted('/market', 'SingleSeason')).toBe(false);
    });
  });

  // Fix #2: Development projects with only nextSeasonEffects
  describe('Fix #2: Development project classification', () => {
    const nextSeasonOnly = developmentProjectCatalog.filter(
      (p) => !p.currentSeasonEffects || Object.keys(p.currentSeasonEffects).length === 0,
    );
    const hasCurrentSeason = developmentProjectCatalog.filter(
      (p) => p.currentSeasonEffects && Object.keys(p.currentSeasonEffects).length > 0,
    );

    it('has projects with only nextSeasonEffects (should be blocked in Single Season)', () => {
      expect(nextSeasonOnly.length).toBeGreaterThan(0);
      expect(nextSeasonOnly.some((p) => p.id === 'dev-next-aero-research')).toBe(true);
      expect(nextSeasonOnly.some((p) => p.id === 'dev-wind-tunnel')).toBe(true);
      expect(nextSeasonOnly.some((p) => p.id === 'dev-aero-experimental')).toBe(true);
    });

    it('next-season-only projects have no currentSeasonEffects', () => {
      for (const p of nextSeasonOnly) {
        expect(p.currentSeasonEffects).toBeUndefined();
      }
    });

    it('has projects with currentSeasonEffects (should be allowed in Single Season)', () => {
      expect(hasCurrentSeason.length).toBeGreaterThan(0);
      expect(hasCurrentSeason.some((p) => p.id === 'dev-engine-power')).toBe(true);
      expect(hasCurrentSeason.some((p) => p.id === 'dev-aero')).toBe(true);
    });

    it('mixed projects have both currentSeasonEffects and nextSeasonEffects', () => {
      const mixed = hasCurrentSeason.filter(
        (p) => p.nextSeasonEffects && Object.keys(p.nextSeasonEffects).length > 0,
      );
      expect(mixed.length).toBeGreaterThan(0);
      expect(mixed.some((p) => p.id === 'dev-engine-power')).toBe(true);
    });

    it('START_DEVELOPMENT is not blocked at action level (handled in startDevelopment function)', () => {
      expect(isActionBlocked('START_DEVELOPMENT', 'SingleSeason')).toBe(false);
    });
  });

  // Fix #4: Sandbox mode label
  describe('Fix #4: getGameModeLabel', () => {
    it('Career displays as Career Mode', () => {
      expect(getGameModeLabel('Career')).toBe('Career Mode');
    });
    it('SingleSeason displays as Single Season', () => {
      expect(getGameModeLabel('SingleSeason')).toBe('Single Season');
    });
    it('Sandbox displays as Sandbox Mode', () => {
      expect(getGameModeLabel('Sandbox')).toBe('Sandbox Mode');
    });
    it('Sandbox does not display as Single Season', () => {
      expect(getGameModeLabel('Sandbox')).not.toBe('Single Season');
      expect(getGameModeLabel('Sandbox')).not.toContain('Single');
    });
    it('undefined defaults to Single Season', () => {
      expect(getGameModeLabel(undefined)).toBe('Single Season');
    });
  });

  // Sandbox does not inherit Single Season restrictions
  describe('Sandbox does not inherit Single Season restrictions', () => {
    it('Sandbox has no restricted routes', () => {
      const routes = ['/scouting', '/curves', '/politics', '/offseason', '/engine', '/sponsors', '/market', '/development', '/hq'];
      for (const r of routes) {
        expect(isRouteRestricted(r, 'Sandbox')).toBe(false);
      }
    });
    it('Sandbox has no blocked actions', () => {
      const actions = ['SIGN_YOUTH', 'PROMOTE_ACADEMY', 'SCOUT_TARGET', 'ADVANCE_SEASON', 'SIGN_ENGINE_DEAL'];
      for (const a of actions) {
        expect(isActionBlocked(a, 'Sandbox')).toBe(false);
      }
    });
  });
});
