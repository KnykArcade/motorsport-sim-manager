import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import { gameReducer, type GameAction } from '../game/gameReducer';
import { approvePreseasonTab } from '../game/careerPhaseEngine';
import type { GameState } from '../game/careerState';
import { technicalDirectorProposals } from './technicalAdvisorEngine';
import { developmentSlots } from './facilityEngine';
import { technicalStateForTeam } from './technicalAdapters';

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

function newSeasonState(): GameState {
  let state = createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'advisor-test',
  });
  for (const tab of preseasonTabs) state = approvePreseasonTab(state, tab);
  state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
  return state;
}

describe('technicalDirectorProposals', () => {
  it('is deterministic for the same state', () => {
    const state = newSeasonState();
    expect(technicalDirectorProposals(state)).toEqual(technicalDirectorProposals(state));
  });

  it('proposes a development program when capacity and budget allow', () => {
    const state = newSeasonState();
    const proposals = technicalDirectorProposals(state);
    const development = proposals.find((proposal) => proposal.kind === 'development');
    expect(development).toBeDefined();
    expect(development?.action.type).toBe('START_DEVELOPMENT');
  });

  it('approving a development proposal starts the program via the reducer', () => {
    const state = newSeasonState();
    const development = technicalDirectorProposals(state).find((proposal) => proposal.kind === 'development');
    expect(development).toBeDefined();
    const before = technicalStateForTeam(state, state.selectedTeamId)?.activeProjects.length ?? 0;
    const after = dispatch(state, development!.action);
    const count = technicalStateForTeam(after, after.selectedTeamId)?.activeProjects.length ?? 0;
    expect(count).toBe(before + 1);
  });

  it('does not propose programs when all capacity is committed', () => {
    let state = newSeasonState();
    const slots = developmentSlots(state.facilities);
    for (let i = 0; i < slots + 1; i += 1) {
      const development = technicalDirectorProposals(state).find((proposal) => proposal.kind === 'development');
      if (!development) break;
      state = dispatch(state, development.action);
    }
    const used = technicalStateForTeam(state, state.selectedTeamId)?.activeProjects.length ?? 0;
    if (used >= slots) {
      const proposals = technicalDirectorProposals(state);
      expect(proposals.some((proposal) => proposal.kind === 'development')).toBe(false);
      expect(proposals.some((proposal) => proposal.kind === 'research')).toBe(false);
    }
  });

  it('proposes repairing a critically worn fitted part', () => {
    const base = newSeasonState();
    const parts = base.teamParts?.[base.selectedTeamId];
    expect(parts).toBeDefined();
    const fitted = parts!.inventory.find((part) => part.status === 'fitted');
    expect(fitted).toBeDefined();
    const state: GameState = {
      ...base,
      teamParts: {
        ...base.teamParts!,
        [base.selectedTeamId]: {
          ...parts!,
          inventory: parts!.inventory.map((part) =>
            part.id === fitted!.id ? { ...part, condition: 20 } : part,
          ),
        },
      },
    };
    const repair = technicalDirectorProposals(state).find((proposal) => proposal.kind === 'repair');
    expect(repair).toBeDefined();
    expect(repair?.action).toEqual({ type: 'REPAIR_PART', partId: fitted!.id });
  });

  it('never proposes actions the team cannot afford', () => {
    const base = newSeasonState();
    const broke: GameState = {
      ...base,
      teams: base.teams.map((team) =>
        team.id === base.selectedTeamId ? { ...team, budget: 0 } : team,
      ),
    };
    expect(technicalDirectorProposals(broke)).toEqual([]);
  });
});
