// Live Race Pace model.
//
// Base Race Pace is the pre-race 50/25/15/10 blend (car/driver/team/other) on
// the 1-10 scale. During the race, Current Live Race Pace is recomputed every
// lap by layering the in-race dynamics on top of the base:
//
//   Live Pace = Base
//     + tyre condition + fuel/distance + tyre warm-up + track evolution
//     + strategy-mode delta + weather grip + driver form swing
//     - damage - reliability concern - mistake
//
// Kept on a 1-10 scale (small boosts above the base are allowed internally;
// the displayed value is clamped to 1.0-10.0). Lap time in the tick engine is
// derived from Live Pace, so the running order reacts to it.
//
// All magnitudes here are the single place to tune the feel of live pace.

import type {
  LiveCarState,
  PaceMode,
  RiskLevel,
  TrafficStatus,
} from '../types/liveTypes';

// Seconds of lap time gained per 1.0 of Live Race Pace (1-10). Chosen to match
// the previous `paceRating * 0.45` spread (paceRating = baseRacePace * 4), so
// the deterministic car-to-car gap is preserved: 4 * 0.45 = 1.8.
export const LIVE_PACE_K = 1.8;

// ---------------------------------------------------------------------------
// Strategy modes
// ---------------------------------------------------------------------------

export type StrategyModeSpec = {
  mode: PaceMode;
  label: string;
  blurb: string;
  // Pace delta on the 1-10 scale applied to Live Race Pace.
  paceDelta: number;
  // Extra pace when running in traffic (Attack presses on where others stall).
  trafficPaceBonus: number;
  // Multiplier on per-lap tyre wear.
  wearMult: number;
  // Multiplier on per-lap mechanical-failure probability.
  reliabilityMult: number;
  // Multiplier on per-lap crash/incident probability.
  crashMult: number;
  // Ability to overtake / follow through dirty air (>1 = better, <1 = worse).
  overtakeMult: number;
  // Resistance to being passed by a car behind (0-1, higher = defends harder).
  defendBonus: number;
};

// The six race modes. Tuned so a faster car still usually beats a slower one,
// but modes create meaningful risk/reward swings the player (and AI) can use.
export const STRATEGY_MODES: Record<PaceMode, StrategyModeSpec> = {
  Conservative: {
    mode: 'Conservative',
    label: 'Conservative',
    blurb: 'Save tyres and the car. Lower pace, much safer.',
    paceDelta: -0.35,
    trafficPaceBonus: 0,
    wearMult: 0.7,
    reliabilityMult: 0.75,
    crashMult: 0.8,
    overtakeMult: 0.8,
    defendBonus: 0.1,
  },
  Balanced: {
    mode: 'Balanced',
    label: 'Balanced',
    blurb: 'Standard racing pace.',
    paceDelta: 0,
    trafficPaceBonus: 0,
    wearMult: 1,
    reliabilityMult: 1,
    crashMult: 1,
    overtakeMult: 1,
    defendBonus: 0.15,
  },
  Push: {
    mode: 'Push',
    label: 'Push',
    blurb: 'More pace to chase a gap — more wear and mechanical stress.',
    paceDelta: 0.35,
    trafficPaceBonus: 0.1,
    wearMult: 1.35,
    reliabilityMult: 1.4,
    crashMult: 1.25,
    overtakeMult: 1.15,
    defendBonus: 0.15,
  },
  Attack: {
    mode: 'Attack',
    label: 'Attack',
    blurb: 'Maximise overtaking. Highest incident risk and tyre cost.',
    paceDelta: 0.25,
    trafficPaceBonus: 0.5,
    wearMult: 1.4,
    reliabilityMult: 1.15,
    crashMult: 1.7,
    overtakeMult: 1.5,
    defendBonus: 0.15,
  },
  Defend: {
    mode: 'Defend',
    label: 'Defend',
    blurb: 'Hold position against cars behind. Slight pace and tyre cost.',
    paceDelta: -0.1,
    trafficPaceBonus: 0,
    wearMult: 1.12,
    reliabilityMult: 1,
    crashMult: 1.2,
    overtakeMult: 0.9,
    defendBonus: 0.6,
  },
  ProtectEngine: {
    mode: 'ProtectEngine',
    label: 'Reliability Mode',
    blurb: 'Reduce mechanical risk. Lowest pace, safest car.',
    paceDelta: -0.5,
    trafficPaceBonus: 0,
    wearMult: 0.7,
    reliabilityMult: 0.5,
    crashMult: 0.75,
    overtakeMult: 0.7,
    defendBonus: 0.1,
  },
};

export function modeSpec(mode: PaceMode): StrategyModeSpec {
  return STRATEGY_MODES[mode];
}

