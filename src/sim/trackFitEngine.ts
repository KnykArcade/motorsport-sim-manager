// Track fit: how well a given driver + car suit a circuit's demands.
// Output is centered around ~0 (neutral). Positive = good fit.

import type { Car, CarRatings, Driver, Track } from '../types/gameTypes';
import { clampRating100, toLegacyRating } from './ratingScale';

export function effectiveCarRatings(car: Car): CarRatings {
  const d = car.developmentLevel;
  const r = car.ratings;
  const eng = car.engineBonus;
  return {
    enginePower: clampRating100(r.enginePower + d.enginePower + (eng?.power ?? 0)),
    aeroEfficiency: clampRating100(r.aeroEfficiency + d.aeroEfficiency),
    mechanicalGrip: clampRating100(r.mechanicalGrip + d.mechanicalGrip),
    reliability: clampRating100(r.reliability + d.reliability + (eng?.reliability ?? 0)),
    pitCrewOperations: clampRating100(r.pitCrewOperations + d.pitCrewOperations),
  };
}

// Overall car competitiveness (1-100): the mean of the effective ratings.
export function carPerformanceRating(car: Car): number {
  const c = effectiveCarRatings(car);
  return (
    (c.enginePower + c.aeroEfficiency + c.mechanicalGrip + c.reliability + c.pitCrewOperations) / 5
  );
}

// A rating (1-100) weighted by a demand (1-100). Demand-weighted so a strong
// engine matters more at high-power tracks. Returns roughly [-5, 5].
function weighted(rating: number, demand: number): number {
  // Convert the 1-100 scale back to the legacy 1-10 behaviour.
  return (toLegacyRating(rating) - 5.5) * (toLegacyRating(demand) / 10);
}

export function calculateDriverTrackFit(driver: Driver, track: Track): number {
  const a = track.attributes;
  const r = driver.ratings;
  const parts = [
    weighted(r.cornering, a.corners),
    weighted(r.braking, a.braking),
    weighted(r.straights, a.straights),
    weighted(r.tractionAcceleration, a.tractionAcceleration),
    weighted(r.elevationBlindCorners, a.elevationBlindCorners),
    weighted(r.technical, a.technical),
    weighted(r.overtakingRacecraft, a.overtakingRacecraft),
    weighted(r.surfaceGripBumpiness, a.surfaceGripBumpiness),
    weighted(r.riskManagement, a.riskWallProximity),
    weighted(r.enduranceConsistency, a.enduranceConsistency),
  ];
  return parts.reduce((s, v) => s + v, 0) / parts.length;
}

export function calculateCarTrackFit(car: Car, track: Track): number {
  const p = track.setupProfile;
  const c = effectiveCarRatings(car);
  const parts = [
    weighted(c.enginePower, p.powerDemand),
    weighted(c.aeroEfficiency, p.aeroDemand),
    weighted(c.mechanicalGrip, p.mechanicalDemand),
    // Reliability is rewarded most at high-risk tracks.
    weighted(c.reliability, p.riskDemand),
    weighted(c.pitCrewOperations, 5),
  ];
  return parts.reduce((s, v) => s + v, 0) / parts.length;
}

export function calculateTrackFit(driver: Driver, car: Car, track: Track): number {
  // 55% driver, 45% car as specified.
  return 0.55 * calculateDriverTrackFit(driver, track) + 0.45 * calculateCarTrackFit(car, track);
}
