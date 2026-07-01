// Career-mode living driver market, derived from the Master Driver Registry.
//
// Single Season and New Career starts still use the exact selected-year season
// rosters (see seasonBundles). Once a career is running, the transfer market is
// no longer a static per-season file: it grows over time from the registry's
// availability rules layered on top of the career save state.
//
//   - the curated per-season market file (when data exists for the year) is kept
//     as the base pool, so early-career feel is unchanged;
//   - registry free agents whose marketEntryYear has arrived are added;
//   - youth prospects enter by academyEligibleYear and age into the adult market
//     at adultEligibleYear / 18;
//   - drivers already on the grid, in the academy, already signed, or past the
//     retirement age are excluded.
//
// Everything here is pure and deterministic — the registry is rebuilt from
// static seed data, so nothing new needs to be persisted in the save.

import type { MarketDriver, MarketSkillRatings, YouthProspect } from '../types/marketTypes';
import type { MasterDriverEntry } from '../types/registryTypes';
import type { Series } from '../types/gameTypes';
import {
  getMasterRegistry,
  normalizeName,
  registryList,
} from '../data/registry/masterRegistry';
import { getMarketBundle, youthSigningCost, youthYearlyAcademyCost, type MarketBundle } from '../data/market';
import { crossSeriesCandidates } from './crossSeriesEngine';
import type { GameState } from '../game/careerState';

export const ROOKIE_AGE = 18;
export const RETIRE_AGE = 40;
// Grid drivers carry no birth year; assume a plausible active span from their
// first appearance before they age out of the market.
const UNKNOWN_AGE_SPAN = 18;

const SKILL_KEYS: (keyof MarketSkillRatings)[] = [
  'cornering',
  'braking',
  'straights',
  'tractionAcceleration',
  'elevationBlindCorners',
  'technical',
  'overtakingRacecraft',
  'surfaceGripBumpiness',
  'riskManagement',
  'enduranceConsistency',
];

function skillsOf(e: MasterDriverEntry): MarketSkillRatings {
  return Object.fromEntries(SKILL_KEYS.map((k) => [k, e.baseRatings[k]])) as MarketSkillRatings;
}

// Best-known age of a registry driver in a given year.
export function ageInYear(e: MasterDriverEntry, year: number): number | undefined {
  if (e.birthYear != null) return year - e.birthYear;
  if (e.startingAge != null) return e.startingAge + (year - e.firstSeenYear);
  return undefined;
}

// Whether a registry driver has aged out of the sport by a given year.
export function isRetiredByAge(e: MasterDriverEntry, year: number): boolean {
  if (e.retirementYear != null && year > e.retirementYear) return true;
  const age = ageInYear(e, year);
  if (age != null) return age > RETIRE_AGE;
  // Unknown age: retire once past the assumed active span from first appearance.
  return year > e.firstSeenYear + UNKNOWN_AGE_SPAN;
}

// A registry driver counts as an available adult free agent for (year, series)
// when their market-entry year has arrived, they are of racing age, eligible for
// the series, and not yet retired. This is the same-series pool; drivers eligible
// only for other series are surfaced separately as cross-series candidates
// (see crossSeriesEngine).
export function isAdultAvailable(e: MasterDriverEntry, year: number, series: Series): boolean {
  if (!e.eligibleSeries.includes(series)) return false;
  if (e.marketEntryYear > year) return false;
  if (isRetiredByAge(e, year)) return false;
  const age = ageInYear(e, year);
  if (age != null) return age >= ROOKIE_AGE;
  return true; // grid-sourced driver of unknown age is an adult
}

// A registry driver counts as an available youth prospect when they are in the
// youth window (academyEligibleYear reached, not yet adult-eligible).
export function isYouthAvailable(e: MasterDriverEntry, year: number, series: Series): boolean {
  if (e.academyEligibleYear == null) return false;
  if (!e.eligibleSeries.includes(series)) return false;
  if (e.academyEligibleYear > year) return false;
  const adultYear = e.adultEligibleYear ?? Infinity;
  if (year >= adultYear) return false;
  const age = ageInYear(e, year);
  if (age != null && age >= ROOKIE_AGE) return false;
  return true;
}

// --- Registry entry → market/youth shapes ----------------------------------

export function entryToMarketDriver(e: MasterDriverEntry, year: number): MarketDriver {
  const age = ageInYear(e, year) ?? 25;
  return {
    id: `reg-${e.driverId}`,
    name: e.displayName,
    age,
    nationality: e.nationality ?? '—',
    context: e.seriesExperience[e.preferredSeries] ? `${e.preferredSeries} free agent` : 'Free agent',
    marketPool: 'registry',
    marketStatus: 'available',
    primaryRole: 'race',
    immediateF1Eligible: true,
    skills: skillsOf(e),
    overall: e.baseRatings.overall,
    potential: e.potential,
    potentialDelta: Math.max(0, e.potential - e.baseRatings.overall),
    developmentRate: 1,
    f1Readiness: 100,
    salary: e.salaryDemand,
    sponsorValue: e.sponsorBacking,
    buyoutCost: e.marketValue,
    negotiationDifficulty: 'medium',
    suggestedUse: 'race',
    notes: '',
  };
}