// The player-selectable modes, in display order.
export const SELECTABLE_MODES: PaceMode[] = [
  'Conservative',
  'Balanced',
  'Push',
  'Attack',
  'Defend',
  'ProtectEngine',
];

// ---------------------------------------------------------------------------
// Live-pace modifiers
// ---------------------------------------------------------------------------

// Tyre condition = 100 - wear. Pace effect follows the spec bands: a small bonus
// on fresh rubber, then progressive loss as the tyre fades.
export function tyrePaceModifier(wear: number): number {
  const condition = 100 - wear;
  if (condition >= 90) return 0.2; // 90-100%: small bonus
  if (condition >= 70) return 0; // 70-89%: normal
  if (condition >= 50) return -0.3; // 50-69%: slight loss
  if (condition >= 30) return -0.7; // 30-49%: moderate loss
  if (condition >= 10) return -1.3; // 10-29%: major loss
  return -2.2; // <10%: severe loss
}

// Extra per-lap mistake risk from a badly-worn tyre (low condition).
export function tyreMistakeRisk(wear: number): number {
  const condition = 100 - wear;
  if (condition >= 30) return 0;
  if (condition >= 10) return 0.02;
  return 0.05;
}

// Scale for terminal tyre failures per era. Older 1990s F1 was more prone to
// punctures/delaminations, so 1990-1994 gets a small bump to keep tyre DNFs in
// the 2-4% window despite the heavier mechanical attrition of that era.
function eraTyreFailureScale(year: number | undefined): number {
  if (year == null) return 1;
  if (year <= 1994) return 1.35;
  if (year <= 2000) return 1.0;
  return 0.85;
}

// Terminal tyre-failure (puncture / delamination / wheel issue) probability per
// lap. Kept deliberately rare: tyre wear should express itself as pace loss,
// mistakes and forced pit stops (see the tyre-cliff stop in raceTickEngine) long
// before it ends a race. Failures now ramp from moderate wear (55+) so they show
// up in the 1990s target split (~2-4% of race DNFs) without dominating.
export function tyreFailureRisk(wear: number, wet: boolean, year?: number): number {
  let risk = 0;
  if (wear >= 90) risk = 0.018;
  else if (wear >= 82) risk = 0.010;
  else if (wear >= 74) risk = 0.005;
  else if (wear >= 60) risk = 0.0015;
  else if (wear >= 55) risk = 0.0008;
  return risk * (wet ? 1.4 : 1) * eraTyreFailureScale(year);
}

// Fuel/distance: cars run heavy early and get progressively faster as fuel
// burns off across the race. Zero-mean around mid-distance so it does not shift
// average pace, only the early-vs-late trend.
export const FUEL_SWING = 0.8;
export function fuelPaceModifier(lap: number, totalLaps: number): number {
  if (totalLaps <= 1) return 0;
  const frac = lap / totalLaps;
  return (frac - 0.5) * FUEL_SWING;
}

// Cold tyres on the out-lap (and the lap after) cost a little pace.
export function warmupPaceModifier(tireAge: number): number {
  if (tireAge <= 0) return -0.3;
  if (tireAge === 1) return -0.12;
  return 0;
}

// The track rubbers in over the race — a small, field-wide gain (does not change
// order, but lap times fall and late laps go quicker).
export const TRACK_EVO = 0.3;
export function trackEvolutionModifier(lap: number, totalLaps: number): number {
  if (totalLaps <= 1) return 0;
  return (lap / totalLaps) * TRACK_EVO;
}

// Dirty air: a car running within DIRTY_AIR_GAP of the car ahead loses pace and
// finds it harder to follow. A car's mode overtaking ability offsets it.
export const DIRTY_AIR_GAP = 1.0;
export const DIRTY_AIR_PENALTY = 0.5;
export function dirtyAirModifier(intervalToCarAhead: number, overtakeMult: number): number {
  if (intervalToCarAhead <= 0 || intervalToCarAhead >= DIRTY_AIR_GAP) return 0;
  const proximity = 1 - intervalToCarAhead / DIRTY_AIR_GAP; // 0..1
  return -DIRTY_AIR_PENALTY * proximity * (2 - overtakeMult);
}

// Weather grip: a wet/greasy track slows everyone relative to a dry base pace.
export function weatherPaceModifier(gripLevel: number): number {
  return (gripLevel - 1) * 2;
}

// ---------------------------------------------------------------------------
// Risk levels + traffic status (UI)
// ---------------------------------------------------------------------------

export function reliabilityRiskLevel(car: LiveCarState): RiskLevel {
  if (car.reliabilityIssue && !car.reliabilityIssue.managed) {
    return car.reliabilityIssue.severity === 'Severe' ? 'Critical' : 'High';
  }
  // Cumulative chance of a failure across the remaining race, roughly.
  const perLap = car.reliabilityRisk;
  if (perLap >= 0.02) return 'High';
  if (perLap >= 0.01) return 'Medium';
  return 'Low';
}

