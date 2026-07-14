import { describe, expect, it } from 'vitest';
import { createNewGame } from './initialCareer';
import { gameReducer } from './gameReducer';
import { rdNodesById } from '../data/rd/rdCatalog';
import { buildRDProjectStartRequest } from '../sim/rdNodeRules';

describe('R&D foundation reducer integration', () => {
  it('initializes every team and starts the focused foundation node', () => {
    const initial = createNewGame({
      gameMode: 'Career',
      seasonYear: 1995,
      series: 'F1',
      teamId: 't-benetton',
      seed: 'rd-foundation',
    });
    expect(Object.keys(initial.teamResearch ?? {})).toHaveLength(initial.teams.length);

    const focused = gameReducer(initial, { type: 'SET_RESEARCH_FOCUS', branchId: 'engine' })!;
    const beforeBudget = focused.teams.find((team) => team.id === focused.selectedTeamId)!.budget;
    const request = buildRDProjectStartRequest(rdNodesById['engine:E1'], focused.series, focused.seasonYear);
    const started = gameReducer(focused, { type: 'START_RD_PROJECT', request })!;
    const research = started.teamResearch?.[started.selectedTeamId];
    expect(research?.focus?.lockedThroughSeasonYear).toBe(1997);
    expect(research?.activeProjects[0].nodeId).toBe('engine:E1');
    expect(research?.tpp.balance).toBe(25);
    expect(started.teams.find((team) => team.id === started.selectedTeamId)!.budget).toBeLessThan(beforeBudget);
  });

  it('does not expose long-term R&D actions in Single Season mode', () => {
    const initial = createNewGame({
      gameMode: 'SingleSeason',
      seasonYear: 1995,
      series: 'F1',
      teamId: 't-benetton',
      seed: 'rd-single-season',
    });
    const unchanged = gameReducer(initial, { type: 'SET_RESEARCH_FOCUS', branchId: 'engine' })!;
    expect(unchanged.teamResearch?.[unchanged.selectedTeamId].focus).toBeUndefined();
  });
});
