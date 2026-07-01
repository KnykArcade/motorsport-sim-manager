// AI Team Management engine core — Career Mode Phase C.
//
// Gives every non-player team a believable management brain: a personality
// archetype, a simplified budget with a financial-health grade, and a season
// goal. All pure & deterministic. The offseason *actions* that consume this
// state (driver market, development, staff, sponsors, engine) arrive in Phase D.

import type { Car, Team } from '../types/gameTypes';
import type { TeamOrganizationRatings } from '../types/teamRatingsTypes';
import type {
  AIFinancialHealth,
  AITeamArchetype,
  AITeamBudget,
  AITeamGoal,
  AITeamState,
} from '../types/aiTeamTypes';
import { MILLION, driverSalary, toMoney } from './financeEngine';
import { carPerformanceRating } from './trackFitEngine';
import { createSeededRandom, deriveSeed } from './random';
import { activeDriversForTeam, type GameState } from '../game/careerState';

// --- Archetype specifications ------------------------------------------------

type ArchetypeSpec = {
  label: string;
  description: string;
  // Fraction of discretionary income steered into car development.
  devBias: number;
  // Fraction of discretionary income steered into facilities.
  facilityBias: number;
  // Minimum cash reserve target as a fraction of annual turnover.
  reserveFactor: number;
  // 0-1 preference for funded (pay) drivers over pure rating.
  payDriverBias: number;
  // 0-1 preference for signing/promoting youth.
  youthBias: number;
  // 0-1 general risk appetite.
  risk: number;
};

export const ARCHETYPE_SPECS: Record<AITeamArchetype, ArchetypeSpec> = {
  ChampionshipContender: {
    label: 'Championship Contender',
    description: 'Spends aggressively on top drivers and car performance; expects wins.',
    devBias: 0.55,
    facilityBias: 0.15,
    reserveFactor: 0.15,
    payDriverBias: 0.0,
    youthBias: 0.3,
    risk: 0.5,
  },
  AmbitiousBuilder: {
    label: 'Ambitious Builder',
    description: 'Invests in facilities and development, takes calculated risks, wants to move up.',
    devBias: 0.45,
    facilityBias: 0.35,
    reserveFactor: 0.2,
    payDriverBias: 0.1,
    youthBias: 0.4,
    risk: 0.6,
  },
  DevelopmentFocused: {
    label: 'Development-Focused',
    description: 'Prioritizes youth and staff, gives reserves opportunities, accepts slower results.',
    devBias: 0.4,
    facilityBias: 0.3,
    reserveFactor: 0.25,
    payDriverBias: 0.1,
    youthBias: 0.7,
    risk: 0.4,
  },
  FinanciallyConservative: {
    label: 'Financially Conservative',
    description: 'Protects the budget, avoids expensive risks, signs affordable drivers.',
    devBias: 0.3,
    facilityBias: 0.15,
    reserveFactor: 0.4,
    payDriverBias: 0.3,
    youthBias: 0.3,
    risk: 0.2,
  },
  PayDriverReliant: {
    label: 'Pay Driver Reliant',
    description: 'Values sponsor backing, may pick funded drivers over rating, prioritizes survival.',
    devBias: 0.25,
    facilityBias: 0.1,
    reserveFactor: 0.3,
    payDriverBias: 0.9,
    youthBias: 0.3,
    risk: 0.3,
  },
  AggressiveSpender: {
    label: 'Aggressive Spender',
    description: 'Spends heavily on upgrades, staff and drivers; can rise fast but risks trouble.',
    devBias: 0.7,
    facilityBias: 0.25,
    reserveFactor: 0.05,
    payDriverBias: 0.0,
    youthBias: 0.3,
    risk: 0.9,
  },
  YouthFocused: {
    label: 'Youth-Focused',
    description: 'Signs academy prospects and promotes youth quickly for long-term upside.',
    devBias: 0.3,
    facilityBias: 0.25,
    reserveFactor: 0.25,
    payDriverBias: 0.2,
    youthBias: 0.9,
    risk: 0.5,
  },
  SurvivalMode: {
    label: 'Survival Mode',
    description: 'Low budget; signs cheap or funded drivers, minimal development, stays solvent.',
    devBias: 0.15,
    facilityBias: 0.05,
    reserveFactor: 0.5,
    payDriverBias: 0.7,
    youthBias: 0.2,
    risk: 0.1,
  },
};

