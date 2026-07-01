// Development project progression and offseason carryover.

import type {
  Car,
  CarRatings,
  DevelopmentProject,
  RegulationChangeEvent,
} from '../types/gameTypes';
import { createSeededRandom, deriveSeed } from './random';

export type DevelopmentTickResult = {
  active: DevelopmentProject[];
  completed: DevelopmentProject[];
  carRatingDeltas: Partial<CarRatings>;
  messages: string[];
};

// Race Operations (engineering consistency) shifts development project success
// odds. Neutral at raceOps 5; a 9-ops team adds ~8 percentage points, a 3-ops
// team loses ~4 (capped).
export function raceOpsDevelopmentBonus(raceOps: number): number {
  return Math.max(-0.1, Math.min(0.1, (raceOps - 5) * 0.02));
}

// Advance all active projects by one race; resolve completed ones. An optional
// successBonus (e.g. from a Technical Director) shifts each project's odds.
export function applyDevelopmentProgress(
  active: DevelopmentProject[],
  car: Car,
  seed: string,
  round: number,
  successBonus = 0,
): DevelopmentTickResult {
  const rng = createSeededRandom(deriveSeed(seed, 'dev', round));
  const stillActive: DevelopmentProject[] = [];
  const completed: DevelopmentProject[] = [];
  const deltas: Partial<CarRatings> = {};
  const messages: string[] = [];

  for (const project of active) {
    const progressed = { ...project, progressRaces: project.progressRaces + 1 };
    if (progressed.progressRaces < progressed.durationRaces) {
      stillActive.push(progressed);
      continue;
    }

    // Resolve success/failure.
    const odds = Math.max(0.05, Math.min(0.98, progressed.successChance + successBonus));
    const success = rng.chance(odds);
    if (success && progressed.currentSeasonEffects) {
      for (const [k, v] of Object.entries(progressed.currentSeasonEffects)) {
        const key = k as keyof CarRatings;
        deltas[key] = (deltas[key] ?? 0) + (v ?? 0);
      }
      messages.push(`Development complete: ${progressed.name} succeeded.`);
    } else if (success) {
      messages.push(`Development complete: ${progressed.name} delivered (research/facility).`);
    } else {
      messages.push(`Development setback: ${progressed.name} failed to deliver.`);
    }
    completed.push(progressed);
  }

  void car;
  return { active: stillActive, completed, carRatingDeltas: deltas, messages };
}

// --- Diminishing returns + maintenance decay --------------------------------
//
// Development gains get progressively harder as a car rating approaches the 10
// ceiling, and ratings do not stay maxed forever without continued spending:
// each offseason the design ages and regulations erode some carried-over
// performance, softened by facilities/staff/budget. Together these keep top cars
// from saturating at 10.0 across multiple teams and give the midfield room to
// close the gap over a long career.

// Multiplier on a raw development gain given the CURRENT rating of the area
// being developed. Cheap and large at the bottom, very small near the cap.
//   1.0–4.9 : 1.30  (larger gains, cheaper improvement)
//   5.0–6.9 : 1.00  (normal)
//   7.0–8.4 : 0.60  (smaller gains, higher cost)
//   8.5–9.2 : 0.32  (difficult gains)
//   9.3–10  : 0.14  (very small gains, high failure risk)
export function diminishingGainMultiplier(rating: number): number {
  if (rating < 5) return 1.3;
  if (rating < 7) return 1.0;
  if (rating < 8.5) return 0.6;
  if (rating < 9.3) return 0.32;
  return 0.14;
}

// Extra chance a high-rated development project simply fails to deliver (no gain
// or a minor setback). Near the ceiling even well-funded upgrades often miss.
export function nearCapFailureChance(rating: number): number {
  if (rating < 8.5) return 0;
  if (rating < 9.3) return 0.25;
  return 0.45;
}

// A midfield/back car improves more efficiently than a front-runner: a catch-up
// multiplier that rewards teams sitting well below the front of the grid. `gap`
// is (fieldTopRating - thisCarRating) on the 1-10 scale.
export function catchUpMultiplier(gap: number): number {
  return 1 + Math.max(0, Math.min(0.6, gap * 0.18));
}

export type OffseasonDecayOptions = {
  // 0 (stable rules) .. 1 (major regulation shakeup): more shakeup, more decay
  // and reshuffle of the development order.
  regulationShakeup?: number;
  // 1-100 org quality (facilities/technical staff): high quality resists decay.
  facilityStaffQuality?: number;
  // Budget health 0 (broke) .. 1 (rich): low budget increases decay.
  budgetHealth?: number;
  // How well this team adapted to a regulation shakeup this offseason:
  // -1 = missed the concept (extra decay), +1 = nailed it (recovers/gains).
  // Only meaningful when regulationShakeup > 0; it reshuffles the order so a
  // dominant team is not guaranteed to stay ahead through a rules reset.
  regulationAdaptation?: number;
};

