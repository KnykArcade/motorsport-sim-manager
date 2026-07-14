import type { CarRatings, DevelopmentOutcome, Series, Team } from '../types/gameTypes';
import type {
  RDActiveProject,
  RDBranchId,
  RDCostBand,
  RDDurationBand,
  RDModifierScope,
  RDProgressResult,
  RDProjectRiskLevel,
  RDProjectStartRequest,
  TeamPrincipalPointReason,
  TeamPrincipalPointsState,
  TeamResearchMap,
  TeamResearchState,
} from '../types/rdTypes';
import {
  rdFoundationProjectById,
  type RDFoundationProjectDefinition,
} from '../data/rd/rdFoundationCatalog';
import { createSeededRandom, deriveSeed } from './random';
import { evaluateRDRequestUnlock } from './rdNodeRules';

export const INITIAL_TPP_BALANCE = 30;
export const ANNUAL_TPP_ALLOCATION = 20;
export const RESEARCH_FOCUS_LOCK_SEASONS = 3;

const TPP_COSTS: Record<RDCostBand, number> = {
  Low: 5, Medium: 10, High: 18, 'Very High': 28, Extreme: 40,
};

const CASH_RATIOS: Record<RDCostBand, number> = {
  Low: 0.018, Medium: 0.032, High: 0.05, 'Very High': 0.075, Extreme: 0.11,
};

const DURATION_ROUNDS: Record<RDDurationBand, number> = {
  Short: 2, Medium: 3, Long: 5, 'Very Long': 7, 'Season Project': 10,
};

const RD_OUTCOME_LABELS: Record<DevelopmentOutcome, string> = {
  GreatSuccess: 'Breakthrough', FullSuccess: 'Full Success', PartialSuccess: 'Partial Success',
  MinorSuccess: 'Minor Success', Failed: 'Failed', RareBackfire: 'Backfire',
};

const RD_OUTCOME_MULTIPLIERS: Record<DevelopmentOutcome, number> = {
  GreatSuccess: 1.4, FullSuccess: 1, PartialSuccess: 0.6,
  MinorSuccess: 0.25, Failed: 0, RareBackfire: -0.25,
};

const RD_OUTCOME_CHANCES: Record<RDProjectRiskLevel, Record<DevelopmentOutcome, number>> = {
  Safe: { GreatSuccess: 0.08, FullSuccess: 0.65, PartialSuccess: 0.2, MinorSuccess: 0.05, Failed: 0.02, RareBackfire: 0 },
  Standard: { GreatSuccess: 0.1, FullSuccess: 0.55, PartialSuccess: 0.2, MinorSuccess: 0.08, Failed: 0.06, RareBackfire: 0.01 },
  Aggressive: { GreatSuccess: 0.15, FullSuccess: 0.4, PartialSuccess: 0.2, MinorSuccess: 0.1, Failed: 0.12, RareBackfire: 0.03 },
  Experimental: { GreatSuccess: 0.2, FullSuccess: 0.3, PartialSuccess: 0.18, MinorSuccess: 0.1, Failed: 0.15, RareBackfire: 0.07 },
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
    projectHistory: [],
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
    if (!current) {
      next[team.id] = createInitialTeamResearch(team.id, seasonYear);
      continue;
    }
    next[team.id] = {
      ...current,
      teamId: team.id,
      tpp: {
        ...current.tpp,
        ledger: current.tpp.ledger ?? [],
        lifetimeEarned: current.tpp.lifetimeEarned ?? current.tpp.balance,
        lifetimeSpent: current.tpp.lifetimeSpent ?? 0,
      },
      activeProjects: (current.activeProjects ?? []).map((project) => {
        const legacy = rdFoundationProjectById[project.nodeId];
        return {
          ...project,
          nodeName: project.nodeName ?? legacy?.name ?? project.nodeId,
          sourceId: project.sourceId ?? legacy?.sourceId ?? project.nodeId.split(':')[1],
          branchId: project.branchId ?? legacy?.branchId ?? project.nodeId.split(':')[0] as RDBranchId,
          tier: project.tier ?? 1,
          path: project.path ?? 'Foundation',
          riskLevel: project.riskLevel ?? 'Safe',
          seriesWeight: project.seriesWeight ?? 1,
          modifierTemplates: project.modifierTemplates ?? (legacy ? [legacy.modifier] : []),
        };
      }),
      completedNodes: (current.completedNodes ?? []).map((node) => {
        const legacy = rdFoundationProjectById[node.nodeId];
        return {
          ...node,
          sourceId: node.sourceId ?? legacy?.sourceId ?? node.nodeId.split(':')[1],
          branchId: node.branchId ?? legacy?.branchId ?? node.nodeId.split(':')[0] as RDBranchId,
          tier: node.tier ?? 1,
        };
      }),
      modifiers: current.modifiers ?? [],
      projectHistory: current.projectHistory ?? [],
    };
  }
  return next;
}

