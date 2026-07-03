// Race Weekend Package Engine — series-agnostic race weekend cost system.
//
// Before each race weekend, the team chooses a Race Weekend Package that
// determines cost, preparation level, race support, risk, sponsor satisfaction,
// and performance modifiers. This replaces the concept of a simple entry fee.

import type { Series, Team, Track } from '../types/gameTypes';
import type {
  RaceWeekendPackageType,
  RaceWeekendPackageEffects,
  SeriesPackageRules,
  AIPackageContext,
} from '../types/raceWeekendPackageTypes';
import { MILLION, toMoney } from './financeEngine';
import { createSeededRandom, deriveSeed } from './random';

// ---------------------------------------------------------------------------
// Package definitions
// ---------------------------------------------------------------------------

export type PackageDefinition = {
  type: RaceWeekendPackageType;
  label: string;
  shortLabel: string;
  description: string;
  costModifier: number;
  effects: RaceWeekendPackageEffects;
  warnings: string[];
};

export const RACE_WEEKEND_PACKAGES: Record<RaceWeekendPackageType, PackageDefinition> = {
  FullAttack: {
    type: 'FullAttack',
    label: 'Full Attack Package',
    shortLabel: 'Full Attack',
    description: 'Maximum preparation, best crew, full spares and support. Brings a small pace boost and the best reliability and pit crew prep.',
    costModifier: 1.35,
    effects: {
      paceModifier: 0.2,
      reliabilityPrep: 0.3,
      pitCrewPrep: 0.2,
      sponsorSatisfaction: 8,
      driverMorale: 3,
      tyrePreservation: 0,
      developmentDataGain: 1.0,
      operationalRiskMultiplier: 0.9,
      crashRiskMultiplier: 1.0,
    },
    warnings: ['Highest cost — ensure budget can sustain repeated use.'],
  },
  Standard: {
    type: 'Standard',
    label: 'Standard Package',
    shortLabel: 'Standard',
    description: 'Balanced preparation with normal performance, reliability, and sponsor expectations. The default package.',
    costModifier: 1.0,
    effects: {
      paceModifier: 0,
      reliabilityPrep: 0,
      pitCrewPrep: 0,
      sponsorSatisfaction: 0,
      driverMorale: 0,
      tyrePreservation: 0,
      developmentDataGain: 1.0,
      operationalRiskMultiplier: 1.0,
      crashRiskMultiplier: 1.0,
    },
    warnings: [],
  },
  Conservative: {
    type: 'Conservative',
    label: 'Conservative Package',
    shortLabel: 'Conservative',
    description: 'Medium-low cost with a slight pace penalty but lower reliability risk, better tyre preservation, and reduced crash risk.',
    costModifier: 0.85,
    effects: {
      paceModifier: -0.1,
      reliabilityPrep: 0.15,
      pitCrewPrep: 0,
      sponsorSatisfaction: -3,
      driverMorale: -1,
      tyrePreservation: 0.15,
      developmentDataGain: 1.0,
      operationalRiskMultiplier: 0.85,
      crashRiskMultiplier: 0.85,
    },
    warnings: ['Slight pace penalty. Sponsors may be unhappy if the team is expected to attack.'],
  },
  Budget: {
    type: 'Budget',
    label: 'Budget Package',
    shortLabel: 'Budget',
    description: 'Low cost with a meaningful pace penalty. Worse pit crew prep, higher operational and reliability risk, lower sponsor satisfaction.',
    costModifier: 0.65,
    effects: {
      paceModifier: -0.3,
      reliabilityPrep: -0.2,
      pitCrewPrep: -0.15,
      sponsorSatisfaction: -10,
      driverMorale: -5,
      tyrePreservation: 0,
      developmentDataGain: 1.0,
      operationalRiskMultiplier: 1.3,
      crashRiskMultiplier: 1.1,
    },
    warnings: ['Pace penalty. Higher operational risk. Sponsors and drivers will be unhappy if used repeatedly.'],
  },
  DevelopmentTest: {
    type: 'DevelopmentTest',
    label: 'Development / Test Package',
    shortLabel: 'Dev / Test',
    description: 'Medium cost with a slight pace penalty but increased practice knowledge, setup data, and development data. Useful for rebuilding teams.',
    costModifier: 0.95,
    effects: {
      paceModifier: -0.1,
      reliabilityPrep: 0.05,
      pitCrewPrep: 0,
      sponsorSatisfaction: -2,
      driverMorale: 0,
      tyrePreservation: 0,
      developmentDataGain: 1.8,
      operationalRiskMultiplier: 1.0,
      crashRiskMultiplier: 0.95,
    },
    warnings: ['Slight pace penalty. Best used at non-priority races for rebuilding teams.'],
  },
  StartAndPark: {
    type: 'StartAndPark',
    label: 'Minimal / Start-and-Park Package',
    shortLabel: 'Minimal',
    description: 'Very low cost with very poor competitiveness. Major sponsor and reputation penalty. Only available in series that allow it.',
    costModifier: 0.35,
    effects: {
      paceModifier: -0.8,
      reliabilityPrep: -0.3,
      pitCrewPrep: -0.3,
      sponsorSatisfaction: -25,
      driverMorale: -15,
      tyrePreservation: 0,
      developmentDataGain: 0.5,
      operationalRiskMultiplier: 1.8,
      crashRiskMultiplier: 1.2,
    },
    warnings: ['Very poor race competitiveness. Major sponsor and reputation penalty. Series-restricted.'],
  },
  SkipRace: {
    type: 'SkipRace',
    label: 'Skip Race',
    shortLabel: 'Skip',
    description: 'No race participation, no operating cost, no points. Major sponsor, driver, and reputation penalty. Series-restricted.',
    costModifier: 0.0,
    effects: {
      paceModifier: 0,
      reliabilityPrep: 0,
      pitCrewPrep: 0,
      sponsorSatisfaction: -40,
      driverMorale: -25,
      tyrePreservation: 0,
      developmentDataGain: 0,
      operationalRiskMultiplier: 1.0,
      crashRiskMultiplier: 1.0,
    },
    warnings: ['No points scored. Major sponsor, driver morale, and reputation penalties. Series-restricted.'],
  },
  MandatoryMinimum: {
    type: 'MandatoryMinimum',
    label: 'Mandatory Minimum Operations',
    shortLabel: 'Minimum Ops',
    description: 'Emergency operations package for teams that cannot afford standard race operations. Gets the cars to the grid with skeleton staff, no practice, and a locked baseline setup. Severe penalties across every dimension of the race weekend.',
    costModifier: 0.0,
    effects: {
      paceModifier: -0.7,
      reliabilityPrep: -0.5,
      pitCrewPrep: -0.45,
      sponsorSatisfaction: -25,
      driverMorale: -18,
      tyrePreservation: -0.2,
      developmentDataGain: 0.2,
      operationalRiskMultiplier: 2.0,
      crashRiskMultiplier: 1.3,
    },
    warnings: [
      'Severe pace, reliability, and pit-stop penalties.',
      'No practice sessions or car setup changes — baseline setup only.',
      'Sponsor confidence and driver morale drop sharply.',
      'Higher crash and operational risk across the weekend.',
      'Repeated use escalates financial distress and owner pressure.',
      'Only available when the team cannot afford any normal package.',
    ],
  },
};

