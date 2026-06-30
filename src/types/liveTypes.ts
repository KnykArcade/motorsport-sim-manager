// Types for the live-race simulation (Phase A).
//
// The live race is a *forward* simulation: cars accumulate per-lap time and the
// classification emerges from the running order, rather than being precomputed.
// Player and AI decisions, weather, safety cars and reliability all perturb the
// outcome as it plays out. The final classification is converted back into the
// existing `RaceResult[]` shape so standings/news/morale are unaffected.

import type { RaceFinishStatus } from './gameTypes';
import type { RaceEvent } from './simTypes';

// ---------------------------------------------------------------------------
// Weather
// ---------------------------------------------------------------------------

export type WeatherCondition =
  | 'Dry'
  | 'Cloudy'
  | 'LightRain'
  | 'HeavyRain'
  | 'Drying'
  | 'Changeable';

export type WeatherState = {
  condition: WeatherCondition;
  // 0..1 grip available relative to a dry track (1 = full dry grip).
  gripLevel: number;
  wet: boolean;
  // Hint that conditions may change soon (drives AI/player gambles).
  changingSoon: boolean;
  label: string;
};

// ---------------------------------------------------------------------------
// Safety car
// ---------------------------------------------------------------------------

export type SafetyCarState = {
  active: boolean;
  lapsRemaining: number;
  deployedOnLap: number | null;
  reason: string | null;
  // How many times the SC has been deployed this race.
  deployments: number;
};

// ---------------------------------------------------------------------------
// Tyres
// ---------------------------------------------------------------------------

export type TireCompound = 'Dry' | 'Wet';

export type TireState = {
  compound: TireCompound;
  age: number; // laps on the current set
  wear: number; // 0 (fresh) .. 100 (worn out)
  // Target stint length for the current set (laps) before a planned stop.
  stintTarget: number;
};

// ---------------------------------------------------------------------------
// Pit stops
// ---------------------------------------------------------------------------

// The advisory pit window for a car's next planned stop. The player can box at
// any time, but the window shows when the strategist recommends stopping.
export type PitWindow = {
  open: number; // first lap of the window
  ideal: number; // strategist's target lap
  close: number; // last lap before the stop is forced
};

export type PitStopState = {
  plannedStops: number;
  stopsMade: number;
  // Remaining scheduled pit laps (may be mutated by reactive decisions).
  scheduledLaps: number[];
  lastPitLap: number | null;
  inPitThisLap: boolean;
  // Player-controlled pitting: the next stop's advisory window, and a flag set
  // when the player has called the car in. AI cars leave these null/false and
  // pit off their scheduledLaps as before.
  window: PitWindow | null;
  pitRequested: boolean;
};

// ---------------------------------------------------------------------------
// Reliability
// ---------------------------------------------------------------------------

export type ReliabilityIssueType =
  | 'EngineOverheating'
  | 'GearboxWarning'
  | 'BrakeIssue'
  | 'SuspensionConcern'
  | 'HydraulicLeak'
  | 'ElectricalGlitch'
  | 'TireVibration'
  | 'CoolingProblem';

export type ReliabilityIssue = {
  type: ReliabilityIssueType;
  label: string;
  severity: 'Minor' | 'Moderate' | 'Severe';
  lap: number;
  // Extra per-lap failure probability while the issue is unmanaged.
  failureRisk: number;
  // True once the driver/team has chosen how to handle it.
  managed: boolean;
};

// ---------------------------------------------------------------------------
// Pace / AI
// ---------------------------------------------------------------------------

export type PaceMode = 'Push' | 'Balanced' | 'Conserve' | 'Nurse';

export type AIStrategyPersonality =
  | 'Conservative'
  | 'Balanced'
  | 'Aggressive'
  | 'Opportunistic'
  | 'RiskAverse'
  | 'UndercutFocused'
  | 'OvercutFocused'
  | 'ReliabilityProtective'
  | 'TrackPositionFocused';

// ---------------------------------------------------------------------------
// Decision prompts
// ---------------------------------------------------------------------------

export type RaceDecisionCategory =
  | 'Pit'
  | 'SafetyCar'
  | 'Reliability'
  | 'Weather'
  | 'Tires'
  | 'TeamOrders'
  | 'Damage';

// The gameplay effect of choosing a decision option. All fields optional; the
// decision engine applies whichever are present to the target car.
export type RaceDecisionEffects = {
  paceMode?: PaceMode; // overrides the car's pace mode
  tireWearDelta?: number; // immediate wear change (negative = fresher)
  reliabilityRiskDelta?: number; // change to per-lap failure probability
  confidenceDelta?: number;
  pitNow?: boolean;
  switchCompound?: TireCompound;
  resolveIssue?: boolean; // marks an active reliability issue as managed
  retire?: boolean;
  repairCostRisk?: number; // 0..1 chance of an added repair bill (Career)
  note?: string; // event-log line emitted when chosen
};

export type RaceDecisionOption = {
  id: string;
  label: string;
  detail: string;
  effects: RaceDecisionEffects;
};

export type RaceDecisionPrompt = {
  id: string;
  driverId: string;
  category: RaceDecisionCategory;
  lap: number;
  title: string;
  description: string;
  options: RaceDecisionOption[];
};

// ---------------------------------------------------------------------------
// Live car / race state
// ---------------------------------------------------------------------------

export type LiveRacePhase = 'formation' | 'racing' | 'finished';

export type LiveCarState = {
  driverId: string;
  teamId: string;
  isPlayer: boolean;
  grid: number;

  // Live classification.
  position: number | null; // null = retired
  totalTime: number; // cumulative race time (s); lower = ahead
  gapToLeader: number; // seconds
  interval: number; // seconds to car ahead
  lastLapTime: number;
  bestLap: number | null; // fastest clean lap so far (s); null until set
  lapsCompleted: number;
  running: boolean;
  status: RaceFinishStatus;
  retiredOnLap: number | null;
  lastIncident?: string;

  // Per-car simulation parameters (set at creation, mostly constant).
  paceRating: number; // baseline pace score (higher = faster)
  baseFailureRisk: number; // per-lap failure probability baseline
  baseMistakeRisk: number; // per-lap mistake probability baseline
  tireDegRate: number; // tyre wear points per lap at balanced pace
  pitLossBase: number; // green-flag pit-stop time loss (s)
  personality: AIStrategyPersonality;
  strategyId: string;
  instructionId: string;

  // Mutable race state.
  paceMode: PaceMode;
  tire: TireState;
  pit: PitStopState;
  reliabilityIssue: ReliabilityIssue | null;
  reliabilityRisk: number; // current effective per-lap failure probability
  damaged: boolean;
};

export type LiveRaceState = {
  raceId: string;
  trackId: string;
  seed: string;
  totalLaps: number;
  currentLap: number; // 0 = pre-start formation
  phase: LiveRacePhase;
  weather: WeatherState;
  safetyCar: SafetyCarState;
  cars: LiveCarState[]; // ordered by running order (leader first), retired trail
  events: RaceEvent[];
  pendingPrompt: RaceDecisionPrompt | null;
  // Categories already prompted recently, keyed by driverId, to avoid spam.
  promptCooldown: Record<string, number>;
  // Ids of unique race events already fired this race (each fires at most once).
  firedEventIds: string[];
};