export function selectResearchFocus(research: TeamResearchState, branchId: RDBranchId, seasonYear: number): TeamResearchState {
  if (research.focus?.branchId === branchId) return research;
  if (research.focus && seasonYear <= research.focus.lockedThroughSeasonYear) return research;
  return {
    ...research,
    focus: { branchId, selectedSeasonYear: seasonYear, lockedThroughSeasonYear: seasonYear + RESEARCH_FOCUS_LOCK_SEASONS - 1 },
  };
}

export function tppCostForBand(band: RDCostBand): number {
  return TPP_COSTS[band];
}

export function durationRoundsForBand(band: RDDurationBand, calendarLength: number): number {
  return band === 'Season Project' ? Math.max(DURATION_ROUNDS[band], Math.round(calendarLength * 0.65)) : DURATION_ROUNDS[band];
}

export function cashCostForBand(band: RDCostBand, teamBudget: number, series: Series, seasonYear: number): number {
  const seriesFactor = series === 'F1' ? 1 : series === 'NASCAR' ? 0.55 : 0.65;
  const eraFactor = seasonYear < 2000 ? 0.75 : seasonYear < 2010 ? 0.85 : seasonYear < 2020 ? 1 : 1.15;
  const referenceBudget = Math.max(teamBudget, 30_000_000);
  const raw = referenceBudget * CASH_RATIOS[band] * seriesFactor * eraFactor;
  return Math.max(250_000, Math.round(raw / 50_000) * 50_000);
}

export function researchModifierTotal(research: TeamResearchState, scope: RDModifierScope, target: string): number {
  return research.modifiers
    .filter((modifier) => modifier.scope === scope && modifier.target === target)
    .reduce((sum, modifier) => sum + modifier.value, 0);
}

export function adjustedResearchCashCost(baseCost: number, research: TeamResearchState): number {
  const reduction = Math.max(-0.15, Math.min(0.25, researchModifierTotal(research, 'finance', 'developmentFunding')));
  return Math.max(100_000, Math.round((baseCost * (1 - reduction)) / 50_000) * 50_000);
}

export function adjustedResearchDuration(baseDuration: number, research: TeamResearchState): number {
  const reduction = Math.max(-0.15, Math.min(0.25, researchModifierTotal(research, 'department', 'manufacturingQuality')));
  return Math.max(1, Math.round(baseDuration * (1 - reduction)));
}

export function canStartResearchProject(
  research: TeamResearchState,
  request: RDProjectStartRequest,
  cashAvailable: number,
  cashCost: number,
  tppCost: number,
  maxActiveProjects: number,
): boolean {
  return evaluateRDRequestUnlock(request, research).unlocked
    && !research.activeProjects.some((project) => project.nodeId === request.nodeId)
    && !research.completedNodes.some((completed) => completed.nodeId === request.nodeId)
    && research.activeProjects.length < maxActiveProjects
    && cashAvailable >= cashCost
    && research.tpp.balance >= tppCost;
}

function legacyFoundationRequest(definition: RDFoundationProjectDefinition): RDProjectStartRequest {
  return {
    nodeId: definition.nodeId, sourceId: definition.sourceId, nodeName: definition.name, displayName: definition.name,
    branchId: definition.branchId, tier: 1, path: 'Foundation', cashCostBand: 'Low', tppCostBand: 'Low',
    durationBand: 'Short', riskLevel: 'Safe', prerequisiteGroups: [], prerequisiteTierCounts: [],
    available: true, availabilityLabel: 'Native era fit', seriesWeight: 1,
    modifierTemplates: [definition.modifier],
  };
}

