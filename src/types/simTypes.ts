// Inputs and intermediate structures used by the simulation engines.

import type {
  Car,
  Driver,
  DriverInstruction,
  QualifyingResult,
  QualifyingRunPlan,
  RaceStrategy,
  SetupOption,
  Track,
} from './gameTypes';

// Per-driver decisions made during the qualifying phase.
export type QualifyingDecision = {
  driverId: string;
  setupId: string;
  runPlanId: QualifyingRunPlan['id'];
};

// Per-driver decisions made during the race phase (after qualifying).
export type RaceDecision = {
  driverId: string;
  setupId: string;
  strategyId: RaceStrategy['id'];
  instructionId: DriverInstruction['id'];
};

export type Entrant = {
  driver: Driver;
  car: Car;
};

export type QualifyingContext = {
  track: Track;
  entrants: Entrant[];
  decisions: Record<string, QualifyingDecision>;
  setupOptions: Record<string, SetupOption>;
  runPlans: Record<string, QualifyingRunPlan>;
  seed: string;
};

export type RaceContext = {
  track: Track;
  entrants: Entrant[];
  qualifyingResults: QualifyingResult[];
  decisions: Record<string, RaceDecision>;
  setupOptions: Record<string, SetupOption>;
  strategies: Record<string, RaceStrategy>;
  instructions: Record<string, DriverInstruction>;
  pointsByPosition: Record<number, number>;
  seed: string;
};

// Debug breakdown surfaced in the developer panel so formulas can be tuned.
export type ScoreBreakdown = {
  driverId: string;
  driverBase: number;
  carBase: number;
  trackFit: number;
  setupFit: number;
  reliabilityRisk: number;
  mistakeRisk: number;
  variance: number;
  finalScore: number;
};

export type RaceEvent = {
  lap: number;
  text: string;
};
