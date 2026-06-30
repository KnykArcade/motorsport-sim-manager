// Core domain models for the Motorsport History Manager.
// These types are intentionally decoupled from React so the simulation and
// data layers can evolve independently of the UI.

export type Series = 'F1' | 'IndyCar';

export type GameMode = 'SingleSeason' | 'Career';

// ---------------------------------------------------------------------------
// Track / season
// ---------------------------------------------------------------------------

export type TrackArchetype =
  | 'Street Circuit'
  | 'Power Circuit'
  | 'High Downforce Circuit'
  | 'Technical Circuit'
  | 'Balanced Circuit'
  | 'Stop-Start Circuit'
  | 'High-Speed Circuit'
  | 'Low-Speed Mechanical Grip Circuit'
  | 'High-Risk Circuit'
  | 'Endurance/Reliability Circuit';

// 1-10 scale ratings describing the physical character of a circuit.
export type TrackAttributes = {
  corners: number;
  braking: number;
  straights: number;
  tractionAcceleration: number;
  elevationBlindCorners: number;
  technical: number;
  overtakingRacecraft: number;
  surfaceGripBumpiness: number;
  riskWallProximity: number;
  enduranceConsistency: number;
};

// Helper values the simulation uses to weight car/setup contributions.
export type TrackSetupProfile = {
  primarySetupProfile: string;
  downforceLevel: string;
  topSpeedEmphasis: number; // engine / top-speed emphasis (1-10)
  mechanicalGripEmphasis: number;
  brakeDemand: number;
  reliabilityRiskFocus: number;
  strategyNotes: string;
  aeroDemand: number;
  powerDemand: number;
  mechanicalDemand: number;
  riskDemand: number;
};

export type Track = {
  id: string;
  name: string;
  gpName: string;
  country?: string;
  archetype: string;
  attributes: TrackAttributes;
  setupProfile: TrackSetupProfile;
  ratingNotes: string;
};

export type Race = {
  id: string;
  round: number;
  gpName: string;
  trackId: string;
  trackName: string;
  laps: number;
  distanceKm?: number;
  completed: boolean;
};

export type Season = {
  id: string;
  year: number;
  name: string;
  series: Series;
  calendar: Race[];
  pointsSystemId: string;
  regulationSetId: string;
  generated?: boolean; // true for placeholder future seasons
};

// ---------------------------------------------------------------------------
// Teams / cars / drivers
// ---------------------------------------------------------------------------

export type CarRatings = {
  enginePower: number;
  aeroEfficiency: number;
  mechanicalGrip: number;
  reliability: number;
  pitCrewOperations: number;
};

export type Car = {
  id: string;
  teamId: string;
  seasonYear: number;
  ratings: CarRatings;
  condition: number; // 0-100
  // Accumulated development applied on top of base ratings.
  developmentLevel: CarRatings;
  // Engine supplier deal contribution to enginePower / reliability (Phase 5).
  // A delta on the 1-10 ratings scale; absent = no engine-deal modifier.
  engineBonus?: { power: number; reliability: number };
};

export type DriverRatings = {
  cornering: number;
  braking: number;
  straights: number;
  tractionAcceleration: number;
  elevationBlindCorners: number;
  technical: number;
  overtakingRacecraft: number;
  surfaceGripBumpiness: number;
  riskManagement: number;
  enduranceConsistency: number;
  qualifying: number;
  racePace: number;
  adaptability: number;
  aggression: number;
  composure: number;
  overall: number;
};

export type Driver = {
  id: string;
  name: string;
  number: number;
  nationality?: string;
  age?: number;
  teamId: string;
  ratings: DriverRatings;
  morale: number; // 0-100
  confidence: number; // 0-100
  contractYearsRemaining?: number;
  salary?: number;
  // Contract tier. 'third' marks a cheaper mid-season reserve/3rd-driver deal;
  // undefined or 'seat' is a full race-seat contract.
  contractType?: 'seat' | 'third';
  traits: string[];
};

export type Team = {
  id: string;
  name: string;
  shortName: string;
  country?: string;
  carId: string;
  driverIds: string[];
  budget: number;
  reputation: number; // 0-100
  morale: number; // 0-100
  expectedStanding?: number;
  difficulty?: 'Easy' | 'Medium' | 'Hard' | 'Very Hard';
  color: string; // accent color for UI
};

// ---------------------------------------------------------------------------
// Points / regulations
// ---------------------------------------------------------------------------

export type PointsSystem = {
  id: string;
  name: string;
  pointsByPosition: Record<number, number>;
};

export type RegulationSet = {
  id: string;
  seasonYear: number;
  series: string;
  pointsSystemId: string;
  qualifyingFormat: string;
  raceWeekendFormat: string;
  testingLimit?: number;
  budgetCap?: number;
  designRules: {
    enginePowerWeight: number;
    aeroEfficiencyWeight: number;
    mechanicalGripWeight: number;
    reliabilityWeight: number;
    minimumReliability?: number;
  };
  carryoverModifiers: {
    enginePower: number;
    aeroEfficiency: number;
    mechanicalGrip: number;
    reliability: number;
    pitCrewOperations: number;
  };
  notes: string[];
};

export type RegulationChangeEvent = {
  id: string;
  name: string;
  description: string;
  severity: 'Stable' | 'Minor' | 'Moderate' | 'Major';
  affectedAreas: Array<
    'Engine' | 'Aero' | 'Mechanical' | 'Reliability' | 'Budget' | 'Testing' | 'Qualifying' | 'Points'
  >;
  effects: {
    carryoverModifiers?: Partial<CarRatings>;
    developmentCostModifiers?: Partial<Record<string, number>>;
    reliabilityRequirementChange?: number;
    pointsSystemId?: string;
    qualifyingFormat?: string;
  };
};

