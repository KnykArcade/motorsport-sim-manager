// DNF cause model.
//
// Retirements are split into four causes whose *proportions* are era-dependent
// (older eras are dominated by mechanical failures; modern eras see more racing
// incidents). When a car retires, the cause is drawn from the era profile,
// nudged by car/driver/situation context, so the aggregate cause split across a
// season lands on the era target while individual retirements still make sense.
//
// Reliability retirements are additionally scaled down (~15-25%) versus the raw
// mechanical risk, most strongly in the 2006-2010 era, per the balance brief.

import type { Rng } from './random';

export type DnfCause = 'Mechanical' | 'Crash' | 'TyreDamage' | 'Other';

export type EraDnfProfile = {
  reliability: number;
  crash: number;
  tyre: number;
  other: number;
};

// Target cause split by era (fractions sum to 1). Tune here.
export function eraDnfProfile(year: number): EraDnfProfile {
  if (year <= 1994) return { reliability: 0.7, crash: 0.2, tyre: 0.07, other: 0.03 };
  if (year <= 2000) return { reliability: 0.65, crash: 0.25, tyre: 0.07, other: 0.03 };
  if (year <= 2005) return { reliability: 0.6, crash: 0.3, tyre: 0.07, other: 0.03 };
  if (year <= 2010) return { reliability: 0.55, crash: 0.35, tyre: 0.07, other: 0.03 };
  if (year <= 2013) return { reliability: 0.5, crash: 0.4, tyre: 0.07, other: 0.03 };
  return { reliability: 0.4, crash: 0.45, tyre: 0.1, other: 0.05 };
}

// Multiplier applied to raw mechanical-failure probability to cut reliability
// retirements. ~0.78 for 2006-2010 (the ~15-25% reduction), a touch higher for
// neighbouring eras, ~1 for the earliest/most-modern where the raw model is fine.
export function eraReliabilityScale(year: number): number {
  if (year <= 1994) return 0.92;
  if (year <= 2000) return 0.88;
  if (year <= 2005) return 0.82;
  if (year <= 2010) return 0.78; // strongest reduction, per brief
  if (year <= 2013) return 0.82;
  return 0.88;
}

// Live-race retirement calibration (Live only; the Quick Sim is untouched).
//
// The Live race rolls each retirement cause as an independent per-lap bucket and
// labels the DNF by the bucket that fired. The *raw* per-car mechanical/crash
// risks (shared with the Quick Sim) are naturally mechanical-heavy in every era,
// so left alone the labelled split would skew mechanical — especially in modern
// eras that should be crash-dominated. These multipliers scale the mechanical
// and crash buckets per era so the aggregate labelled split (and total DNF rate)
// lands on the era targets in `eraDnfProfile`. Tune here.
export type LiveRiskCalibration = { mech: number; crash: number };
export function liveRiskCalibration(year: number, series: string): LiveRiskCalibration {
  if (series === 'IndyCar') return { mech: 0.5, crash: 1.35 };
  if (year <= 1994) return { mech: 0.95, crash: 0.54 };
  if (year <= 2000) return { mech: 0.82, crash: 0.82 };
  if (year <= 2005) return { mech: 0.88, crash: 0.9 };
  if (year <= 2010) return { mech: 0.82, crash: 0.95 };
  if (year <= 2013) return { mech: 0.68, crash: 1.1 };
  return { mech: 0.36, crash: 1.2 };
}

// Context that nudges the cause draw away from the flat era profile.
export type DnfCauseContext = {
  // 1-100 car reliability (low = more mechanical).
  carReliability: number;
  // 1-100 driver aggression (high = more crashes).
  aggression: number;
  // 1-100 driver composure (high = fewer crashes).
  composure: number;
  // Tyre wear 0-100 at the moment of retirement (high = more tyre failures).
  tyreWear: number;
  // Track wall proximity 1-100 (high = more crashes).
  wallProximity: number;
  // Whether the car was fighting/among traffic (raises crash share).
  inTraffic: boolean;
};

const MECHANICAL_CAUSES = [
  'Engine failure',
  'Gearbox failure',
  'Hydraulics failure',
  'Electrical failure',
  'Suspension failure',
  'Cooling failure',
];
const CRASH_CAUSES = [
  'Crashed out',
  'Spun into the barriers',
  'Collision, retired',
  'Contact damage, retired',
  'Lost it under braking',
];
const TYRE_CAUSES = ['Puncture', 'Tyre failure', 'Delaminated tyre'];
const OTHER_CAUSES = ['Fuel system', 'Driver retired, unwell', 'Debris damage', 'Wheel not attached'];

// Choose a DNF cause for a retiring car, weighted by the era profile and nudged
// by context. Returns the cause plus a descriptive incident label.
export function pickDnfCause(
  year: number,
  ctx: DnfCauseContext,
  rng: Rng,
): { cause: DnfCause; label: string } {
  const p = eraDnfProfile(year);

  // Context multipliers (kept mild so the era profile dominates the aggregate).
  const relW = p.reliability * (1 + (50 - ctx.carReliability) * 0.006);
  const crashW =
    p.crash *
    (1 + (ctx.aggression - 50) * 0.006 + (50 - ctx.composure) * 0.005 + (ctx.wallProximity - 50) * 0.004) *
    (ctx.inTraffic ? 1.3 : 1);
  const tyreW = p.tyre * (1 + Math.max(0, ctx.tyreWear - 60) * 0.03);
  const otherW = p.other;

  const total = Math.max(1e-6, relW + crashW + tyreW + otherW);
  let roll = rng.next() * total;
  if (roll < relW) return { cause: 'Mechanical', label: rng.pick(MECHANICAL_CAUSES) };
  roll -= relW;
  if (roll < crashW) return { cause: 'Crash', label: rng.pick(CRASH_CAUSES) };
  roll -= crashW;
  if (roll < tyreW) return { cause: 'TyreDamage', label: rng.pick(TYRE_CAUSES) };
  return { cause: 'Other', label: rng.pick(OTHER_CAUSES) };
}

// Per-bucket label pickers. The live race rolls each retirement risk bucket
// independently and labels the DNF by the bucket that actually fired, so the
// reported cause always reflects the real trigger (no era-profile re-draw).
export function mechanicalLabel(rng: Rng): string {
  return rng.pick(MECHANICAL_CAUSES);
}
export function crashLabel(rng: Rng): string {
  return rng.pick(CRASH_CAUSES);
}
export function tyreLabel(rng: Rng): string {
  return rng.pick(TYRE_CAUSES);
}
export function otherLabel(rng: Rng): string {
  return rng.pick(OTHER_CAUSES);
}

// Classify a DNF incident string back into a cause (for analysis / reporting).
export function classifyDnfCause(incident: string | undefined): DnfCause {
  if (!incident) return 'Other';
  const s = incident.toLowerCase();
  if (/(crash|spun|spin|collision|contact|barrier|braking|accident|hit )/.test(s)) return 'Crash';
  if (/(puncture|tyre|tire|delamin)/.test(s)) return 'TyreDamage';
  if (/(engine|gearbox|hydraul|electric|suspension|cooling|mechanical|brake|clutch|transmission|overheat)/.test(s))
    return 'Mechanical';
  if (/(fuel|unwell|debris|wheel|retired)/.test(s)) return 'Other';
  return 'Other';
}
