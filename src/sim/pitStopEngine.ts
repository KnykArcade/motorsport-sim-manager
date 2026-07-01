// Pit stop performance contribution to the race.

import type { Car, RaceStrategy } from '../types/gameTypes';
import type { Rng } from './random';
import { effectiveCarRatings } from './trackFitEngine';

export type PitStopOutcome = {
  // Net contribution to race score (positive = time gained).
  scoreDelta: number;
  note?: string;
};

// How the weekend's operations execution (`opsForm`, 0 = neutral) sharpens or
// scruffs a pit stop, on top of the car's own pit-crew rating. Zero-mean: a
// good ops weekend gains time and fumbles less, a bad one the reverse, so the
// average is unchanged and only the swing grows for weaker operations.
export const PIT_OPS_GAIN = 0.5;
export const PIT_OPS_FUMBLE_SENS = 0.06;

export function calculatePitStopPerformance(
  car: Car,
  strategy: RaceStrategy,
  rng: Rng,
  // Weekend operations-form (0 neutral): pit-crew execution on the day.
  opsForm = 0,
): PitStopOutcome {
  const ops = effectiveCarRatings(car).pitCrewOperations; // 1-10

  // Strong pit crews gain time; the day's operations swing adds or removes some.
  const base = (ops - 5.5) * 0.15 + opsForm * PIT_OPS_GAIN;

  // More stops means more exposure to pit risk; a sharp day fumbles less.
  const riskExposure = strategy.pitRiskModifier;
  const fumbleChance = clamp(
    0.06 + riskExposure * 0.08 - (ops - 5) * 0.01 - opsForm * PIT_OPS_FUMBLE_SENS,
    0.01,
    0.3,
  );

  if (rng.chance(fumbleChance)) {
    const severity = rng.range(0.5, 1.5);
    return {
      scoreDelta: base - severity,
      note: 'Slow pit stop cost track position.',
    };
  }

  if (ops >= 8 && rng.chance(0.2)) {
    return { scoreDelta: base + 0.4, note: 'Lightning-fast pit stop.' };
  }

  return { scoreDelta: base };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