// ---------------------------------------------------------------------------
// Setup / decisions
// ---------------------------------------------------------------------------

export type SetupOption = {
  id: string;
  name: string;
  description: string;
  downforce: number;
  topSpeed: number;
  mechanicalGrip: number;
  brakingStability: number;
  tirePreservation: number;
  reliabilityProtection: number;
  qualifyingBoost: number;
  racePaceBoost: number;
  riskModifier: number;
};

export type QualifyingRunPlanId =
  | 'BankerLapFirst'
  | 'StandardPush'
  | 'MaximumAttack'
  | 'ConservativeCleanLap'
  | 'LateTrackEvolution'
  | 'SaveTiresProtectCar';

export type QualifyingRunPlan = {
  id: QualifyingRunPlanId;
  name: string;
  description: string;
  paceModifier: number;
  mistakeModifier: number;
  crashModifier: number;
  trafficModifier: number;
  mechanicalStressModifier: number;
  confidenceModifier: number;
};

export type RaceStrategyId =
  | 'ConservativeOneStop'
  | 'BalancedOneStop'
  | 'AggressiveTwoStop'
  | 'UndercutFocused'
  | 'OvercutFocused'
  | 'TrackPositionFocus'
  | 'SafetyFirstPoints'
  | 'ReactiveStrategy';

export type RaceStrategy = {
  id: RaceStrategyId;
  name: string;
  description: string;
  paceModifier: number;
  tireDegModifier: number;
  pitRiskModifier: number;
  overtakeModifier: number;
  trackPositionModifier: number;
};

export type DriverInstructionId =
  | 'Conservative'
  | 'Balanced'
  | 'Aggressive'
  | 'MaximumAttack'
  | 'ProtectCar'
  | 'PrioritizePoints'
  | 'HoldPosition'
  | 'SupportTeammate'
  | 'AttackTeammate'
  | 'DefendTrackPosition';

export type DriverInstruction = {
  id: DriverInstructionId;
  name: string;
  description: string;
  paceModifier: number;
  mistakeModifier: number;
  overtakeModifier: number;
  tireWearModifier: number;
  reliabilityStressModifier: number;
};

// ---------------------------------------------------------------------------
// Development
// ---------------------------------------------------------------------------

export type DevelopmentHorizon =
  | 'RaceSpecific'
  | 'CurrentSeason'
  | 'NextSeasonResearch'
  | 'LongTermInfrastructure';

export type DevelopmentCategory =
  | 'Engine'
  | 'Aero'
  | 'Mechanical'
  | 'Reliability'
  | 'PitCrew'
  | 'Strategy'
  | 'Driver'
  | 'Facilities'
  | 'Research';

export type DevelopmentProject = {
  id: string;
  name: string;
  category: DevelopmentCategory;
  horizon: DevelopmentHorizon;
  cost: number;
  durationRaces: number;
  progressRaces: number;
  successChance: number;
  currentSeasonEffects?: Partial<CarRatings>;
  nextSeasonEffects?: Partial<CarRatings>;
  facilityEffects?: Record<string, number>;
  carryoverRate: number; // 0-1
  regulationSensitivity: number; // 0-1
  risk?: string;
};

// ---------------------------------------------------------------------------
// Standings / results
// ---------------------------------------------------------------------------

export type StandingsEntry = {
  entityId: string;
  points: number;
  wins: number;
  podiums: number;
  dnfs: number;
};

export type RaceFinishStatus = 'Finished' | 'DNF' | 'DNS' | 'DSQ';

export type RaceResult = {
  position: number | null;
  driverId: string;
  teamId: string;
  gridPosition: number;
  status: RaceFinishStatus;
  lapsCompleted: number;
  points: number;
  raceScore: number;
  gapText: string;
  incidents: string[];
  rating?: number; // driver performance rating 1-10
};

export type QualifyingIncident = {
  type: 'None' | 'Spin' | 'Crash' | 'Mechanical Issue' | 'Traffic' | 'Invalid Lap';
  severity: 'Minor' | 'Moderate' | 'Major';
  raceImpact?: string;
};

export type QualifyingResult = {
  position: number;
  driverId: string;
  teamId: string;
  qualifyingScore: number;
  gapText: string;
  runPlan: string;
  setupChoice: string;
  notes: string[];
  incident?: QualifyingIncident;
  // True when the car finished outside the series' qualifying cap and is not
  // allowed to start the race (DNQ — Did Not Qualify).
  dnq?: boolean;
};

// ---------------------------------------------------------------------------
// Offseason (Career)
// ---------------------------------------------------------------------------

export type OffseasonBudgetPlan = {
  nextYearCarDesign: number;
  engineProgram: number;
  aeroProgram: number;
  mechanicalProgram: number;
  reliabilityProgram: number;
  facilities: number;
  driverContracts: number;
  staff: number;
  testing: number;
  reserve: number;
};

export type OffseasonSummary = {
  seasonYear: number;
  championDriverId?: string;
  championTeamId?: string;
  regulationEventId?: string;
  budgetPlan?: OffseasonBudgetPlan;
  notes: string[];
};

export type NewsItem = {
  id: string;
  round?: number;
  headline: string;
  body?: string;
  timestamp: string;
};
