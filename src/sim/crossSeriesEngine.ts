// Cross-series driver market (Phase 4).
//
// The transfer market behaves like one marketplace across series. A driver has a
// preferred series and a set of eligible series, but may still consider an offer
// from a *foreign* series depending on their willingness (age / career phase /
// whether they currently hold a seat) and the quality of the concrete offer
// (team reputation, car competitiveness, salary vs demand, series prestige,
// contract length).
//
// This module is pure and deterministic. It exposes:
//   - refinedWillingness()  — live willingness to switch, refined by seat status
//   - crossSeriesInterest() — 0-100 interest in a specific offer
//   - willingToSign()       — boolean gate on an offer
//   - crossSeriesCandidates() — foreign-series free agents open to this series,
//                               surfaced into the career market bundle

import type { Series } from '../types/gameTypes';
import type { MarketDriver } from '../types/marketTypes';
import type { MasterDriverEntry } from '../types/registryTypes';
import { careerPhaseForAge, getMasterRegistry, registryList } from '../data/registry/masterRegistry';
import {
  ageInYear,
  entryToMarketDriver,
  isRetiredByAge,
  occupiedIdentities,
  ROOKIE_AGE,
  RETIRE_AGE,
} from './careerMarketEngine';
import type { GameState } from '../game/careerState';

// Relative prestige of each series (0-100). F1 is the pinnacle; a driver drops
// down reluctantly, especially an established one with a seat.
export const SERIES_PRESTIGE: Record<Series, number> = {
  F1: 100,
  IndyCar: 72,
  CART: 70,
  'Champ Car': 70,
};

export function seriesPrestige(series: Series): number {
  return SERIES_PRESTIGE[series] ?? 50;
}

// A driver whose willingness (as a free agent) clears this bar is surfaced as a
// cross-series candidate in another series' market.
export const CROSS_SERIES_WILLINGNESS_THRESHOLD = 45;

const clamp = (min: number, max: number, v: number) => Math.max(min, Math.min(max, v));
const clamp0100 = (v: number) => clamp(0, 100, v);
const clamp01 = (v: number) => clamp(0, 1, v);

// A concrete seat offer being weighed by a driver.
export type SeriesOffer = {
  series: Series;
  teamReputation: number; // 0-100
  carCompetitiveness: number; // 0-100 (car overall)
  salary: number; // $M/yr offered
  contractYears: number;
};

// Live willingness (0-100) to switch series, refining the registry baseline with
// current seat status: a driver without a seat is more open; one holding a seat
// is more reluctant. Older drivers stay flexible when out of top options.
export function refinedWillingness(
  e: MasterDriverEntry,
  year: number,
  hasSeat: boolean,
): number {
  const phase = careerPhaseForAge(ageInYear(e, year));
  let w = e.willingnessToSwitchSeries;
  w += hasSeat ? -10 : 20;
  if (phase === 'twilight') w += 5;
  return clamp0100(w);
}

// How standing (talent) a driver is, 0..1 (overall 60→0, 100→1).
function standingOf(e: MasterDriverEntry): number {
  return clamp01((e.baseRatings.overall - 60) / 40);
}

// Series-preference component (0-100): a driver most wants their preferred
// series, then eligible / secondary-interest series; a pure foreign switch is
// gated by their (seat-refined) willingness.
function seriesPreferenceScore(
  e: MasterDriverEntry,
  year: number,
  hasSeat: boolean,
  series: Series,
): number {
  if (series === e.preferredSeries) return 90;
  if (e.eligibleSeries.includes(series)) return 70;
  if (e.secondarySeriesInterest.includes(series)) return 60;
  return refinedWillingness(e, year, hasSeat);
}

// Chance-to-win component (0-100): team reputation + car competitiveness.
function competitivenessScore(offer: SeriesOffer): number {
  return clamp0100(0.5 * offer.teamReputation + 0.5 * offer.carCompetitiveness);
}

// Salary component (0-100): meeting the driver's demand scores 50, doubling it
// approaches 100, halving it drops toward 25.
function salaryScore(e: MasterDriverEntry, offer: SeriesOffer): number {
  const ratio = offer.salary / Math.max(0.5, e.salaryDemand);
  return clamp0100(50 + (ratio - 1) * 50);
}

