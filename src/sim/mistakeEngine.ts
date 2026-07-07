// Mistake / crash probability for a driver in a session.

import type { Driver, Track } from '../types/gameTypes';

// Returns a probability in [0, 1] of a driver error.
export function calculateMistakeRisk(
  driver: Driver,
  track: Track,
  // Combined aggression from run plan / instruction (can be negative).
  aggression: number,
  // Situational pressure (e.g. fighting for grid/position), 0+.
  pressure: number,
): number {
  const r = driver.ratings;

  // Composure & risk management reduce mistakes.
  const skill = (r.composure + r.riskManagement) / 2; // 1-100
  const base = 0.16 - (skill / 10) * 0.013;

  // High-risk / technical tracks punish errors more.
  const trackFactor =
    (track.attributes.riskWallProximity + track.attributes.technical - 10) * 0.008;

  const risk = base + trackFactor + aggression * 0.05 + pressure * 0.02;
  return clamp(risk, 0.01, 0.5);
}

// Crash (not just a small error) probability, derived from mistake risk and the
// track's wall proximity.
export function calculateCrashRisk(
  driver: Driver,
  track: Track,
  aggression: number,
): number {
  const mistake = calculateMistakeRisk(driver, track, aggression, 0);
  const wallFactor = track.attributes.riskWallProximity / 100;
  return clamp(mistake * (0.3 + wallFactor * 0.5), 0.005, 0.4);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
