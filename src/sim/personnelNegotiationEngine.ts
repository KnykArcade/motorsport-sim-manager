import { getStaffPool } from '../data';
import type { GameState, MarketContractNegotiation, StaffContractNegotiation } from '../game/careerState';
import { careerMarketBundle } from './careerMarketEngine';
import { carForTeam } from '../game/careerState';
import { carPerformanceRating } from './trackFitEngine';
import { marketDriverOfferInterest } from './crossSeriesEngine';
import { competingBidFor } from './driverBiddingEngine';
import { staffEmployer } from './aiStaffRosterEngine';
import { staffFutureIntentContractModifier } from './characterFutureIntentEngine';
import { staffRatingOutOfTen } from './staffEngine';

function round1(value: number): number { return Math.round(value * 10) / 10; }

export function marketNegotiationScore(state: GameState, negotiation: MarketContractNegotiation): number {
  const driver = careerMarketBundle(state).drivers.find((entry) => entry.id === negotiation.marketId);
  if (!driver) return 0;
  const org = state.teamOrgRatings?.[state.selectedTeamId]?.overallTeamRating ?? 50;
  const car = carForTeam(state, state.selectedTeamId);
  const interest = marketDriverOfferInterest(state, driver, org, car ? carPerformanceRating(car) : 50);
  const rivalBid = competingBidFor(driver, state.randomSeed);
  const bidScore = rivalBid <= 0 ? 70 : Math.min(100, negotiation.offeredBid / rivalBid * 70);
  const salaryScore = Math.min(100, negotiation.offeredSalary / Math.max(0.1, driver.salary) * 65);
  const security = negotiation.years * 5;
  return Math.round((interest ?? 55) * 0.42 + bidScore * 0.32 + salaryScore * 0.21 + security);
}

export function buildMarketContractNegotiation(state: GameState, marketId: string, seatDriverId: string): MarketContractNegotiation | undefined {
  const driver = careerMarketBundle(state).drivers.find((entry) => entry.id === marketId);
  if (!driver) return undefined;
  const rivalBid = competingBidFor(driver, state.randomSeed);
  const askingBid = round1(Math.max(driver.buyoutCost, rivalBid + (rivalBid > 0 ? 0.1 : 0)));
  const negotiation: MarketContractNegotiation = {
    marketId, seatDriverId, offeredBid: driver.buyoutCost, askingBid,
    offeredSalary: driver.salary, askingSalary: round1(driver.salary * 1.1),
    years: 2, clauseType: 'EqualTreatment', acceptanceLikelihood: 0,
    attemptsRemaining: 3, response: 'demand',
  };
  return { ...negotiation, acceptanceLikelihood: marketNegotiationScore(state, negotiation) };
}

export function refreshMarketContractNegotiation(state: GameState, negotiation: MarketContractNegotiation): MarketContractNegotiation {
  const next = {
    ...negotiation,
    offeredBid: round1(Math.max(0, negotiation.offeredBid)),
    offeredSalary: round1(Math.max(0.1, negotiation.offeredSalary)),
    years: Math.max(1, Math.min(5, Math.round(negotiation.years))),
    response: negotiation.response === 'countered' ? 'countered' as const : 'editing' as const,
  };
  return { ...next, acceptanceLikelihood: marketNegotiationScore(state, next) };
}

export function staffNegotiationScore(state: GameState, negotiation: StaffContractNegotiation): number {
  const member = [...(state.staff ?? []), ...getStaffPool(state.seasonYear, state.series)]
    .find((entry) => entry.id === negotiation.staffId);
  if (!member) return 0;
  const opinion = state.characterInteractions?.opinions[`Staff:${member.id}`];
  const relationship = negotiation.mode === 'extension'
    ? (opinion?.trust ?? 50) * 0.24 + (opinion?.respect ?? 50) * 0.16
    : 20;
  const approached = (state.characterInteractions?.recruitmentInterest[member.id] ?? 0) > 0 ? 8 : 0;
  const employerPenalty = staffEmployer(state.aiStaff, member.id) ? 8 : 0;
  const ratingPremium = Math.max(0, staffRatingOutOfTen(member.rating) - 7) * 3;
  const future = negotiation.mode === 'extension' ? staffFutureIntentContractModifier(state, member.id) : 0;
  return Math.round(24 + relationship + approached + negotiation.years * 6 + (negotiation.offerMultiplier - 1) * 42 + future - employerPenalty - ratingPremium);
}

export function buildStaffContractNegotiation(state: GameState, staffId: string): StaffContractNegotiation | undefined {
  const mode = (state.staff ?? []).some((entry) => entry.id === staffId) ? 'extension' : 'hire';
  const member = [...(state.staff ?? []), ...getStaffPool(state.seasonYear, state.series)].find((entry) => entry.id === staffId);
  if (!member) return undefined;
  const negotiation: StaffContractNegotiation = {
    staffId, mode, offerMultiplier: 1, askingMultiplier: mode === 'hire' && staffEmployer(state.aiStaff, staffId) ? 1.2 : 1.1,
    years: 2, acceptanceLikelihood: 0, attemptsRemaining: 3, response: 'demand',
  };
  return { ...negotiation, acceptanceLikelihood: staffNegotiationScore(state, negotiation) };
}

export function refreshStaffContractNegotiation(state: GameState, negotiation: StaffContractNegotiation): StaffContractNegotiation {
  const next = {
    ...negotiation,
    offerMultiplier: Math.max(1, Math.min(2.5, round1(negotiation.offerMultiplier))),
    years: Math.max(1, Math.min(5, Math.round(negotiation.years))),
    response: negotiation.response === 'countered' ? 'countered' as const : 'editing' as const,
  };
  return { ...next, acceptanceLikelihood: staffNegotiationScore(state, next) };
}