export const GOAL_LABELS: Record<AITeamGoal, string> = {
  TitleChallenge: 'Title Challenge',
  Podiums: 'Regular Podiums',
  PointsFinish: 'Score Points',
  MidfieldImprovement: 'Climb the Midfield',
  Survival: 'Survive the Season',
  YouthDevelopment: 'Develop Young Talent',
};

// --- Archetype assignment ----------------------------------------------------

// Deterministically pick a starting archetype from a team's profile. Reputation
// and car strength dominate; budget and the org youth/sponsor/research ratings
// steer the mid/back of the grid. A tiny seeded nudge spreads teams sitting on a
// boundary so the paddock isn't monotone.
export function assignArchetype(
  team: Team,
  org: TeamOrganizationRatings | undefined,
  car: Car | undefined,
  seed: string,
): AITeamArchetype {
  const rep = team.reputation;
  const cashM = team.budget / MILLION;
  const carPace = car ? carPerformanceRating(car) : 5;
  const youth = org?.youthAcademy ?? 40;
  const sponsor = org?.sponsorAppeal ?? 40;
  const research = org?.research ?? 40;
  const nudge = createSeededRandom(deriveSeed(seed, 'archetype', team.id)).next();

  if (rep >= 75 && carPace >= 7.3) return 'ChampionshipContender';
  if (cashM < 28 && rep < 45) return 'SurvivalMode';
  if (rep < 42 && sponsor >= 55) return 'PayDriverReliant';
  if (youth >= 66) return rep >= 70 ? 'DevelopmentFocused' : 'YouthFocused';
  if (research >= 60 && rep >= 45 && rep < 72) {
    return nudge < 0.6 ? 'AmbitiousBuilder' : 'DevelopmentFocused';
  }
  if (cashM >= 65 && rep < 72) return 'AggressiveSpender';
  if (rep < 45) return nudge < 0.5 ? 'SurvivalMode' : 'PayDriverReliant';
  return 'FinanciallyConservative';
}

// --- Budget model ------------------------------------------------------------

// Estimated annual prize money for a final constructor position (raw dollars).
// A gentle curve: champions earn far more than the tail of the grid.
export function estimatePrizeMoney(constructorPosition: number, teamCount: number): number {
  const pos = Math.max(1, Math.min(teamCount, constructorPosition));
  const top = 45; // $M for P1
  const tail = 6; // $M for last
  const frac = teamCount > 1 ? (pos - 1) / (teamCount - 1) : 0;
  return toMoney(top - (top - tail) * frac);
}

// Estimated annual sponsor income from commercial appeal + reputation.
function estimateSponsorIncome(team: Team, org: TeamOrganizationRatings | undefined): number {
  const appeal = org?.sponsorAppeal ?? team.reputation;
  return toMoney(3 + appeal * 0.35 + team.reputation * 0.12);
}

// Estimated annual staff wage bill from staff quality.
function estimateStaffCost(org: TeamOrganizationRatings | undefined): number {
  const quality = org?.staffQuality ?? 45;
  return toMoney(2 + quality * 0.12);
}

// Base operating cost (logistics, race ops) scaled a little by reputation.
function estimateOperatingCost(team: Team): number {
  return toMoney(7 + team.reputation * 0.05);
}

