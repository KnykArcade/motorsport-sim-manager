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

// Race strategy modes the player (and AI) can switch between during a race.
// Each carries a distinct pace / tyre-wear / reliability / crash tradeoff (see
// STRATEGY_MODES in src/sim/liveRacePace.ts).
//   Conservative  — protect the car, save tyres, bring it home
//   Balanced      — default racing mode
//   Push          — more pace, more wear + reliability stress
//   Attack        — maximise overtaking, highest incident risk
//   Defend        — resist cars behind, slight pace cost
//   ProtectEngine — minimise mechanical failure risk, least pace
export type PaceMode =
  | 'Conservative'
  | 'Balanced'
  | 'Push'
  | 'Attack'
  | 'Defend'
  | 'ProtectEngine';

// Coarse risk bands surfaced on the live-race UI.
export type RiskLevel = 'Low' | 'Medium' | 'Elevated' | 'High' | 'Critical';

// A car's relationship to the cars around it, which drives dirty-air pace loss
// and overtaking/defending dynamics.
export type TrafficStatus = 'Clear' | 'InTraffic' | 'Attacking' | 'Defending';

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
// Data Analytics Recommendations
// ---------------------------------------------------------------------------

// How urgently the pit wall should react. Drives card styling and whether an
// ignore is logged / whether an ignored warning is re-raised after it worsens.
export type RecPriority = 'low' | 'medium' | 'high' | 'urgent';

// The concrete action a recommendation applies. Most map to a strategy mode
// switch; a few request a pit stop or a team order. `label` is the button text.
export type RecActionType =
  | 'Conservative'
  | 'Balanced'
  | 'Push'
  | 'Attack'
  | 'Defend'
  | 'ProtectEngine'
  | 'PitNow'
  | 'StayOut'
  | 'SaveTires'
  | 'FuelSave'
  | 'HoldPosition'
  | 'LetTeammateRace'
  | 'SwapPositions'
  | 'LetCrewDecide';

// Lifecycle of a recommendation. See the analytics/tick engines for transitions.
// pending    — visible, awaiting the player's decision
// accepted   — player accepted the recommended action (one-shot actions only)
// modified   — player chose an alternate action (one-shot actions only)
// ignored    — player actively dismissed it
// expired    — the decision countdown elapsed with no response
// active     — an accepted/modified duration instruction is being applied
// completed  — an active instruction's duration has finished
// superseded — a newer / more urgent recommendation replaced it
export type RecStatus =
  | 'pending'
  | 'accepted'
  | 'modified'
  | 'ignored'
  | 'expired'
  | 'active'
  | 'completed'
  | 'superseded';

export type RecAction = {
  type: RecActionType;
  label: string;
  // If the action maps to a strategy-mode switch, the mode to apply.
  paceMode?: PaceMode;
  // If the action is a pit call.
  pitNow?: boolean;
  // If the action is a team order (needs the favoured driver, resolved by UI).
  teamOrder?: 'SwapPositions' | 'LetThemRace';
};

// A single recommendation generated by the analytics engine for a player driver.
export type AnalyticsRecommendation = {
  id: string; // stable key: `${driverId}:${kind}`
  driverId: string;
  kind: string; // trigger category, used for dedup / cooldown
  priority: RecPriority;
  issue: string; // what the analytics team detected
  recommendedAction: string; // human-readable recommended action
  suggestedDuration?: string; // e.g. "5-8 laps"
  suggestedDurationLaps?: number; // parsed numeric duration for active instructions
  expectedImpact: string; // e.g. "Reliability Risk: Medium -> Low, Live Pace -0.3"
  confidence: number; // 0-100
  createdLap: number;
  expiresLap: number;
  action: RecAction; // applied on Accept
  alternatives: RecAction[]; // shown on Modify
  // Lifecycle.
  status: RecStatus;
  appliedAction?: RecAction; // the action chosen on accept/modify (drives `active`)
  appliedUntilLap?: number; // active instruction runs until (and excluding) this lap
  // Reserved for grouped multi-driver recs (rows are still per-driver recs).
  affectedDriverIds?: string[];
  sourceEventId?: string;
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
  paceRating: number; // baseline pace score (higher = faster) — internal scale
  baseRacePace: number; // Base Race Pace on the 1-10 scale (50/25/15/10 blend)
  baseFailureRisk: number; // per-lap mechanical-failure probability baseline
  baseCrashRisk: number; // per-lap crash/incident probability baseline
  baseMistakeRisk: number; // per-lap (non-terminal) mistake probability baseline
  tireDegRate: number; // tyre wear points per lap at balanced pace
  pitLossBase: number; // green-flag pit-stop time loss (s)
  opsForm: number; // per-weekend operations execution (0 neutral) — pit/strategy consistency
  personality: AIStrategyPersonality;
  strategyId: string;
  instructionId: string;

  // Mutable race state.
  paceMode: PaceMode;
  // Current Live Race Pace (1-10), recomputed every lap from Base Race Pace and
  // the live modifiers (tyre, fuel, form, mode, track fit, weather, traffic,
  // damage, reliability concern, mistakes). Small boosts above the base allowed.
  liveRacePace: number;
  tire: TireState;
  pit: PitStopState;
  reliabilityIssue: ReliabilityIssue | null;
  reliabilityRisk: number; // current effective per-lap mechanical-failure probability
  crashRisk: number; // current effective per-lap crash/incident probability
  damaged: boolean;
  // Fuel load (100 = full tank at the start, 0 = tank empty at the flag). Burns
  // off linearly across the race distance (no refuelling era).
  fuel: number;
  // Component health (0-100, 100 = fresh). Degrades across the race, faster on
  // Push/Attack and while a matching reliability issue is active, so the pit
  // wall's component bars reflect real mechanical stress.
  engineHealth: number;
  gearboxHealth: number;
  brakeHealth: number;
  // Split of the last representative lap into three sector times (s). Empty
  // until a clean lap is set.
  lastSectors: [number, number, number] | null;
  // Sectors of the car's fastest clean lap (s).
  bestSectors: [number, number, number] | null;
  // UI-facing live status.
  reliabilityRiskLevel: RiskLevel;
  crashRiskLevel: RiskLevel;
  trafficStatus: TrafficStatus;
  statusMessage: string;
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
  // Active analytics recommendations for the player's drivers (at most one per
  // driver), regenerated each lap from live state.
  recommendations: AnalyticsRecommendation[];
  // Ignored recommendations keyed by `${driverId}:${kind}` and the lap ignored,
  // so the same warning is not re-raised immediately. `priority` captures the
  // level when it was ignored so a later, higher-priority candidate (a worsened
  // warning) can bypass the cooldown and re-raise.
  ignoredRecs: { key: string; lap: number; issue: string; priority: RecPriority; escalated: boolean }[];
  // Per-kind dedup cooldowns keyed by `${driverId}:${kind}` -> the lap after
  // which that recommendation kind may be raised again. Written when a rec is
  // ignored, resolved (one-shot accept/modify) or an active instruction
  // completes, so the same advice is not re-issued every lap.
  recCooldowns: Record<string, number>;
  // On-track battle tracker for the event log's Battles feed. Keyed by
  // `${attackerId}>${defenderId}` -> consecutive laps the attacker has sat
  // within striking distance directly behind that defender, so a sustained
  // challenge can be logged once (a "defends"/"stuck behind" line) and a faded
  // challenge can be closed out ("attack fades") without re-logging every lap.
  battleTracker: Record<string, number>;
  // Retirements this race (for the race-info panel).
  retirements: number;
};
