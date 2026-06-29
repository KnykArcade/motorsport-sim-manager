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
