// Technical Director's Briefing: deterministic, read-only proposal engine.
// Reads the current state and suggests concrete technical actions the player
// can approve with one click. Approving dispatches the same reducer actions
// the full screens use, so outcomes are identical to acting manually.

import type { GameState } from '../game/careerState';
import type { GameAction } from '../game/gameReducer';
import type { CarRatings, DevelopmentProject } from '../types/gameTypes';
import { developmentProjectCatalog } from '../data/development/developmentProjects';
import { isDevelopmentProjectAllowedForMode, isSingleSeasonMode } from '../game/modeRestrictions';
import { canUpgrade, developmentSlots, upgradeCostFor, FACILITY_SPECS } from './facilityEngine';
import { availableSpareParts, carWithFittedParts, latestPartDesign, manufacturingQuote, repairQuote } from './partsEngine';
import { PART_TYPES } from '../types/partsTypes';
import { effectiveCarRatings } from './trackFitEngine';
import { activeUpgradePrograms, researchStateForTeam, technicalStateForTeam } from './technicalAdapters';
import { chooseAIResearchRequest } from './aiTechnicalDirectorEngine';
import { adjustedResearchCashCost, adjustedResearchDuration, cashCostForBand, durationRoundsForBand, tppCostForBand } from './rdEngine';
import { activeDriversForTeam } from '../game/careerState';

export type TechnicalProposalKind = 'repair' | 'development' | 'research' | 'manufacture' | 'facility';

export type TechnicalProposal = {
  id: string;
  kind: TechnicalProposalKind;
  title: string;
  reason: string;
  costLabel: string;
  durationLabel: string;
  /** Technical Center tab holding the full controls for this proposal. */
  section: 'development' | 'parts' | 'facilities';
  action: GameAction;
};

const RATING_KEYS = ['enginePower', 'aeroEfficiency', 'mechanicalGrip', 'reliability'] as const;
type RatingKey = (typeof RATING_KEYS)[number];

const RATING_LABELS: Record<RatingKey, string> = {
  enginePower: 'Power unit',
  aeroEfficiency: 'Aero',
  mechanicalGrip: 'Mechanical grip',
  reliability: 'Reliability',
};

const REPAIR_CONDITION_THRESHOLD = 40;
const MAX_PROPOSALS = 5;

function money(amount: number): string {
  return `$${(amount / 1_000_000).toFixed(1)}M`;
}

function weakestRating(ratings: CarRatings): RatingKey {
  return [...RATING_KEYS].sort((a, b) => ratings[a] - ratings[b])[0];
}

function projectGainFor(project: DevelopmentProject, rating: RatingKey): number {
  return (project.currentSeasonEffects?.[rating] ?? 0) + (project.nextSeasonEffects?.[rating] ?? 0) * 0.5;
}

function repairProposals(state: GameState, budget: number): TechnicalProposal[] {
  const parts = state.teamParts?.[state.selectedTeamId];
  if (!parts) return [];
  const drivers = activeDriversForTeam(state, state.selectedTeamId);
  const driverName = (driverId: string | undefined) => drivers.find((driver) => driver.id === driverId)?.name;
  return parts.inventory
    .filter((part) => part.status === 'fitted' && part.condition < REPAIR_CONDITION_THRESHOLD)
    .sort((a, b) => a.condition - b.condition)
    .slice(0, 2)
    .map((part) => {
      const quote = repairQuote(part);
      if (quote.cost > budget) return undefined;
      const fittedTo = driverName(part.fittedDriverId);
      return {
        id: `advisor-repair-${part.id}`,
        kind: 'repair' as const,
        title: `Repair ${part.name}`,
        reason: `At ${Math.round(part.condition)}% condition${fittedTo ? ` on ${fittedTo}'s car` : ''} — a failure risk if left on the car.`,
        costLabel: money(quote.cost),
        durationLabel: `${quote.rounds} round${quote.rounds === 1 ? '' : 's'}`,
        section: 'parts' as const,
        action: { type: 'REPAIR_PART', partId: part.id } satisfies GameAction,
      };
    })
    .filter((proposal): proposal is NonNullable<typeof proposal> => !!proposal);
}

function developmentProposal(state: GameState, budget: number, freeSlots: number): TechnicalProposal | undefined {
  if (freeSlots <= 0) return undefined;
  const team = state.teams.find((candidate) => candidate.id === state.selectedTeamId);
  const baseCar = state.cars.find((car) => car.id === team?.carId);
  if (!baseCar) return undefined;
  const drivers = activeDriversForTeam(state, state.selectedTeamId);
  const parts = state.teamParts?.[state.selectedTeamId];
  const ratings = effectiveCarRatings(carWithFittedParts(baseCar, parts, drivers[0]?.id ?? ''));
  const target = weakestRating(ratings);
  const activeIds = new Set(activeUpgradePrograms(state).map((project) => project.id.replace(/-\d+$/, '')));
  const candidate = developmentProjectCatalog
    .filter((project) => isDevelopmentProjectAllowedForMode(project, state.gameMode))
    .filter((project) => project.cost <= budget && !activeIds.has(project.id))
    .filter((project) => projectGainFor(project, target) > 0)
    .sort((a, b) => projectGainFor(b, target) - projectGainFor(a, target) || a.cost - b.cost)[0];
  if (!candidate) return undefined;
  return {
    id: `advisor-dev-${candidate.id}`,
    kind: 'development',
    title: `Start ${candidate.name}`,
    reason: `${RATING_LABELS[target]} is the car's weakest area at ${ratings[target].toFixed(1)}.`,
    costLabel: money(candidate.cost),
    durationLabel: `${candidate.durationRaces} races`,
    section: 'development',
    action: { type: 'START_DEVELOPMENT', projectId: candidate.id } satisfies GameAction,
  };
}

