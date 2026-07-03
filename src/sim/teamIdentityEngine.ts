// Team Identity Engine — applies philosophy-trait-based weighted modifiers
// to AI team decisions across multiple seasons.
//
// Each philosophy trait shifts the team's behavior in specific areas:
// - Development focus (aero vs engine vs reliability)
// - Driver market preferences (youth vs experience vs pay drivers)
// - Academy investment willingness
// - Staff/facility spending priorities
// - Risk appetite adjustments
// - Sponsor/engine deal preferences
//
// The modifiers are additive on top of the archetype specs, so a team's
// identity compounds with its archetype to produce unique behavior patterns
// that persist and evolve across seasons.

import type { TeamPhilosophyTrait, AITeamArchetype, TeamMemoryEntry } from '../types/aiTeamTypes';
export type { TeamMemoryEntry };

// ---------------------------------------------------------------------------
// Trait-based modifier tables
// ---------------------------------------------------------------------------

// Development area preferences: each trait biases which car area a team
// prioritizes when developing. Positive = more likely to target that area.
export const TRAIT_DEV_BIAS: Partial<Record<TeamPhilosophyTrait, Partial<Record<'aeroEfficiency' | 'enginePower' | 'mechanicalGrip' | 'reliability' | 'pitCrewOperations', number>>>> = {
  TechnicalInnovator: { aeroEfficiency: 0.3, enginePower: 0.15 },
  Traditionalist: { reliability: 0.2, mechanicalGrip: 0.1 },
  RiskTaker: { aeroEfficiency: 0.2, enginePower: 0.15 },
  DataDriven: { aeroEfficiency: 0.15, reliability: 0.1 },
  Maverick: { enginePower: 0.2, pitCrewOperations: 0.1 },
  Disciplined: { reliability: 0.25, pitCrewOperations: 0.1 },
  PeopleFirst: { pitCrewOperations: 0.15, reliability: 0.1 },
  StarMaker: { mechanicalGrip: 0.1, reliability: 0.1 },
};

// Driver market modifiers: each trait shifts the team's evaluation of
// market drivers beyond the archetype's base biases.
export const TRAIT_MARKET_MOD: Partial<Record<TeamPhilosophyTrait, {
  overallBias?: number;
  youthBias?: number;
  payDriverBias?: number;
  potentialBias?: number;
}>> = {
  TechnicalInnovator: { potentialBias: 0.1 },
  Traditionalist: { overallBias: 0.1, youthBias: -0.1 },
  RiskTaker: { potentialBias: 0.15, youthBias: 0.1 },
  PeopleFirst: { overallBias: 0.05 },
  DataDriven: { overallBias: 0.1 },
  Maverick: { potentialBias: 0.1, payDriverBias: 0.1 },
  Disciplined: { overallBias: 0.05, youthBias: -0.05 },
  StarMaker: { youthBias: 0.2, potentialBias: 0.15 },
};

// Academy investment willingness: each trait shifts the probability of
// signing a new youth prospect.
export const TRAIT_ACADEMY_BIAS: Partial<Record<TeamPhilosophyTrait, number>> = {
  StarMaker: 0.25,
  PeopleFirst: 0.1,
  TechnicalInnovator: 0.05,
  Traditionalist: -0.1,
  Disciplined: -0.05,
  RiskTaker: 0.05,
  Maverick: 0,
};

// Staff/facility spending priority: each trait shifts how much a team
// invests in staff vs facilities vs car development.
export const TRAIT_SPEND_PRIORITY: Partial<Record<TeamPhilosophyTrait, {
  devShift?: number;
  facilityShift?: number;
  staffShift?: number;
}>> = {
  TechnicalInnovator: { devShift: 0.1, facilityShift: -0.05 },
  Traditionalist: { staffShift: 0.1, devShift: -0.05 },
  RiskTaker: { devShift: 0.15, facilityShift: -0.05 },
  PeopleFirst: { staffShift: 0.15, facilityShift: 0.05 },
  DataDriven: { facilityShift: 0.1, devShift: 0.05 },
  Maverick: { devShift: 0.1, staffShift: -0.05 },
  Disciplined: { facilityShift: 0.1, staffShift: 0.05 },
  StarMaker: { staffShift: 0.1, facilityShift: 0.05 },
};

