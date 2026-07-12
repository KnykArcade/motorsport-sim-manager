// AI Team Management engine core — Career Mode Phase C.
//
// Gives every non-player team a believable management brain: a personality
// archetype, a simplified budget with a financial-health grade, and a season
// goal. All pure & deterministic. The offseason *actions* that consume this
// state (driver market, development, staff, sponsors, engine) arrive in Phase D.

import type { Car, Team } from '../types/gameTypes';
import type { TeamOrganizationRatings } from '../types/teamRatingsTypes';
import type { PrincipalAttributes } from '../types/principalTypes';
import type {
  AIFinancialHealth,
  AITeamArchetype,
  AITeamBudget,
  AITeamGoal,
  AITeamState,
  TeamPhilosophy,
  TeamPhilosophyTrait,
  TeamMemoryEntry,
} from '../types/aiTeamTypes';
import { MILLION, driverSalary, toMoney } from './financeEngine';
import { carPerformanceRating } from './trackFitEngine';
import { createSeededRandom, deriveSeed } from './random';
import { memoryArchetypeNudge } from './teamIdentityEngine';
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

// --- Philosophy (persistent identity) ----------------------------------------

export const TRAIT_LABELS: Record<TeamPhilosophyTrait, string> = {
  TechnicalInnovator: 'Technical Innovator',
  Traditionalist: 'Traditionalist',
  RiskTaker: 'Risk Taker',
  PeopleFirst: 'People First',
  DataDriven: 'Data Driven',
  Maverick: 'Maverick',
  Disciplined: 'Disciplined',
  StarMaker: 'Star Maker',
};

// Archetype-to-trait affinities: each archetype naturally gravitates toward
// certain traits. Philosophy generation picks from these first, then adds a
// random trait for variety.
const ARCHETYPE_TRAIT_AFFINITIES: Record<AITeamArchetype, TeamPhilosophyTrait[]> = {
  ChampionshipContender: ['RiskTaker', 'DataDriven', 'Disciplined'],
  AmbitiousBuilder: ['TechnicalInnovator', 'RiskTaker', 'Disciplined'],
  DevelopmentFocused: ['StarMaker', 'DataDriven', 'PeopleFirst'],
  FinanciallyConservative: ['Disciplined', 'Traditionalist', 'DataDriven'],
  PayDriverReliant: ['Maverick', 'Traditionalist'],
  AggressiveSpender: ['RiskTaker', 'Maverick', 'TechnicalInnovator'],
  YouthFocused: ['StarMaker', 'PeopleFirst', 'TechnicalInnovator'],
  SurvivalMode: ['Traditionalist', 'Disciplined'],
};

function generatePhilosophy(
  team: Team,
  archetype: AITeamArchetype,
  seed: string,
): TeamPhilosophy {
  const rng = createSeededRandom(deriveSeed(seed, 'philosophy', team.id));
  const affinities = ARCHETYPE_TRAIT_AFFINITIES[archetype];
  const traits: TeamPhilosophyTrait[] = [];

  // Pick 2 affinity traits (deterministic).
  const shuffled = [...affinities].sort(() => rng.next() - 0.5);
  traits.push(shuffled[0]);

  // 50% chance to add a second affinity trait, otherwise add a random one for variety.
  if (rng.next() < 0.5 && shuffled.length > 1) {
    traits.push(shuffled[1]);
  } else {
    const allTraits: TeamPhilosophyTrait[] = [
      'TechnicalInnovator', 'Traditionalist', 'RiskTaker', 'PeopleFirst',
      'DataDriven', 'Maverick', 'Disciplined', 'StarMaker',
    ];
    const remaining = allTraits.filter((t) => !traits.includes(t));
    const idx = Math.floor(rng.next() * remaining.length);
    traits.push(remaining[idx]);
  }

  const traitLabels = traits.map((t) => TRAIT_LABELS[t]);
  const description = `${team.name} is known as a ${traitLabels.join(' & ')} team.`;

  return { traits, description };
}

