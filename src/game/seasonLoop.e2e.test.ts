import { beforeEach, describe, expect, it } from 'vitest';
import { loadSeasonBundle } from '../data/seasonLoader';
import { preloadMarketBundle } from '../data/market';
import { getCareerPhase, approvePreseasonTab } from './careerPhaseEngine';
import { currentRace } from './careerState';
import { gameReducer, type GameAction } from './gameReducer';
import { createNewGame } from './initialCareer';
import { deleteSave, hasSave, loadGame, saveGame } from './saveSystem';
import type { GameState } from './careerState';

const preseasonTabs = [
  'teamOverview',
  'budget',
  'driverLineup',
  'carDevelopment',
  'sponsorsEngine',
  'seasonObjectives',
  'roundOnePreview',
] as const;

function dispatch(state: GameState, action: GameAction): GameState {
  return gameReducer(state, action) as GameState;
}

describe('playable season loop e2e', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
        clear: () => values.clear(),
        key: (index: number) => [...values.keys()][index] ?? null,
        get length() { return values.size; },
      } satisfies Storage,
    });
    deleteSave();
  });

  it('runs new game through qualifying, race, standings, and save reload', async () => {
    const bundle = await loadSeasonBundle(1995, 'F1');
    await preloadMarketBundle(1995, 'F1');
    expect(bundle).toBeDefined();

    let state = createNewGame({
      gameMode: 'SingleSeason',
      seasonYear: 1995,
      series: 'F1',
      teamId: 't-benetton',
      seed: 'season-loop-e2e',
      bundle,
    });
    for (const tab of preseasonTabs) state = approvePreseasonTab(state, tab);
    state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
    state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
    expect(getCareerPhase(state)).toBe('race_weekend');

    const race = currentRace(state);
    expect(race).toBeDefined();
    state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
    const qualifying = state.qualifyingResults[race!.id];
    expect(qualifying).toHaveLength(state.drivers.length);
    expect(qualifying?.[0]?.gapText).toBe('POLE');

    state = dispatch(state, { type: 'RUN_RACE', decisions: [] });
    const results = state.completedRaceResults[race!.id];
    expect(results).toHaveLength(qualifying?.filter((result) => !result.dnq).length);
    expect(state.driverStandings.length).toBeGreaterThan(0);
    expect(state.constructorStandings.length).toBeGreaterThan(0);
    expect(getCareerPhase(state)).toBe('post_race_review');

    saveGame(state);
    expect(hasSave()).toBe(true);
    const restored = loadGame();
    expect(restored?.completedRaceResults[race!.id]).toEqual(results);
    expect(restored?.driverStandings).toEqual(state.driverStandings);
    expect(restored?.constructorStandings).toEqual(state.constructorStandings);
  });
});
