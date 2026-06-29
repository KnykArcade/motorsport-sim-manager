// Pit stop performance contribution to the race.

import type { Car, RaceStrategy } from '../types/gameTypes';
import type { Rng } from './random';
import { effectiveCarRatings } from './trackFitEngine';

export type PitStopOutcome = {
  // Net contribution to race score (positive = time gained).
  scoreDelta: number;
  note?: string;
};

export function calculatePitStopPerformance(
  car: Car,
  strategy: RaceStrategy,
  rng: Rng,
): PitStopOutcome {
  const ops = effectiveCarRatings(car).pitCrewOperations; // 1-10

  // Strong pit crews gain time; weak ones lose it.
  const base = (ops - 5.5) * 0.15;

  // More stops means more exposure to pit risk.
  const riskExposure = strategy.pitRiskModifier;
  const fumbleChance = clamp(0.06 + riskExposure * 0.08 - (ops - 5) * 0.01, 0.01, 0.3);

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
