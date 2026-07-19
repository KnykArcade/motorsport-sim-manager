import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { AI_RD_NODE_INDEX } from '../data/rd/rdAIIndex.generated';
import { rdNodeCatalog } from '../data/rd/rdCatalog';
import { getTrackById } from '../data';
import { createNewGame } from '../game/initialCareer';
import type { GameState } from '../game/careerState';
import {
  aiTechnicalSummary,
  planAITechnicalPrograms,
  progressAITechnicalProgramsAfterRace,
} from './aiTechnicalDirectorEngine';
import { researchStateForTeam, technicalStateWithResearch } from './technicalAdapters';
import { developmentSlots } from './facilityEngine';

function newState(seed = 'ai-technical-test'): GameState {
  return createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed,
  });
}

describe('AI technical director', () => {
  it('keeps a compact AI index in parity with the complete R&D catalog', () => {
    expect(AI_RD_NODE_INDEX).toHaveLength(rdNodeCatalog.length);
    expect(new Set(AI_RD_NODE_INDEX.map((node) => node[0])))
      .toEqual(new Set(rdNodeCatalog.map((node) => node.id)));
  });

  it('starts deterministic real technical programs for AI teams only', () => {
    const first = newState();
    const second = newState();
    const aiTeamIds = first.teams.filter((team) => team.id !== first.selectedTeamId).map((team) => team.id);

    expect(researchStateForTeam(first, first.selectedTeamId)?.activeProjects).toHaveLength(0);
    expect(aiTeamIds.every((teamId) => Boolean(researchStateForTeam(first, teamId)?.focus))).toBe(true);
    expect(aiTeamIds.some((teamId) => (first.teamTechnical?.[teamId]?.activeProjects.length ?? 0) > 0)).toBe(true);
    expect(aiTeamIds.map((teamId) => aiTechnicalSummary(first, teamId)))
      .toEqual(aiTeamIds.map((teamId) => aiTechnicalSummary(second, teamId)));
  });

  it('can mix quick upgrades with research without exceeding shared capacity', () => {
    const state = newState('quick-upgrade-capacity');
    const aiTeams = state.teams.filter((team) => team.id !== state.selectedTeamId);
    const upgrades = aiTeams.flatMap((team) =>
      state.teamTechnical?.[team.id]?.activeProjects.filter((project) => project.kind === 'upgrade') ?? []);

    expect(upgrades.length).toBeGreaterThan(0);
    for (const team of aiTeams) {
      expect(state.teamTechnical?.[team.id]?.activeProjects.length ?? 0)
        .toBeLessThanOrEqual(developmentSlots(state.facilities));
    }
  });

  it('protects the reserve and blocks new research for a critical team', () => {
    const initial = newState('critical-team');
    const team = initial.teams.find((candidate) => candidate.id !== initial.selectedTeamId)!;
    const ai = initial.aiTeamStates![team.id];
    const state: GameState = {
      ...initial,
      aiTeamStates: {
        ...initial.aiTeamStates,
        [team.id]: { ...ai, financialHealth: 'Critical', technicalSpendThisSeason: 0 },
      },
      teamTechnical: {
        ...initial.teamTechnical,
        [team.id]: technicalStateWithResearch(
          initial.teamTechnical![team.id],
          { ...researchStateForTeam(initial, team.id)!, activeProjects: [] },
        ),
      },
    };
    const budgetBefore = team.budget;
    const planned = planAITechnicalPrograms(state, [team.id]);

    expect(researchStateForTeam(planned, team.id)?.activeProjects).toHaveLength(0);
    expect(planned.teams.find((candidate) => candidate.id === team.id)?.budget).toBeGreaterThanOrEqual(ai.budget.reserveTarget);
    expect(planned.teams.find((candidate) => candidate.id === team.id)?.budget).toBeLessThanOrEqual(budgetBefore);
  });

  it('progresses AI projects after a race and replans without touching the player program', () => {
    const state = newState('post-race-progress');
    const race = state.calendar[0];
    const track = getTrackById(race.trackId)!;
    const aiTeam = state.teams.find((team) =>
      team.id !== state.selectedTeamId && (state.teamTechnical?.[team.id]?.activeProjects.length ?? 0) > 0)!;
    const playerBefore = researchStateForTeam(state, state.selectedTeamId);
    const technicalBefore = state.teamTechnical![aiTeam.id];
    const projectBefore = technicalBefore.activeProjects[0];

    const progressed = progressAITechnicalProgramsAfterRace(state, race, [], track).state;
    const technicalAfter = progressed.teamTechnical![aiTeam.id];
    const sameProject = technicalAfter.activeProjects.find((project) => project.id === projectBefore.id);
    const completed = technicalAfter.completedPrograms.some((project) => project.id === projectBefore.id);

    expect((sameProject?.progressTicks ?? 0) > projectBefore.progressTicks || completed).toBe(true);
    expect(researchStateForTeam(progressed, state.selectedTeamId)).toEqual(playerBefore);
  });

  it('keeps a deterministic three-race quick-upgrade balance harness', () => {
    const run = (seed: string) => {
      let state = newState(seed);
      for (let index = 0; index < 3; index += 1) {
        const race = state.calendar[index];
        const track = getTrackById(race.trackId)!;
        state = progressAITechnicalProgramsAfterRace(state, race, [], track).state;
      }
      return state;
    };
    const first = run('quick-upgrade-balance');
    const second = run('quick-upgrade-balance');

    expect(first.cars).toEqual(second.cars);
    expect(first.teamTechnical).toEqual(second.teamTechnical);
    for (const team of first.teams.filter((candidate) => candidate.id !== first.selectedTeamId)) {
      const technical = first.teamTechnical?.[team.id];
      const ai = first.aiTeamStates?.[team.id];
      expect(technical?.activeProjects.length ?? 0).toBeLessThanOrEqual(developmentSlots(first.facilities));
      expect(team.budget).toBeGreaterThanOrEqual(0);
      expect(ai?.technicalSpendThisSeason ?? 0).toBeLessThanOrEqual(ai?.budget.developmentSpend ?? 0);
      for (const car of first.cars.filter((candidate) => candidate.teamId === team.id)) {
        expect(Object.values(car.developmentLevel).every((value) => Number.isFinite(value))).toBe(true);
      }
    }
  });
});