// Gradual philosophy trait evolution: each offseason, a team's traits may drift
// by at most one swap, influenced by its performance trend and archetype.
// Declining teams tend to shed conservative traits for aggressive ones;
// improving teams consolidate toward stability; stagnant teams shake things up.
export function evolvePhilosophy(
  team: Team,
  prev: TeamPhilosophy,
  archetype: AITeamArchetype,
  memory: TeamMemoryEntry | undefined,
  seed: string,
): TeamPhilosophy {
  if (!memory || memory.seasonsTracked < 2) return prev;

  const rng = createSeededRandom(deriveSeed(seed, 'philosophy-evolution', team.id));
  const roll = rng.next();

  // Base chance of a trait swap this offseason.
  let swapChance = 0.2;
  if (memory.trendDirection === 'declining') swapChance = 0.35;
  if (memory.trendDirection === 'improving') swapChance = 0.15;
  // Long stagnation in midfield → more likely to shake things up.
  if (memory.trendDirection === 'stable' && memory.seasonsTracked >= 3) swapChance = 0.3;

  if (roll > swapChance) return prev;

  const traits = [...prev.traits];
  const affinities = ARCHETYPE_TRAIT_AFFINITIES[archetype];

  // Traits that signal conservatism vs aggression vs development.
  const conservativeTraits: TeamPhilosophyTrait[] = ['Disciplined', 'Traditionalist'];
  const aggressiveTraits: TeamPhilosophyTrait[] = ['RiskTaker', 'Maverick', 'TechnicalInnovator'];

  let traitToReplace: TeamPhilosophyTrait | undefined;
  let candidatePool: TeamPhilosophyTrait[];

  if (memory.trendDirection === 'declining') {
    // Drop a conservative trait, pick up an aggressive or affinity trait.
    traitToReplace = traits.find((t) => conservativeTraits.includes(t));
    if (!traitToReplace) traitToReplace = traits[0];
    candidatePool = [...aggressiveTraits, ...affinities];
  } else if (memory.trendDirection === 'improving') {
    // Drop an aggressive trait, pick up a stability or affinity trait.
    traitToReplace = traits.find((t) => aggressiveTraits.includes(t));
    if (!traitToReplace) return prev; // Already stable, no change needed.
    candidatePool = ['Disciplined', 'DataDriven', ...affinities];
  } else {
    // Stable: swap a non-affinity trait for an affinity trait not already held.
    traitToReplace = traits.find((t) => !affinities.includes(t)) ?? traits[0];
    candidatePool = affinities;
  }

  // Filter out traits already held.
  const candidates = candidatePool.filter((t) => !traits.includes(t) && t !== traitToReplace);
  if (candidates.length === 0) return prev;

  const replacement = candidates[Math.floor(rng.next() * candidates.length)];
  const idx = traits.indexOf(traitToReplace);
  traits[idx] = replacement;

  const traitLabels = traits.map((t) => TRAIT_LABELS[t]);
  const description = `${team.name} is known as a ${traitLabels.join(' & ')} team.`;

  return { traits, description };
}

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
  const carPace = car ? carPerformanceRating(car) : 50;
  const youth = org?.youthAcademy ?? 40;
  const sponsor = org?.sponsorAppeal ?? 40;
  const research = org?.research ?? 40;
  const nudge = createSeededRandom(deriveSeed(seed, 'archetype', team.id)).next();

  if (rep >= 75 && carPace >= 73) return 'ChampionshipContender';
  if (cashM < 28 && rep < 45) return 'SurvivalMode';
  if (rep < 42 && sponsor >= 55) return 'PayDriverReliant';
  if (youth >= 60) return rep >= 62 ? 'DevelopmentFocused' : 'YouthFocused';
  if (research >= 52 && rep >= 42 && rep < 72) {
    return nudge < 0.45 ? 'AmbitiousBuilder' : 'DevelopmentFocused';
  }
  if (cashM >= 48 && rep < 72) return 'AggressiveSpender';
  if (rep < 45) return nudge < 0.5 ? 'SurvivalMode' : 'PayDriverReliant';
  return 'FinanciallyConservative';
}

// --- Budget model ------------------------------------------------------------

// Estimated annual prize money for a final constructor position (raw dollars).
// A gentle curve: champions earn far more than the tail of the grid.
export function estimatePrizeMoney(constructorPosition: number, teamCount: number): number {
  const pos = Math.max(1, Math.min(teamCount, constructorPosition));
  const top = 48; // $M for P1
  const tail = 7; // $M for last
  const frac = teamCount > 1 ? (pos - 1) / (teamCount - 1) : 0;
  return toMoney(top - (top - tail) * frac);
}

