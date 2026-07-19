import type { GameState } from '../game/careerState';
import type { DevelopmentProject } from '../types/gameTypes';
import type { RDActiveProject, TeamResearchMap, TeamResearchState } from '../types/rdTypes';
import type {
  TeamTechnicalState,
  LegacyTechnicalFields,
  TeamTechnicalMap,
  TechnicalProgram,
  TechnicalResearchProgram,
  TechnicalUpgradeProgram,
} from '../types/technicalTypes';
import { toUnifiedTechnical } from './technicalModel';

function upgradeFromProgram(program: TechnicalUpgradeProgram): DevelopmentProject {
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
  const teamResearch: TeamResearchMap = {};

  for (const team of state.teams) {
    const teamTechnical = technical[team.id];
    const activeProjects = activeProgramsForTeam(technical, team.id);
    const activeResearchProjects = activeProjects
      .filter((program): program is TechnicalResearchProgram => program.kind === 'research')
      .map(researchFromProgram);
    const completedNodes = teamTechnical?.completedPrograms
      .filter((program) => program.kind === 'research' && program.node)
      .map((program) => program.kind === 'research' ? program.node! : undefined)
      .filter((node): node is NonNullable<typeof node> => !!node)
      ?? [];
    const projectHistory = teamTechnical?.completedPrograms
      .filter((program) => program.kind === 'research' && program.historyEntry)
      .map((program) => program.kind === 'research' ? program.historyEntry! : undefined)
      .filter((entry): entry is NonNullable<typeof entry> => !!entry)
      ?? [];

    teamResearch[team.id] = {
      teamId: team.id,
      focus: teamTechnical?.focus,
      tpp: teamTechnical?.tpp ?? { balance: 0, lifetimeEarned: 0, lifetimeSpent: 0, ledger: [] },
      activeProjects: activeResearchProjects,
      completedNodes,
      modifiers: teamTechnical?.modifiers ?? [],
      projectHistory,
    };

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

  return { activeDevelopmentProjects, completedDevelopmentProjects, teamResearch };
}

export function withUnifiedTechnical(
  state: GameState,
  legacy: LegacyTechnicalFields,
): GameState {
  const projected = toUnifiedTechnical({
    ...state,
    activeDevelopmentProjects: legacy.activeDevelopmentProjects,
    completedDevelopmentProjects: legacy.completedDevelopmentProjects,
    teamResearch: legacy.teamResearch,
  });
  const legacyWithoutResearchCompat: Partial<LegacyTechnicalFields> = { ...legacy };
  const result = {
    ...state,
    ...legacyWithoutResearchCompat,
    teamTechnical: projected,
  };
  return result;
}

export function withLegacyTechnicalCompat(state: GameState): GameState {
  return withUnifiedTechnical(state, fromUnifiedTechnical(state));
}

export function technicalStateForTeam(state: GameState, teamId: string): TeamTechnicalState | undefined {
  return state.teamTechnical?.[teamId];
}

export function activeUpgradePrograms(state: GameState, teamId = state.selectedTeamId): DevelopmentProject[] {
  return teamId === state.selectedTeamId
    ? fromUnifiedTechnical(state).activeDevelopmentProjects
    : [];
}

export function completedUpgradePrograms(state: GameState, teamId = state.selectedTeamId): DevelopmentProject[] {
  return teamId === state.selectedTeamId
    ? fromUnifiedTechnical(state).completedDevelopmentProjects
    : [];
}

export function researchStateForTeam(state: GameState, teamId: string) {
  return fromUnifiedTechnical(state).teamResearch[teamId];
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