export function canStartFoundationProject(
  research: TeamResearchState,
  nodeId: string,
  cashAvailable: number,
  cashCost: number,
  tppCost: number,
): boolean {
  const definition = rdFoundationProjectById[nodeId];
  return !!definition && canStartResearchProject(research, legacyFoundationRequest(definition), cashAvailable, cashCost, tppCost, 1);
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

export function startResearchProject(
  research: TeamResearchState,
  request: RDProjectStartRequest,
  seasonYear: number,
  round: number,
  cashCost: number,
  durationRounds: number,
  tppCost: number,
): TeamResearchState {
  const project: RDActiveProject = {
    id: `${request.nodeId}:${seasonYear}:${round}:${research.projectHistory.length}`,
    nodeId: request.nodeId,
    teamId: research.teamId,
    startedSeasonYear: seasonYear,
    startedRound: round,
    progressRounds: 0,
    durationRounds,
    cashCost,
    tppCost,
    nodeName: request.displayName,
    sourceId: request.sourceId,
    branchId: request.branchId,
    tier: request.tier,
    path: request.path,
    riskLevel: request.riskLevel,
    seriesWeight: request.seriesWeight,
    modifierTemplates: request.modifierTemplates,
  };
  return {
    ...research,
    tpp: spendTPP(research.teamId, research.tpp, tppCost, seasonYear, round, request.nodeId, request.displayName),
    activeProjects: [...research.activeProjects, project],
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
  return startResearchProject(research, legacyFoundationRequest(definition), seasonYear, round, cashCost, durationRounds, tppCost);
}

function rollRDOutcome(
  riskLevel: RDProjectRiskLevel,
  seed: string,
  project: RDActiveProject,
  seasonYear: number,
  round: number,
  successBonus: number,
): DevelopmentOutcome {
  const chances = { ...RD_OUTCOME_CHANCES[riskLevel] };
  const bonus = Math.max(-0.12, Math.min(0.2, successBonus));
  chances.FullSuccess = Math.max(0, chances.FullSuccess + bonus * 0.7);
  chances.GreatSuccess = Math.max(0, chances.GreatSuccess + bonus * 0.3);
  chances.Failed = Math.max(0, chances.Failed - bonus * 0.7);
  chances.RareBackfire = Math.max(0, chances.RareBackfire - bonus * 0.3);
  const total = Object.values(chances).reduce((sum, value) => sum + value, 0);
  const rng = createSeededRandom(deriveSeed(seed, 'rd-outcome', project.teamId, project.nodeId, seasonYear, round));
  const roll = rng.next();
  let cumulative = 0;
  const order: DevelopmentOutcome[] = ['GreatSuccess', 'FullSuccess', 'PartialSuccess', 'MinorSuccess', 'Failed', 'RareBackfire'];
  for (const outcome of order) {
    cumulative += chances[outcome] / total;
    if (roll <= cumulative) return outcome;
  }
  return 'Failed';
}

export function progressTeamResearch(
  research: TeamResearchState,
  seasonYear: number,
  round: number,
  seed = 'rd',
  successBonus = 0,
): RDProgressResult {
  const activeProjects: RDActiveProject[] = [];
  const completedNodes = [...research.completedNodes];
  const modifiers = [...research.modifiers];
  const projectHistory = [...research.projectHistory];
  const carRatingDeltas: Partial<CarRatings> = {};
  const completedNodeIds: string[] = [];
  const messages: string[] = [];

  for (const project of research.activeProjects) {
    const progressed = { ...project, progressRounds: project.progressRounds + 1 };
    if (progressed.progressRounds < progressed.durationRounds) {
      activeProjects.push(progressed);
      continue;
    }

    const legacy = rdFoundationProjectById[project.nodeId];
    const nodeName = project.nodeName ?? legacy?.name ?? project.nodeId;
    const templates = project.modifierTemplates ?? (legacy ? [legacy.modifier] : []);
    const outcome = rollRDOutcome(project.riskLevel ?? 'Standard', seed, project, seasonYear, round, successBonus);
    const multiplier = RD_OUTCOME_MULTIPLIERS[outcome];
    const appliedModifiers = templates
      .filter(() => multiplier !== 0)
      .map((template, index) => ({
        id: `${research.teamId}:${project.nodeId}:${seasonYear}:${round}:${index}`,
        sourceNodeId: project.nodeId,
        scope: template.scope,
        target: template.target,
        value: Number((template.value * multiplier).toFixed(4)),
        description: `${template.description} — ${RD_OUTCOME_LABELS[outcome]}`,
        appliedSeasonYear: seasonYear,
      }));
    const outcomeResult = {
      outcome,
      multiplier,
      label: RD_OUTCOME_LABELS[outcome],
      description: outcome === 'Failed'
        ? 'The project did not produce a usable result and may be attempted again.'
        : outcome === 'RareBackfire'
          ? 'The concept created a setback and remains incomplete.'
          : `The project delivered ${Math.round(multiplier * 100)}% of its planned effect.`,
      appliedModifiers,
    };
    const completed = outcome !== 'Failed' && outcome !== 'RareBackfire';
    if (completed) {
      completedNodes.push({
        nodeId: project.nodeId,
        teamId: research.teamId,
        completedSeasonYear: seasonYear,
        completedRound: round,
        sourceId: project.sourceId ?? project.nodeId.split(':')[1],
        branchId: project.branchId ?? project.nodeId.split(':')[0] as RDBranchId,
        tier: project.tier ?? 1,
        outcomeResult,
      });
      completedNodeIds.push(project.nodeId);
    }
    modifiers.push(...appliedModifiers);
    for (const modifier of appliedModifiers) {
      if (modifier.scope === 'car' && modifier.target in ({
        enginePower: true, aeroEfficiency: true, mechanicalGrip: true,
        reliability: true, pitCrewOperations: true,
      } satisfies Record<keyof CarRatings, true>)) {
        const key = modifier.target as keyof CarRatings;
        carRatingDeltas[key] = (carRatingDeltas[key] ?? 0) + modifier.value;
      }
    }
    projectHistory.push({ projectId: project.id, nodeId: project.nodeId, nodeName, seasonYear, round, outcomeResult, completed });
    messages.push(`R&D ${completed ? 'complete' : 'result'}: ${nodeName} — ${outcomeResult.label}. ${outcomeResult.description}`);
  }

  return {
    teamResearch: { ...research, activeProjects, completedNodes, modifiers, projectHistory },
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