// ---------------------------------------------------------------------------
// Series rules
// ---------------------------------------------------------------------------

export const SERIES_PACKAGE_RULES: Record<Series, SeriesPackageRules> = {
  F1: {
    allowedPackages: ['FullAttack', 'Standard', 'Conservative', 'Budget', 'DevelopmentTest'],
    baseWeekendCost: 2.5, // $M
    allowsSkipRace: false,
    allowsStartAndPark: false,
  },
  IndyCar: {
    allowedPackages: ['FullAttack', 'Standard', 'Conservative', 'Budget', 'DevelopmentTest'],
    baseWeekendCost: 1.5, // $M
    allowsSkipRace: false,
    allowsStartAndPark: false,
  },
};

// Future series can be added here. NASCAR would allow StartAndPark and SkipRace.
// NASCAR: {
//   allowedPackages: ['FullAttack', 'Standard', 'Conservative', 'Budget', 'DevelopmentTest', 'StartAndPark', 'SkipRace'],
//   baseWeekendCost: 1.8,
//   allowsSkipRace: true,
//   allowsStartAndPark: true,
// },

export function availablePackagesForSeries(series: Series): RaceWeekendPackageType[] {
  const rules = SERIES_PACKAGE_RULES[series] ?? SERIES_PACKAGE_RULES.F1;
  return rules.allowedPackages;
}