// Risk appetite adjustment: each trait nudges the team's overall risk level.
export const TRAIT_RISK_MOD: Partial<Record<TeamPhilosophyTrait, number>> = {
  RiskTaker: 0.15,
  Maverick: 0.1,
  TechnicalInnovator: 0.05,
  Traditionalist: -0.1,
  Disciplined: -0.1,
  PeopleFirst: -0.05,
  DataDriven: 0,
  StarMaker: 0.05,
};

// ---------------------------------------------------------------------------
// Weighted decision functions
// ---------------------------------------------------------------------------

// Get the combined development area bias from all of a team's traits.
export function devAreaBias(
  traits: TeamPhilosophyTrait[] | undefined,
): Record<'aeroEfficiency' | 'enginePower' | 'mechanicalGrip' | 'reliability' | 'pitCrewOperations', number> {
  const base = { aeroEfficiency: 0, enginePower: 0, mechanicalGrip: 0, reliability: 0, pitCrewOperations: 0 };
  if (!traits) return base;
  for (const trait of traits) {
    const mod = TRAIT_DEV_BIAS[trait];
    if (mod) {
      for (const [key, val] of Object.entries(mod)) {
        base[key as keyof typeof base] += val;
      }
    }
  }
  return base;
}

// Pick a development area using trait-weighted probabilities.
// The base target (from archetype/reliability) gets a bonus from trait biases.
export function weightedDevTarget(
  car: { ratings: { aeroEfficiency: number; enginePower: number; mechanicalGrip: number; reliability: number; pitCrewOperations: number } },
  hadReliabilityProblem: boolean,
  traits: TeamPhilosophyTrait[] | undefined,
): 'aeroEfficiency' | 'enginePower' | 'mechanicalGrip' | 'reliability' | 'pitCrewOperations' {
  const bias = devAreaBias(traits);
  const eff = car.ratings;

  // If reliability is a problem, strongly bias there unless traits override.
  if (hadReliabilityProblem && eff.reliability < 8.5) {
    const reliabilityWeight = 1 + bias.reliability;
    if (reliabilityWeight > 0.5) return 'reliability';
  }

  // Score each area: lower current rating = higher need, plus trait bias.
  const areas: ('aeroEfficiency' | 'enginePower' | 'mechanicalGrip' | 'reliability' | 'pitCrewOperations')[] = [
    'aeroEfficiency', 'enginePower', 'mechanicalGrip', 'reliability', 'pitCrewOperations',
  ];
  let best: typeof areas[0] = 'aeroEfficiency';
  let bestScore = -Infinity;
  for (const area of areas) {
    const need = 10 - eff[area]; // lower rating = higher need
    const traitBonus = bias[area];
    const score = need + traitBonus * 5;
    if (score > bestScore) {
      bestScore = score;
      best = area;
    }
  }
  return best;
}

// Get the combined market evaluation modifier from traits.
export function marketMod(
  traits: TeamPhilosophyTrait[] | undefined,
): { overallBias: number; youthBias: number; payDriverBias: number; potentialBias: number } {
  const base = { overallBias: 0, youthBias: 0, payDriverBias: 0, potentialBias: 0 };
  if (!traits) return base;
  for (const trait of traits) {
    const mod = TRAIT_MARKET_MOD[trait];
    if (mod) {
      if (mod.overallBias) base.overallBias += mod.overallBias;
      if (mod.youthBias) base.youthBias += mod.youthBias;
      if (mod.payDriverBias) base.payDriverBias += mod.payDriverBias;
      if (mod.potentialBias) base.potentialBias += mod.potentialBias;
    }
  }
  return base;
}

// Get the academy investment willingness modifier from traits.
export function academyBias(traits: TeamPhilosophyTrait[] | undefined): number {
  if (!traits) return 0;
  let total = 0;
  for (const trait of traits) {
    total += TRAIT_ACADEMY_BIAS[trait] ?? 0;
  }
  return total;
}

// Get the spend priority shifts from traits.
export function spendPriorityShift(
  traits: TeamPhilosophyTrait[] | undefined,
): { devShift: number; facilityShift: number; staffShift: number } {
  const base = { devShift: 0, facilityShift: 0, staffShift: 0 };
  if (!traits) return base;
  for (const trait of traits) {
    const mod = TRAIT_SPEND_PRIORITY[trait];
    if (mod) {
      if (mod.devShift) base.devShift += mod.devShift;
      if (mod.facilityShift) base.facilityShift += mod.facilityShift;
      if (mod.staffShift) base.staffShift += mod.staffShift;
    }
  }
  return base;
}