export function crashRiskLevel(car: LiveCarState): RiskLevel {
  const r = car.crashRisk;
  if (r >= 0.02) return 'High';
  if (r >= 0.01) return 'Elevated';
  return 'Low';
}

// ---------------------------------------------------------------------------
// Status messages
// ---------------------------------------------------------------------------

export type StatusInputs = {
  car: LiveCarState;
  intervalAhead: number; // seconds to car ahead (0 = leader)
  intervalBehind: number; // seconds to car behind (0 = last / none)
  underPressure: boolean; // a car close behind
  mistakeThisLap: boolean;
  pittedThisLap: boolean;
  freshFromPit: boolean; // within a couple laps of a stop
};

// A short, readable line explaining why the car's pace is what it is. Ordered by
// priority so the most important cause wins.
export function statusMessage(inp: StatusInputs): string {
  const { car } = inp;
  if (!car.running) return car.lastIncident ?? 'Out of the race';
  if (inp.pittedThisLap) return 'In the pits';
  if (inp.mistakeThisLap) return 'Mistake cost lap time';
  if (car.reliabilityIssue && !car.reliabilityIssue.managed) {
    return `Reliability warning: ${car.reliabilityIssue.label.toLowerCase()}`;
  }
  if (car.damaged) return 'Managing car damage';
  if (car.paceMode === 'ProtectEngine') return 'Reliability mode — protecting the car';
  if (car.paceMode === 'Conservative') return 'Conserving tyres and the car';

  const wear = car.tire.wear;
  if (wear >= 90) return 'Tyres are gone — losing big time';
  if (wear >= 70) return 'Losing time on worn tyres';

  if (inp.freshFromPit) return 'Strong pace on fresh tyres';

  if (car.paceMode === 'Defend' && inp.underPressure) return 'Defending under pressure';
  if (car.paceMode === 'Attack' && inp.intervalAhead > 0 && inp.intervalAhead < DIRTY_AIR_GAP) {
    return 'Attacking the car ahead';
  }
  if (inp.intervalAhead > 0 && inp.intervalAhead < DIRTY_AIR_GAP) return 'Stuck in traffic';
  if (car.paceMode === 'Push') return 'Pushing hard';
  if (wear >= 50) return 'Tyres beginning to fade';
  if (inp.underPressure) return 'Under pressure from behind';
  if (car.position === 1) return 'Leading in clean air';
  return 'Holding station in clean air';
}

export function trafficStatus(inp: {
  mode: PaceMode;
  intervalAhead: number;
  underPressure: boolean;
}): TrafficStatus {
  const inDirtyAir = inp.intervalAhead > 0 && inp.intervalAhead < DIRTY_AIR_GAP;
  if (inp.mode === 'Attack' && inDirtyAir) return 'Attacking';
  if (inp.mode === 'Defend' && inp.underPressure) return 'Defending';
  if (inDirtyAir) return 'InTraffic';
  return 'Clear';
}

// ---------------------------------------------------------------------------
// Live pace computation
// ---------------------------------------------------------------------------

export type LivePaceInputs = {
  car: LiveCarState;
  lap: number;
  totalLaps: number;
  gripLevel: number;
  intervalAhead: number;
  formSwing: number; // zero-mean per-lap driver momentum
  mistakeThisLap: boolean;
};

// Recompute Current Live Race Pace (1-10) for a car this lap. Internally allowed
// to exceed 10 slightly (temporary boost); callers clamp for display.
export function computeLivePace(inp: LivePaceInputs): number {
  const { car } = inp;
  const spec = modeSpec(car.paceMode);

  let pace = car.baseRacePace;
  pace += tyrePaceModifier(car.tire.wear);
  pace += fuelPaceModifier(inp.lap, inp.totalLaps);
  pace += warmupPaceModifier(car.tire.age);
  pace += trackEvolutionModifier(inp.lap, inp.totalLaps);
  pace += spec.paceDelta;
  pace += weatherPaceModifier(inp.gripLevel);
  pace += inp.formSwing;

  const dirty = dirtyAirModifier(inp.intervalAhead, spec.overtakeMult);
  pace += dirty;
  if (dirty < 0) pace += spec.trafficPaceBonus; // Attack claws some of it back

  if (car.damaged) pace -= 0.4;
  if (car.reliabilityIssue && !car.reliabilityIssue.managed) {
    pace -= car.reliabilityIssue.severity === 'Severe' ? 0.5 : 0.25;
  }
  if (inp.mistakeThisLap) pace -= 0.6;

  return clamp(pace, 1, 10.5);
}

// The Live Race Pace shown to the player (clamped 1.0-10.0, one decimal).
export function displayPace(pace: number): number {
  return Math.round(clamp(pace, 1, 10) * 10) / 10;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
