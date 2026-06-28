// Reliability: probability that a car suffers a mechanical failure.

import type { Car, SetupOption, Track } from '../types/gameTypes';
import { effectiveCarRatings } from './trackFitEngine';

// Returns a per-race DNF probability in [0, 1].
export function calculateReliabilityRisk(
  car: Car,
  track: Track,
  setup: SetupOption,
  // Extra stress from aggressive driving / run plans (0+).
  stress: number,
): number {
  const c = effectiveCarRatings(car);

  // Base failure rate: a 10-reliability car ~3% DNF, a 2-reliability car ~25%.
  const base = 0.28 - c.reliability * 0.025;

  // Track punishment: risk + endurance demands increase mechanical attrition.
  const trackStress =
    (track.setupProfile.riskDemand + track.attributes.enduranceConsistency) / 2;
  const trackFactor = (trackStress - 5) * 0.012;

  // Setup: low reliability protection raises risk.
  const setupFactor = (5 - setup.reliabilityProtection) * 0.01;

  // Car condition: a damaged car (e.g. quali crash) is more fragile.
  const conditionFactor = (100 - car.condition) * 0.0015;

  const risk = base + trackFactor + setupFactor + conditionFactor + stress * 0.03;
  return clamp(risk, 0.01, 0.6);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
