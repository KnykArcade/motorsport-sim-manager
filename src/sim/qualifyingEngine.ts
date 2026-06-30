// Qualifying engine — deliberately SEPARATE from the race engine so the player
// can choose an aggressive qualifying approach and a cautious race approach.

import type {
  Car,
  Driver,
  QualifyingResult,
  QualifyingRunPlan,
  QualifyingSegment,
  SetupOption,
  Track,
} from '../types/gameTypes';
import type { WeatherState } from '../types/liveTypes';
import type { QualifyingContext, QualifyingFormat, ScoreBreakdown } from '../types/simTypes';
import { createSeededRandom, deriveSeed, type Rng } from './random';
import { calculateTrackFit } from './trackFitEngine';
import { calculateSetupFit } from './setupEngine';
import { calculateCrashRisk, calculateMistakeRisk } from './mistakeEngine';

export function calculateQualifyingSetupFit(
  _driver: Driver,
  _car: Car,
  track: Track,
  qualifyingSetup: SetupOption,
): number {
  // Setup fit plus the setup's own qualifying boost.
  return calculateSetupFit(qualifyingSetup, track) + qualifyingSetup.qualifyingBoost;
}

export function calculateQualifyingRisk(
  driver: Driver,
  _car: Car,
  track: Track,
  runPlan: QualifyingRunPlan,
): { crash: number; mistake: number } {
  const aggression = runPlan.crashModifier; // run plan aggressiveness
  return {
    crash: calculateCrashRisk(driver, track, aggression),
    mistake: calculateMistakeRisk(driver, track, runPlan.mistakeModifier, 0.5),
  };
}

export function calculateQualifyingPace(
  driver: Driver,
  car: Car,
  track: Track,
  setup: SetupOption,
  runPlan: QualifyingRunPlan,
): { score: number; breakdown: ScoreBreakdown } {
  const driverBase = (driver.ratings.qualifying + driver.ratings.overall) / 2; // ~1-10
  const trackFit = calculateTrackFit(driver, car, track);
  const setupFit = calculateQualifyingSetupFit(driver, car, track, setup);

  // Confidence nudges peak performance.
  const confidenceFactor = (driver.confidence - 65) / 100; // ~[-0.65, 0.35]

  const score =
    driverBase * 1.0 +
    trackFit * 1.2 +
    setupFit * 0.8 +
    runPlan.paceModifier +
    confidenceFactor;

  const breakdown: ScoreBreakdown = {
    driverId: driver.id,
    driverBase,
    carBase: 0,
    trackFit,
    setupFit,
    reliabilityRisk: 0,
    mistakeRisk: 0,
    variance: 0,
    finalScore: score,
  };

  return { score, breakdown };
}

// 0 (dry) .. ~1 (heavy rain): how treacherous the session is. Wetter sessions
// add variance and reward driver skill over raw car/setup pace.
export function sessionWetness(weather?: WeatherState): number {
  if (!weather) return 0;
  const fromGrip = clampProb(1 - weather.gripLevel);
  const changeable = weather.changingSoon ? 0.15 : 0;
  return Math.min(1, fromGrip + changeable);
}

// Knockout (Q1/Q2/Q3) is a modern F1 format (introduced in 2006). Older eras and
// other series use a single combined qualifying session.
export function qualifyingFormatFor(year: number, series: string): QualifyingFormat {
  if (series === 'F1' && year >= 2006) return 'Knockout';
  return 'SingleLap';
}

function clampRuns(runs: number | undefined): number {
  if (!runs || !Number.isFinite(runs)) return 1;
  return Math.max(1, Math.min(3, Math.round(runs)));
}

const INCIDENT_NOTES = {
  positive: [
    'Excellent lap',
    'Perfect setup window',
    'Found time in the final sector',
  ],
  neutral: ['Clean lap', 'Tidy effort', 'Solid banker lap'],
  small: ['Small driver mistake', 'Brake lockup', 'Slightly off the ideal line'],
  traffic: ['Traffic in final sector', 'Compromised by a slow car'],
  poor: ['Poor balance', 'Engine hesitation', 'Could not string it together'],
};

