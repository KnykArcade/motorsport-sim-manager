// Reliability: probability that a car suffers a mechanical failure.

import type { Car, SetupOption, Track } from '../types/gameTypes';
import type { ReliabilityIssue, ReliabilityIssueType } from '../types/liveTypes';
import type { Rng } from './random';
import { toLegacyRating } from './ratingScale';
import { effectiveCarRatings } from './trackFitEngine';

// Sensitivity of DNF risk to the weekend's operations execution (see
// `operationsForm` in raceEngine). Zero-mean: a sharp operations weekend
// (opsForm > 0) reduces reliability risk, a scrappy one raises it, so the
// *average* risk is unchanged and only its weekend-to-weekend swing grows.
export const RELIABILITY_OPS_SENS = 0.8;

// Multiplier applied to reliability risk for a given weekend operations-form
// value (0 = neutral, preserving prior behaviour). Clamped so risk stays sane.
export function operationsRiskMultiplier(opsForm = 0): number {
  return Math.max(0.3, Math.min(1.9, 1 - opsForm * RELIABILITY_OPS_SENS));
}

// Returns a per-race DNF probability in [0, 1].
export function calculateReliabilityRisk(
  car: Car,
  track: Track,
  setup: SetupOption,
  // Extra stress from aggressive driving / run plans (0+).
  stress: number,
  // Weekend operations-form (0 neutral): reliability management consistency.
  opsForm = 0,
): number {
  const c = effectiveCarRatings(car);
  const reliability = toLegacyRating(c.reliability);

  // Base failure rate: a 10-reliability car ~3% DNF, a 2-reliability car ~25%.
  // Ratings are 1-100 in the data, so convert to the legacy 1-10 scale the formula expects.
  const base = 0.28 - reliability * 0.025;

  // Track punishment: risk + endurance demands increase mechanical attrition.
  const riskDemand = toLegacyRating(track.setupProfile.riskDemand);
  const enduranceConsistency = toLegacyRating(track.attributes.enduranceConsistency);
  const trackStress = (riskDemand + enduranceConsistency) / 2;
  const trackFactor = (trackStress - 5) * 0.012;

  // Setup: low reliability protection and nervous/aggressive trim raise risk.
  // A car that is badly outside the weekend setup window should feel fragile,
  // especially when the player also asks the driver to push.
  const setupFactor =
    (5 - setup.reliabilityProtection) * 0.018 +
    Math.max(0, setup.riskModifier) * 0.006;

  // Car condition: a damaged car (e.g. quali crash) is more fragile.
  const conditionFactor = (100 - car.condition) * 0.0015;

  const risk =
    (base + trackFactor + setupFactor + conditionFactor + stress * 0.03) *
    operationsRiskMultiplier(opsForm);
  return clamp(risk, 0.01, 0.6);
}

// ---------------------------------------------------------------------------
// In-race (live) reliability
// ---------------------------------------------------------------------------

// Spread a per-race DNF probability across the race distance into a per-lap
// failure probability. A car that pushes hard amplifies it; nursing reduces it.
export function perLapFailureRisk(perRaceRisk: number, totalLaps: number): number {
  if (totalLaps <= 0) return perRaceRisk;
  // 1 - (1 - perLap)^laps = perRace  =>  perLap = 1 - (1 - perRace)^(1/laps)
  const perLap = 1 - Math.pow(1 - clamp(perRaceRisk, 0, 0.95), 1 / totalLaps);
  return clamp(perLap, 0.0002, 0.2);
}

const ISSUE_LABELS: Record<ReliabilityIssueType, string> = {
  EngineOverheating: 'Engine overheating',
  GearboxWarning: 'Gearbox warning',
  BrakeIssue: 'Brake issue',
  SuspensionConcern: 'Suspension concern',
  HydraulicLeak: 'Hydraulic leak',
  ElectricalGlitch: 'Electrical glitch',
  TireVibration: 'Tyre vibration',
  CoolingProblem: 'Cooling problem',
};

const ALL_ISSUE_TYPES = Object.keys(ISSUE_LABELS) as ReliabilityIssueType[];

// Per-lap chance that a (so-far healthy) car develops a reliability *warning* —
// a non-terminal issue that raises failure risk until the team manages it.
export function rollReliabilityIssue(
  rng: Rng,
  perLapBaseRisk: number,
  lap: number,
  pushing: boolean,
): ReliabilityIssue | null {
  const chance = perLapBaseRisk * (pushing ? 4 : 2.5);
  if (!rng.chance(chance)) return null;

  const type = rng.pick(ALL_ISSUE_TYPES);
  const severityRoll = rng.next();
  const severity = severityRoll > 0.85 ? 'Severe' : severityRoll > 0.5 ? 'Moderate' : 'Minor';
  // Extra per-lap failure risk a warning adds until it is managed. Kept small so
  // a warning is a manageable concern (pace/strategy pressure) rather than an
  // near-certain retirement when it goes unmanaged over many laps.
  const severityRisk = severity === 'Severe' ? 0.018 : severity === 'Moderate' ? 0.008 : 0.004;

  return {
    type,
    label: ISSUE_LABELS[type],
    severity,
    lap,
    failureRisk: severityRisk,
    managed: false,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