// Build the simplified annual budget for one AI team.
export function estimateAIBudget(
  state: GameState,
  team: Team,
  org: TeamOrganizationRatings | undefined,
  archetype: AITeamArchetype,
  constructorPosition: number,
): AITeamBudget {
  const spec = ARCHETYPE_SPECS[archetype];
  const startingCash = team.budget;

  const raceDrivers = activeDriversForTeam(state, team.id);
  const driverSalaries = raceDrivers.reduce((sum, d) => sum + driverSalary(d), 0);
  const staffSalaries = estimateStaffCost(org);
  const engineDeal = state.engine?.deals?.[team.id];
  const engineCost = engineDeal ? toMoney(engineDeal.annualCost) : toMoney(6);
  const operatingCost = estimateOperatingCost(team);
  const sponsorIncome = estimateSponsorIncome(team, org);
  const prizeMoney = estimatePrizeMoney(constructorPosition, state.teams.length);

  const fixedExpenses = driverSalaries + staffSalaries + engineCost + operatingCost;
  const reserveTarget = toMoney(5) + Math.round(spec.reserveFactor * (sponsorIncome + fixedExpenses));

  // Discretionary spend is funded by any operating surplus plus a slice of the
  // cash held above the reserve target. Aggressive teams tap more of it.
  const surplus = Math.max(0, sponsorIncome - fixedExpenses);
  const cashSlice = Math.max(0, startingCash - reserveTarget) * (0.05 + spec.risk * 0.1);
  const discretionary = surplus + cashSlice;
  const developmentSpend = Math.round(spec.devBias * discretionary);
  const facilitySpend = Math.round(spec.facilityBias * discretionary);

  const totalExpenses =
    fixedExpenses + developmentSpend + facilitySpend;
  const netResult = sponsorIncome - totalExpenses;
  const projectedCash = startingCash + netResult;

  return {
    startingCash,
    sponsorIncome,
    prizeMoney,
    driverSalaries,
    staffSalaries,
    developmentSpend,
    facilitySpend,
    engineCost,
    operatingCost,
    totalExpenses,
    netResult,
    projectedCash,
    reserveTarget,
  };
}

// --- Financial health --------------------------------------------------------

export function financialHealth(budget: AITeamBudget): AIFinancialHealth {
  const { projectedCash, reserveTarget, netResult, sponsorIncome } = budget;
  if (projectedCash <= 0) return 'Critical';
  if (projectedCash < reserveTarget * 0.5 || netResult < -0.3 * Math.max(1, sponsorIncome)) {
    return 'AtRisk';
  }
  if (projectedCash < reserveTarget) return 'Tight';
  if (projectedCash < reserveTarget * 3) return 'Stable';
  return 'Excellent';
}

// --- Goals -------------------------------------------------------------------

export function aiTeamGoal(
  archetype: AITeamArchetype,
  constructorPosition: number,
  teamCount: number,
  health: AIFinancialHealth,
): AITeamGoal {
  if (health === 'Critical') return 'Survival';
  if (archetype === 'SurvivalMode') return 'Survival';
  if (archetype === 'YouthFocused') return 'YouthDevelopment';
  const upperThird = Math.max(1, Math.round(teamCount / 3));
  const midThird = Math.max(2, Math.round((teamCount * 2) / 3));
  if (constructorPosition <= 2) return 'TitleChallenge';
  if (constructorPosition <= upperThird) return 'Podiums';
  if (constructorPosition <= midThird) return 'PointsFinish';
  return 'MidfieldImprovement';
}

// --- Personality evolution ---------------------------------------------------

// Let a team's personality drift with its fortunes: sustained financial trouble
// pushes toward Survival Mode; a recovery or fresh investment lets a team climb
// back toward building/spending. Returns the (possibly unchanged) archetype.
export function evolveArchetype(
  current: AITeamArchetype,
  health: AIFinancialHealth,
  seasonsInTrouble: number,
  cashGrowthRatio: number, // projectedCash / max(1, previousStartingCash)
): AITeamArchetype {
  // Deep trouble → retrench into Survival Mode.
  if (health === 'Critical' || (health === 'AtRisk' && seasonsInTrouble >= 1)) {
    return 'SurvivalMode';
  }
  // Recovery out of Survival Mode once finances stabilize.
  if (current === 'SurvivalMode' && (health === 'Stable' || health === 'Excellent')) {
    return 'FinanciallyConservative';
  }
  // A big cash injection (investment) emboldens a stable team.
  if (health === 'Excellent' && cashGrowthRatio >= 1.5) {
    if (current === 'FinanciallyConservative') return 'AmbitiousBuilder';
    if (current === 'AmbitiousBuilder') return 'AggressiveSpender';
  }
  return current;
}

// --- State construction ------------------------------------------------------

// Position of a team in the (possibly empty) constructor standings, 1-based;
// falls back to mid-grid when standings aren't available yet (season start).
export function constructorPositionOf(state: GameState, teamId: string): number {
  const idx = state.constructorStandings.findIndex((s) => s.entityId === teamId);
  if (idx >= 0) return idx + 1;
  // No standings yet: order by expected standing / reputation as a proxy.
  const ordered = [...state.teams].sort((a, b) => b.reputation - a.reputation);
  const repIdx = ordered.findIndex((t) => t.id === teamId);
  return repIdx >= 0 ? repIdx + 1 : Math.ceil(state.teams.length / 2);
}

