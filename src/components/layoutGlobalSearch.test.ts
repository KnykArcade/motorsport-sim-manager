import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import { globalSearchIndex, searchGlobalIndex } from './layoutGlobalSearch';

function createState(gameMode: 'Career' | 'SingleSeason' = 'Career') {
  return createNewGame({
    gameMode,
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'layout-global-search',
  });
}

describe('FM-style global object search', () => {
  it('indexes drivers, staff, teams, races, circuits, and championships', () => {
    const state = createState();
    const categories = new Set(globalSearchIndex(state).map((result) => result.category));
    expect(categories).toEqual(new Set([
      'Driver',
      'Staff',
      'Team',
      'Race',
      'Circuit',
      'Championship',
    ]));
  });

  it('opens an exact object and exposes contextual actions', () => {
    const state = createState();
    const driver = state.drivers[0];
    const result = searchGlobalIndex(globalSearchIndex(state), driver.name)[0];
    expect(result.id).toBe(`driver:${driver.id}`);
    expect(result.to).toContain(`driver=${encodeURIComponent(driver.id)}`);
    expect(result.actions.map((action) => action.label)).toContain('Open profile');
  });

  it('honors mode-hidden routes in direct-action menus', () => {
    const state = createState('SingleSeason');
    const driver = state.drivers.find((entry) => entry.teamId !== state.selectedTeamId)!;
    const result = searchGlobalIndex(
      globalSearchIndex(state, new Set(['/scouting'])),
      driver.name,
    )[0];
    expect(result.actions.map((action) => action.label)).not.toContain('Scout');
  });

  it('ranks exact and prefix title matches before general metadata matches', () => {
    const state = createState();
    const team = state.teams[0];
    const results = searchGlobalIndex(globalSearchIndex(state), team.name);
    expect(results[0].id).toBe(`team:${team.id}`);
  });

  it('connects the player organization to the Team Planner only in multi-season modes', () => {
    const career = createState();
    const player = career.teams.find((team) => team.id === career.selectedTeamId)!;
    const careerResult = searchGlobalIndex(globalSearchIndex(career), player.name)[0];
    expect(careerResult.actions).toContainEqual({ label: 'Team planner', to: '/planner' });

    const singleSeason = createState('SingleSeason');
    const historicalPlayer = singleSeason.teams.find((team) => team.id === singleSeason.selectedTeamId)!;
    const singleResult = searchGlobalIndex(globalSearchIndex(singleSeason), historicalPlayer.name)[0];
    expect(singleResult.actions.map((action) => action.label)).not.toContain('Team planner');
  });
});