export function isPackageAvailable(
  packageType: RaceWeekendPackageType,
  series: Series,
): boolean {
  return availablePackagesForSeries(series).includes(packageType);
}

// ---------------------------------------------------------------------------
// Team scale modifier — based on team reputation/tier
// ---------------------------------------------------------------------------

export type TeamScaleTier =
  | 'Elite'
  | 'Top'
  | 'Midfield'
  | 'LowerMidfield'
  | 'Backmarker'
  | 'PartTime';

export const TEAM_SCALE_MODIFIERS: Record<TeamScaleTier, number> = {
  Elite: 1.30,
  Top: 1.15,
  Midfield: 1.00,
  LowerMidfield: 0.80,
  Backmarker: 0.60,
  PartTime: 0.45,
};

export function teamScaleTier(team: Team): TeamScaleTier {
  const rep = team.reputation;
  if (rep >= 85) return 'Elite';
  if (rep >= 70) return 'Top';
  if (rep >= 50) return 'Midfield';
  if (rep >= 35) return 'LowerMidfield';
  if (rep >= 20) return 'Backmarker';
  return 'PartTime';
}

export function teamScaleModifier(team: Team): number {
  return TEAM_SCALE_MODIFIERS[teamScaleTier(team)];
}

// ---------------------------------------------------------------------------
// Track cost modifier — based on track archetype and attributes
// ---------------------------------------------------------------------------

export type TrackCostClass =
  | 'Normal'
  | 'Street'
  | 'LongTravel'
  | 'International'
  | 'CrownJewel'
  | 'HighDamageRisk';

export const TRACK_COST_MODIFIERS: Record<TrackCostClass, number> = {
  Normal: 1.00,
  Street: 1.15,
  LongTravel: 1.15,
  International: 1.30,
  CrownJewel: 1.20,
  HighDamageRisk: 1.10,
};

// Classify a track into a cost class based on its archetype and attributes.
export function trackCostClass(track: Track): TrackCostClass {
  const archetype = track.archetype;
  const attrs = track.attributes;

  // Street circuits have higher logistics and damage risk.
  if (archetype === 'Street Circuit') return 'Street';
  // High-risk circuits have higher damage reserve.
  if (archetype === 'High-Risk Circuit' || attrs.riskWallProximity >= 8) return 'HighDamageRisk';
  // Endurance circuits have higher wear.
  if (archetype === 'Endurance/Reliability Circuit' && attrs.enduranceConsistency >= 8) return 'HighDamageRisk';

  // Default to Normal for everything else.
  // In the future, specific tracks can be tagged as CrownJewel or International
  // via a data-driven lookup. For now, we use a simple heuristic.
  return 'Normal';
}

export function trackCostModifier(track: Track): number {
  return TRACK_COST_MODIFIERS[trackCostClass(track)];
}

// ---------------------------------------------------------------------------
// Damage reserve — a flat amount added to the package cost
// ---------------------------------------------------------------------------

export function damageReserve(
  series: Series,
  track: Track,
  packageType: RaceWeekendPackageType,
): number {
  if (packageType === 'SkipRace') return 0;
  const rules = SERIES_PACKAGE_RULES[series] ?? SERIES_PACKAGE_RULES.F1;
  const base = rules.baseWeekendCost * 0.1; // 10% of base as damage reserve
  const trackClass = trackCostClass(track);
  const trackMultiplier = trackClass === 'HighDamageRisk' || trackClass === 'Street' ? 1.5 : 1.0;
  const packageMultiplier = packageType === 'FullAttack' ? 1.5 : packageType === 'Budget' ? 0.5 : 1.0;
  return toMoney(base * trackMultiplier * packageMultiplier);
}

// ---------------------------------------------------------------------------
// Cost formula
// ---------------------------------------------------------------------------

