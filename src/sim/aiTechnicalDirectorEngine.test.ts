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

    expect(first.teamResearch?.[first.selectedTeamId]?.activeProjects).toHaveLength(0);
    expect(aiTeamIds.every((teamId) => Boolean(first.teamResearch?.[teamId]?.focus))).toBe(true);
    expect(aiTeamIds.some((teamId) => (first.teamResearch?.[teamId]?.activeProjects.length ?? 0) > 0)).toBe(true);
    expect(aiTeamIds.map((teamId) => aiTechnicalSummary(first, teamId)))
      .toEqual(aiTeamIds.map((teamId) => aiTechnicalSummary(second, teamId)));
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
      teamResearch: {
        ...initial.teamResearch,
        [team.id]: { ...initial.teamResearch![team.id], activeProjects: [] },
      },
    };
    const budgetBefore = team.budget;
    const planned = planAITechnicalPrograms(state, [team.id]);

    expect(planned.teamResearch?.[team.id].activeProjects).toHaveLength(0);
    expect(planned.teams.find((candidate) => candidate.id === team.id)?.budget).toBeGreaterThanOrEqual(ai.budget.reserveTarget);
    expect(planned.teams.find((candidate) => candidate.id === team.id)?.budget).toBeLessThanOrEqual(budgetBefore);
  });

  it('progresses AI projects after a race and replans without touching the player program', () => {
    const state = newState('post-race-progress');
    const race = state.calendar[0];
    const track = getTrackById(race.trackId)!;
    const aiTeam = state.teams.find((team) =>
      team.id !== state.selectedTeamId && (state.teamResearch?.[team.id]?.activeProjects.length ?? 0) > 0)!;
    const playerBefore = state.teamResearch?.[state.selectedTeamId];
    const projectBefore = state.teamResearch![aiTeam.id].activeProjects[0];

    const progressed = progressAITechnicalProgramsAfterRace(state, race, [], track).state;
    const researchAfter = progressed.teamResearch![aiTeam.id];
    const sameProject = researchAfter.activeProjects.find((project) => project.id === projectBefore.id);
    const completed = researchAfter.projectHistory.some((project) => project.projectId === projectBefore.id);

    expect((sameProject?.progressRounds ?? 0) > projectBefore.progressRounds || completed).toBe(true);
    expect(progressed.teamResearch?.[state.selectedTeamId]).toEqual(playerBefore);
  });
});
