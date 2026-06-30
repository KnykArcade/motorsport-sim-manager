// Track fit: how well a given driver + car suit a circuit's demands.
// Output is centered around ~0 (neutral). Positive = good fit.

import type { Car, CarRatings, Driver, Track } from '../types/gameTypes';

export function effectiveCarRatings(car: Car): CarRatings {
  const d = car.developmentLevel;
  const r = car.ratings;
  const eng = car.engineBonus;
  const clamp10 = (n: number) => Math.max(1, Math.min(10, n));
  return {
    enginePower: clamp10(r.enginePower + d.enginePower + (eng?.power ?? 0)),
    aeroEfficiency: r.aeroEfficiency + d.aeroEfficiency,
    mechanicalGrip: r.mechanicalGrip + d.mechanicalGrip,
    reliability: clamp10(r.reliability + d.reliability + (eng?.reliability ?? 0)),
    pitCrewOperations: r.pitCrewOperations + d.pitCrewOperations,
  };
}

// A rating (1-10) weighted by a demand (1-10). Demand-weighted so a strong
// engine matters more at high-power tracks. Returns roughly [-5, 5].
function weighted(rating: number, demand: number): number {
  // (rating - 5.5) shifts the 1-10 scale so an average car is neutral.
  // demand/10 scales the contribution by how much the track asks for it.
  return (rating - 5.5) * (demand / 10);
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
