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
  // 1990s F1: mechanical/technical dominates, but crashes and operational issues are common.
  if (year <= 1994) return { reliability: 0.70, crash: 0.20, tyre: 0.03, other: 0.07 };
  if (year <= 2000) return { reliability: 0.65, crash: 0.26, tyre: 0.03, other: 0.06 };
  if (year <= 2005) return { reliability: 0.55, crash: 0.35, tyre: 0.07, other: 0.03 };
  if (year <= 2010) return { reliability: 0.52, crash: 0.38, tyre: 0.07, other: 0.03 };
  if (year <= 2013) return { reliability: 0.48, crash: 0.42, tyre: 0.07, other: 0.03 };
  return { reliability: 0.38, crash: 0.47, tyre: 0.1, other: 0.05 };
}

// Multiplier applied to raw mechanical-failure probability to cut reliability
// retirements. ~0.78 for 2006-2010 (the ~15-25% reduction), a touch higher for
// neighbouring eras, ~1 for the earliest/most-modern where the raw model is fine.
export function eraReliabilityScale(year: number): number {
  // After fixing the 1-100 scale, the raw mechanical base is lower than intended
  // (it was previously clamped to the minimum for most cars). These multipliers
  // restore era-appropriate mechanical attrition: 1990s F1 is high, then gradually
  // improves through the 2000s. Modern eras are still lower than the raw model.
  if (year <= 1994) return 2.9;
  if (year <= 2000) return 2.25;
  if (year <= 2005) return 1.5;
  if (year <= 2010) return 1.1;
  if (year <= 2013) return 1.0;
  return 0.9;
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
  // The raw per-car risks are mechanical-heavy after the scale fix, so live uses
  // these multipliers to land the labelled cause split on the era targets.
  if (series === 'IndyCar') return { mech: 0.55, crash: 1.35 };
  if (year <= 1994) return { mech: 0.87, crash: 2.05 };
  if (year <= 2000) return { mech: 0.84, crash: 1.95 };
  if (year <= 2005) return { mech: 0.85, crash: 1.25 };
  if (year <= 2010) return { mech: 0.78, crash: 1.15 };
  if (year <= 2013) return { mech: 0.65, crash: 1.15 };
  return { mech: 0.42, crash: 1.25 };
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
  'Transmission failure',
  'Clutch failure',
  'Hydraulics failure',
  'Electrical failure',
  'Electronics failure',
  'Cooling failure',
  'Overheating',
  'Oil pressure failure',
  'Oil leak',
  'Fuel pressure problem',
  'Fuel pump failure',
  'Suspension failure',
  'Brake failure',
  'Steering failure',
  'Driveshaft failure',
  'Differential failure',
];
const CRASH_CAUSES = [
  'Crashed out',
  'Spun off',
  'Spun into the barriers',
  'Collision, retired',
  'Contact damage, retired',
  'Lost it under braking',
  'First-lap collision',
];
const TYRE_CAUSES = [
  'Puncture',
  'Tyre failure',
  'Tyre delamination',
  'Wheel rim failure',
  'Wheel nut issue',
  'Wheel bearing failure',
];
const OTHER_CAUSES = [
  'Driver unwell',
  'Debris damage',
  'Refuelling issue',
  'Stalled',
  'Out of fuel',
  'Fire',
  'Retired by team',
];

// Choose a DNF cause for a retiring car, weighted by the era profile and nudged
// by context. Returns the cause plus a descriptive incident label.
//
// If `riskWeights` is supplied, the cause is drawn from those bucket weights
// instead of the era profile, so the reported cause reflects the actual
// mechanical/crash/tyre/other risk that triggered the retirement.
export function pickDnfCause(
  year: number,
  ctx: DnfCauseContext,
  rng: Rng,
  riskWeights?: EraDnfProfile,
  lap?: number,
): { cause: DnfCause; label: string } {
  const base = riskWeights ?? eraDnfProfile(year);

  // Context multipliers (kept mild so the era profile or supplied weights dominate).
  const relW = base.reliability * (1 + (50 - ctx.carReliability) * 0.006);
  const crashW =
    base.crash *
    (1 + (ctx.aggression - 50) * 0.006 + (50 - ctx.composure) * 0.005 + (ctx.wallProximity - 50) * 0.004) *
    (ctx.inTraffic ? 1.3 : 1);
  const tyreW = base.tyre * (1 + Math.max(0, ctx.tyreWear - 60) * 0.03);
  const otherW = base.other;

  const total = Math.max(1e-6, relW + crashW + tyreW + otherW);
  let roll = rng.next() * total;
  if (roll < relW) return { cause: 'Mechanical', label: rng.pick(MECHANICAL_CAUSES) };
  roll -= relW;
  if (roll < crashW) return { cause: 'Crash', label: crashLabel(rng, lap) };
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
export function crashLabel(rng: Rng, lap?: number): string {
  const pool = lap === 1 ? CRASH_CAUSES : CRASH_CAUSES.filter((c) => c !== 'First-lap collision');
  return rng.pick(pool);
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

  // Tyre/wheel-specific labels first. 'wheel not attached' and 'wheel' on its own
  // are not tyre failures, so match specific wheel parts only.
  if (/(\bpuncture\b|\btyre\b|\btire\b|delamin|wheel rim|wheel nut|wheel bearing)/.test(s)) return 'TyreDamage';

  // Mechanical root causes. Fuel pressure / fuel pump are mechanical; generic
  // 'out of fuel' / 'refuelling' / 'fuel system' are operational (see below).
  if (
    /(engine|gearbox|transmission|clutch|hydraul|electric|electronics|suspension|brake|steering|cooling|overheat|oil|driveshaft|differential|mechanical|fuel pressure|fuel pump)/.test(s)
  )
    return 'Mechanical';

  // Crash / driver incident. 'lost it' is used as crash shorthand; it should
  // lose to mechanical root causes above ('steering failure — lost it').
  if (/(crash|spun|spin|collision|contact|barrier|barriers|accident|lost it)/.test(s)) return 'Crash';

  // Operational / other.
  if (/(driver unwell|illness|debris|refuelling|refueling|out of fuel|stalled|fire|retired by team|wheel not attached|fuel system)/.test(s))
    return 'Other';

  return 'Other';
}
