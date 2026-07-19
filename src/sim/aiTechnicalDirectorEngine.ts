import { developmentProjectCatalog } from '../data/development/developmentProjects';
import { AI_RD_NODE_INDEX } from '../data/rd/rdAIIndex.generated';
import type { GameState } from '../game/careerState';
import { activeDriversForTeam, carForTeam } from '../game/careerState';
import type { CarRatings, DevelopmentProject, Race, RaceResult, Team, Track } from '../types/gameTypes';
import type { AITeamArchetype, AITeamState } from '../types/aiTeamTypes';
import type { CarPart, TeamPartsState } from '../types/partsTypes';
import { PART_TYPES } from '../types/partsTypes';
import type {
  RDBranchId,
  RDCostBand,
  RDDurationBand,
  RDModifierTemplate,
  RDProjectRiskLevel,
  RDProjectStartRequest,
  TeamResearchState,
} from '../types/rdTypes';
import type { TechnicalUpgradeProgram } from '../types/technicalTypes';
import { createSeededRandom, deriveSeed } from './random';
import {
  applyDevelopmentProgress,
  computeAdjustedDuration,
  diminishingGainMultiplier,
} from './developmentEngine';
import { developmentSlots, relevantFacilityLevel } from './facilityEngine';
import {
  upgradeFromProgram,
  researchStateFromTechnical,
  researchStateForTeam,
  technicalStateWithResearch,
} from './technicalAdapters';
import {
  adjustedResearchCashCost,
  adjustedResearchDuration,
  canStartResearchProject,
  cashCostForBand,
  durationRoundsForBand,
  progressTeamResearch,
  selectResearchFocus,
  startResearchProject,
  tppCostForBand,
} from './rdEngine';
import { rdBranchWeightForSeries } from './rdNodeRules';
import { effectiveCarRatings } from './trackFitEngine';
import {
  availableSpareParts,
  ensureTeamPartsMap,
  fitPart,
  fittedPartsForDriver,
  manufacturingQuote,
  progressPartsAfterRace,
  repairQuote,
  retirePart,
  startPartManufacturing,
  startPartRepair,
} from './partsEngine';

type CompactAINode = (typeof AI_RD_NODE_INDEX)[number];

