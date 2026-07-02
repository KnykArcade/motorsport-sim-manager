// Driver aging & development curves (Living Universe Phase 10).
//
// Every driver has a deterministic age-based curve: they grow toward a potential
// ceiling while young, plateau through a peak window in their late 20s/early 30s,
// then decline. Growth is modulated by development rate, morale and (for the
// player's own youngsters) the Driver Academy. Applied once per offseason. Pure
// and deterministic; ratings are on the game's 1-10 scale.

import type { Driver, DriverRatings } from '../types/gameTypes';
import type {
  DevelopmentStepResult,
  DriverDevelopmentCurve,
} from '../types/developmentCurveTypes';
import { createSeededRandom, deriveSeed } from './random';

export type DevelopmentPhase = 'Developing' | 'Peak' | 'Declining';

// Performance skills that move directly with a driver's form.
const PERFORMANCE_KEYS: (keyof DriverRatings)[] = [
  'cornering',
  'braking',
  'straights',
  'tractionAcceleration',
  'elevationBlindCorners',
  'technical',
  'overtakingRacecraft',
  'surfaceGripBumpiness',
  'qualifying',
  'racePace',
  'adaptability',
];
// Mental skills that mature with experience and resist age-related decline.
const MENTAL_KEYS: (keyof DriverRatings)[] = ['enduranceConsistency', 'riskManagement', 'composure'];

