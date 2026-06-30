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
import type { WeatherState } from './liveTypes';

// How a driver manages tyres across their qualifying runs.
export type QualifyingTyreApproach = 'Standard' | 'Conserve';

// Per-driver decisions made during the qualifying phase.
export type QualifyingDecision = {
  driverId: string;
  setupId: string;
  runPlanId: QualifyingRunPlan['id'];
  // Number of timed runs (1-3). More runs find more pace but raise the chance of
  // an incident and use more tyre/fuel life. Defaults to 1 if omitted.
  runs?: number;
  // Tyre management across the runs. 'Conserve' trades peak pace for fresher
  // tyres and lower risk. Defaults to 'Standard'.
  tyreApproach?: QualifyingTyreApproach;
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

export type QualifyingFormat = 'Knockout' | 'SingleLap';

export type QualifyingContext = {
  track: Track;
  entrants: Entrant[];
  decisions: Record<string, QualifyingDecision>;
  setupOptions: Record<string, SetupOption>;
  runPlans: Record<string, QualifyingRunPlan>;
  seed: string;
  // Maximum number of cars allowed to start the race. Cars slower than this in
  // qualifying are flagged DNQ. Undefined means no cap.
  maxQualifiers?: number;
  // Session weather (from the weekend forecast). Wet/changeable sessions add
  // variance and reward driver skill. Undefined = treated as dry.
  weather?: WeatherState;
  // Drivers who ran Wet-Weather Preparation in practice — they cope better when
  // qualifying is wet.
  wetPreparedDriverIds?: string[];
  // Qualifying format. Knockout runs Q1/Q2/Q3 elimination segments; SingleLap is
  // one combined session. Defaults to SingleLap.
  format?: QualifyingFormat;
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