export function buildAITeamState(state: GameState, team: Team): AITeamState {
  const org = state.teamOrgRatings?.[team.id];
  const car = state.cars.find((c) => c.teamId === team.id);
  const archetype = assignArchetype(team, org, car, state.randomSeed);
  const position = constructorPositionOf(state, team.id);
  const budget = estimateAIBudget(state, team, org, archetype, position);
  const health = financialHealth(budget);
  const goal = aiTeamGoal(archetype, position, state.teams.length, health);
  return {
    teamId: team.id,
    archetype,
    financialHealth: health,
    goal,
    budget,
    seasonsInTrouble: health === 'AtRisk' || health === 'Critical' ? 1 : 0,
    lastConstructorPosition: state.constructorStandings.length ? position : undefined,
  };
}

// Build brain state for every non-player team.
export function buildAllAITeamStates(state: GameState): Record<string, AITeamState> {
  const out: Record<string, AITeamState> = {};
  for (const team of state.teams) {
    if (team.id === state.selectedTeamId) continue;
    out[team.id] = buildAITeamState(state, team);
  }
  return out;
}

// --- Offseason rollover ------------------------------------------------------

export type AIRolloverResult = {
  states: Record<string, AITeamState>;
  // Cash delta (raw dollars) to apply to each AI team's Team.budget: sponsor
  // income earned minus development/facility spend committed. Prize money and
  // fixed salaries are handled elsewhere / banked during the season, so only the
  // discretionary flows move here to avoid double counting.
  budgetDeltaByTeam: Record<string, number>;
  notes: string[];
};

// Recompute every AI team's brain at the offseason: refresh the budget from the
// season just finished, grade financial health, evolve personality and set next
// season's goal. Produces per-team cash deltas + a few headline notes for the
// rollover summary.
export function rolloverAITeamStates(state: GameState): AIRolloverResult {
  const prev = state.aiTeamStates ?? {};
  const states: Record<string, AITeamState> = {};
  const budgetDeltaByTeam: Record<string, number> = {};
  const notes: string[] = [];

  for (const team of state.teams) {
    if (team.id === state.selectedTeamId) continue;
    const org = state.teamOrgRatings?.[team.id];
    const car = state.cars.find((c) => c.teamId === team.id);
    const position = constructorPositionOf(state, team.id);
    const prevState = prev[team.id];

    const archetype0 = prevState?.archetype ?? assignArchetype(team, org, car, state.randomSeed);
    const budget = estimateAIBudget(state, team, org, archetype0, position);
    const health = financialHealth(budget);

    const wasTrouble = health === 'AtRisk' || health === 'Critical';
    const seasonsInTrouble = wasTrouble ? (prevState?.seasonsInTrouble ?? 0) + 1 : 0;
    const cashGrowthRatio =
      budget.projectedCash / Math.max(1, prevState?.budget.startingCash ?? budget.startingCash);
    const archetype = evolveArchetype(archetype0, health, seasonsInTrouble, cashGrowthRatio);
    const goal = aiTeamGoal(archetype, position, state.teams.length, health);

    // Discretionary cash flow applied to the team's cash for next year.
    const delta = budget.sponsorIncome - budget.developmentSpend - budget.facilitySpend;
    budgetDeltaByTeam[team.id] = delta;

    states[team.id] = {
      teamId: team.id,
      archetype,
      financialHealth: health,
      goal,
      budget,
      seasonsInTrouble,
      lastConstructorPosition: position,
    };

    // Headline personality shifts for the offseason summary.
    if (archetype !== archetype0) {
      if (archetype === 'SurvivalMode') {
        notes.push(`${team.name} enters Survival Mode after budget losses.`);
      } else if (archetype0 === 'SurvivalMode') {
        notes.push(`${team.name} stabilizes its finances and steadies the ship.`);
      } else if (archetype === 'AggressiveSpender' || archetype === 'AmbitiousBuilder') {
        notes.push(`${team.name} shifts to ${ARCHETYPE_SPECS[archetype].label} after fresh investment.`);
      }
    }
  }

  return { states, budgetDeltaByTeam, notes };
}