function clampRating(n: number): number {
  return Math.max(1, Math.min(10, n));
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// A plausible age when the season data doesn't provide one: stronger drivers
// skew a little older (established), with deterministic per-driver variance.
export function synthesizeAge(seed: string, driverId: string, overall: number): number {
  const rng = createSeededRandom(deriveSeed(seed, 'devage', driverId));
  const base = 22 + (overall - 5) * 0.9 + rng.variance(4);
  return Math.max(18, Math.min(38, Math.round(base)));
}

export function driverAge(driver: Driver, seed: string): number {
  return driver.age ?? synthesizeAge(seed, driver.id, driver.ratings.overall);
}

// Build the static development curve for a driver: peak window, growth/decline
// rates and the potential ceiling they can reach. Deterministic per seed+driver.
export function createDriverDevelopmentCurve(
  driver: Driver,
  seed: string,
): DriverDevelopmentCurve {
  const rng = createSeededRandom(deriveSeed(seed, 'devcurve', driver.id));
  const age = driverAge(driver, seed);
  const overall = driver.ratings.overall;

  const peakAgeStart = 26 + Math.round(rng.variance(2)); // ~24-28
  const peakAgeEnd = peakAgeStart + 3 + Math.round(Math.abs(rng.variance(2))); // ~28-33
  const developmentRate = Math.max(0.1, Math.min(0.95, 0.45 + rng.variance(0.25)));
  const declineRate = Math.max(0.1, Math.min(0.9, 0.35 + rng.variance(0.2)));
  const consistencyGrowth = Math.max(0.1, Math.min(0.9, 0.4 + rng.variance(0.2)));
  const aggressionChange = rng.variance(0.3);

  // A driver still short of their peak has headroom above their current overall;
  // one already at/over peak is treated as at their ceiling.
  const headroom =
    age < peakAgeStart
      ? Math.min(2, (peakAgeStart - age) * 0.18 * (0.6 + developmentRate * 0.8))
      : 0;
  const potentialCeiling = clampRating(overall + headroom);

  return {
    driverId: driver.id,
    peakAgeStart,
    peakAgeEnd,
    developmentRate,
    declineRate,
    consistencyGrowth,
    aggressionChange,
    potentialCeiling,
  };
}

export function developmentPhase(curve: DriverDevelopmentCurve, age: number): DevelopmentPhase {
  if (age < curve.peakAgeStart) return 'Developing';
  if (age <= curve.peakAgeEnd) return 'Peak';
  return 'Declining';
}

export type DevelopmentStepOptions = {
  seasonYear: number;
  // 0-0.6 Driver Academy boost (player's own developing drivers only).
  academyBoost?: number;
};

// The overall change a driver experiences entering a season at `age`.
function overallDelta(
  curve: DriverDevelopmentCurve,
  age: number,
  overall: number,
  morale: number,
  academyBoost: number,
): { delta: number; phase: DevelopmentPhase } {
  const phase = developmentPhase(curve, age);
  const moraleBoost = ((morale - 50) / 50) * 0.08;
  if (phase === 'Developing') {
    const headroom = Math.max(0, curve.potentialCeiling - overall);
    const delta = headroom * curve.developmentRate * 0.35 + academyBoost * 0.25 + moraleBoost;
    return { delta: Math.max(0, Math.min(0.6, delta)), phase };
  }
  if (phase === 'Peak') {
    const headroom = Math.max(0, curve.potentialCeiling - overall);
    return { delta: Math.max(0, Math.min(0.15, headroom * 0.12)), phase };
  }
  const yearsPast = age - curve.peakAgeEnd;
  const loss = curve.declineRate * (0.06 + yearsPast * 0.035);
  return { delta: -Math.max(0.04, Math.min(0.5, loss)), phase };
}

// Apply one offseason of aging/development to a driver: increment age and nudge
// ratings along the curve. Returns the updated driver and a transparency record.
export function developmentStep(
  curve: DriverDevelopmentCurve,
  driver: Driver,
  seed: string,
  opts: DevelopmentStepOptions,
): { driver: Driver; result: DevelopmentStepResult } {
  const newAge = driverAge(driver, seed) + 1;
  const overallBefore = driver.ratings.overall;
  const { delta, phase } = overallDelta(
    curve,
    newAge,
    overallBefore,
    driver.morale,
    opts.academyBoost ?? 0,
  );

  // Mental skills keep maturing and shed less in decline (veteran craft).
  const mentalDelta =
    delta >= 0
      ? delta + curve.consistencyGrowth * 0.04
      : delta * (1 - curve.consistencyGrowth) + curve.consistencyGrowth * 0.03;

  const r = driver.ratings;
  const next: DriverRatings = { ...r };
  for (const key of PERFORMANCE_KEYS) next[key] = round1(clampRating(r[key] + delta));
  for (const key of MENTAL_KEYS) next[key] = round1(clampRating(r[key] + mentalDelta));
  next.aggression = round1(clampRating(r.aggression + curve.aggressionChange));
  next.overall = round1(clampRating(overallBefore + delta));

  const overallAfter = next.overall;
  const notes: string[] = [];
  if (phase === 'Developing') {
    notes.push(`Developing (age ${newAge}) — improving toward a ${curve.potentialCeiling.toFixed(1)} ceiling.`);
  } else if (phase === 'Peak') {
    notes.push(`At peak (age ${newAge}) — holding form.`);
  } else {
    notes.push(`Declining (age ${newAge}) — losing ${Math.abs(delta).toFixed(2)} overall.`);
  }

  return {
    driver: { ...driver, age: newAge, ratings: next },
    result: { driverId: driver.id, seasonYear: opts.seasonYear, overallBefore, overallAfter, phase, notes },
  };
}

export type TrajectoryPoint = { age: number; overall: number; phase: DevelopmentPhase };

// Project a driver's overall forward over `years` seasons (no situational inputs)
// for display. Does not mutate anything.
export function projectTrajectory(
  curve: DriverDevelopmentCurve,
  startAge: number,
  startOverall: number,
  years: number,
): TrajectoryPoint[] {
  const points: TrajectoryPoint[] = [];
  let overall = startOverall;
  for (let i = 0; i <= years; i++) {
    const age = startAge + i;
    const phase = developmentPhase(curve, age);
    points.push({ age, overall: round1(overall), phase });
    const { delta } = overallDelta(curve, age + 1, overall, 50, 0);
    overall = clampRating(overall + delta);
  }
  return points;
}

// Seed development curves for a roster (called at new-game). Ages are filled in
// where missing so aging is stable across seasons.
export function seedDevelopmentCurves(
  drivers: Driver[],
  seed: string,
): { curves: Record<string, DriverDevelopmentCurve>; drivers: Driver[] } {
  const curves: Record<string, DriverDevelopmentCurve> = {};
  const aged = drivers.map((d) => {
    curves[d.id] = createDriverDevelopmentCurve(d, seed);
    return d.age == null ? { ...d, age: driverAge(d, seed) } : d;
  });
  return { curves, drivers: aged };
}
