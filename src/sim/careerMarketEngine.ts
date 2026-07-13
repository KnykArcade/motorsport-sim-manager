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
  canonicalNameOf,
  getMasterRegistry,
  registryList,
  sanitizeMarketName,
} from '../data/registry/masterRegistry';
import { getMarketBundle, youthSigningCost, youthYearlyAcademyCost, type MarketBundle } from '../data/market';
import { getReleasedMarketDrivers } from '../data/market';
import { crossSeriesCandidates } from './crossSeriesEngine';
import { ensureMinimumYouthProspects } from './youthGenerationEngine';
import type { GameState } from '../game/careerState';

export const ROOKIE_AGE = 18; // adult driver market eligibility (18+)
export const YOUTH_MIN_AGE = 12; // youth academy / scouting pool floor (12–17)
export const YOUTH_MAX_AGE = 17;
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
  void series;
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
  void series;
  if (e.academyEligibleYear > year) return false;
  const adultYear = e.adultEligibleYear ?? Infinity;
  if (year >= adultYear) return false;
  const age = ageInYear(e, year);
  // Youth academy pool is 12–17: under-12 prospects are not yet in any market,
  // 18+ have aged into the adult market.
  if (age != null && (age < YOUTH_MIN_AGE || age >= ROOKIE_AGE)) return false;
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
    seriesPreferences: [
      { series: e.preferredSeries, weight: 100 },
      ...e.secondarySeriesInterest.map((series, index) => ({ series, weight: Math.max(55, 80 - index * 10) })),
    ],
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

// Current age of a curated youth prospect in a given year (from birth year).
export function youthProspectAge(y: YouthProspect, year: number): number {
  return year - y.birthYear;
}

// A curated youth prospect who has aged out of the 12–17 window into adulthood
// (18+) becomes a normal adult-market free agent. Ratings carry across; salary
// and buyout are synthesized from overall/potential the same way registry youth
// entries would be, so they slot into the driver market cleanly.
export function youthProspectToAdultMarketDriver(y: YouthProspect, year: number): MarketDriver {
  return {
    id: y.id,
    name: y.name,
    age: youthProspectAge(y, year),
    nationality: y.nationality,
    context: 'Rookie',
    marketPool: 'adult',
    marketStatus: 'adult_market_eligible',
    primaryRole: 'race',
    immediateF1Eligible: y.yearsUntilF1Ready <= 0,
    skills: { ...y.skills },
    overall: y.overall,
    potential: y.potential,
    potentialDelta: y.potentialDelta,
    developmentRate: y.developmentRate,
    f1Readiness: y.yearsUntilF1Ready <= 0 ? 100 : Math.max(0, 100 - y.yearsUntilF1Ready * 25),
    salary: Math.max(0.3, y.overall * 0.4),
    sponsorValue: 0,
    buyoutCost: y.signingCost,
    negotiationDifficulty: 'low',
    suggestedUse: 'Rookie race or reserve driver',
    notes: y.notes,
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
  // Active drivers, reserves and third/test drivers all live in state.drivers.
  // Use canonicalNameOf so abbreviated names (e.g. "M. Schumacher") match
  // their full-form identity in the registry.
  for (const d of state.drivers) names.add(canonicalNameOf(d.name));
  // The player's academy and every AI team's academy hold rights to their youth.
  for (const a of state.academy ?? []) names.add(canonicalNameOf(a.name));
  for (const members of Object.values(state.aiAcademies ?? {})) {
    for (const a of members) names.add(canonicalNameOf(a.name));
  }
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
  const releasedDrivers = getReleasedMarketDrivers(year, series);
  const occupied = occupiedIdentities(state);
  // A driver holding an active seat in any championship belongs to the shared
  // universe roster, not the open market—even when the player manages another
  // series. Market and youth history does not count as an active-seat record.
  for (const entry of registryList(reg)) {
    if (entry.activeSeatsByYear?.some((seat) => seat.year === year)) {
      occupied.names.add(entry.canonicalName);
    }
  }

  // Normalize the curated youth pool by age: under-12 are hidden entirely
  // (not yet in any market), 12–17 stay in the youth pool, and any who have
  // aged to 18+ move to the adult driver market.
  const curatedYouth: YouthProspect[] = [];
  const curatedYouthToAdults: MarketDriver[] = [];
  for (const y of staticBundle?.youth ?? []) {
    const age = youthProspectAge(y, year);
    if (age < YOUTH_MIN_AGE) continue; // not yet available
    if (age > YOUTH_MAX_AGE) curatedYouthToAdults.push(youthProspectToAdultMarketDriver(y, year));
    else curatedYouth.push(y);
  }

  const curatedDrivers = [...releasedDrivers, ...curatedYouthToAdults];
  const curatedDriverNames = new Set(curatedDrivers.map((d) => canonicalNameOf(d.name)));
  const curatedYouthNames = new Set(curatedYouth.map((y) => canonicalNameOf(y.name)));

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
    ...extraDrivers.map((d) => canonicalNameOf(d.name)),
  ]);
  const crossSeries = crossSeriesCandidates(state).filter(
    (d) => !takenDriverNames.has(canonicalNameOf(d.name)),
  );

  // Final safety net: sanitize every market name and enforce a single identity
  // across the whole bundle. Names already occupied by the career universe (on
  // the grid, in any academy) are pre-seeded so they can never reappear, and no
  // driver may sit in both the adult market and the youth pool.
  const seenDrivers = new Set<string>(occupied.names);
  const drivers: MarketDriver[] = [];
  for (const d of [...curatedDrivers, ...extraDrivers, ...(staticBundle?.drivers ?? []), ...crossSeries]) {
    const clean = sanitizeMarketName(d.name);
    const key = canonicalNameOf(clean);
    if (seenDrivers.has(key)) continue;
    seenDrivers.add(key);
    drivers.push(clean === d.name ? d : { ...d, name: clean });
  }

  const seenYouth = new Set<string>(occupied.names);
  const youth: YouthProspect[] = [];
  for (const y of [...curatedYouth, ...extraYouth]) {
    const clean = sanitizeMarketName(y.name);
    const key = canonicalNameOf(clean);
    if (seenYouth.has(key) || drivers.some((d) => canonicalNameOf(d.name) === key)) continue;
    seenYouth.add(key);
    youth.push(clean === y.name ? y : { ...y, name: clean });
  }

  // Historical careers are real-driver only: a thin verified youth class stays
  // thin rather than being padded with fictional prospects. Generation remains
  // available for post-2026 future seasons, where historical data cannot exist.
  const allOccupiedNames = new Set<string>([...seenYouth, ...drivers.map((d) => canonicalNameOf(d.name))]);
  const filledYouth = year <= 2026
    ? youth
    : ensureMinimumYouthProspects(youth, state.randomSeed, state.series, year, allOccupiedNames);

  return { drivers, youth: filledYouth };
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
