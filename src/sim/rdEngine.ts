import type { CarRatings, Series, Team } from '../types/gameTypes';
import type {
  RDActiveProject,
  RDBranchId,
  RDCostBand,
  RDDurationBand,
  RDProgressResult,
  TeamPrincipalPointReason,
  TeamPrincipalPointsState,
  TeamResearchMap,
  TeamResearchState,
} from '../types/rdTypes';
import {
  rdFoundationProjectById,
  type RDFoundationProjectDefinition,
} from '../data/rd/rdFoundationCatalog';

export const INITIAL_TPP_BALANCE = 30;
export const ANNUAL_TPP_ALLOCATION = 20;
export const RESEARCH_FOCUS_LOCK_SEASONS = 3;

const TPP_COSTS: Record<RDCostBand, number> = {
  Low: 5,
  Medium: 10,
  High: 18,
  'Very High': 28,
  Extreme: 40,
};

const CASH_RATIOS: Record<RDCostBand, number> = {
  Low: 0.018,
  Medium: 0.032,
  High: 0.05,
  'Very High': 0.075,
  Extreme: 0.11,
};

const DURATION_ROUNDS: Record<RDDurationBand, number> = {
  Short: 2,
  Medium: 3,
  Long: 5,
  'Very Long': 7,
  'Season Project': 10,
};

function transactionId(teamId: string, seasonYear: number, round: number, reason: TeamPrincipalPointReason, index: number): string {
  return `${teamId}:${seasonYear}:${round}:${reason}:${index}`;
}

export function createInitialTPP(teamId: string, seasonYear: number): TeamPrincipalPointsState {
  return {
    balance: INITIAL_TPP_BALANCE,
    lifetimeEarned: INITIAL_TPP_BALANCE,
    lifetimeSpent: 0,
    ledger: [{
      id: transactionId(teamId, seasonYear, 0, 'initial_allocation', 0),
      seasonYear,
      round: 0,
      amount: INITIAL_TPP_BALANCE,
      balanceAfter: INITIAL_TPP_BALANCE,
      reason: 'initial_allocation',
      description: 'Initial team leadership allocation',
    }],
  };
}

export function createInitialTeamResearch(teamId: string, seasonYear: number): TeamResearchState {
  return {
    teamId,
    tpp: createInitialTPP(teamId, seasonYear),
    activeProjects: [],
    completedNodes: [],
    modifiers: [],
  };
}

export function createInitialTeamResearchMap(teams: readonly Team[], seasonYear: number): TeamResearchMap {
  return Object.fromEntries(teams.map((team) => [team.id, createInitialTeamResearch(team.id, seasonYear)]));
}

export function ensureTeamResearchMap(
  existing: TeamResearchMap | undefined,
  teams: readonly Team[],
  seasonYear: number,
): TeamResearchMap {
  const next = { ...(existing ?? {}) };
  for (const team of teams) {
    const current = next[team.id];
    next[team.id] = current
      ? {
          ...current,
          teamId: team.id,
          tpp: {
            ...current.tpp,
            ledger: current.tpp.ledger ?? [],
            lifetimeEarned: current.tpp.lifetimeEarned ?? current.tpp.balance,
            lifetimeSpent: current.tpp.lifetimeSpent ?? 0,
          },
          activeProjects: current.activeProjects ?? [],
          completedNodes: current.completedNodes ?? [],
          modifiers: current.modifiers ?? [],
        }
      : createInitialTeamResearch(team.id, seasonYear);
  }
  return next;
}

export function selectResearchFocus(
  research: TeamResearchState,
  branchId: RDBranchId,
  seasonYear: number,
): TeamResearchState {
  if (research.focus?.branchId === branchId) return research;
  if (research.focus && seasonYear <= research.focus.lockedThroughSeasonYear) return research;
  return {
    ...research,
    focus: {
      branchId,
      selectedSeasonYear: seasonYear,
      lockedThroughSeasonYear: seasonYear + RESEARCH_FOCUS_LOCK_SEASONS - 1,
    },
  };
}

export function tppCostForBand(band: RDCostBand): number {
  return TPP_COSTS[band];
}

export function durationRoundsForBand(band: RDDurationBand, calendarLength: number): number {
  if (band !== 'Season Project') return DURATION_ROUNDS[band];
  return Math.max(DURATION_ROUNDS[band], Math.round(calendarLength * 0.65));
}

export function cashCostForBand(
  band: RDCostBand,
  teamBudget: number,
  series: Series,
  seasonYear: number,
): number {
  const seriesFactor = series === 'F1' ? 1 : series === 'NASCAR' ? 0.55 : 0.65;
  const eraFactor = seasonYear < 2000 ? 0.75 : seasonYear < 2010 ? 0.85 : seasonYear < 2020 ? 1 : 1.15;
  const referenceBudget = Math.max(teamBudget, 30_000_000);
  const raw = referenceBudget * CASH_RATIOS[band] * seriesFactor * eraFactor;
  return Math.max(250_000, Math.round(raw / 50_000) * 50_000);
}