// Race Weekend Cost = SeriesBase × TeamScale × TrackModifier × PackageModifier + DamageReserve

export function computeRaceWeekendPackageCost(
  series: Series,
  team: Team,
  track: Track,
  packageType: RaceWeekendPackageType,
): { cost: number; baseCost: number; teamScale: number; trackModifier: number; packageModifier: number; damageReserve: number } {
  const rules = SERIES_PACKAGE_RULES[series] ?? SERIES_PACKAGE_RULES.F1;
  const baseCost = toMoney(rules.baseWeekendCost);
  const teamScale = teamScaleModifier(team);
  const trackMod = trackCostModifier(track);
  const packageMod = RACE_WEEKEND_PACKAGES[packageType].costModifier;
  const reserve = damageReserve(series, track, packageType);

  const cost = Math.round(baseCost * teamScale * trackMod * packageMod + reserve);

  return {
    cost,
    baseCost,
    teamScale,
    trackModifier: trackMod,
    packageModifier: packageMod,
    damageReserve: reserve,
  };
}

// Convenience: compute cost for all available packages at once.
export function computeAllPackageCosts(
  series: Series,
  team: Team,
  track: Track,
): Record<RaceWeekendPackageType, ReturnType<typeof computeRaceWeekendPackageCost>> {
  const result = {} as Record<RaceWeekendPackageType, ReturnType<typeof computeRaceWeekendPackageCost>>;
  for (const pkg of availablePackagesForSeries(series)) {
    result[pkg] = computeRaceWeekendPackageCost(series, team, track, pkg);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Package effects
// ---------------------------------------------------------------------------

export function packageEffects(packageType: RaceWeekendPackageType): RaceWeekendPackageEffects {
  return RACE_WEEKEND_PACKAGES[packageType].effects;
}

// Combined opsForm bonus from package: average of reliability and pit crew prep.
export function packageOpsFormBonus(packageType: RaceWeekendPackageType): number {
  const e = packageEffects(packageType);
  return (e.reliabilityPrep + e.pitCrewPrep) / 2;
}

// ---------------------------------------------------------------------------
// AI package selection
// ---------------------------------------------------------------------------

// Weighted package selection for AI teams based on finances, personality,
// championship position, track type, and car reliability.
export function aiSelectPackage(
  ctx: AIPackageContext,
  series: Series,
  seed: string,
  teamId: string,
  raceRound: number,
): RaceWeekendPackageType {
  const available = availablePackagesForSeries(series);
  const rng = createSeededRandom(deriveSeed(seed, 'pkg', teamId, raceRound));

  // Build weights for each available package.
  const weights: Record<RaceWeekendPackageType, number> = {} as Record<RaceWeekendPackageType, number>;
  for (const pkg of available) {
    weights[pkg] = aiPackageWeight(pkg, ctx);
  }

  // Draw from the weighted distribution.
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  if (total <= 0) return 'Standard';

  let roll = rng.next() * total;
  for (const pkg of available) {
    roll -= weights[pkg];
    if (roll <= 0) return pkg;
  }
  return 'Standard';
}

function aiPackageWeight(
  pkg: RaceWeekendPackageType,
  ctx: AIPackageContext,
): number {
  let weight = 1; // base weight

  void ctx.teamBudget;

  // --- Financial gate: can't afford expensive packages if poor ---
  if (ctx.financialHealth === 'Critical' || ctx.financialHealth === 'AtRisk') {
    if (pkg === 'FullAttack') weight *= 0.05;
    if (pkg === 'Standard') weight *= 0.3;
    if (pkg === 'Budget') weight *= 3;
    if (pkg === 'Conservative') weight *= 2;
  } else if (ctx.financialHealth === 'Tight') {
    if (pkg === 'FullAttack') weight *= 0.3;
    if (pkg === 'Budget') weight *= 1.5;
  } else if (ctx.financialHealth === 'Stable' || ctx.financialHealth === 'Excellent') {
    if (pkg === 'FullAttack') weight *= 1.5;
    if (pkg === 'Budget') weight *= 0.5;
  }

  // --- Archetype / risk appetite ---
  if (ctx.risk >= 0.7) {
    if (pkg === 'FullAttack') weight *= 2;
    if (pkg === 'Budget') weight *= 0.3;
  } else if (ctx.risk <= 0.2) {
    if (pkg === 'FullAttack') weight *= 0.4;
    if (pkg === 'Conservative') weight *= 1.5;
    if (pkg === 'Budget') weight *= 1.2;
  }

  // --- Championship position ---
  if (ctx.championshipPosition <= 3) {
    // Title contenders want Full Attack, especially at important races.
    if (pkg === 'FullAttack') weight *= ctx.raceImportance > 0.7 ? 3 : 2;
    if (pkg === 'Budget') weight *= 0.2;
  } else if (ctx.championshipPosition >= ctx.teamCount - 2) {
    // Backmarkers may prefer Budget or Development.
    if (pkg === 'Budget') weight *= 1.5;
    if (pkg === 'DevelopmentTest') weight *= 1.5;
  }

  // --- Car reliability: fragile cars lean Conservative ---
  if (ctx.carReliability < 5) {
    if (pkg === 'Conservative') weight *= 2;
    if (pkg === 'FullAttack') weight *= 0.6;
  }

  // --- Damage risk track: lean Conservative ---
  if (ctx.damageRiskTrack) {
    if (pkg === 'Conservative') weight *= 1.3;
    if (pkg === 'FullAttack') weight *= 0.8;
  }

  // --- Late season: push if in title fight, otherwise save ---
  if (ctx.isLateSeason) {
    if (ctx.championshipPosition <= 3 && pkg === 'FullAttack') weight *= 1.5;
    if (ctx.championshipPosition > 5 && pkg === 'Budget') weight *= 1.3;
    if (ctx.championshipPosition > 5 && pkg === 'DevelopmentTest') weight *= 1.5;
  }

  // --- Development-focused archetypes prefer Dev/Test at non-key races ---
  if (ctx.archetype === 'DevelopmentFocused' && ctx.raceImportance < 0.5) {
    if (pkg === 'DevelopmentTest') weight *= 2.5;
    if (pkg === 'FullAttack') weight *= 0.5;
  }

  // --- Survival mode: Budget or Minimal ---
  if (ctx.archetype === 'SurvivalMode') {
    if (pkg === 'Budget') weight *= 3;
    if (pkg === 'FullAttack') weight *= 0.1;
    if (pkg === 'Standard') weight *= 0.8;
  }

  // Ensure weight is non-negative.
  return Math.max(0.01, weight);
}

// ---------------------------------------------------------------------------
// Labels and UI helpers
// ---------------------------------------------------------------------------

export const PACKAGE_LABELS: Record<RaceWeekendPackageType, string> = {
  FullAttack: 'Full Attack Package',
  Standard: 'Standard Package',
  Conservative: 'Conservative Package',
  Budget: 'Budget Package',
  DevelopmentTest: 'Development / Test Package',
  StartAndPark: 'Minimal / Start-and-Park Package',
  SkipRace: 'Skip Race',
  MandatoryMinimum: 'Mandatory Minimum Operations',
};

export const PACKAGE_COLORS: Record<RaceWeekendPackageType, string> = {
  FullAttack: 'text-red-400',
  Standard: 'text-blue-400',
  Conservative: 'text-green-400',
  Budget: 'text-orange-400',
  DevelopmentTest: 'text-purple-400',
  StartAndPark: 'text-neutral-500',
  SkipRace: 'text-neutral-600',
  MandatoryMinimum: 'text-rose-400',
};

export const PACKAGE_BORDER_COLORS: Record<RaceWeekendPackageType, string> = {
  FullAttack: 'border-red-500/50',
  Standard: 'border-blue-500/50',
  Conservative: 'border-green-500/50',
  Budget: 'border-orange-500/50',
  DevelopmentTest: 'border-purple-500/50',
  StartAndPark: 'border-neutral-600/50',
  SkipRace: 'border-neutral-700/50',
  MandatoryMinimum: 'border-rose-600/50',
};

export function formatPackageCost(cost: number): string {
  return `$${(cost / MILLION).toFixed(2)}M`;
}

// ---------------------------------------------------------------------------
// Emergency / Mandatory Minimum Operations helpers
// ---------------------------------------------------------------------------

// Check if a team can afford any normal (non-emergency) package.
export function canAffordAnyNormalPackage(
  series: Series,
  team: Team,
  track: Track,
): boolean {
  const normalPackages = availablePackagesForSeries(series);
  for (const pkg of normalPackages) {
    const cost = computeRaceWeekendPackageCost(series, team, track, pkg);
    if (team.budget >= cost.cost) return true;
  }
  return false;
}

// Compute the MandatoryMinimum package cost (always 0 — emergency operations).
export function computeMandatoryMinimumCost(): { cost: number; baseCost: number; teamScale: number; trackModifier: number; packageModifier: number; damageReserve: number } {
  return {
    cost: 0,
    baseCost: 0,
    teamScale: 1,
    trackModifier: 1,
    packageModifier: 0,
    damageReserve: 0,
  };
}

// ---------------------------------------------------------------------------
// Financial distress helpers
// ---------------------------------------------------------------------------

import type { FinancialDistressState, FinancialDistressLevel } from '../types/raceWeekendPackageTypes';

export function defaultFinancialDistress(): FinancialDistressState {
  return {
    level: 'Stable',
    consecutiveNegativeCashRaces: 0,
    racesUsingEmergencyPackage: 0,
    ownerPressure: 0,
  };
}

export function distressLevelFromConsecutiveNegative(negativeRaces: number): FinancialDistressLevel {
  if (negativeRaces <= 0) return 'Stable';
  if (negativeRaces === 1) return 'Tight';
  if (negativeRaces <= 3) return 'AtRisk';
  if (negativeRaces <= 5) return 'Critical';
  if (negativeRaces <= 7) return 'Administration';
  return 'ClosureRisk';
}

export function updateFinancialDistress(
  current: FinancialDistressState | undefined,
  teamBudget: number,
  usedEmergencyPackage: boolean,
): FinancialDistressState {
  const prev = current ?? defaultFinancialDistress();
  const isNegative = teamBudget < 0;
  const consecutiveNegativeCashRaces = isNegative
    ? prev.consecutiveNegativeCashRaces + 1
    : 0;
  const racesUsingEmergencyPackage = usedEmergencyPackage
    ? prev.racesUsingEmergencyPackage + 1
    : prev.racesUsingEmergencyPackage;
  const level = distressLevelFromConsecutiveNegative(consecutiveNegativeCashRaces);
  const ownerPressure = Math.min(100, Math.max(0,
    prev.ownerPressure + (usedEmergencyPackage ? 10 : 0) + (isNegative ? 5 : 0) - (level === 'Stable' ? 5 : 0),
  ));
  return {
    level,
    consecutiveNegativeCashRaces,
    racesUsingEmergencyPackage,
    ownerPressure,
  };
}

export function distressNewsHeadline(
  teamName: string,
  distress: FinancialDistressState,
): { headline: string; body: string } | null {
  switch (distress.level) {
    case 'Tight':
      return {
        headline: `${teamName} finances tighten as budget runs thin`,
        body: `${teamName} is operating with a negative budget. The team will need to manage costs carefully.`,
      };
    case 'AtRisk':
      return {
        headline: `Financial pressure mounts at ${teamName}`,
        body: `${teamName} has now operated at a loss for ${distress.consecutiveNegativeCashRaces} consecutive races. Owner pressure is rising.`,
      };
    case 'Critical':
      return {
        headline: `${teamName} in critical financial state`,
        body: `Prolonged financial distress at ${teamName} has reached critical levels. Repeated use of emergency operations is drawing scrutiny from team owners.`,
      };
    case 'Administration':
      return {
        headline: `Owner intervention looms at ${teamName}`,
        body: `${teamName} has been financially distressed for ${distress.consecutiveNegativeCashRaces} races. The team faces potential administration if the situation does not improve.`,
      };
    case 'ClosureRisk':
      return {
        headline: `${teamName} at risk of closure`,
        body: `Severe and prolonged financial distress at ${teamName} has put the team's future in jeopardy. Without a dramatic turnaround, the team may not survive the offseason.`,
      };
    default:
      return null;
  }
}