// Get the risk appetite modifier from traits.
export function riskMod(traits: TeamPhilosophyTrait[] | undefined): number {
  if (!traits) return 0;
  let total = 0;
  for (const trait of traits) {
    total += TRAIT_RISK_MOD[trait] ?? 0;
  }
  return total;
}

// Effective risk score combining archetype base risk with trait modifiers.
export function effectiveRisk(
  traits: TeamPhilosophyTrait[] | undefined,
  baseRisk: number,
): number {
  return Math.max(0, Math.min(1, baseRisk + riskMod(traits)));
}

// Multi-season memory: track a team's historical performance to influence
// future decisions. This is stored per team and updated at each offseason.
// The type is defined in aiTeamTypes.ts and imported above.

// Update team memory after a season. Pure & deterministic.
export function updateTeamMemory(
  prev: TeamMemoryEntry | undefined,
  teamId: string,
  constructorPosition: number,
  wins: number,
  podiums: number,
): TeamMemoryEntry {
  const seasonsTracked = (prev?.seasonsTracked ?? 0) + 1;
  const lastPositions = prev?.avgConstructorPosition
    ? [prev.avgConstructorPosition * (seasonsTracked - 1), constructorPosition]
    : [constructorPosition];
  const avgConstructorPosition = lastPositions.reduce((a, b) => a + b, 0) / seasonsTracked;

  const best = prev?.bestConstructorPosition
    ? Math.min(prev.bestConstructorPosition, constructorPosition)
    : constructorPosition;
  const worst = prev?.worstConstructorPosition
    ? Math.max(prev.worstConstructorPosition, constructorPosition)
    : constructorPosition;

  // Trend: compare last position to previous.
  let trendDirection: 'improving' | 'declining' | 'stable' = 'stable';
  if (prev?.lastConstructorPosition !== undefined) {
    const delta = prev.lastConstructorPosition - constructorPosition;
    if (delta > 0) trendDirection = 'improving';
    else if (delta < 0) trendDirection = 'declining';
  }

  return {
    teamId,
    seasonsTracked,
    lastConstructorPosition: constructorPosition,
    bestConstructorPosition: best,
    worstConstructorPosition: worst,
    avgConstructorPosition: Math.round(avgConstructorPosition * 10) / 10,
    trendDirection,
    seasonsSincePodium: podiums > 0 ? 0 : (prev?.seasonsSincePodium ?? 0) + 1,
    seasonsSinceWin: wins > 0 ? 0 : (prev?.seasonsSinceWin ?? 0) + 1,
    totalWins: (prev?.totalWins ?? 0) + wins,
    totalPodiums: (prev?.totalPodiums ?? 0) + podiums,
  };
}

// Apply team memory to influence archetype evolution. A team that's been
// declining for multiple seasons should be more likely to take risks or
// retrench, depending on its philosophy.
export function memoryArchetypeNudge(
  memory: TeamMemoryEntry | undefined,
  currentArchetype: AITeamArchetype,
): AITeamArchetype {
  if (!memory || memory.seasonsTracked < 2) return currentArchetype;

  // Long decline with no wins → push toward more aggressive or survival.
  if (memory.trendDirection === 'declining' && memory.seasonsSinceWin >= 3) {
    if (currentArchetype === 'FinanciallyConservative') return 'AmbitiousBuilder';
    if (currentArchetype === 'DevelopmentFocused') return 'AmbitiousBuilder';
  }

  // Consistent improvement → consolidate with development focus.
  if (memory.trendDirection === 'improving' && memory.lastConstructorPosition && memory.lastConstructorPosition <= 5) {
    if (currentArchetype === 'SurvivalMode') return 'FinanciallyConservative';
  }

  // Long midfield stagnation → shake things up.
  if (
    memory.seasonsTracked >= 3 &&
    memory.avgConstructorPosition &&
    memory.avgConstructorPosition > 5 &&
    memory.avgConstructorPosition < 9 &&
    memory.trendDirection === 'stable'
  ) {
    if (currentArchetype === 'FinanciallyConservative') return 'AmbitiousBuilder';
  }

  return currentArchetype;
}