export function updateAIReputation(team: Team, constructorPosition: number, teamCount: number): Team {
  const expected = team.expectedStanding ?? Math.ceil(teamCount / 2);
  const performanceGap = expected - constructorPosition;
  const drift = Math.max(-2, Math.min(2, performanceGap * 0.35));
  return {
    ...team,
    reputation: Math.max(1, Math.min(100, Math.round((team.reputation + drift) * 10) / 10)),
  };
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

function principalBudgetFactor(attributes: PrincipalAttributes | undefined): number {
  return attributes ? 1 + (attributes.financialDiscipline - 50) / 500 : 1;
}

// Ongoing testing programme cost — grows with the team's technical ambition.
function estimateTestingCost(org: TeamOrganizationRatings | undefined): number {
  return toMoney(1 + (org?.research ?? 40) * 0.03);
}

// Ongoing youth-academy running cost — grows with academy investment.
function estimateAcademyCost(org: TeamOrganizationRatings | undefined): number {
  return toMoney((org?.youthAcademy ?? 30) * 0.03);
}

// Sponsor-expectation penalty: a shortfall between where the team finished and
// where its reputation implies it should, scaled by how big its commercial
// programme is (bigger deals carry bigger expectations). Reduces net sponsor
// income so under-performing teams feel commercial pressure.
function estimateSponsorPenalty(
  team: Team,
  constructorPosition: number,
  teamCount: number,
): number {
  const expectedPos = Math.max(1, Math.round(teamCount * (1 - team.reputation / 100)));
  const shortfall = Math.max(0, constructorPosition - expectedPos);
  if (shortfall <= 0) return 0;
  return toMoney(shortfall * (0.4 + team.reputation * 0.02));
}

// Build the simplified annual budget for one AI team.
//
// Long-run pressure comes from two design choices: (1) real ongoing costs
// (salaries, staff, engine, ops, testing, academy, sponsor penalties), and (2)
// discretionary investment that scales with the cash a team holds *above* its
// reserve. Because a richer war-chest is spent down harder, every team settles
// around a stable equilibrium budget instead of compounding upward forever —
// while winners (big prize money) still bank more than the tail of the grid.
export function estimateAIBudget(
  state: GameState,
  team: Team,
  org: TeamOrganizationRatings | undefined,
  archetype: AITeamArchetype,
  constructorPosition: number,
  principalAttributes?: PrincipalAttributes,
): AITeamBudget {
  const spec = ARCHETYPE_SPECS[archetype];
  const startingCash = team.budget;
  const teamCount = state.teams.length;

  const raceDrivers = activeDriversForTeam(state, team.id);
  const driverSalaries = raceDrivers.reduce((sum, d) => sum + driverSalary(d), 0);
  const staffSalaries = estimateStaffCost(org);
  const engineDeal = state.engine?.deals?.[team.id];
  const engineCost = engineDeal ? toMoney(engineDeal.annualCost) : toMoney(6);
  const operatingCost = Math.round(estimateOperatingCost(team) * principalBudgetFactor(principalAttributes));
  const testingCost = estimateTestingCost(org);
  const academyCost = estimateAcademyCost(org);
  const sponsorPenalty = estimateSponsorPenalty(team, constructorPosition, teamCount);

  const sponsorIncome = Math.max(0, estimateSponsorIncome(team, org) - sponsorPenalty);
  const prizeMoney = estimatePrizeMoney(constructorPosition, teamCount);

  const ongoingFixed =
    driverSalaries + staffSalaries + engineCost + operatingCost + testingCost + academyCost;
  const income = sponsorIncome + prizeMoney;
  const reserveTarget = toMoney(5) + Math.round(spec.reserveFactor * (sponsorIncome + ongoingFixed));

  // Personality-driven spend rates. Aggressive/low-reserve teams commit more of
  // both their operating surplus and their war-chest; conservative teams hold
  // back. The excess-cash term is what caps long-run inflation.
  const operatingSurplus = income - ongoingFixed;
  const excessCash = Math.max(0, startingCash - reserveTarget);
  const surplusSpendRate = Math.min(0.95, 0.55 + spec.risk * 0.4);
  const excessSpendRate = Math.max(
    0.05,
    Math.min(0.6, 0.12 + spec.risk * 0.35 - spec.reserveFactor * 0.15),
  );
  const efficiency = principalAttributes
    ? 1 + (principalAttributes.financialDiscipline - 50) / 400
    : 1;
  const investmentPool =
    (Math.max(0, operatingSurplus) * surplusSpendRate + excessCash * excessSpendRate) * efficiency;

  const developmentSpend = Math.round(spec.devBias * investmentPool);
  const facilitySpend = Math.round(spec.facilityBias * investmentPool);
  const otherInvestment = Math.round(
    Math.max(0, 1 - spec.devBias - spec.facilityBias) * investmentPool,
  );

  const totalExpenses =
    ongoingFixed + developmentSpend + facilitySpend + otherInvestment;
  // Full annual result: all income (sponsor + prize money) minus all expenses.
  // This is the real cash swing applied each offseason, so budgets track their
  // true earnings and settle at an equilibrium rather than ballooning.
  const netResult = income - totalExpenses;
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
    testingCost,
    academyCost,
    sponsorPenalty,
    otherInvestment,
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
  if (projectedCash < reserveTarget * 0.5) return 'AtRisk';
  if (projectedCash < reserveTarget) return 'Tight';
  // A heavy operating loss is a warning sign even with cash in the bank, but a
  // team sitting on a comfortable reserve (>=3x) is not "At Risk" — that reserve
  // is the clear reason the grade stays healthy despite the loss.
  const heavyLoss = netResult < -0.3 * Math.max(1, sponsorIncome);
  if (projectedCash < reserveTarget * 3) return heavyLoss ? 'Tight' : 'Stable';
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
  if (
    current === 'SurvivalMode' &&
    (health === 'Stable' || health === 'Excellent' || (health === 'Tight' && cashGrowthRatio >= 1.1))
  ) {
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
  const budget = estimateAIBudget(state, team, org, archetype, position, state.aiPrincipals?.[team.id]?.attributes);
  const health = financialHealth(budget);
  const goal = aiTeamGoal(archetype, position, state.teams.length, health);
  const philosophy = generatePhilosophy(team, archetype, state.randomSeed);
  return {
    teamId: team.id,
    archetype,
    financialHealth: health,
    goal,
    budget,
    philosophy,
    principalAttributes: state.aiPrincipals?.[team.id]?.attributes,
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
  // Cash delta (raw dollars) to apply to each AI team's Team.budget: the full
  // annual net result (sponsor + prize income minus salaries, staff, engine,
  // operating, development and facility costs). Applying the true net — not just
  // the discretionary flows — keeps AI budgets realistic instead of ballooning
  // over a long career, and keeps Team.budget in step with financial health.
  budgetDeltaByTeam: Record<string, number>;
  notes: string[];
};

// Recompute every AI team's brain at the offseason: refresh the budget from the
// season just finished, grade financial health, evolve personality and set next
// season's goal. Produces per-team cash deltas + a few headline notes for the
// rollover summary.
export function rolloverAITeamStates(
  state: GameState,
  teamMemory?: Record<string, TeamMemoryEntry>,
): AIRolloverResult {
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
    const budget = estimateAIBudget(
      state,
      team,
      org,
      archetype0,
      position,
      prevState?.principalAttributes ?? state.aiPrincipals?.[team.id]?.attributes,
    );
    const health = financialHealth(budget);

    const wasTrouble = health === 'AtRisk' || health === 'Critical';
    const seasonsInTrouble = wasTrouble ? (prevState?.seasonsInTrouble ?? 0) + 1 : 0;
    const cashGrowthRatio =
      budget.projectedCash / Math.max(1, prevState?.budget.startingCash ?? budget.startingCash);
    const evolved = evolveArchetype(archetype0, health, seasonsInTrouble, cashGrowthRatio);
    // Apply multi-season memory nudge on top of financial-health-driven evolution.
    const archetype = teamMemory
      ? memoryArchetypeNudge(teamMemory[team.id], evolved)
      : evolved;
    const goal = aiTeamGoal(archetype, position, state.teams.length, health);

    // Full annual net result applied to the team's cash for next year, so
    // budgets reflect real earnings and costs rather than ballooning.
    budgetDeltaByTeam[team.id] = budget.netResult;

    // Philosophy persists across seasons unless the archetype changed — then
    // regenerate to reflect the team's new identity direction. When the archetype
    // is unchanged, gradually evolve traits based on multi-season performance.
    let philosophy: TeamPhilosophy;
    if (archetype !== archetype0) {
      philosophy = generatePhilosophy(team, archetype, `${state.randomSeed}-${state.seasonYear}`);
    } else if (prevState?.philosophy) {
      philosophy = evolvePhilosophy(
        team,
        prevState.philosophy,
        archetype,
        teamMemory?.[team.id],
        `${state.randomSeed}-${state.seasonYear}`,
      );
    } else {
      philosophy = generatePhilosophy(team, archetype, state.randomSeed);
    }

    states[team.id] = {
      teamId: team.id,
      archetype,
      financialHealth: health,
      goal,
      budget,
      philosophy,
      principalAttributes: prevState?.principalAttributes ?? state.aiPrincipals?.[team.id]?.attributes,
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
      if (philosophy) {
        notes.push(`${team.name}'s identity: ${philosophy.description}`);
      }
    } else if (prevState?.philosophy && philosophy.traits !== prevState.philosophy.traits) {
      notes.push(`${team.name}'s identity evolves: ${philosophy.description}`);
    }
  }

  return { states, budgetDeltaByTeam, notes };
}