const CAR_GAIN_BY_TIER = [0, 0.12, 0.18, 0.24, 0.32, 0.42];
const SUPPORT_GAIN_BY_TIER = [0, 0.008, 0.012, 0.018, 0.025, 0.035];
export const AI_QUICK_UPGRADE_CATCH_UP_SCALE = 0.25;
const COST_BY_TIER: Record<number, RDCostBand> = { 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Very High', 5: 'Extreme' };
const DURATION_BY_TIER: Record<number, RDDurationBand> = { 1: 'Short', 2: 'Medium', 3: 'Long', 4: 'Very Long', 5: 'Season Project' };
const RISK_BY_TIER: Record<number, RDProjectRiskLevel> = { 1: 'Safe', 2: 'Standard', 3: 'Aggressive', 4: 'Aggressive', 5: 'Experimental' };

export type AITechnicalProgressResult = {
  state: GameState;
  messages: string[];
};

function branchOf(node: CompactAINode): RDBranchId {
  return node[0].split(':')[0] as RDBranchId;
}

function isHybridContext(series: GameState['series'], seasonYear: number): boolean {
  return (series === 'F1' && seasonYear >= 2014) || (series === 'IndyCar' && seasonYear >= 2024);
}

function nodeAvailable(node: CompactAINode, state: GameState): boolean {
  return node[3] === 0 || isHybridContext(state.series, state.seasonYear);
}

function modifierTemplates(
  branchId: RDBranchId,
  tier: number,
  seriesWeight: number,
  name: string,
): RDModifierTemplate[] {
  const carGain = Number((CAR_GAIN_BY_TIER[tier] * seriesWeight).toFixed(3));
  const supportGain = Number((SUPPORT_GAIN_BY_TIER[tier] * seriesWeight).toFixed(4));
  const description = `${name} (AI technical program)`;
  switch (branchId) {
    case 'engine': return [{ scope: 'car', target: 'enginePower', value: carGain, description }];
    case 'aero': return [{ scope: 'car', target: 'aeroEfficiency', value: carGain, description }];
    case 'reliability': return [{ scope: 'car', target: 'reliability', value: carGain, description }];
    case 'chassis': return [{ scope: 'car', target: 'mechanicalGrip', value: carGain, description }];
    case 'tires': return [
      { scope: 'car', target: 'mechanicalGrip', value: Number((carGain * 0.45).toFixed(3)), description },
      { scope: 'race_weekend', target: 'tireKnowledge', value: supportGain, description },
    ];
    case 'operations': return [{ scope: 'car', target: 'pitCrewOperations', value: carGain, description }];
    case 'manufacturing': return [{ scope: 'department', target: 'manufacturingQuality', value: supportGain, description }];
    case 'electronics': return [{ scope: 'race_weekend', target: 'dataAccuracy', value: supportGain, description }];
    case 'driver_staff': return [{ scope: 'department', target: 'driverFeedback', value: supportGain, description }];
    case 'commercial_political': return [{ scope: 'finance', target: 'developmentFunding', value: supportGain, description }];
  }
}

function requestForNode(node: CompactAINode, state: GameState): RDProjectStartRequest {
  const [nodeId, name, tier] = node;
  const branchId = branchOf(node);
  const seriesWeight = rdBranchWeightForSeries(branchId, state.series);
  return {
    nodeId,
    sourceId: nodeId.split(':')[1],
    nodeName: name,
    displayName: name,
    branchId,
    tier,
    path: 'AI Technical Program',
    cashCostBand: COST_BY_TIER[tier],
    tppCostBand: COST_BY_TIER[tier],
    durationBand: DURATION_BY_TIER[tier],
    riskLevel: RISK_BY_TIER[tier],
    prerequisiteGroups: [],
    prerequisiteTierCounts: [],
    available: nodeAvailable(node, state),
    availabilityLabel: nodeAvailable(node, state) ? 'Available' : 'Unavailable in this era',
    seriesWeight,
    modifierTemplates: modifierTemplates(branchId, tier, seriesWeight, name),
    contextSeries: state.series,
    contextSeasonYear: state.seasonYear,
  };
}

function focusScores(state: GameState, team: Team, ai: AITeamState | undefined): Record<RDBranchId, number> {
  const car = carForTeam(state, team.id);
  const ratings = car ? effectiveCarRatings(car) : {
    enginePower: 50, aeroEfficiency: 50, mechanicalGrip: 50, reliability: 50, pitCrewOperations: 50,
  };
  const scores: Record<RDBranchId, number> = {
    engine: 100 - ratings.enginePower,
    aero: 100 - ratings.aeroEfficiency,
    reliability: 100 - ratings.reliability,
    chassis: 100 - ratings.mechanicalGrip,
    tires: (100 - ratings.mechanicalGrip) * 0.65 + 16,
    operations: 100 - ratings.pitCrewOperations,
    manufacturing: 28,
    electronics: 25,
    driver_staff: 22,
    commercial_political: 20,
  };
  for (const branch of Object.keys(scores) as RDBranchId[]) {
    scores[branch] *= rdBranchWeightForSeries(branch, state.series);
  }
  const add = (branch: RDBranchId, value: number) => { scores[branch] += value; };
  switch (ai?.archetype) {
    case 'ChampionshipContender': add('engine', 10); add('aero', 10); add('operations', 5); break;
    case 'AmbitiousBuilder': add('manufacturing', 11); add('chassis', 7); add('aero', 6); break;
    case 'DevelopmentFocused': add('driver_staff', 12); add('manufacturing', 8); break;
    case 'FinanciallyConservative': add('reliability', 10); add('commercial_political', 8); break;
    case 'PayDriverReliant': add('commercial_political', 14); add('reliability', 5); break;
    case 'AggressiveSpender': add('engine', 12); add('aero', 12); add('electronics', 5); break;
    case 'YouthFocused': add('driver_staff', 15); add('operations', 5); break;
    case 'SurvivalMode': add('commercial_political', 15); add('reliability', 12); break;
  }
  if (ai?.goal === 'TitleChallenge' || ai?.goal === 'Podiums') { add('engine', 5); add('aero', 5); }
  if (ai?.goal === 'Survival') { add('reliability', 7); add('commercial_political', 7); }
  for (const trait of ai?.philosophy?.traits ?? []) {
    if (trait === 'TechnicalInnovator') { add('electronics', 7); add('aero', 4); }
    if (trait === 'DataDriven') add('electronics', 8);
    if (trait === 'PeopleFirst' || trait === 'StarMaker') add('driver_staff', 8);
    if (trait === 'Disciplined') { add('reliability', 5); add('manufacturing', 5); }
    if (trait === 'RiskTaker' || trait === 'Maverick') add('engine', 5);
  }
  const rng = createSeededRandom(deriveSeed(state.randomSeed, 'ai-rd-focus', team.id, state.seasonYear));
  for (const branch of Object.keys(scores) as RDBranchId[]) scores[branch] += rng.range(0, 5);
  return scores;
}

export function chooseAIResearchFocus(
  state: GameState,
  team: Team,
  research: TeamResearchState,
  ai: AITeamState | undefined,
): RDBranchId {
  if (research.focus && state.seasonYear <= research.focus.lockedThroughSeasonYear) return research.focus.branchId;
  const scores = focusScores(state, team, ai);
  return (Object.entries(scores) as Array<[RDBranchId, number]>)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
}

function targetTier(research: TeamResearchState, branchId: RDBranchId): number {
  let tier = 1;
  for (let next = 2; next <= 5; next += 1) {
    const completedPrior = research.completedNodes.filter((node) => node.branchId === branchId && node.tier === next - 1).length;
    if (completedPrior < 3) break;
    tier = next;
  }
  return tier;
}

export function chooseAIResearchRequest(
  state: GameState,
  team: Team,
  research: TeamResearchState,
): RDProjectStartRequest | undefined {
  const branchId = research.focus?.branchId;
  if (!branchId) return undefined;
  const completed = new Set(research.completedNodes.map((node) => node.nodeId));
  const active = new Set(research.activeProjects.map((project) => project.nodeId));
  const tier = targetTier(research, branchId);
  const candidates = AI_RD_NODE_INDEX
    .filter((node) => branchOf(node) === branchId && node[2] === tier && nodeAvailable(node, state))
    .filter((node) => !completed.has(node[0]) && !active.has(node[0]));
  if (candidates.length === 0) return undefined;
  return requestForNode([...candidates].sort((a, b) => {
    const ar = createSeededRandom(deriveSeed(state.randomSeed, 'ai-rd-node', team.id, state.seasonYear, a[0])).next();
    const br = createSeededRandom(deriveSeed(state.randomSeed, 'ai-rd-node', team.id, state.seasonYear, b[0])).next();
    return ar - br || a[0].localeCompare(b[0]);
  })[0], state);
}

function maxActiveProjects(ai: AITeamState | undefined): number {
  if (!ai || ai.financialHealth === 'Critical') return 0;
  if (ai.financialHealth === 'AtRisk') return 1;
  if (ai.financialHealth === 'Tight') return 1;
  if ((ai.lastConstructorPosition ?? 1) <= 2) return 1;
  if ((ai.lastConstructorPosition ?? 1) >= 6) return 2;
  // Extra parallel capacity is a catch-up/building tool. Established title
  // contenders still make high-quality choices, but cannot compound a lead by
  // running twice as many projects as most of the grid.
  return ai.archetype === 'AggressiveSpender' || ai.archetype === 'AmbitiousBuilder' ? 2 : 1;
}

function remainingTechnicalAllocation(ai: AITeamState | undefined): number {
  if (!ai) return 0;
  return Math.max(0, ai.budget.developmentSpend - (ai.technicalSpendThisSeason ?? 0));
}

function spendableCash(team: Team, ai: AITeamState | undefined): number {
  return Math.max(0, Math.min(team.budget - (ai?.budget.reserveTarget ?? 0), remainingTechnicalAllocation(ai)));
}

function upgradeRating(project: DevelopmentProject): keyof CarRatings | undefined {
  const effect = Object.keys(project.currentSeasonEffects ?? {})[0]
    ?? Object.keys(project.nextSeasonEffects ?? {})[0];
  if (effect === 'enginePower' || effect === 'aeroEfficiency' || effect === 'mechanicalGrip'
    || effect === 'reliability' || effect === 'pitCrewOperations') return effect;
  return undefined;
}

function upgradeAllowedForArchetype(
  project: DevelopmentProject,
  archetype: AITeamArchetype | undefined,
): boolean {
  if (project.horizon !== 'CurrentSeason') return false;
  if (archetype === 'SurvivalMode') return project.riskLevel === 'Safe';
  if (archetype === 'FinanciallyConservative') {
    return project.riskLevel !== 'Aggressive' && project.riskLevel !== 'Experimental';
  }
  return project.riskLevel !== 'Experimental' || archetype === 'AggressiveSpender';
}

function chooseAIUpgrade(
  state: GameState,
  team: Team,
  ai: AITeamState | undefined,
  activeProjects: readonly TechnicalUpgradeProgram[],
): DevelopmentProject | undefined {
  const car = carForTeam(state, team.id);
  if (!car) return undefined;
  const ratings = effectiveCarRatings(car);
  const activeNames = new Set(activeProjects.map((project) => project.name));
  return developmentProjectCatalog
    .filter((project) => upgradeAllowedForArchetype(project, ai?.archetype))
    .filter((project) => !activeNames.has(project.name))
    .map((project) => {
      const rating = upgradeRating(project);
      return { project, rating, deficit: rating ? 100 - ratings[rating] : -1 };
    })
    .filter((candidate): candidate is {
      project: DevelopmentProject;
      rating: keyof CarRatings;
      deficit: number;
    } => !!candidate.rating)
    .sort((a, b) => b.deficit - a.deficit
      || a.project.cost - b.project.cost
      || a.project.id.localeCompare(b.project.id))[0]?.project;
}

function quickUpgradeChance(archetype: AITeamArchetype | undefined): number {
  if (archetype === 'AggressiveSpender' || archetype === 'ChampionshipContender') return 0.45;
  if (archetype === 'AmbitiousBuilder' || archetype === 'DevelopmentFocused') return 0.35;
  if (archetype === 'SurvivalMode' || archetype === 'FinanciallyConservative') return 0.15;
  return 0.25;
}

function upgradeProgramFor(
  state: GameState,
  team: Team,
  project: DevelopmentProject,
  round: number,
): TechnicalUpgradeProgram {
  const facilityLevel = relevantFacilityLevel(state.facilities, project.category);
  return {
    kind: 'upgrade',
    id: `ai-upgrade:${team.id}:${state.seasonYear}:${round}:${project.id}`,
    teamId: team.id,
    progressTicks: 0,
    durationTicks: computeAdjustedDuration(project.durationRaces, facilityLevel, project.projectSize),
    baseDurationTicks: project.durationRaces,
    cashCost: project.cost,
    tppCost: 0,
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
    facilityLevelAtStart: facilityLevel,
  };
}

function upgradeProgramFromProject(
  project: DevelopmentProject,
  teamId: string,
): TechnicalUpgradeProgram {
  return {
    kind: 'upgrade',
    id: project.id,
    teamId,
    progressTicks: project.progressRaces,
    durationTicks: project.adjustedDurationRaces ?? project.durationRaces,
    baseDurationTicks: project.durationRaces,
    cashCost: project.cost,
    tppCost: 0,
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
  };
}

function recordTechnicalDecision(ai: AITeamState, spend: number, round: number, decision: string): AITeamState {
  return {
    ...ai,
    technicalSpendThisSeason: (ai.technicalSpendThisSeason ?? 0) + spend,
    lastTechnicalDecision: decision,
    lastTechnicalDecisionRound: round,
  };
}

function replacementThreshold(archetype: AITeamArchetype | undefined): number {
  if (archetype === 'ChampionshipContender') return 76;
  if (archetype === 'AggressiveSpender' || archetype === 'AmbitiousBuilder') return 70;
  if (archetype === 'SurvivalMode' || archetype === 'FinanciallyConservative') return 56;
  return 64;
}

function manageAIParts(
  state: GameState,
  team: Team,
  parts: TeamPartsState,
  research: TeamResearchState,
  ai: AITeamState | undefined,
  round: number,
): { parts: TeamPartsState; spend: number; decisions: string[] } {
  let working = parts;
  let spend = 0;
  const decisions: string[] = [];
  const threshold = replacementThreshold(ai?.archetype);
  for (const driver of activeDriversForTeam(state, team.id)) {
    for (const type of PART_TYPES) {
      const fitted = fittedPartsForDriver(working, driver.id).find((part) => part.type === type);
      const spare = availableSpareParts(working, type)[0];
      if (spare && (!fitted || (fitted.condition < threshold && spare.condition >= fitted.condition + 8))) {
        working = fitPart(working, spare.id, driver.id, state.seasonYear, round);
        decisions.push(`fitted ${spare.name}`);
      }
    }
  }

  const repairCandidate = working.inventory
    .filter((part) => part.status === 'spare' && part.condition < 72 && part.condition >= 20)
    .sort((a, b) => a.condition - b.condition)[0];
  if (repairCandidate) {
    const quote = repairQuote(repairCandidate);
    if (quote.cost <= Math.max(0, spendableCash(team, ai) - spend)) {
      const repaired = startPartRepair(working, repairCandidate.id);
      if (repaired !== working) {
        working = repaired;
        spend += quote.cost;
        decisions.push(`sent ${repairCandidate.name} for repair`);
      }
    }
  }

  const retireCandidates = working.inventory.filter((part) =>
    part.status === 'spare' && (part.condition < 18 || (part.maximumCondition <= 76 && part.condition < 38)));
  for (const part of retireCandidates) {
    working = retirePart(working, part.id, state.seasonYear, round);
    decisions.push(`retired ${part.name}`);
  }

  const queueLimit = ai?.financialHealth === 'Tight' || ai?.archetype === 'SurvivalMode'
    ? 1
    : ai?.archetype === 'AggressiveSpender' || ai?.archetype === 'ChampionshipContender' ? 3 : 2;
  const priorities = PART_TYPES.map((type) => {
    const spares = availableSpareParts(working, type).filter((part) => part.condition >= 45);
    const fitted = working.inventory.filter((part) => part.type === type && part.status === 'fitted');
    const worstFitted = fitted.reduce((worst, part) => Math.min(worst, part.condition), 100);
    return { type, urgency: (spares.length === 0 ? 100 : 0) + Math.max(0, 65 - worstFitted) };
  }).sort((a, b) => b.urgency - a.urgency || a.type.localeCompare(b.type));
  for (const priority of priorities) {
    if (priority.urgency <= 0 || working.manufacturingQueue.length >= queueLimit) break;
    if (working.manufacturingQueue.some((order) => order.type === priority.type)) continue;
    const order = manufacturingQuote(working, priority.type, 1, research, state.seasonYear, round);
    if (order.cost > Math.max(0, spendableCash(team, ai) - spend)) continue;
    working = startPartManufacturing(working, order);
    spend += order.cost;
    decisions.push(`ordered ${order.quantity} ${priority.type.replace('_', ' ')}`);
  }
  return { parts: working, spend, decisions };
}

export function planAITechnicalPrograms(state: GameState, teamIds?: readonly string[]): GameState {
  const allowed = teamIds ? new Set(teamIds) : undefined;
  let teams = [...state.teams];
  const teamTechnical = { ...(state.teamTechnical ?? {}) };
  const teamParts = ensureTeamPartsMap(state.teamParts, teams, state.drivers, state.seasonYear);
  const aiTeamStates = { ...(state.aiTeamStates ?? {}) };
  const round = state.calendar[state.currentRaceIndex]?.round ?? state.currentRaceIndex + 1;

  for (const originalTeam of teams) {
    if (originalTeam.id === state.selectedTeamId || (allowed && !allowed.has(originalTeam.id))) continue;
    let team = teams.find((candidate) => candidate.id === originalTeam.id)!;
    let research = researchStateFromTechnical(teamTechnical[team.id]);
    let ai = aiTeamStates[team.id];
    if (!research || !ai) continue;
    const focus = chooseAIResearchFocus({ ...state, teams }, team, research, ai);
    research = selectResearchFocus(research, focus, state.seasonYear);

    const maxActive = maxActiveProjects(ai);
    const currentTechnical = teamTechnical[team.id];
    const activeUpgrades = (currentTechnical?.activeProjects ?? [])
      .filter((program): program is TechnicalUpgradeProgram => program.kind === 'upgrade');
    const upgradeRoll = createSeededRandom(
      deriveSeed(state.randomSeed, 'ai-quick-upgrade', team.id, state.seasonYear),
    ).next();
    const upgrade = upgradeRoll < quickUpgradeChance(ai?.archetype)
      ? chooseAIUpgrade({ ...state, teams }, team, ai, activeUpgrades)
      : undefined;
    if (upgrade && (currentTechnical?.activeProjects.length ?? 0) < Math.min(maxActive, developmentSlots(state.facilities))
      && upgrade.cost <= spendableCash(team, ai)) {
      const program = upgradeProgramFor({ ...state, teams }, team, upgrade, round);
      teamTechnical[team.id] = {
        ...(currentTechnical ?? {
          teamId: team.id,
          tpp: research.tpp,
          focus: research.focus,
          activeProjects: [],
          completedPrograms: [],
          modifiers: research.modifiers,
        }),
        activeProjects: [...(currentTechnical?.activeProjects ?? []), program],
      };
      team = { ...team, budget: team.budget - upgrade.cost };
      ai = recordTechnicalDecision(ai, upgrade.cost, round, `Started ${upgrade.name}`);
      teams = teams.map((candidate) => candidate.id === team.id ? team : candidate);
    }

    const upgradeCount = teamTechnical[team.id]?.activeProjects
      .filter((program) => program.kind === 'upgrade').length ?? 0;
    while (research.activeProjects.length + upgradeCount < maxActive) {
      const request = chooseAIResearchRequest({ ...state, teams }, team, research);
      if (!request) break;
      const baseCost = cashCostForBand(request.cashCostBand, team.budget, state.series, state.seasonYear);
      const cashCost = adjustedResearchCashCost(baseCost, research);
      const tppCost = tppCostForBand(request.tppCostBand);
      const duration = adjustedResearchDuration(durationRoundsForBand(request.durationBand, state.calendar.length), research);
      if (cashCost > spendableCash(team, ai)
        || !canStartResearchProject(research, request, team.budget, cashCost, tppCost, maxActive)) break;
      research = startResearchProject(research, request, state.seasonYear, round, cashCost, duration, tppCost);
      team = { ...team, budget: team.budget - cashCost };
      ai = recordTechnicalDecision(ai, cashCost, round, `Started ${request.displayName}`);
      teams = teams.map((candidate) => candidate.id === team.id ? team : candidate);
    }

    const partsDecision = manageAIParts({ ...state, teams, teamParts }, team, teamParts[team.id], research, ai, round);
    if (partsDecision.spend > 0 || partsDecision.decisions.length > 0) {
      team = { ...team, budget: team.budget - partsDecision.spend };
      ai = recordTechnicalDecision(
        ai,
        partsDecision.spend,
        round,
        partsDecision.decisions.join('; '),
      );
      teams = teams.map((candidate) => candidate.id === team.id ? team : candidate);
    }
    const updatedTechnical = teamTechnical[team.id];
    if (updatedTechnical) teamTechnical[team.id] = technicalStateWithResearch(updatedTechnical, research);
    teamParts[team.id] = partsDecision.parts;
    aiTeamStates[team.id] = ai;
  }

  return { ...state, teams, teamTechnical, teamParts, aiTeamStates };
}

function applyCarDeltas(
  state: GameState,
  teamId: string,
  deltas: Partial<CarRatings>,
  catchUpScale = 1,
): GameState['cars'] {
  const priorPosition = state.aiTeamStates?.[teamId]?.lastConstructorPosition;
  const gridFraction = priorPosition == null || state.teams.length <= 1
    ? 0.4
    : Math.max(0, Math.min(1, (priorPosition - 1) / (state.teams.length - 1)));
  // Represents the extra development efficiency available to teams trying to
  // close a deficit (including era-appropriate testing/concession effects).
  // The wide range compensates for the deliberately small per-node gains and
  // scales smoothly by grid position instead of using series-specific cutoffs.
  const catchUpMultiplier = 0.15 + gridFraction * 59.85;
  return state.cars.map((car) => {
    if (car.teamId !== teamId) return car;
    const developmentLevel = { ...car.developmentLevel };
    for (const [key, value] of Object.entries(deltas)) {
      const rating = key as keyof CarRatings;
      const current = car.ratings[rating] + (developmentLevel[rating] ?? 0);
      developmentLevel[rating] = (developmentLevel[rating] ?? 0)
        + (value ?? 0) * catchUpMultiplier * catchUpScale * diminishingGainMultiplier(current);
    }
    return { ...car, developmentLevel };
  });
}

export function progressAITechnicalProgramsAfterRace(
  state: GameState,
  race: Race,
  results: RaceResult[],
  track: Track,
): AITechnicalProgressResult {
  let working: GameState = {
    ...state,
    teamParts: ensureTeamPartsMap(state.teamParts, state.teams, state.drivers, state.seasonYear),
  };
  const messages: string[] = [];
  for (const team of working.teams) {
    if (team.id === working.selectedTeamId) continue;
    const research = researchStateFromTechnical(working.teamTechnical?.[team.id]);
    if (!research) continue;
    const technical = working.teamTechnical?.[team.id];
    const upgradePrograms = (technical?.activeProjects ?? [])
      .filter((program): program is TechnicalUpgradeProgram => program.kind === 'upgrade');
    if (upgradePrograms.length > 0) {
      const car = carForTeam(working, team.id);
      if (car) {
        const upgradeTick = applyDevelopmentProgress(
          upgradePrograms.map((program) => upgradeFromProgram(program)),
          car,
          working.randomSeed,
          race.round,
        );
        if (Object.keys(upgradeTick.carRatingDeltas).length > 0) {
          working = {
            ...working,
            cars: applyCarDeltas(
              working,
              team.id,
              upgradeTick.carRatingDeltas,
              AI_QUICK_UPGRADE_CATCH_UP_SCALE,
            ),
          };
        }
        const activeUpgrades = upgradeTick.active.map((project) => upgradeProgramFromProject(project, team.id));
        const completedUpgrades = upgradeTick.completed.map((project) => ({
          kind: 'upgrade' as const,
          id: project.id,
          teamId: team.id,
          completedTicks: project.progressRaces,
          program: upgradeProgramFromProject(project, team.id),
        }));
        working = {
          ...working,
          teamTechnical: {
            ...working.teamTechnical,
            [team.id]: {
              ...working.teamTechnical![team.id],
              activeProjects: [
                ...working.teamTechnical![team.id].activeProjects.filter((program) => program.kind === 'research'),
                ...activeUpgrades,
              ],
              completedPrograms: [
                ...working.teamTechnical![team.id].completedPrograms.filter((program) => program.kind === 'research'),
                ...completedUpgrades,
              ],
            },
          },
        };
        if (upgradeTick.completed.length > 0) {
          messages.push(`${team.name} completes ${upgradeTick.completed.length === 1
            ? upgradeTick.completed[0].name
            : `${upgradeTick.completed.length} quick upgrades`}.`);
        }
      }
    }
    if (research.activeProjects.length > 0) {
      const ai = working.aiTeamStates?.[team.id];
      const support = ((working.teamOrgRatings?.[team.id]?.research ?? 50) - 50) / 500
        + ((ai?.principalAttributes?.development ?? 50) - 50) / 600;
      const tick = progressTeamResearch(research, working.seasonYear, race.round, working.randomSeed, support);
      working = {
        ...working,
        cars: applyCarDeltas(working, team.id, tick.carRatingDeltas),
        teamTechnical: working.teamTechnical
          ? {
            ...working.teamTechnical,
            [team.id]: technicalStateWithResearch(working.teamTechnical[team.id], tick.teamResearch),
          }
          : working.teamTechnical,
      };
      if (tick.completedNodeIds.length > 0) {
        messages.push(`${team.name} completes ${tick.completedNodeIds.length === 1 ? tick.teamResearch.projectHistory.at(-1)?.nodeName ?? 'an R&D project' : `${tick.completedNodeIds.length} R&D projects`}.`);
      }
    }
    const parts = working.teamParts![team.id];
    const partsTick = progressPartsAfterRace(parts, results, track, working.seasonYear, race.round);
    working = { ...working, teamParts: { ...working.teamParts, [team.id]: partsTick.state } };
  }
  working = planAITechnicalPrograms(working);
  return {
    state: working,
    messages: messages.slice(0, 5),
  };
}

export function aiTechnicalSummary(state: GameState, teamId: string): {
  focus?: RDBranchId;
  activeProjects: number;
  completedProjects: number;
  factoryOrders: number;
  criticalParts: number;
  spend: number;
  lastDecision?: string;
} {
  const research = researchStateForTeam(state, teamId);
  const parts = state.teamParts?.[teamId];
  return {
    focus: research?.focus?.branchId,
    activeProjects: research?.activeProjects.length ?? 0,
    completedProjects: research?.completedNodes.length ?? 0,
    factoryOrders: parts?.manufacturingQueue.length ?? 0,
    criticalParts: parts?.inventory.filter((part: CarPart) => part.status === 'fitted' && part.condition < 30).length ?? 0,
    spend: state.aiTeamStates?.[teamId]?.technicalSpendThisSeason ?? 0,
    lastDecision: state.aiTeamStates?.[teamId]?.lastTechnicalDecision,
  };
}
