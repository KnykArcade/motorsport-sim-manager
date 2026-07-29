import { describe, expect, it } from 'vitest';
import { contextualNavigationForRoute, pageIdentityForRoute } from './layoutContext';
import { isNavigationItemActive } from './layoutNavigation';
import type { GameState } from '../game/careerState';

function stateFor(
  currentPhase: 'pre_season_setup' | 'paddock_week' | 'pre_race_briefing' | 'race_weekend' | 'post_race_review',
  gameMode: 'Career' | 'SingleSeason' | 'Sandbox' = 'Career',
): GameState {
  return {
    gameMode,
    seasonComplete: false,
    careerPhase: { currentPhase },
    completedRaceResults: {},
  } as unknown as GameState;
}

describe('contextual shell navigation', () => {
  it('moves page identity into the shell for normal and query-backed pages', () => {
    expect(pageIdentityForRoute('/inbox')).toEqual({ section: 'Management', title: 'Inbox' });
    expect(pageIdentityForRoute('/teams', '?filter=player')).toEqual({ section: 'Team', title: 'Team Info' });
    expect(pageIdentityForRoute('/sponsors', '?tab=owner')).toEqual({ section: 'Finance', title: 'Owner Vision' });
    expect(pageIdentityForRoute('/planner')).toEqual({ section: 'Team', title: 'Team Planner' });
    expect(pageIdentityForRoute('/live-race/race-3')).toEqual({ section: 'Race', title: 'Live Race' });
  });

  it('keeps the current screen selected and exposes only its owning area', () => {
    const raceState = stateFor('pre_race_briefing');
    const raceRoutes = contextualNavigationForRoute('/briefing', new Set(), raceState)
      .map((item) => item.to);
    expect(raceRoutes).toEqual(['/briefing', '/calendar', '/performance', '/history']);
    expect(raceRoutes).not.toContain('/weekend');

    const teamRoutes = contextualNavigationForRoute('/drivers', new Set(), raceState)
      .map((item) => item.to);
    expect(teamRoutes).toContain('/drivers');
    expect(teamRoutes).toContain('/staff');
    expect(teamRoutes).toContain('/planner');

    const current = contextualNavigationForRoute(
      '/technical',
      new Set(),
      raceState,
      '?section=setup',
    )[0];
    expect(current.to).toBe('/technical?section=setup');
    expect(isNavigationItemActive(current, '/technical', '?section=setup')).toBe(true);
  });

  it('removes mode-restricted contextual routes', () => {
    const routes = contextualNavigationForRoute(
      '/market',
      new Set(['/scouting', '/curves']),
      stateFor('race_weekend', 'SingleSeason'),
    )
      .map((item) => item.to);
    expect(routes).not.toContain('/scouting');
    expect(routes).not.toContain('/curves');
    expect(routes).toEqual(['/market']);
    expect(contextualNavigationForRoute(
      '/teams',
      new Set(['/planner']),
      stateFor('race_weekend', 'SingleSeason'),
    ).map((item) => item.to)).not.toContain('/planner');
  });
});