export function entryToYouthProspect(e: MasterDriverEntry, year: number): YouthProspect {
  const age = ageInYear(e, year) ?? 16;
  return {
    id: `reg-${e.driverId}`,
    name: e.displayName,
    age,
    birthYear: e.birthYear ?? year - age,
    nationality: e.nationality ?? '—',
    currentLevel: 'junior',
    marketPool: 'registry',
    marketStatus: 'available',
    academyEligibleNow: (e.academyEligibleYear ?? year) <= year,
    earliestFullAcademyYear: e.academyEligibleYear ?? year,
    skills: skillsOf(e),
    overall: e.baseRatings.overall,
    potential: e.potential,
    potentialDelta: Math.max(0, e.potential - e.baseRatings.overall),
    developmentRate: 2,
    yearsUntilF1Ready: Math.max(0, (e.adultEligibleYear ?? year) - year),
    signingCost: youthSigningCost(e.potential),
    yearlyAcademyCost: youthYearlyAcademyCost(e.potential),
    riskLevel: 'medium',
    suggestedPath: 'academy',
    notes: '',
  };
}

// --- Exclusion set ----------------------------------------------------------

// Identities already accounted for in the career universe (on the grid, in the
// academy, or already signed off the market) — these must not reappear as fresh
// market candidates.
export function occupiedIdentities(state: GameState): {
  names: Set<string>;
  signedIds: Set<string>;
} {
  const names = new Set<string>();
  for (const d of state.drivers) names.add(normalizeName(d.name));
  for (const a of state.academy ?? []) names.add(normalizeName(a.name));
  const signedIds = new Set(state.signedMarketIds ?? []);
  return { names, signedIds };
}

function notOccupied(
  e: MasterDriverEntry,
  occupied: { names: Set<string>; signedIds: Set<string> },
): boolean {
  if (occupied.names.has(e.canonicalName)) return false;
  if (occupied.signedIds.has(`reg-${e.driverId}`)) return false;
  return true;
}

// --- Living career market bundle -------------------------------------------

// The transfer market for the current career year: the curated season file (if
// any) plus registry free agents / youth that have become available and are not
// already in the universe. Deduplicated by canonical name against the curated
// pool and the grid.
export function careerMarketBundle(state: GameState): MarketBundle {
  const { seasonYear: year, series } = state;
  const reg = getMasterRegistry();
  const staticBundle = getMarketBundle(year, series);
  const occupied = occupiedIdentities(state);

  const curatedDriverNames = new Set((staticBundle?.drivers ?? []).map((d) => normalizeName(d.name)));
  const curatedYouthNames = new Set((staticBundle?.youth ?? []).map((y) => normalizeName(y.name)));

  const extraDrivers: MarketDriver[] = [];
  const extraYouth: YouthProspect[] = [];
  for (const e of registryList(reg)) {
    if (!notOccupied(e, occupied)) continue;
    if (isAdultAvailable(e, year, series) && !curatedDriverNames.has(e.canonicalName)) {
      extraDrivers.push(entryToMarketDriver(e, year));
    } else if (isYouthAvailable(e, year, series) && !curatedYouthNames.has(e.canonicalName)) {
      extraYouth.push(entryToYouthProspect(e, year));
    }
  }

  // Foreign-series free agents open to switching into this series.
  const takenDriverNames = new Set([
    ...curatedDriverNames,
    ...extraDrivers.map((d) => normalizeName(d.name)),
  ]);
  const crossSeries = crossSeriesCandidates(state).filter(
    (d) => !takenDriverNames.has(normalizeName(d.name)),
  );

  return {
    drivers: [...(staticBundle?.drivers ?? []), ...extraDrivers, ...crossSeries],
    youth: [...(staticBundle?.youth ?? []), ...extraYouth],
  };
}

// --- Rollover deltas (for the offseason summary) ----------------------------

export type MarketRolloverChanges = {
  newAdults: MasterDriverEntry[]; // available next year, not this year
  newYouth: MasterDriverEntry[]; // enter the youth pool next year
  promotedYouth: MasterDriverEntry[]; // youth this year → adult market next year
  retirements: MasterDriverEntry[]; // active/available this year → retired next
};

// Diff registry availability between the finishing season and the next one to
// describe what changes in the living market. Identities already occupied by the
// career universe are ignored so the summary reflects the actual free market.
export function marketRolloverChanges(state: GameState, nextYear: number): MarketRolloverChanges {
  const { seasonYear: prevYear, series } = state;
  const occupied = occupiedIdentities(state);
  const changes: MarketRolloverChanges = {
    newAdults: [],
    newYouth: [],
    promotedYouth: [],
    retirements: [],
  };
  for (const e of registryList(getMasterRegistry())) {
    if (!notOccupied(e, occupied)) continue;
    const adultPrev = isAdultAvailable(e, prevYear, series);
    const adultNext = isAdultAvailable(e, nextYear, series);
    const youthPrev = isYouthAvailable(e, prevYear, series);
    const youthNext = isYouthAvailable(e, nextYear, series);

    if (youthNext && !youthPrev && !adultPrev) changes.newYouth.push(e);
    if (adultNext && youthPrev) changes.promotedYouth.push(e);
    else if (adultNext && !adultPrev && !youthPrev) changes.newAdults.push(e);
    if (!adultNext && !youthNext && (adultPrev || youthPrev) && isRetiredByAge(e, nextYear)) {
      changes.retirements.push(e);
    }
  }
  return changes;
}

// Human-readable summary lines for the offseason report.
export function marketRolloverNotes(changes: MarketRolloverChanges): string[] {
  const notes: string[] = [];
  if (changes.newAdults.length) {
    notes.push(`${changes.newAdults.length} new driver(s) entered the market.`);
  }
  if (changes.newYouth.length) {
    notes.push(`${changes.newYouth.length} new youth prospect(s) entered the pool.`);
  }
  if (changes.promotedYouth.length) {
    notes.push(
      `${changes.promotedYouth.length} youth driver(s) aged into the senior market.`,
    );
  }
  if (changes.retirements.length) {
    notes.push(`${changes.retirements.length} driver(s) retired.`);
  }
  return notes;
}
