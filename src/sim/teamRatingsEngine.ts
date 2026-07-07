// Team organization ratings — Career Mode Phase 1.
//
// Derives a detailed 0-100 organization-ratings profile for every team from the
// data already in a season bundle (car ratings, reputation, budget), with a
// little deterministic variance. Also computes the weighted overall rating and
// the academy capacity that the overall rating unlocks. Pure & deterministic.

import type { Car, Team, Series } from '../types/gameTypes';
import type { TeamOrganizationRatings } from '../types/teamRatingsTypes';
import { effectiveCarRatings } from './trackFitEngine';
import { createSeededRandom, deriveSeed } from './random';

function clamp(n: number, lo = 1, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

// Weights for the overall roll-up. Car performance dominates; research &
// facilities are next; the commercial/operational categories matter less.
const OVERALL_WEIGHTS: Record<keyof Omit<TeamOrganizationRatings, 'teamId' | 'overallTeamRating'>, number> = {
  carPerformance: 0.22,
  research: 0.1,
  facilities: 0.1,
  financialStability: 0.08,
  staffQuality: 0.08,
  driverAppeal: 0.07,
  sponsorAppeal: 0.06,
  operations: 0.06,
  reliabilityDepartment: 0.06,
  pitCrew: 0.04,
  marketing: 0.03,
  fanSupport: 0.03,
  mediaReach: 0.03,
  scouting: 0.02,
  youthAcademy: 0.02,
};

// Weighted roll-up of the individual categories into a single 0-100 rating.
export function calculateOverallTeamRating(r: TeamOrganizationRatings): number {
  let total = 0;
  let weight = 0;
  for (const key of Object.keys(OVERALL_WEIGHTS) as (keyof typeof OVERALL_WEIGHTS)[]) {
    total += r[key] * OVERALL_WEIGHTS[key];
    weight += OVERALL_WEIGHTS[key];
  }
  return clamp(total / weight);
}

// Academy capacity (1-4) unlocked by the team's overall rating, with a small
// nudge from a strong youth academy / facilities. Never below 1 or above 4.
export function calculateAcademyCapacity(r: TeamOrganizationRatings): number {
  const overall = r.overallTeamRating;
  let capacity: number;
  if (overall < 45) capacity = 1;
  else if (overall < 65) capacity = 2;
  else if (overall < 80) capacity = 3;
  else capacity = 4;

  // Strong youth/facilities can push a team up one band near a boundary.
  const support = (r.youthAcademy + r.facilities) / 2;
  if (support >= 75 && capacity < 4) {
    if ((overall >= 42 && overall < 45) || (overall >= 62 && overall < 65) || (overall >= 77 && overall < 80)) {
      capacity += 1;
    }
  }
  return Math.max(1, Math.min(4, capacity));
}

// Car ratings are on a 1-100 scale; the org ratings are 0-100.
function carPerformanceScore(car: Car | undefined): number {
  if (!car) return 50;
  const r = effectiveCarRatings(car);
  const avg = (r.enginePower + r.aeroEfficiency + r.mechanicalGrip + r.reliability + r.pitCrewOperations) / 5;
  return clamp(avg);
}

// Budget ($M) mapped to a 0-100 financial-strength score.
function budgetScore(budget: number): number {
  // ~15M shoestring -> ~140M works-level.
  return clamp(20 + budget * 0.55);
}

// Build one team's organization ratings. Values are anchored to the team's
// reputation, car and budget, with small deterministic per-category variance so
// teams aren't flat. mediaReach is era-appropriate (lower ceiling pre-internet).
export function buildTeamOrganizationRatings(
  team: Team,
  car: Car | undefined,
  year: number,
  seed: string,
  series: Series,
): TeamOrganizationRatings {
  const rng = createSeededRandom(deriveSeed(seed, 'teamratings', team.id, year));
  const rep = team.reputation; // 0-100
  const carScore = carPerformanceScore(car);
  const money = budgetScore(team.budget);

  // A category centered on a base with a little variance.
  const cat = (base: number, spread = 8) => clamp(base + rng.variance(spread));

  // Era factor for media: the modern digital era lifts the reach ceiling.
  const digitalEra = series === 'F1' ? year >= 2005 : year >= 2010;
  const mediaBase = rep * 0.6 + 20 + (digitalEra ? 12 : 0);

  const ratings: TeamOrganizationRatings = {
    teamId: team.id,
    carPerformance: cat(carScore, 4),
    marketing: cat(rep * 0.7 + 15),
    research: cat(carScore * 0.5 + rep * 0.4 + 5),
    facilities: cat(rep * 0.6 + money * 0.3 + 5),
    scouting: cat(rep * 0.5 + 20),
    fanSupport: cat(rep * 0.75 + 12),
    mediaReach: cat(mediaBase),
    financialStability: cat(money),
    staffQuality: cat(rep * 0.6 + carScore * 0.2 + 12),
    driverAppeal: cat(rep * 0.55 + carScore * 0.3 + 8),
    sponsorAppeal: cat(rep * 0.6 + money * 0.2 + 8),
    operations: cat(rep * 0.5 + carScore * 0.3 + 12),
    reliabilityDepartment: cat((car ? effectiveCarRatings(car).reliability : 55) * 0.7 + rep * 0.3),
    pitCrew: cat((car ? effectiveCarRatings(car).pitCrewOperations : 55) * 0.7 + rep * 0.3),
    youthAcademy: cat(rep * 0.5 + 18),
    overallTeamRating: 0,
  };
  ratings.overallTeamRating = calculateOverallTeamRating(ratings);
  return ratings;
}

// Convenience: the academy capacity for a team given the org-ratings map,
// falling back to a midfield default of 2 when ratings are unavailable.
export function academyCapacityFor(
  orgRatings: Record<string, TeamOrganizationRatings> | undefined,
  teamId: string,
): number {
  const r = orgRatings?.[teamId];
  return r ? calculateAcademyCapacity(r) : 2;
}

export function buildAllTeamOrganizationRatings(
  teams: Team[],
  cars: Car[],
  year: number,
  seed: string,
  series: Series,
): Record<string, TeamOrganizationRatings> {
  const carByTeam = new Map(cars.map((c) => [c.teamId, c]));
  const out: Record<string, TeamOrganizationRatings> = {};
  for (const team of teams) {
    out[team.id] = buildTeamOrganizationRatings(team, carByTeam.get(team.id), year, seed, series);
  }
  return out;
}
