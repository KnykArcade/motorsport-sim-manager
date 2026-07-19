import type { GameState } from '../game/careerState';
import type { DevelopmentProject } from '../types/gameTypes';
import type { RDActiveProject, TeamResearchMap, TeamResearchState } from '../types/rdTypes';
import type {
  TeamTechnicalState,
  LegacyTechnicalFields,
  TeamTechnicalMap,
  CompletedUpgradeProgram,
  TechnicalProgram,
  TechnicalResearchProgram,
  TechnicalUpgradeProgram,
} from '../types/technicalTypes';
import { toUnifiedTechnical } from './technicalModel';
import { ensureTeamResearchMap } from './rdEngine';

export function upgradeFromProgram(program: TechnicalUpgradeProgram): DevelopmentProject {
  return {
    id: program.id,
    name: program.name,
    category: program.category,
    horizon: program.horizon,
    cost: program.cashCost,
    durationRaces: program.baseDurationTicks,
    progressRaces: program.progressTicks,
    successChance: program.successChance,
    currentSeasonEffects: program.currentSeasonEffects,
    nextSeasonEffects: program.nextSeasonEffects,
    facilityEffects: program.facilityEffects,
    carryoverRate: program.carryoverRate,
    regulationSensitivity: program.regulationSensitivity,
    risk: program.risk,
    riskLevel: program.riskLevel,
    projectSize: program.size,
    relevantFacilityTypes: program.relevantFacilityTypes,
    outcomeResult: program.outcomeResult,
    rushed: program.rushed,
    facilityLevelAtStart: program.facilityLevelAtStart,
    adjustedDurationRaces: program.durationTicks,
  };
}

function researchFromProgram(program: TechnicalResearchProgram): RDActiveProject {
  return {
    id: program.id,
    nodeId: program.nodeId,
    teamId: program.teamId,
    startedSeasonYear: program.startedSeasonYear ?? 0,
    startedRound: program.startedRound ?? 0,
    progressRounds: program.progressTicks,
    durationRounds: program.durationTicks,
    cashCost: program.cashCost,
    tppCost: program.tppCost,
    nodeName: program.nodeName,
    sourceId: program.sourceId,
    branchId: program.branchId,
    tier: program.tier,
    path: program.path,
    riskLevel: program.riskLevel,
    seriesWeight: program.seriesWeight,
    modifierTemplates: program.modifierTemplates,
  };
}

function activeProgramsForTeam(technical: TeamTechnicalMap, teamId: string): TechnicalProgram[] {
  return technical[teamId]?.activeProjects ?? [];
}

export function fromUnifiedTechnical(state: GameState): LegacyTechnicalFields {
  const technical = state.teamTechnical ?? toUnifiedTechnical(state);
  const activeDevelopmentProjects: DevelopmentProject[] = [];
  const completedDevelopmentProjects: DevelopmentProject[] = [];

  for (const team of state.teams) {
    const teamTechnical = technical[team.id];
    const activeProjects = activeProgramsForTeam(technical, team.id);
    if (team.id !== state.selectedTeamId) continue;
    activeDevelopmentProjects.push(
      ...activeProjects
        .filter((program): program is TechnicalUpgradeProgram => program.kind === 'upgrade')
        .map(upgradeFromProgram),
    );
    completedDevelopmentProjects.push(
      ...(teamTechnical?.completedPrograms ?? [])
        .filter((program) => program.kind === 'upgrade' && program.program)
        .map((program) => program.kind === 'upgrade' ? upgradeFromProgram(program.program) : undefined)
        .filter((project): project is NonNullable<typeof project> => !!project),
    );
  }

  return { activeDevelopmentProjects, completedDevelopmentProjects };
}

export function withUnifiedTechnical(
  state: GameState,
  legacy: LegacyTechnicalFields,
): GameState {
  const researchMap = state.teamTechnical
    ? Object.fromEntries(
      Object.entries(state.teamTechnical).map(([teamId, technical]) => [
        teamId,
        researchStateFromTechnical(technical),
      ]),
    ) as TeamResearchMap
    : ensureTeamResearchMap(undefined, state.teams, state.seasonYear);
  const projected = toUnifiedTechnical({
    ...state,
    activeDevelopmentProjects: legacy.activeDevelopmentProjects,
    completedDevelopmentProjects: legacy.completedDevelopmentProjects,
  }, researchMap);
  return {
    ...state,
    teamTechnical: projected,
  };
}