function researchProposal(state: GameState, budget: number, freeSlots: number): TechnicalProposal | undefined {
  if (freeSlots <= 0 || isSingleSeasonMode(state.gameMode)) return undefined;
  const team = state.teams.find((candidate) => candidate.id === state.selectedTeamId);
  const research = researchStateForTeam(state, state.selectedTeamId);
  if (!team || !research?.focus?.branchId) return undefined;
  const request = chooseAIResearchRequest(state, team, research);
  if (!request) return undefined;
  const cashCost = adjustedResearchCashCost(cashCostForBand(request.cashCostBand, team.budget, state.series, state.seasonYear), research);
  const tppCost = tppCostForBand(request.tppCostBand);
  if (cashCost > budget || tppCost > research.tpp.balance) return undefined;
  const durationRounds = adjustedResearchDuration(durationRoundsForBand(request.durationBand, state.calendar.length), research);
  return {
    id: `advisor-rd-${request.nodeId}`,
    kind: 'research',
    title: `Research ${request.displayName}`,
    reason: `Next step in the ${request.branchId} focus — tier ${request.tier} of the tree.`,
    costLabel: `${money(cashCost)} · ${tppCost} TPP`,
    durationLabel: `${durationRounds} rounds`,
    section: 'development',
    action: { type: 'START_RD_PROJECT', request } satisfies GameAction,
  };
}

function manufactureProposal(state: GameState, budget: number): TechnicalProposal | undefined {
  const parts = state.teamParts?.[state.selectedTeamId];
  if (!parts || parts.manufacturingQueue.length >= 3) return undefined;
  const technical = technicalStateForTeam(state, state.selectedTeamId);
  const round = state.currentRaceIndex + 1;
  for (const type of PART_TYPES) {
    if (availableSpareParts(parts, type).length > 0) continue;
    if (parts.manufacturingQueue.some((order) => order.type === type)) continue;
    const design = latestPartDesign(type, technical);
    const order = manufacturingQuote(parts, type, 1, technical, state.seasonYear, round);
    if (order.cost > budget) continue;
    return {
      id: `advisor-build-${type}`,
      kind: 'manufacture',
      title: `Build spare ${type.replace(/_/g, ' ')}`,
      reason: `No spare in stock — a failure would leave the car without a replacement. Latest design: generation ${design.designGeneration}.`,
      costLabel: money(order.cost),
      durationLabel: `${order.totalRounds} round${order.totalRounds === 1 ? '' : 's'}`,
      section: 'parts',
      action: { type: 'START_PART_MANUFACTURING', partType: type, quantity: 1 } satisfies GameAction,
    };
  }
  return undefined;
}

function facilityProposal(state: GameState, budget: number): TechnicalProposal | undefined {
  const facilities = state.facilities;
  if (!facilities) return undefined;
  const candidate = facilities.facilities
    .filter((facility) => canUpgrade(facility))
    .filter((facility) => !facilities.pendingUpgrades.some((upgrade) => upgrade.facilityId === facility.id))
    // Only suggest facility spend when it leaves comfortable headroom.
    .filter((facility) => upgradeCostFor(facility) * 1_000_000 * 2 <= budget)
    .sort((a, b) => a.level - b.level || upgradeCostFor(a) - upgradeCostFor(b))[0];
  if (!candidate) return undefined;
  const cost = upgradeCostFor(candidate) * 1_000_000;
  return {
    id: `advisor-facility-${candidate.id}`,
    kind: 'facility',
    title: `Upgrade ${FACILITY_SPECS[candidate.type].label} to L${candidate.level + 1}`,
    reason: `Lowest-level facility (L${candidate.level}) and the budget has headroom for infrastructure.`,
    costLabel: money(cost),
    durationLabel: `${candidate.upgradeDurationWeeks} weeks`,
    section: 'facilities',
    action: { type: 'UPGRADE_FACILITY', facilityId: candidate.id } satisfies GameAction,
  };
}

/**
 * The Technical Director's proposals for the player team, most urgent first.
 * Pure and deterministic: same state always yields the same briefing.
 */
export function technicalDirectorProposals(state: GameState): TechnicalProposal[] {
  const team = state.teams.find((candidate) => candidate.id === state.selectedTeamId);
  if (!team) return [];
  const budget = team.budget;
  const slots = developmentSlots(state.facilities);
  const used = technicalStateForTeam(state, state.selectedTeamId)?.activeProjects.length ?? 0;
  const freeSlots = Math.max(0, slots - used);

  const development = developmentProposal(state, budget, freeSlots);
  const proposals: TechnicalProposal[] = [
    ...repairProposals(state, budget),
    development,
    // A proposed development program would take one of the free slots.
    researchProposal(state, budget, development ? freeSlots - 1 : freeSlots),
    manufactureProposal(state, budget),
    facilityProposal(state, budget),
  ].filter((proposal): proposal is TechnicalProposal => !!proposal);
  return proposals.slice(0, MAX_PROPOSALS);
}
