import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { preloadMarketBundle } from '../data/market';
import { loadSeasonBundle } from '../data/seasonLoader';
import { approvePreseasonTab, getCareerPhase } from '../game/careerPhaseEngine';
import type { GameState } from '../game/careerState';
import { currentRace } from '../game/careerState';
import { gameReducer, type GameAction } from '../game/gameReducer';
import { createNewGame } from '../game/initialCareer';
import { migrateGameState } from '../game/saveSystem';
import { advanceSeason } from '../game/seasonRollover';
import type { Series } from '../types/gameTypes';
import { DEPARTMENT_IDS, TEAM_CULTURE_AXES } from '../types/phase18Types';

const preseasonTabs = [
  'teamOverview',
  'budget',
  'driverLineup',
  'carDevelopment',
  'sponsorsEngine',
  'seasonObjectives',
  'roundOnePreview',
] as const;

const representativeUniverses: Array<{ year: number; series: Series }> = [
  { year: 1990, series: 'F1' },
  { year: 1998, series: 'CART' },
  { year: 2008, series: 'IndyCar' },
  { year: 1998, series: 'NASCAR' },
  { year: 2026, series: 'NASCAR' },
];

const rolloverUniverses = representativeUniverses.filter(({ year }) => year < 2026);

function dispatch(state: GameState, action: GameAction): GameState {
  return gameReducer(state, action) as GameState;
}

describe('Phase 18 cross-series integration audit', () => {
  it.each(representativeUniverses)('survives the first playable race and save migration in $year $series', async ({ year, series }) => {
    const bundle = await loadSeasonBundle(year, series);
    await preloadMarketBundle(year, series);
    expect(bundle).toBeDefined();

    const selectedTeam = bundle!.teams[0];
    let state = createNewGame({
      gameMode: 'Career',
      seasonYear: year,
      series,
      teamId: selectedTeam.id,
      seed: `phase18-integration-${year}-${series}`,
      bundle,
    });

    expect(Object.keys(state.phase18!.teamCultures)).toHaveLength(state.teams.length);
    expect(Object.keys(state.phase18!.departmentMoods)).toHaveLength(state.teams.length);
    expect(Object.keys(state.phase18!.aiPrincipalIdentities)).toHaveLength(state.teams.length - 1);
    for (const team of state.teams) {
      expect(Object.keys(state.phase18!.teamCultures[team.id].axes)).toEqual([...TEAM_CULTURE_AXES]);
      expect(Object.keys(state.phase18!.departmentMoods[team.id])).toEqual([...DEPARTMENT_IDS]);
    }

    for (const tab of preseasonTabs) state = approvePreseasonTab(state, tab);
    state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
    state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
    expect(getCareerPhase(state)).toBe('race_weekend');

    const race = currentRace(state)!;
    state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
    state = dispatch(state, { type: 'RUN_RACE', decisions: [] });
    expect(state.completedRaceResults[race.id]?.length).toBeGreaterThan(0);
    expect(getCareerPhase(state)).toBe('post_race_review');

    state = dispatch(state, { type: 'ADVANCE_TO_PADDOCK_WEEK' });
    state = dispatch(state, { type: 'GENERATE_PADDOCK_EVENTS' });
    expect(getCareerPhase(state)).toBe('paddock_week');
    expect(state.careerPhase?.generatedEventsForCurrentWeek).toBe(true);
    expect(state.phase18?.narratives.length).toBeGreaterThan(0);

    const restored = migrateGameState(JSON.parse(JSON.stringify(state)) as GameState);
    expect(restored.phase18).toEqual(state.phase18);
    expect(restored.completedRaceResults[race.id]).toEqual(state.completedRaceResults[race.id]);
  }, 60_000);

  it.each(rolloverUniverses)('rebuilds current-team Phase 18 state for the next $series season after $year', async ({ year, series }) => {
    const bundle = await loadSeasonBundle(year, series);
    const nextBundle = await loadSeasonBundle(year + 1, series);
    expect(bundle).toBeDefined();
    expect(nextBundle).toBeDefined();

    const state = createNewGame({
      gameMode: 'Career',
      seasonYear: year,
      series,
      teamId: bundle!.teams[0].id,
      seed: `phase18-rollover-${year}-${series}`,
      bundle,
    });
    const next = advanceSeason({ ...state, seasonComplete: true }, nextBundle);
    const currentTeamIds = new Set(next.teams.map((team) => team.id));

    expect(next.seasonYear).toBe(year + 1);
    expect(next.phase18?.preseason?.seasonYear).toBe(year + 1);
    expect(Object.keys(next.phase18!.teamCultures).filter((teamId) => currentTeamIds.has(teamId))).toHaveLength(next.teams.length);
    expect(Object.keys(next.phase18!.departmentMoods).filter((teamId) => currentTeamIds.has(teamId))).toHaveLength(next.teams.length);
    expect(Object.keys(next.phase18!.aiPrincipalIdentities).filter((teamId) => currentTeamIds.has(teamId))).toHaveLength(next.teams.length - 1);

    const currentRelationships = Object.values(next.phase18!.rivalRelationships).filter((relationship) =>
      currentTeamIds.has(relationship.teamAId) && currentTeamIds.has(relationship.teamBId));
    expect(currentRelationships).toHaveLength(next.teams.length * (next.teams.length - 1) / 2);
  }, 60_000);
});
