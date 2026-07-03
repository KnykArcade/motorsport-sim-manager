// Race Weekend Package types — series-agnostic race weekend cost system.
//
// Before each race weekend, the team chooses what level of race weekend
// operation they are bringing to the event. This package determines cost,
// preparation level, race support, risk, sponsor satisfaction, and performance
// modifiers.

export type RaceWeekendPackageType =
  | 'FullAttack'
  | 'Standard'
  | 'Conservative'
  | 'Budget'
  | 'DevelopmentTest'
  | 'StartAndPark'
  | 'SkipRace'
  | 'MandatoryMinimum';

// The performance and operational effects a package applies to the weekend.
export type RaceWeekendPackageEffects = {
  // Pace modifier applied to qualifying and race pace (on the 1-10 scale).
  paceModifier: number;
  // Reliability preparation bonus/penalty (added to opsForm, -1..1 range).
  reliabilityPrep: number;
  // Pit crew preparation bonus/penalty (added to opsForm, -1..1 range).
  pitCrewPrep: number;
  // Sponsor satisfaction delta (0-100 scale, applied to sponsor confidence).
  sponsorSatisfaction: number;
  // Driver morale delta (0-100 scale).
  driverMorale: number;
  // Tyre preservation bonus (reduces tyre wear, 0 = neutral, positive = better).
  tyrePreservation: number;
  // Development data gain multiplier (1.0 = normal, >1 = more data).
  developmentDataGain: number;
  // Operational error risk multiplier (1.0 = normal, >1 = more mistakes).
  operationalRiskMultiplier: number;
  // Crash/mistake risk multiplier (1.0 = normal, <1 = safer).
  crashRiskMultiplier: number;
};

// A resolved package selection for a specific race weekend.
export type RaceWeekendPackageSelection = {
  packageType: RaceWeekendPackageType;
  raceId: string;
  gpName: string;
  cost: number; // in dollars
  teamScale: number;
  trackModifier: number;
  packageModifier: number;
  damageReserve: number;
};

// Which packages are available for a given series.
export type SeriesPackageRules = {
  allowedPackages: RaceWeekendPackageType[];
  baseWeekendCost: number; // in $M
  allowsSkipRace: boolean;
  allowsStartAndPark: boolean;
};

// AI context for package selection.
export type AIPackageContext = {
  teamBudget: number; // in dollars
  financialHealth: string;
  archetype: string;
  risk: number; // 0-1
  championshipPosition: number;
  teamCount: number;
  carReliability: number; // 1-10
  raceImportance: number; // 0-1 (crown jewel = 1)
  isLateSeason: boolean;
  damageRiskTrack: boolean;
};

// Financial distress levels for teams.
export type FinancialDistressLevel =
  | 'Stable'
  | 'Tight'
  | 'AtRisk'
  | 'Critical'
  | 'Administration'
  | 'ClosureRisk';

// Lightweight financial distress tracking per team.
export type FinancialDistressState = {
  level: FinancialDistressLevel;
  consecutiveNegativeCashRaces: number;
  racesUsingEmergencyPackage: number;
  ownerPressure: number; // 0-100
};

// Map of teamId -> financial distress state.
export type FinancialDistressMap = Record<string, FinancialDistressState>;
