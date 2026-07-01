// Driver Setup Comfort — the driver-feel answer.
//
// Separate from Objective Setup Quality (the engineering answer). Comfort asks
// "how comfortable is THIS driver with THIS setup?" and is driven by:
//   * practice running banked on the setup family the driver actually ran,
//   * how far the final setup has drifted from that practised setup,
//   * the driver's adaptability / composure / aggression / consistency,
//   * the driver's inferred setup-style preference,
//   * which practice programs were run (quali sim, race pace, wet prep),
//   * incidents during practice.
//
// A high-quality setup a driver does not trust yields inconsistency and
// mistakes; a slightly worse setup a driver is comfortable in can be faster over
// a stint. Comfort therefore feeds execution / consistency / mistake risk, not
// the objective pace ceiling.

import type { Driver } from '../types/gameTypes';
import type {
  CarSetup,
  ComfortLabel,
  DriverComfort,
  DriverComfortEffects,
  SetupParamKey,
  SetupPreferences,
} from '../types/setupTypes';

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
function r1(v: number): number {
  return Math.round(v * 10) / 10;
}
// Normalise a 1-10 rating/param to -1..1 around the mid point.
function n(v: number): number {
  return (v - 5) / 5;
}

// Infer a driver's setup-feel preferences from their ratings. Aggressive drivers
// tolerate (and want) a sharper front end and a more aggressive differential;
// composed drivers cope with braking instability; consistent/endurance drivers
// prefer a stable, tyre-preserving car; adaptable drivers have a wider comfort
// window. Preferences colour comfort, never the objective setup quality.
export function inferSetupPreferences(driver: Driver): SetupPreferences {
  const r = driver.ratings;
  return {
    prefersSharpFrontEnd: clamp(n(r.aggression) * 0.8 + n(r.qualifying) * 0.2, -1, 1),
    prefersAggressiveDiff: clamp(n(r.aggression), -1, 1),
    prefersStableRear: clamp((n(r.enduranceConsistency) - n(r.aggression)) * 0.6, -1, 1),
    prefersSoftSuspension: clamp(-n(r.aggression) * 0.4 + Math.max(0, -n(r.composure)) * 0.4, -1, 1),
    prefersLowDrag: clamp(n(r.qualifying) * 0.3, -1, 1),
    prefersTyrePreservation: clamp(n(r.enduranceConsistency), -1, 1),
    adaptabilityWindow: clamp(1 + n(r.adaptability) * 0.6, 0.4, 1.6),
  };
}

// Per-parameter weights for the setup "distance": the parameters that most
// change the car's character (aero balance, diff, suspension) count more toward
// how different a setup feels than trims like brake cooling.
const CHANGE_WEIGHTS: Record<SetupParamKey, number> = {
  frontWing: 1.2,
  rearWing: 1.2,
  suspensionStiffness: 1.0,
  rideHeight: 0.7,
  gearing: 0.6,
  brakeBias: 0.8,
  brakeCooling: 0.5,
  differential: 1.1,
  engineCooling: 0.5,
  tyreUsage: 0.9,
};

// Normalised distance (0..1) between two setups: 0 = identical, 1 = maximally
// different. Used to judge how relevant practised feedback is to the current
// setup — a small change preserves familiarity, a large change makes it stale.
export function setupChangeDelta(a: CarSetup, b: CarSetup): number {
  let weighted = 0;
  let total = 0;
  for (const key of Object.keys(CHANGE_WEIGHTS) as SetupParamKey[]) {
    const w = CHANGE_WEIGHTS[key];
    weighted += (Math.abs(a[key] - b[key]) / 9) * w;
    total += w;
  }
  return total > 0 ? clamp01(weighted / total) : 0;
}

// How well a setup's character suits a driver's inferred preferences (-1..1).
function styleMatch(setup: CarSetup, prefs: SetupPreferences): number {
  const avgWing = (setup.frontWing + setup.rearWing) / 2;
  const terms: number[] = [
    prefs.prefersSharpFrontEnd * n(setup.frontWing),
    prefs.prefersAggressiveDiff * n(setup.differential),
    prefs.prefersStableRear * -n(setup.differential),
    prefs.prefersSoftSuspension * -n(setup.suspensionStiffness),
    prefs.prefersLowDrag * -n(avgWing),
    prefs.prefersTyrePreservation * -n(setup.tyreUsage),
  ];
  return clamp(terms.reduce((s, v) => s + v, 0) / terms.length, -1, 1);
}

