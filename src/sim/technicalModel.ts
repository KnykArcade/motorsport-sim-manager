import type { GameState } from '../game/careerState';
import { ensureTeamResearchMap } from './rdEngine';
import type {
  CompletedProgram,
  TeamTechnicalMap,
  TechnicalProgram,
} from '../types/technicalTypes';

export function toUnifiedTechnical(state: GameState): TeamTechnicalMap {
  const researchMap = ensureTeamResearchMap(state.teamResearch, state.teams, state.seasonYear);
  const playerTeamId = state.selectedTeamId;

  return Object.fromEntries(state.teams.map((team) => {
    const research = researchMap[team.id];
    const activeProjects: TechnicalProgram[] = research.activeProjects.map((project) => ({
      kind: 'research',
      id: project.id,
      teamId: team.id,
      progressTicks: project.progressRounds,
      durationTicks: project.durationRounds,
      cashCost: project.cashCost,
      tppCost: project.tppCost,
      nodeId: project.nodeId,
      startedSeasonYear: project.startedSeasonYear,
      startedRound: project.startedRound,
      nodeName: project.nodeName,
      sourceId: project.sourceId,
      branchId: project.branchId,
      tier: project.tier,
      path: project.path,
      riskLevel: project.riskLevel,
      seriesWeight: project.seriesWeight,
      modifierTemplates: project.modifierTemplates,
    }));

    if (team.id === playerTeamId) {
      activeProjects.unshift(
        ...(state.activeDevelopmentProjects ?? []).map((project) => ({
          kind: 'upgrade' as const,
          id: project.id,
          teamId: team.id,
          progressTicks: project.progressRaces,
          durationTicks: project.adjustedDurationRaces ?? project.durationRaces,
          baseDurationTicks: project.durationRaces,
          cashCost: project.cost,
          tppCost: 0 as const,
          name: project.name,
          category: project.category,
          horizon: project.horizon,
          successChance: project.successChance,
          size: project.projectSize,
          risk: project.risk,
          riskLevel: project.riskLevel,
          carryoverRate: project.carryoverRate,
          regulationSensitivity: project.regulationSensitivity,
          currentSeasonEffects: project.currentSeasonEffects,
          nextSeasonEffects: project.nextSeasonEffects,
          facilityEffects: project.facilityEffects,
          relevantFacilityTypes: project.relevantFacilityTypes,
          outcomeResult: project.outcomeResult,
          rushed: project.rushed,
          facilityLevelAtStart: project.facilityLevelAtStart,
        })),
      );
    }

    const completedPrograms: CompletedProgram[] = research.completedNodes.map((node) => ({
      kind: 'research',
      id: `node:${node.nodeId}:${node.completedSeasonYear}:${node.completedRound}`,
      teamId: team.id,
      completedTicks: node.completedRound,
      node,
    }));

    for (const entry of research.projectHistory) {
      completedPrograms.push({
        kind: 'research',
        id: `history:${entry.projectId}`,
        teamId: team.id,
        completedTicks: entry.round,
        historyEntry: entry,
      });
    }

    if (team.id === playerTeamId) {
      completedPrograms.unshift(
        ...(state.completedDevelopmentProjects ?? []).map((project) => ({
          kind: 'upgrade' as const,
          id: project.id,
          teamId: team.id,
          completedTicks: project.progressRaces,
          program: {
            kind: 'upgrade' as const,
            id: project.id,
            teamId: team.id,
            progressTicks: project.progressRaces,
            durationTicks: project.adjustedDurationRaces ?? project.durationRaces,
            baseDurationTicks: project.durationRaces,
            cashCost: project.cost,
            tppCost: 0 as const,
            name: project.name,
            category: project.category,
            horizon: project.horizon,
            successChance: project.successChance,
            size: project.projectSize,
            risk: project.risk,
            riskLevel: project.riskLevel,
            carryoverRate: project.carryoverRate,
            regulationSensitivity: project.regulationSensitivity,
            currentSeasonEffects: project.currentSeasonEffects,
          nextSeasonEffects: project.nextSeasonEffects,
          facilityEffects: project.facilityEffects,
          relevantFacilityTypes: project.relevantFacilityTypes,
          outcomeResult: project.outcomeResult,
            rushed: project.rushed,
            facilityLevelAtStart: project.facilityLevelAtStart,
          },
        })),
      );
    }

    return [team.id, {
      teamId: team.id,
      tpp: research.tpp,
      focus: research.focus,
      activeProjects,
      completedPrograms,
      modifiers: research.modifiers,
    }];
  })) as TeamTechnicalMap;
}