export function canStartFoundationProject(
  research: TeamResearchState,
  nodeId: string,
  cashAvailable: number,
  cashCost: number,
  tppCost: number,
): boolean {
  const definition = rdFoundationProjectById[nodeId];
  return !!definition
    && research.focus?.branchId === definition.branchId
    && !research.activeProjects.some((project) => project.nodeId === nodeId)
    && !research.completedNodes.some((completed) => completed.nodeId === nodeId)
    && research.activeProjects.length === 0
    && cashAvailable >= cashCost
    && research.tpp.balance >= tppCost;
}

function spendTPP(
  teamId: string,
  tpp: TeamPrincipalPointsState,
  amount: number,
  seasonYear: number,
  round: number,
  nodeId: string,
  description: string,
): TeamPrincipalPointsState {
  const balanceAfter = tpp.balance - amount;
  return {
    balance: balanceAfter,
    lifetimeEarned: tpp.lifetimeEarned,
    lifetimeSpent: tpp.lifetimeSpent + amount,
    ledger: [...tpp.ledger, {
      id: transactionId(teamId, seasonYear, round, 'research_project', tpp.ledger.length),
      seasonYear,
      round,
      amount: -amount,
      balanceAfter,
      reason: 'research_project',
      description,
      nodeId,
    }],
  };
}

export function startFoundationProject(
  research: TeamResearchState,
  definition: RDFoundationProjectDefinition,
  seasonYear: number,
  round: number,
  cashCost: number,
  durationRounds: number,
  tppCost = TPP_COSTS.Low,
): TeamResearchState {
  const project: RDActiveProject = {
    id: `${definition.nodeId}:${seasonYear}:${round}`,
    nodeId: definition.nodeId,
    teamId: research.teamId,
    startedSeasonYear: seasonYear,
    startedRound: round,
    progressRounds: 0,
    durationRounds,
    cashCost,
    tppCost,
  };
  return {
    ...research,
    tpp: spendTPP(research.teamId, research.tpp, tppCost, seasonYear, round, definition.nodeId, definition.name),
    activeProjects: [...research.activeProjects, project],
  };
}

export function progressTeamResearch(
  research: TeamResearchState,
  seasonYear: number,
  round: number,
): RDProgressResult {
  const activeProjects: RDActiveProject[] = [];
  const completedNodes = [...research.completedNodes];
  const modifiers = [...research.modifiers];
  const carRatingDeltas: Partial<CarRatings> = {};
  const completedNodeIds: string[] = [];
  const messages: string[] = [];

  for (const project of research.activeProjects) {
    const progressed = { ...project, progressRounds: project.progressRounds + 1 };
    if (progressed.progressRounds < progressed.durationRounds) {
      activeProjects.push(progressed);
      continue;
    }

    const definition = rdFoundationProjectById[project.nodeId];
    if (!definition) {
      activeProjects.push(progressed);
      continue;
    }
    completedNodes.push({ nodeId: project.nodeId, teamId: research.teamId, completedSeasonYear: seasonYear, completedRound: round });
    completedNodeIds.push(project.nodeId);
    modifiers.push({
      id: `${research.teamId}:${project.nodeId}:${seasonYear}:${round}`,
      sourceNodeId: project.nodeId,
      scope: definition.modifier.scope,
      target: definition.modifier.target,
      value: definition.modifier.value,
      description: definition.modifier.description,
      appliedSeasonYear: seasonYear,
    });
    if (definition.modifier.scope === 'car' && definition.modifier.target in ({
      enginePower: true,
      aeroEfficiency: true,
      mechanicalGrip: true,
      reliability: true,
      pitCrewOperations: true,
    } satisfies Record<keyof CarRatings, true>)) {
      const key = definition.modifier.target as keyof CarRatings;
      carRatingDeltas[key] = (carRatingDeltas[key] ?? 0) + definition.modifier.value;
    }
    messages.push(`R&D complete: ${definition.name} — ${definition.modifier.description}.`);
  }

  return {
    teamResearch: { ...research, activeProjects, completedNodes, modifiers },
    carRatingDeltas,
    completedNodeIds,
    messages,
  };
}

export function allocateSeasonTPP(research: TeamResearchState, seasonYear: number): TeamResearchState {
  const previous = research.tpp;
  const balanceAfter = previous.balance + ANNUAL_TPP_ALLOCATION;
  return {
    ...research,
    tpp: {
      balance: balanceAfter,
      lifetimeEarned: previous.lifetimeEarned + ANNUAL_TPP_ALLOCATION,
      lifetimeSpent: previous.lifetimeSpent,
      ledger: [...previous.ledger, {
        id: transactionId(research.teamId, seasonYear, 0, 'season_allocation', previous.ledger.length),
        seasonYear,
        round: 0,
        amount: ANNUAL_TPP_ALLOCATION,
        balanceAfter,
        reason: 'season_allocation',
        description: `${seasonYear} leadership allocation`,
      }],
    },
  };
}
