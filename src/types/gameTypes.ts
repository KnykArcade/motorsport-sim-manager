// Core domain models for the Motorsport History Manager.
// These types are intentionally decoupled from React so the simulation and
// data layers can evolve independently of the UI.

export type Series = 'F1' | 'IndyCar' | 'CART' | 'Champ Car';

export type GameMode = 'SingleSeason' | 'Career' | 'Sandbox';

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

// 1-100 scale ratings describing the physical character of a circuit.
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
  pointsMultiplier?: number;
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
  // A delta on the 1-100 ratings scale; absent = no engine-deal modifier.
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
  // Contract tier. 'third'/'reserve'/'test' mark cheaper non-racing deals (a
  // 3rd/reserve/test driver sits behind the two race seats); undefined or 'seat'
  // is a full race-seat contract.
  contractType?: 'seat' | 'third' | 'reserve' | 'test';
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
  // Race Operations Rating (1-100): strategy, pit-crew quality, setup execution,
  // reliability management, engineering consistency and race-weekend execution.
  // Distinct from reputation (prestige/commercial). Drives the team component of
  // race & qualifying pace and the per-weekend operations variance.
  raceOperations: number; // 1-100
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
  bonusNotes?: string;
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
  // Era-specific rule metadata.
  refuelingAllowed: boolean;
  drsEnabled: boolean;
  sprintSupport: boolean;
  pushToPass: boolean;
  tireChangeRules: string;
  eraLabel: string;
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

export type ProjectRiskLevel = 'Safe' | 'Standard' | 'Aggressive' | 'Experimental';

export type ProjectSize = 'Small' | 'Medium' | 'Major' | 'Experimental';

export type DevelopmentOutcome =
  | 'GreatSuccess'
  | 'FullSuccess'
  | 'PartialSuccess'
  | 'MinorSuccess'
  | 'Failed'
  | 'RareBackfire';

export type DevelopmentOutcomeResult = {
  outcome: DevelopmentOutcome;
  expectedGain: Partial<CarRatings>;
  actualGain: Partial<CarRatings>;
  sideEffects?: Partial<CarRatings>;
  label: string;
  description: string;
};

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
  riskLevel?: ProjectRiskLevel;
  projectSize?: ProjectSize;
  relevantFacilityTypes?: string[];
  outcomeResult?: DevelopmentOutcomeResult;
  rushed?: boolean;
  facilityLevelAtStart?: number;
  adjustedDurationRaces?: number;
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

// The qualifying segment a driver's final time was set in (knockout format).
// 'Single' = a one-session (non-knockout) format.
export type QualifyingSegment = 'Q1' | 'Q2' | 'Q3' | 'Single';

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
  // Knockout segment this driver reached / was eliminated in. Optional for
  // backward compatibility with saves made before knockout qualifying.
  segment?: QualifyingSegment;
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
  // Structured career event fields (optional for backward compatibility).
  category?: NewsCategory;
  priority?: NewsPriority;
  careerPhase?: string;
  teamId?: string;
  driverId?: string;
};

export type NewsCategory =
  | 'race_result'
  | 'qualifying'
  | 'practice'
  | 'preseason'
  | 'paddock'
  | 'post_race'
  | 'financial'
  | 'driver_market'
  | 'youth_academy'
  | 'development'
  | 'sponsor'
  | 'ai_team'
  | 'career_event'
  | 'championship'
  | 'regulation'
  | 'general';

export type NewsPriority = 'low' | 'normal' | 'high' | 'critical';

// ---------------------------------------------------------------------------
// Phase 0: expanded 1-100 master schema (additive, pilot-friendly)
// ---------------------------------------------------------------------------

export type Phase0SeasonKey = {
  year: number;
  series: Series;
};

export type Phase0SeriesAffinity = {
  series: Series;
  strength: number;
};

export type Phase0CareerTimelineEntry = {
  year: number;
  series: Series;
  teamId: string;
  role: 'driver' | 'reserve' | 'principal' | 'academy';
};

export type Phase0Contract = {
  teamId: string;
  yearsLeft: number;
  salary: number;
  options?: string[];
};

export type GlobalDriver = {
  driverId: string;
  name: string;
  nationality?: string;
  dateOfBirth?: string;
  birthYear?: number;
  traits: string[];
  seriesAffinity: Phase0SeriesAffinity[];
  careerTimeline: Phase0CareerTimelineEntry[];

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
  startsRestarts: number;
  wetWeather: number;
  tireManagement: number;
  adaptability: number;
  aggression: number;
  composure: number;
  pressureHandling: number;
  feedbackQuality: number;
  technicalUnderstanding: number;
  mechanicalSympathy: number;
  overall: number;
  potential: number;
  developmentPotential: number;

  morale: number;
  trust: number;
  reputation: number;
  marketValue: number;
  contract: Phase0Contract;
};

export type GlobalTeamNamePeriod = {
  fromYear: number;
  toYear?: number;
  name: string;
};

export type GlobalTeamNameChangeEvent = {
  year: number;
  oldName?: string;
  newName: string;
  note?: string;
};

export type GlobalTeam = {
  teamLineageId: string;
  series: Series;
  canonicalName: string;
  namePerPeriod: GlobalTeamNamePeriod[];
  nameChangeEvents: GlobalTeamNameChangeEvent[];

  reputation: number;
  raceOperations: number;
  pitCrewOperations: number;
  developmentRate: number;
  facilities: number;
  sponsorStrength: number;
  commercialStrength: number;
  politicalInfluence: number;
  financeHealth: number;
  budget: number;
};