// Apply offseason maintenance decay to a set of car ratings. Only performance
// above a floor erodes, and only the amount above ~5.5 (a car does not rot to
// nothing). Facilities/staff and budget reduce decay; regulation shakeups add to
// it. Deterministic — no randomness so rollovers replay identically.
export function applyOffseasonDecay(
  ratings: CarRatings,
  opts: OffseasonDecayOptions = {},
): CarRatings {
  const shakeup = Math.max(0, Math.min(1, opts.regulationShakeup ?? 0));
  const quality = Math.max(1, Math.min(100, opts.facilityStaffQuality ?? 50));
  const budget = Math.max(0, Math.min(1, opts.budgetHealth ?? 0.5));

  // Base yearly decay grows with regulation shakeup; strong facilities/staff and
  // a healthy budget damp it. Stable years erode only a little (maintenance),
  // major shakeups reset far more of the carried-over performance.
  const resist = 0.6 + (quality / 100) * 0.5 + budget * 0.3; // ~0.6..1.4
  const stableBase = 0.05;
  const shakeupBase = shakeup * 0.75; // stable 0, major ~0.75
  const floor = 5.0;

  // A team that nails a new regulation concept recovers much of the reset (and
  // can even gain); one that misses it loses more. Scaled by shakeup magnitude
  // so it only matters in rules-change years.
  const adapt = Math.max(-1, Math.min(1, opts.regulationAdaptation ?? 0));

  const out = {} as CarRatings;
  for (const k of Object.keys(ratings) as (keyof CarRatings)[]) {
    const v = ratings[k];
    const above = Math.max(0, v - floor);
    // Regulation shakeups bite the strongest cars hardest (their advantage came
    // from a mature package that the rules reset), so the order reshuffles;
    // stable-year maintenance decay is gentle and roughly flat.
    const maintenance = stableBase * (0.5 + above / 8);
    const reset = shakeupBase * (above / 4) * (1 - adapt * 0.9);
    const decay = (maintenance + reset) / Math.max(0.5, resist);
    // Nailing the concept can add a little raw performance on top (bounded).
    const adaptGain = adapt > 0 ? shakeup * adapt * 0.4 : 0;
    out[k] = round1(clamp(v - decay + adaptGain, 1, 10));
  }
  return out;
}

// Compute next season's starting car baseline from this season's work.
export function calculateOffseasonCarryover(
  car: Car,
  completedProjects: DevelopmentProject[],
  regulationChanges: RegulationChangeEvent[],
): CarRatings {
  // Start from current effective ratings.
  const base: CarRatings = {
    enginePower: car.ratings.enginePower + car.developmentLevel.enginePower,
    aeroEfficiency: car.ratings.aeroEfficiency + car.developmentLevel.aeroEfficiency,
    mechanicalGrip: car.ratings.mechanicalGrip + car.developmentLevel.mechanicalGrip,
    reliability: car.ratings.reliability + car.developmentLevel.reliability,
    pitCrewOperations: car.ratings.pitCrewOperations + car.developmentLevel.pitCrewOperations,
  };

  // Aggregate regulation carryover modifiers (multiplicative).
  const regMod: CarRatings = {
    enginePower: 1,
    aeroEfficiency: 1,
    mechanicalGrip: 1,
    reliability: 1,
    pitCrewOperations: 1,
  };
  for (const ev of regulationChanges) {
    const m = ev.effects.carryoverModifiers;
    if (!m) continue;
    (Object.keys(regMod) as (keyof CarRatings)[]).forEach((k) => {
      if (m[k] !== undefined) regMod[k] *= m[k] as number;
    });
  }

  // Apply next-season research/facility effects, scaled by carryover and
  // dampened by regulation sensitivity.
  const next: CarRatings = { ...base };
  for (const project of completedProjects) {
    if (!project.nextSeasonEffects) continue;
    for (const [k, v] of Object.entries(project.nextSeasonEffects)) {
      const key = k as keyof CarRatings;
      const regDamp = 1 - project.regulationSensitivity * (1 - regMod[key]);
      next[key] += (v ?? 0) * project.carryoverRate * regDamp;
    }
  }

  // Apply regulation carryover to the whole car (some performance is lost when
  // rules reset the field).
  (Object.keys(next) as (keyof CarRatings)[]).forEach((k) => {
    // Only the development portion above the floor erodes; clamp to 1-10.
    next[k] = clamp(round1(next[k] * (0.6 + 0.4 * regMod[k])), 1, 10);
  });

  return next;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