export function withLegacyTechnicalCompat(state: GameState): GameState {
  return withUnifiedTechnical(state, fromUnifiedTechnical(state));
}

export function technicalStateForTeam(state: GameState, teamId: string): TeamTechnicalState | undefined {
  return state.teamTechnical?.[teamId];
}

export function activeUpgradePrograms(state: GameState, teamId = state.selectedTeamId): DevelopmentProject[] {
  return (state.teamTechnical?.[teamId]?.activeProjects ?? [])
    .filter((program): program is TechnicalUpgradeProgram => program.kind === 'upgrade')
    .map(upgradeFromProgram);
}

export function completedUpgradePrograms(state: GameState, teamId = state.selectedTeamId): DevelopmentProject[] {
  return (state.teamTechnical?.[teamId]?.completedPrograms ?? [])
    .filter((program): program is CompletedUpgradeProgram => program.kind === 'upgrade')
    .map((program) => upgradeFromProgram(program.program));
}

export function researchStateForTeam(state: GameState, teamId: string) {
  return researchStateFromTechnical(state.teamTechnical?.[teamId]);
}

export function researchMapFromTechnical(state: GameState): TeamResearchMap {
  return Object.fromEntries(
    Object.keys(state.teamTechnical ?? {}).map((teamId) => [
      teamId,
      researchStateFromTechnical(state.teamTechnical?.[teamId]),
    ]),
  ) as TeamResearchMap;
}

export function researchStateFromTechnical(
  technical: TeamTechnicalState | undefined,
): TeamResearchState | undefined {
  if (!technical) return undefined;
  const completedNodes = technical.completedPrograms
    .filter((program) => program.kind === 'research' && program.node)
    .map((program) => program.kind === 'research' ? program.node! : undefined)
    .filter((node): node is NonNullable<typeof node> => !!node);
  const projectHistory = technical.completedPrograms
    .filter((program) => program.kind === 'research' && program.historyEntry)
    .map((program) => program.kind === 'research' ? program.historyEntry! : undefined)
    .filter((entry): entry is NonNullable<typeof entry> => !!entry);
  return {
    teamId: technical.teamId,
    focus: technical.focus,
    tpp: technical.tpp,
    activeProjects: technical.activeProjects
      .filter((program): program is TechnicalResearchProgram => program.kind === 'research')
      .map(researchFromProgram),
    completedNodes,
    modifiers: technical.modifiers,
    projectHistory,
  };
}

function researchProgramFromNative(project: RDActiveProject): TechnicalResearchProgram {
  return {
    kind: 'research',
    id: project.id,
    teamId: project.teamId,
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
  };
}

export function technicalStateWithResearch(
  technical: TeamTechnicalState,
  research: TeamResearchState,
): TeamTechnicalState {
  const completedPrograms = [
    ...research.completedNodes.map((node) => ({
      kind: 'research' as const,
      id: `node:${node.nodeId}:${node.completedSeasonYear}:${node.completedRound}`,
      teamId: technical.teamId,
      completedTicks: node.completedRound,
      node,
    })),
    ...research.projectHistory.map((entry) => ({
      kind: 'research' as const,
      id: `history:${entry.projectId}`,
      teamId: technical.teamId,
      completedTicks: entry.round,
      historyEntry: entry,
    })),
  ];
  return {
    ...technical,
    tpp: research.tpp,
    focus: research.focus,
    modifiers: research.modifiers,
    activeProjects: [
      ...technical.activeProjects.filter((program) => program.kind === 'upgrade'),
      ...research.activeProjects.map(researchProgramFromNative),
    ],
    completedPrograms: [
      ...technical.completedPrograms.filter((program) => program.kind === 'upgrade'),
      ...completedPrograms,
    ],
  };
}

export function withResearchMap(state: GameState, researchMap: TeamResearchMap): GameState {
  const teamTechnical = { ...(state.teamTechnical ?? {}) };
  for (const [teamId, research] of Object.entries(researchMap)) {
    const technical = teamTechnical[teamId];
    if (technical) teamTechnical[teamId] = technicalStateWithResearch(technical, research);
  }
  return { ...state, teamTechnical };
}