type Entry = {
  driver: Driver;
  car: Car;
  setup: SetupOption;
  runPlan: QualifyingRunPlan;
  runs: number;
  conserve: boolean;
  wetReady: boolean;
};

type LapOutcome = {
  finalScore: number;
  notes: string[];
  incident?: QualifyingResult['incident'];
  breakdown: ScoreBreakdown;
};

// Simulate one driver's qualifying effort for a segment, with the session's
// weather, the track's evolution (rubbering in across segments) and the driver's
// chosen number of runs / tyre approach all factored in.
function simulateLap(
  track: Track,
  entry: Entry,
  wetness: number,
  evolution: number,
  rng: Rng,
): LapOutcome {
  const { driver, car, setup, runPlan } = entry;
  const { score, breakdown } = calculateQualifyingPace(driver, car, track, setup, runPlan);

  let base = score + evolution;

  // Weather: wet/changeable sessions reward adaptable, composed drivers and add
  // chaos. Drivers who banked wet running in practice cope better.
  if (wetness > 0) {
    const wetSkill = (driver.ratings.adaptability + driver.ratings.composure) / 2 - 5; // ~[-4,4]
    base += wetness * wetSkill * 0.7;
    if (entry.wetReady) base += wetness * 0.8;
  }

  // Multiple runs find more pace (more attempts as the track improves); conserving
  // tyres trades some of that upside (to keep fresher rubber for the race).
  const runBonus = (entry.runs - 1) * 0.3 * (entry.conserve ? 0.5 : 1);
  base += runBonus;

  const variance = rng.variance(1.4 * (1 + wetness));
  let finalScore = base + variance;

  const risk = calculateQualifyingRisk(driver, car, track, runPlan);
  const riskMult =
    (1 + (entry.runs - 1) * 0.18) * (entry.conserve ? 0.82 : 1) * (1 + wetness * 0.6);
  let crash = risk.crash * riskMult;
  let mistake = risk.mistake * riskMult;
  if (entry.wetReady) {
    crash *= 0.85;
    mistake *= 0.85;
  }

  const notes: string[] = [];
  let incident: QualifyingResult['incident'];

  // Resolve incidents from most to least severe.
  if (rng.chance(crash)) {
    finalScore -= 6;
    incident = {
      type: 'Crash',
      severity: 'Major',
      raceImpact: 'Car damaged; reliability risk and repair cost in the race.',
    };
    notes.push(wetness > 0.4 ? 'Aquaplaned off — crashed in the wet!' : 'Crashed in qualifying!');
  } else if (rng.chance(mistake)) {
    finalScore -= 2.5;
    incident = { type: 'Spin', severity: 'Minor' };
    notes.push(rng.pick(INCIDENT_NOTES.small));
  } else if (rng.chance(clampProb(runPlan.trafficModifier * 0.25))) {
    finalScore -= 1.5;
    incident = { type: 'Traffic', severity: 'Minor' };
    notes.push(rng.pick(INCIDENT_NOTES.traffic));
  } else if (variance > 0.9) {
    notes.push(rng.pick(INCIDENT_NOTES.positive));
  } else if (variance < -0.9) {
    notes.push(rng.pick(INCIDENT_NOTES.poor));
  } else {
    notes.push(rng.pick(INCIDENT_NOTES.neutral));
  }

  breakdown.variance = variance;
  breakdown.mistakeRisk = mistake;
  breakdown.finalScore = finalScore;

  return { finalScore, notes, incident, breakdown };
}

type ResultRow = {
  entry: Entry;
  score: number;
  notes: string[];
  incident?: QualifyingResult['incident'];
  segment: QualifyingSegment;
};

// Track evolution bonus per knockout segment — the surface rubbers in, so later
// segments are quicker. Applied uniformly within a segment.
const SEGMENT_EVOLUTION: Record<string, number> = { Q1: 0, Q2: 0.4, Q3: 0.8, Single: 0 };

