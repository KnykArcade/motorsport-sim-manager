import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { GameState } from '../game/careerState';
import {
  PRIMARY_SECTIONS,
  ROUTE_CATALOG,
  contextualRoutesForSection,
  routeAccessForState,
  routeDefinitionForPath,
} from './routeCatalog';

function stateFor(
  currentPhase: 'pre_season_setup' | 'paddock_week' | 'pre_race_briefing' | 'race_weekend' | 'post_race_review',
  overrides: Partial<GameState> = {},
): GameState {
  return {
    gameMode: 'Career',
    seasonComplete: false,
    careerPhase: { currentPhase },
    completedRaceResults: {},
    ...overrides,
  } as unknown as GameState;
}

describe('Phase 24 route catalog', () => {
  it('owns every declared application route exactly once', () => {
    expect(new Set(ROUTE_CATALOG.map((route) => route.path)).size).toBe(ROUTE_CATALOG.length);

    const app = readFileSync(new URL('App.tsx', import.meta.url), 'utf8');
    const declaredRoutes = [...app.matchAll(/<Route path="([^"]+)"/g)]
      .map((match) => match[1])
      .filter((path) => path !== '*');

    expect(declaredRoutes).toHaveLength(ROUTE_CATALOG.length);
    for (const path of declaredRoutes) {
      expect(ROUTE_CATALOG.some((route) => route.path === path), path).toBe(true);
    }
  });

  it('defines the eight permanent player-facing areas', () => {
    expect(PRIMARY_SECTIONS.map((section) => section.label)).toEqual([
      'Home',
      'Inbox',
      'Race',
      'Team',
      'Recruitment',
      'Technical',
      'Finance',
      'World',
    ]);
    expect(new Set(PRIMARY_SECTIONS.map((section) => section.id)).size).toBe(8);
  });

  it('matches parameter routes and preserves their owning area', () => {
    expect(routeDefinitionForPath('/drivers/d-44/negotiate')).toMatchObject({
      path: '/drivers/:driverId/negotiate',
      section: 'team',
    });
    expect(routeDefinitionForPath('/live-race/race-8')).toMatchObject({
      path: '/live-race/:raceId',
      section: 'race',
    });
  });

  it('makes only the active race-phase workspace visible', () => {
    const state = stateFor('pre_race_briefing');
    const raceRoutes = contextualRoutesForSection('race', state).map((route) => route.path);

    expect(raceRoutes).toContain('/briefing');
    expect(raceRoutes).not.toContain('/preseason');
    expect(raceRoutes).not.toContain('/paddock');
    expect(raceRoutes).not.toContain('/weekend');
    expect(routeAccessForState('/weekend', state)).toMatchObject({ available: false });
  });

  it('keeps completed reports readable without making live race resumable', () => {
    const state = stateFor('paddock_week', {
      completedRaceResults: { 'race-1': [] },
    });

    expect(routeAccessForState('/post-race/race-1', state).available).toBe(true);
    expect(routeAccessForState('/results/race-1', state).available).toBe(true);
    expect(routeDefinitionForPath('/live-race/race-1')?.resumable).toBe(false);
  });

  it('keeps car and setup work in both Technical and the active Race workflow', () => {
    expect(routeDefinitionForPath('/technical')).toMatchObject({
      section: 'technical',
      title: 'Technical Center',
    });
    expect(routeDefinitionForPath('/weekend')).toMatchObject({
      section: 'race',
      availability: 'race_weekend',
    });
  });

  it('gives every in-career route an explicit fallback', () => {
    const careerRoutes = ROUTE_CATALOG.filter((route) => route.availability !== 'public');
    expect(careerRoutes.length).toBeGreaterThan(0);
    for (const route of careerRoutes) {
      expect(route.fallback, route.path).toBeTruthy();
      expect(route.section, route.path).not.toBe('system');
    }
  });
});