// Beyond this normalised change the practised feedback is considered stale.
export const STALE_CHANGE_THRESHOLD = 0.3;
// Practice laps on the family that bank "full" familiarity.
const FAMILIARITY_LAPS = 22;

export type ComfortInput = {
  driver: Driver;
  currentSetup: CarSetup;
  // The setup family the driver actually ran in practice (undefined if the
  // driver has not practised this weekend).
  practicedSetup?: CarSetup;
  // Practice laps the driver has banked this weekend.
  practiceLaps?: number;
  // Setup knowledge accumulated in practice (0-1) — knowing the setup helps the
  // driver trust it.
  setupKnowledge?: number;
  ranQualiSim?: boolean;
  ranRacePace?: boolean;
  ranWetPrep?: boolean;
  raceWet?: boolean;
  hadIncident?: boolean;
};

function labelFor(comfort: number, familiarity: number, practiced: boolean): ComfortLabel {
  if (!practiced || familiarity < 0.05) return 'Unknown';
  if (comfort >= 80) return 'Gelled';
  if (comfort >= 66) return 'Comfortable';
  if (comfort >= 50) return 'Workable';
  return 'Uneasy';
}

// Compute a driver's comfort with a setup. Pure / deterministic.
export function driverSetupComfort(input: ComfortInput): DriverComfort {
  const prefs = inferSetupPreferences(input.driver);
  const practiced = input.practicedSetup != null;
  const laps = Math.max(0, input.practiceLaps ?? 0);
  const knowledge = clamp01(input.setupKnowledge ?? 0);

  const changeDelta = practiced ? setupChangeDelta(input.currentSetup, input.practicedSetup!) : 0;
  // Adaptable drivers keep more relevance after a change (wider window).
  const relevance = practiced
    ? clamp01(1 - changeDelta / (STALE_CHANGE_THRESHOLD * prefs.adaptabilityWindow))
    : 0;
  const lapFamiliarity = clamp01(laps / FAMILIARITY_LAPS);
  const familiarity = lapFamiliarity * (0.3 + 0.7 * relevance);
  const stale = practiced && laps > 0 && changeDelta >= STALE_CHANGE_THRESHOLD * prefs.adaptabilityWindow;

  const style = styleMatch(input.currentSetup, prefs);
  const notes: string[] = [];

  let comfort = 46;
  comfort += style * 16;
  comfort += familiarity * 26;
  comfort += knowledge * 6;
  comfort += n(input.driver.ratings.adaptability) * 5;
  if (input.ranQualiSim) comfort += 4;
  if (input.ranRacePace) comfort += 4;
  if (input.ranWetPrep && input.raceWet) comfort += 5;
  if (stale) comfort -= 12 * clamp01(changeDelta / 0.6);
  if (input.hadIncident) comfort -= 6;
  comfort = clamp(Math.round(comfort), 0, 100);

  // Notes surfaced in the workshop.
  if (!practiced) {
    notes.push('No practice data yet — the driver has not run this car this weekend.');
  } else if (stale) {
    notes.push('Major setup change — the driver has not run this configuration.');
    notes.push('Feedback may be stale after large setup changes.');
  } else if (changeDelta > 0.12) {
    notes.push('Small setup change — practice data still relevant.');
  } else if (laps > 0) {
    notes.push('This is close to the setup the driver ran in practice.');
  }
  if (style <= -0.35) notes.push('This setup does not suit the driver’s natural style.');
  else if (style >= 0.35) notes.push('This setup plays to the driver’s strengths.');

  const label = labelFor(comfort, familiarity, practiced);
  return {
    comfort,
    label,
    familiarity: r1(familiarity),
    relevance: r1(relevance),
    changeDelta: r1(changeDelta),
    stale,
    effects: comfortEffects(comfort, prefs, input, stale),
    notes,
  };
}

function comfortEffects(
  comfort: number,
  prefs: SetupPreferences,
  input: ComfortInput,
  stale: boolean,
): DriverComfortEffects {
  const cf = (comfort - 60) / 20; // ~ -3 .. +2
  const lowComfort = Math.max(0, 60 - comfort);
  const lowComposure = Math.max(0, -n(input.driver.ratings.composure));
  return {
    execution: r1(cf * 0.6 + (input.ranQualiSim ? 0.3 : 0)),
    consistency: r1(cf * 0.5 + (input.ranRacePace ? 0.3 : 0)),
    mistakeRisk: r1(lowComfort / 40 + (stale ? 0.3 : 0)),
    lockupSpinRisk: r1(lowComfort / 50 + lowComposure * 0.2),
    tyreManagement: r1(cf * 0.4 + prefs.prefersTyrePreservation * 0.3),
  };
}
