// Active-driver retirement — Career Mode long-run stability.
//
// At each offseason rollover, contracted race drivers are reviewed for
// retirement so the grid doesn't accumulate drivers who never age out. The
// review is age-led, tempered by rating and morale, and deterministic (seeded
// per driver + year), so the same career always plays out the same way.

import type { Driver, Team } from '../types/gameTypes';
import { createSeededRandom, deriveSeed } from './random';

// Beyond this age a driver always retires.
export const HARD_RETIRE_AGE = 45;
// From this age a driver only keeps a full-time seat if elite and motivated.
export const VETERAN_AGE = 42;
// From this age an out-of-contract driver is reviewed strongly for retirement.
export const REVIEW_AGE = 39;

// An elite, motivated veteran who is still in clear demand and may keep racing
// past the veteran age.
function isEliteVeteran(driver: Driver): boolean {
  const morale = driver.morale ?? 60;
  return driver.ratings.overall >= 80 && morale >= 55;
}

// Decide whether a driver retires at the end of the season. Pure/deterministic.
export function shouldRetire(driver: Driver, seed: string, year: number): boolean {
  const age = driver.age;
  if (age == null) return false;
  if (age >= HARD_RETIRE_AGE) return true;
  if (age >= VETERAN_AGE) {
    // Only elite, motivated, in-demand veterans keep a full-time race seat.
    return !isEliteVeteran(driver);
  }
  if (age >= REVIEW_AGE) {
    // An out-of-contract driver in his late 30s is reviewed strongly; a weaker
    // or unhappy one is the most likely to call time.
    const expiring = (driver.contractYearsRemaining ?? 0) <= 1;
    if (!expiring) return false;
    const overall = driver.ratings.overall;
    const morale = driver.morale ?? 60;
    const p =
      0.15 + Math.max(0, 7.5 - overall) * 0.18 + Math.max(0, 55 - morale) * 0.004;
    const rng = createSeededRandom(deriveSeed(seed, 'retire', driver.id, year));
    return rng.chance(Math.min(0.85, p));
  }
  return false;
}

export type RetirementResult = {
  drivers: Driver[];
  teams: Team[];
  notes: string[];
  retiredIds: string[];
};

// Apply end-of-season retirements to the whole grid. Retired drivers are
// removed from the driver list and every team roster; the vacated race seats
// are refilled downstream (AI teams by their offseason market pass, the player
// through the signing UI). Only full race-seat drivers are retired here —
// reserves/test drivers are left for teams to manage.
export function applyDriverRetirements(
  drivers: Driver[],
  teams: Team[],
  seed: string,
  year: number,
): RetirementResult {
  const retiredIds: string[] = [];
  const notes: string[] = [];
  const nextDrivers: Driver[] = [];
  const teamName = new Map(teams.map((t) => [t.id, t.name] as const));

  for (const d of drivers) {
    const isRaceSeat = d.contractType == null || d.contractType === 'seat';
    if (isRaceSeat && shouldRetire(d, seed, year)) {
      retiredIds.push(d.id);
      notes.push(
        `${d.name} retires from racing at the end of the season (age ${d.age}, ${
          teamName.get(d.teamId) ?? 'their team'
        }).`,
      );
    } else {
      nextDrivers.push(d);
    }
  }

  const retiredSet = new Set(retiredIds);
  const nextTeams = teams.map((t) => {
    if (!t.driverIds.some((id) => retiredSet.has(id))) return t;
    return { ...t, driverIds: t.driverIds.filter((id) => !retiredSet.has(id)) };
  });

  return { drivers: nextDrivers, teams: nextTeams, notes, retiredIds };
}