function runSegment(
  track: Track,
  entries: Entry[],
  wetness: number,
  seed: string,
  segment: QualifyingSegment,
  breakdowns: Record<string, ScoreBreakdown>,
): ResultRow[] {
  const rng = createSeededRandom(deriveSeed(seed, 'quali', segment, track.id));
  const evolution = SEGMENT_EVOLUTION[segment] ?? 0;
  const rows = entries.map((entry) => {
    const lap = simulateLap(track, entry, wetness, evolution, rng);
    breakdowns[entry.driver.id] = lap.breakdown;
    return { entry, score: lap.finalScore, notes: lap.notes, incident: lap.incident, segment };
  });
  rows.sort((a, b) => b.score - a.score);
  return rows;
}

function runKnockout(
  track: Track,
  entries: Entry[],
  wetness: number,
  seed: string,
  breakdowns: Record<string, ScoreBreakdown>,
): ResultRow[] {
  const n = entries.length;
  const q2Keep = Math.min(15, n - 1);
  const q3Keep = Math.min(10, q2Keep - 1);

  const q1 = runSegment(track, entries, wetness, seed, 'Q1', breakdowns);
  const q1Survivors = q1.slice(0, q2Keep).map((r) => r.entry);
  const q1Out = q1.slice(q2Keep); // eliminated in Q1, keep their Q1 order

  const q2 = runSegment(track, q1Survivors, wetness, seed, 'Q2', breakdowns);
  const q2Survivors = q2.slice(0, q3Keep).map((r) => r.entry);
  const q2Out = q2.slice(q3Keep); // eliminated in Q2

  const q3 = runSegment(track, q2Survivors, wetness, seed, 'Q3', breakdowns);

  // Final grid order: Q3 shootout first, then Q2 dropouts, then Q1 dropouts.
  return [...q3, ...q2Out, ...q1Out];
}

export function simulateQualifying(context: QualifyingContext): {
  results: QualifyingResult[];
  breakdowns: Record<string, ScoreBreakdown>;
} {
  const wetness = sessionWetness(context.weather);
  const wetReady = new Set(context.wetPreparedDriverIds ?? []);
  const format = context.format ?? 'SingleLap';
  const breakdowns: Record<string, ScoreBreakdown> = {};

  const entries: Entry[] = context.entrants.map((e) => {
    const decision = context.decisions[e.driver.id];
    return {
      driver: e.driver,
      car: e.car,
      setup: context.setupOptions[decision.setupId],
      runPlan: context.runPlans[decision.runPlanId],
      runs: clampRuns(decision.runs),
      conserve: decision.tyreApproach === 'Conserve',
      wetReady: wetReady.has(e.driver.id),
    };
  });

  // Knockout needs enough cars to fill the segments; otherwise fall back to a
  // single session.
  const useKnockout = format === 'Knockout' && entries.length > 10;
  const ordered = useKnockout
    ? runKnockout(context.track, entries, wetness, context.seed, breakdowns)
    : runSegment(context.track, entries, wetness, context.seed, 'Single', breakdowns);

  const cap = context.maxQualifiers;
  const pole = ordered[0]?.score ?? 0;
  const results: QualifyingResult[] = ordered.map((row, i) => {
    const dnq = cap !== undefined && i + 1 > cap;
    const notes = dnq
      ? [...row.notes, `Did not qualify — outside the ${cap}-car cap`]
      : row.notes;
    return {
      position: i + 1,
      driverId: row.entry.driver.id,
      teamId: row.entry.driver.teamId,
      qualifyingScore: round2(row.score),
      gapText: i === 0 ? 'POLE' : `+${round2((pole - row.score) * 0.18)}s`,
      runPlan: row.entry.runPlan.name,
      setupChoice: row.entry.setup.name,
      notes,
      incident: row.incident,
      dnq: dnq || undefined,
      segment: row.segment,
    };
  });

  return { results, breakdowns };
}

function clampProb(p: number): number {
  return Math.max(0, Math.min(1, p));
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type { Rng };