// Reluctance to drop to a lower-prestige series. Elite drivers — especially ones
// holding a seat — resist downgrades most; seatless drivers care far less.
function prestigePenalty(e: MasterDriverEntry, offer: SeriesOffer, hasSeat: boolean): number {
  const gap = Math.max(0, seriesPrestige(e.preferredSeries) - seriesPrestige(offer.series));
  return gap * (0.25 + 0.35 * standingOf(e)) * (hasSeat ? 1 : 0.5);
}

// Interest (0-100) a driver has in a specific offer. Talented drivers weight car
// competitiveness more heavily (they want a winning seat); everyone values
// preference and salary. A downgrade in series prestige subtracts, a sensible
// contract length adds, and being seatless nudges interest up.
export function crossSeriesInterest(
  e: MasterDriverEntry,
  year: number,
  hasSeat: boolean,
  offer: SeriesOffer,
): number {
  const standing = standingOf(e);
  const wComp = 0.25 + 0.2 * standing; // 0.25 .. 0.45
  const wPref = 0.45 - 0.1 * standing; // 0.45 .. 0.35
  const wSal = 1 - wComp - wPref; // remainder

  const base =
    wPref * seriesPreferenceScore(e, year, hasSeat, offer.series) +
    wComp * competitivenessScore(offer) +
    wSal * salaryScore(e, offer);

  const contractBonus = offer.contractYears >= 2 && offer.contractYears <= 4 ? 4 : 0;
  const seatlessBonus = hasSeat ? 0 : 8;

  return clamp0100(base - prestigePenalty(e, offer, hasSeat) + contractBonus + seatlessBonus);
}

// Whether a driver would accept a given offer.
export function willingToSign(
  e: MasterDriverEntry,
  year: number,
  hasSeat: boolean,
  offer: SeriesOffer,
  threshold = 50,
): boolean {
  return crossSeriesInterest(e, year, hasSeat, offer) >= threshold;
}

// A market driver's interest (0-100) in signing for the player's team this year,
// used to weight contested bids. Returns undefined for drivers who are already
// eligible for the career's series (a same-series move carries no series-
// preference penalty, so bidding is unchanged) and for non-registry curated
// drivers. `playerTeamReputation` is 0-100; `playerCarOverall` is 0-100.
export function marketDriverOfferInterest(
  state: GameState,
  md: MarketDriver,
  playerTeamReputation: number,
  playerCarOverall: number,
): number | undefined {
  if (!md.id.startsWith('reg-')) return undefined;
  const e = getMasterRegistry().byId[md.id.slice(4)];
  if (!e) return undefined;
  if (e.eligibleSeries.includes(state.series)) return undefined; // same-series: unchanged
  const offer: SeriesOffer = {
    series: state.series,
    teamReputation: playerTeamReputation,
    carCompetitiveness: playerCarOverall,
    salary: md.salary,
    contractYears: 2,
  };
  return crossSeriesInterest(e, state.seasonYear, false, offer);
}

// Foreign-series free agents who are open to the career's current series. These
// are drivers NOT eligible for the current series (that pool is the normal
// market) but willing to cross over, surfaced as MarketDrivers tagged
// `crossSeries` so the UI can flag them.
export function crossSeriesCandidates(state: GameState): MarketDriver[] {
  const { seasonYear: year, series } = state;
  const occupied = occupiedIdentities(state);
  const out: MarketDriver[] = [];
  for (const e of registryList()) {
    if (e.eligibleSeries.includes(series)) continue; // handled by the normal market
    if (e.marketEntryYear > year) continue;
    if (isRetiredByAge(e, year)) continue;
    if (occupied.names.has(e.canonicalName)) continue;
    if (occupied.signedIds.has(`reg-${e.driverId}`)) continue;
    const age = ageInYear(e, year);
    if (age != null && (age < ROOKIE_AGE || age > RETIRE_AGE)) continue;
    const willingness = refinedWillingness(e, year, false);
    if (willingness < CROSS_SERIES_WILLINGNESS_THRESHOLD) continue;
    const md = entryToMarketDriver(e, year);
    out.push({
      ...md,
      marketPool: 'crossSeries',
      context: `${e.preferredSeries} crossover`,
      notes: `Open to ${series} — willingness ${Math.round(willingness)}/100`,
    });
  }
  return out;
}