export type GlobalCar = {
  carId: string;
  teamId: string;
  seasonYear: number;
  series: Series;
  enginePower: number;
  fuelEnergyEfficiency: number;
  drag: number;
  downforce: number;
  chassisBalance: number;
  cooling: number;
  weightEfficiency: number;
  mechanicalGrip: number;
  brakingStability: number;
  acceleration: number;
  topSpeed: number;
  tireWear: number;
  tireWarmup: number;
  tempControl: number;
  wetPerformance: number;
  reliability: number;
  setupWindow: number;
  upgradeCompatibility: number;
  carOverall: number;
};

export type GlobalTrackDemandProfile = {
  downforceDemand: number;
  powerDemand: number;
  mechanicalDemand: number;
  brakeDemand: number;
  tireDemand: number;
  coolingDemand: number;
  riskDemand: number;
  tractionDemand?: number;
  overtakingDifficulty?: number;
  tireWearSeverity?: number;
  reliabilityStress?: number;
  setupComplexity?: number;
  pitStrategySensitivity?: number;
  safetyCarCautionRisk?: number;
  overallTrackDifficulty?: number;
  winnerBaseline?: number;
};

export type GlobalTrack = {
  trackId: string;
  name: string;
  facility?: string;
  configNote?: string;
  type: 'oval' | 'street' | 'road' | 'mixed' | 'airport' | 'temporary';
  category?: 'Road' | 'Street' | 'Oval';
  ovalSubtype?: 'Short Oval' | 'Speedway' | 'Superspeedway';
  subcategory?: string;
  location?: string;
  city?: string;
  stateProvinceRegion?: string;
  country?: string;
  locationDisplay?: string;
  locationConfidence?: string;
  locationSource?: string;
  lengthKm: number;
  seasonsUsed: Phase0SeasonKey[];
  aliases: string[];
  attributes: {
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
  demandProfile: GlobalTrackDemandProfile;
};

export type SupplierType = 'engine' | 'chassis';

export type Supplier = {
  supplierId: string;
  type: SupplierType;
  name: string;
  seriesList: Series[];
  years: { start: number; end?: number }[];
  power: number;
  reliability: number;
  efficiency: number;
};

export type TireManufacturer = {
  manufacturerId: string;
  name: string;
  series: Series;
  seasonYear: number;
  grip: number;
  durability: number;
  degradationControl: number;
  warmup: number;
  wetPerformance: number;
  ovalLoadPerformance: number;
  roadStreetPerformance: number;
  consistency: number;
  failureRisk: number;
  compoundDepth: number;
  developmentSupport: number;
  costLevel: number;
  politicalInfluence: number;
};

export type TeamPrincipalCareerEntry = {
  year: number;
  series: Series;
  teamId: string;
  role: string;
};

export type TeamPrincipalContract = {
  teamId: string;
  yearsLeft: number;
  salary: number;
  options?: string[];
};

export type TeamPrincipal = {
  principalId: string;
  name: string;
  principalType: 'Real' | 'Generated';
  careerTimeline: TeamPrincipalCareerEntry[];
  contract?: TeamPrincipalContract;
  leadership: number;
  technicalVision: number;
  operations: number;
  driverManagement: number;
  commercial: number;
  political: number;
  riskAppetite: number;
  developmentVision: number;
  crisisManagement: number;
  negotiation: number;
  reputation: number;
};

export type YouthProspectRatingBlock = {
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
};

export type YouthProspect = {
  prospectId: string;
  name: string;
  age: number;
  birthYear: number;
  nationality: string;
  preferredSeries: Series | 'Any';
  currentLevel: string;
  potential: number;
  hiddenRatings: YouthProspectRatingBlock;
  signingDifficulty: string;
};

export type Phase0SeasonEntityReference = {
  entityId: string;
  label: string;
  sourceSheet: string;
};

export type Phase0SeasonCalendarRow = {
  round: number;
  raceName: string;
  trackId: string;
  trackName: string;
  laps: number;
  distanceKm: number;
  pointsMultiplier?: number;
};

export type Phase0SeasonAssignment = {
  season: number;
  series: Series;
  entityId: string;
  role: 'driver' | 'team' | 'track' | 'supplier' | 'tire' | 'principal' | 'prospect';
  sourceSheet: string;
};

export type Phase0SeasonBundle = {
  season: number;
  series: Series;
  seasonId: string;
  calendar: Phase0SeasonCalendarRow[];
  standings?: Array<{
    driverId: string;
    teamId: string;
    position: number;
    points: number;
  }>;
  teamEntries: Array<{
    teamId: string;
    carNumber: string;
    driverId: string;
    chassis: string;
    engine: string;
  }>;
  driverAssignments: Phase0SeasonEntityReference[];
  teamAssignments: Phase0SeasonEntityReference[];
  trackAssignments: Phase0SeasonEntityReference[];
  supplierAssignments: Phase0SeasonEntityReference[];
  tireAssignments: Phase0SeasonEntityReference[];
  principalAssignments: Phase0SeasonEntityReference[];
  youthAssignments: Phase0SeasonEntityReference[];
};

export type Phase0GlobalRegistry = {
  drivers: GlobalDriver[];
  teams: GlobalTeam[];
  cars: GlobalCar[];
  tracks: GlobalTrack[];
  suppliers: Supplier[];
  tires: TireManufacturer[];
  principals: TeamPrincipal[];
  youthProspects: YouthProspect[];
};
