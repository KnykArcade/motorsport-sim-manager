// Development project progression and offseason carryover.

import type {
  Car,
  CarRatings,
  DevelopmentProject,
  DevelopmentOutcome,
  DevelopmentOutcomeResult,
  ProjectRiskLevel,
  ProjectSize,
  RegulationChangeEvent,
} from '../types/gameTypes';
import { createSeededRandom, deriveSeed, type Rng } from './random';
import { toLegacyRating } from './ratingScale';
import {
  facilityOutcomeChances,
  facilityImpactMultiplier,
  type OutcomeChances,
} from './facilityEngine';

export type DevelopmentTickResult = {
  active: DevelopmentProject[];
  completed: DevelopmentProject[];
  carRatingDeltas: Partial<CarRatings>;
  messages: string[];
};

// ---------------------------------------------------------------------------
// Outcome labels and descriptions
// ---------------------------------------------------------------------------

export const OUTCOME_LABELS: Record<DevelopmentOutcome, string> = {
  GreatSuccess: 'Great Success',
  FullSuccess: 'Full Success',
  PartialSuccess: 'Partial Success',
  MinorSuccess: 'Minor Success',
  Failed: 'Failed',
  RareBackfire: 'Rare Backfire',
};

export const OUTCOME_DESCRIPTIONS: Record<DevelopmentOutcome, string> = {
  GreatSuccess: 'The project delivered beyond expectations — a breakthrough result.',
  FullSuccess: 'The project delivered exactly what was promised.',
  PartialSuccess: 'The project delivered most of the planned gains.',
  MinorSuccess: 'The project delivered a small fraction of the planned gains.',
  Failed: 'The project failed to deliver any gains.',
  RareBackfire: 'The project backfired — a small setback in the targeted area.',
};

// ---------------------------------------------------------------------------
// Project size modifiers: gain scale, cost scale, risk shift, time scale
// ---------------------------------------------------------------------------

export type ProjectSizeMods = {
  gainScale: number;
  costScale: number;
  timeScale: number;
  riskShift: number; // added to archetype risk appetite
};

export const PROJECT_SIZE_MODS: Record<ProjectSize, ProjectSizeMods> = {
  Small: { gainScale: 0.6, costScale: 0.5, timeScale: 0.6, riskShift: 0 },
  Medium: { gainScale: 1.0, costScale: 1.0, timeScale: 1.0, riskShift: 0 },
  Major: { gainScale: 1.6, costScale: 1.8, timeScale: 1.5, riskShift: 0.1 },
  Experimental: { gainScale: 2.2, costScale: 2.5, timeScale: 1.8, riskShift: 0.3 },
};

// ---------------------------------------------------------------------------
// Outcome gain multipliers: how much of the base effect each outcome delivers
// ---------------------------------------------------------------------------

export const OUTCOME_GAIN_MULTIPLIERS: Record<DevelopmentOutcome, number> = {
  GreatSuccess: 1.4,
  FullSuccess: 1.0,
  PartialSuccess: 0.6,
  MinorSuccess: 0.25,
  Failed: 0,
  RareBackfire: -0.3,
};

// ---------------------------------------------------------------------------
// Roll a development outcome from the chance table
// ---------------------------------------------------------------------------

export function rollOutcome(rng: Rng, chances: OutcomeChances): DevelopmentOutcome {
  const roll = rng.next();
  let cumulative = 0;
  const order: DevelopmentOutcome[] = [
    'GreatSuccess',
    'FullSuccess',
    'PartialSuccess',
    'MinorSuccess',
    'Failed',
    'RareBackfire',
  ];
  for (const outcome of order) {
    cumulative += chances[outcome];
    if (roll < cumulative) return outcome;
  }
  return 'Failed';
}

// Compute the adjusted duration for a project given facility level, size, and
// rush status. Rushing reduces time by 30% but increases risk.
export function computeAdjustedDuration(
  baseDuration: number,
  facilityLevel: number,
  projectSize: ProjectSize = 'Medium',
  rushed = false,
): number {
  // Level 1: x1.40, Level 2: x1.20, Level 3: x1.00, Level 4: x0.85, Level 5: x0.70
  const timeTable = [1.4, 1.2, 1.0, 0.85, 0.7];
  const idx = Math.max(0, Math.min(4, Math.round(facilityLevel) - 1));
  const facilityTime = timeTable[idx];
  const sizeTime = PROJECT_SIZE_MODS[projectSize].timeScale;
  const rushMod = rushed ? 0.7 : 1.0;
  return Math.max(1, Math.round(baseDuration * facilityTime * sizeTime * rushMod));
}

// Compute the rush cost multiplier (1.5x base cost).
export function RUSH_COST_MULTIPLIER(): number {
  return 1.5;
}

// Race Operations (engineering consistency) shifts development project success
// odds. Neutral at raceOps 50; a 90-ops team adds ~8 percentage points, a
// 30-ops team loses ~4 (capped).
export function raceOpsDevelopmentBonus(raceOps: number): number {
  return Math.max(-0.1, Math.min(0.1, (toLegacyRating(raceOps) - 5) * 0.02));
}

// Advance all active projects by one race; resolve completed ones.
// Uses the new facility-based outcome system: facility level, risk level,
// project size, and staff bonus determine outcome chances and gain magnitude.
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
    const effectiveDuration = progressed.adjustedDurationRaces ?? progressed.durationRaces;
    if (progressed.progressRaces < effectiveDuration) {
      stillActive.push(progressed);
      continue;
    }

    // Determine facility level for this project.
    const facilityLevel = progressed.facilityLevelAtStart ?? 3;
    const riskLevel: ProjectRiskLevel = progressed.riskLevel ?? 'Standard';
    const projectSize: ProjectSize = progressed.projectSize ?? 'Medium';

    // Calculate outcome chances from facility level + risk + staff bonus.
    const chances = facilityOutcomeChances(facilityLevel, riskLevel, successBonus);
    const outcome = rollOutcome(rng, chances);
    const gainMultiplier = OUTCOME_GAIN_MULTIPLIERS[outcome];
    const impactMult = facilityImpactMultiplier(facilityLevel);
    const sizeMods = PROJECT_SIZE_MODS[projectSize];

    // Compute expected gain (what FullSuccess would deliver).
    const expectedGain: Partial<CarRatings> = {};
    if (progressed.currentSeasonEffects) {
      for (const [k, v] of Object.entries(progressed.currentSeasonEffects)) {
        const key = k as keyof CarRatings;
        expectedGain[key] = round1((v ?? 0) * impactMult * sizeMods.gainScale);
      }
    }

    // Compute actual gain based on outcome.
    const actualGain: Partial<CarRatings> = {};
    if (progressed.currentSeasonEffects) {
      for (const [k, v] of Object.entries(progressed.currentSeasonEffects)) {
        const key = k as keyof CarRatings;
        const raw = (v ?? 0) * impactMult * sizeMods.gainScale * gainMultiplier;
        actualGain[key] = round1(raw);
      }
    }

    // Apply actual gains to deltas.
    if (Object.keys(actualGain).length > 0) {
      for (const [k, v] of Object.entries(actualGain)) {
        const key = k as keyof CarRatings;
        deltas[key] = (deltas[key] ?? 0) + (v ?? 0);
      }
    }

    // Build the outcome result attached to the completed project.
    const outcomeResult: DevelopmentOutcomeResult = {
      outcome,
      expectedGain,
      actualGain,
      label: OUTCOME_LABELS[outcome],
      description: OUTCOME_DESCRIPTIONS[outcome],
    };

    const completedProject = { ...progressed, outcomeResult };
    completed.push(completedProject);

    // Generate a descriptive message.
    const gainSummary = Object.entries(actualGain)
      .map(([k, v]) => `${v >= 0 ? '+' : ''}${v} ${k}`)
      .join(', ');
    if (outcome === 'Failed') {
      messages.push(`Development complete: ${progressed.name} — ${OUTCOME_LABELS[outcome]}. No gains delivered.`);
    } else if (outcome === 'RareBackfire') {
      messages.push(`Development setback: ${progressed.name} — ${OUTCOME_LABELS[outcome]}. ${gainSummary}`);
    } else {
      messages.push(`Development complete: ${progressed.name} — ${OUTCOME_LABELS[outcome]}. ${gainSummary}`);
    }
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
//   10.0–49.0 : 1.30  (larger gains, cheaper improvement)
//   50.0–69.0 : 1.00  (normal)
//   70.0–84.0 : 0.60  (smaller gains, higher cost)
//   85.0–92.0 : 0.32  (difficult gains)
//   93.0–100  : 0.14  (very small gains, high failure risk)
export function diminishingGainMultiplier(rating: number): number {
  const legacy = toLegacyRating(rating);
  if (legacy < 5) return 1.3;
  if (legacy < 7) return 1.0;
  if (legacy < 8.5) return 0.6;
  if (legacy < 9.3) return 0.2;
  return 0.05;
}

// Extra chance a high-rated development project simply fails to deliver (no gain
// or a minor setback). Near the ceiling even well-funded upgrades often miss.
export function nearCapFailureChance(rating: number): number {
  const legacy = toLegacyRating(rating);
  if (legacy < 8.5) return 0;
  if (legacy < 9.3) return 0.25;
  return 0.45;
}

// A midfield/back car improves more efficiently than a front-runner: a catch-up
// multiplier that rewards teams sitting well below the front of the grid. `gap`
// is (fieldTopRating - thisCarRating) on the 1-100 scale.
export function catchUpMultiplier(gap: number): number {
  return 1 + Math.max(0, Math.min(0.6, (gap / 10) * 0.45));
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
  // A team that nails a new regulation concept recovers much of the reset (and
  // can even gain); one that misses it loses more. Scaled by shakeup magnitude
  // so it only matters in rules-change years.
  const adapt = Math.max(-1, Math.min(1, opts.regulationAdaptation ?? 0));

  const out = {} as CarRatings;
  for (const k of Object.keys(ratings) as (keyof CarRatings)[]) {
    const v = ratings[k];
    const legacy = toLegacyRating(v);
    const above = Math.max(0, legacy - 5);
    // Regulation shakeups bite the strongest cars hardest (their advantage came
    // from a mature package that the rules reset), so the order reshuffles;
    // stable-year maintenance decay is gentle and roughly flat.
    const levelMaintenance = Math.max(0, legacy - 7.5) * 0.22;
    const maintenance = stableBase * (0.5 + above / 8) + levelMaintenance;
    const reset = shakeupBase * (above / 4) * Math.max(0, 1 - adapt * 3);
    const decay = (maintenance + reset) / Math.max(0.5, resist);
    // Nailing the concept can add a little raw performance on top (bounded).
    const adaptGain = adapt > 0 ? shakeup * adapt * 0.6 : 0;
    const nextLegacy = clamp(legacy - decay + adaptGain, 1, 10);
    out[k] = round1(nextLegacy * 10);
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
    // Only the development portion above the floor erodes; clamp to 1-100.
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
