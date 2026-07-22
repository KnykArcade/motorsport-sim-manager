import type { Driver, Team } from '../types/gameTypes';
import type { ContractClauseType } from '../types/phase18Types';
import type { DriverContractNegotiation, DriverContractRole, GameState } from '../game/careerState';
import { extendedDriverSalaryMillions } from './contractEngine';
import { driverFutureIntentContractModifier } from './characterFutureIntentEngine';
import { negotiationClauseScore } from './phase18ContractClauseEngine';

export function driverExtensionOfferScore(
  state: GameState,
  driver: Driver,
  appliedYears: number,
  offerMultiplier: number,
  clauseType?: ContractClauseType,
): number {
  const rel = state.driverRelationships?.[driver.id];
  const team = state.teams.find((entry) => entry.id === state.selectedTeamId);
  const relationshipScore = rel
    ? rel.morale * 0.16 + rel.teamLoyalty * 0.16 + rel.trustInPrincipal * 0.14 - rel.frustration * 0.18
    : driver.morale * 0.18 + driver.confidence * 0.12;
  const driverMood = driver.morale * 0.12 + driver.confidence * 0.08;
  const teamPull = Math.max(-8, Math.min(8, (((team as Team | undefined)?.reputation ?? 50) - 50) / 5));
  const ambitionPenalty = Math.max(0, driver.ratings.overall - 80) * 0.7;
  const seatInsecure = ['third', 'reserve', 'test'].includes(driver.contractType ?? 'seat') || driver.confidence < 40 || driver.morale < 40 || (rel?.frustration ?? 0) >= 70;
  const shortTermPenalty = appliedYears === 1 && !seatInsecure
    ? Math.max(5, Math.round((driver.ratings.overall - 50) * 0.3 + ((rel?.ego ?? 50) - 50) / 8))
    : 0;
  const securityBoost = (appliedYears >= 2 ? 9 + appliedYears * 7 : seatInsecure ? 5 : 1) + (offerMultiplier - 1) * 44;
  const expiringBoost = (driver.contractYearsRemaining ?? 1) <= 1 ? 4 : 0;
  return Math.round(22 + relationshipScore + driverMood + teamPull + securityBoost + expiringBoost
    + negotiationClauseScore(state, driver, clauseType)
    + driverFutureIntentContractModifier(state, driver.id) - ambitionPenalty - shortTermPenalty);
}

export function driverNegotiationSalaryBase(driver: Driver, years: number): number {
  return Math.max(0.1, extendedDriverSalaryMillions(driver, years));
}

export function negotiationOfferMultiplier(driver: Driver, years: number, offeredSalary: number): number {
  return Math.max(1, Math.min(2.5, offeredSalary / driverNegotiationSalaryBase(driver, years)));
}

export function buildDriverContractNegotiation(state: GameState, driver: Driver): DriverContractNegotiation {
  const years = Math.min(2, Math.max(1, 5 - (driver.contractYearsRemaining ?? 1)));
  const role: DriverContractRole = driver.contractType ?? 'seat';
  const clauseType: ContractClauseType = role === 'seat' ? 'EqualTreatment' : 'SeatGuarantee';
  const base = driverNegotiationSalaryBase(driver, years);
  const askingSalary = Math.round(base * 1.2 * 10) / 10;
  const offeredSalary = Math.round(base * 10) / 10;
  return {
    driverId: driver.id, askingSalary, offeredSalary, years, role, clauseType,
    acceptanceLikelihood: driverExtensionOfferScore(state, driver, years, negotiationOfferMultiplier(driver, years, offeredSalary), clauseType),
    response: 'demand',
  };
}

export function refreshDriverContractNegotiation(
  state: GameState,
  negotiation: DriverContractNegotiation,
): DriverContractNegotiation {
  const driver = state.drivers.find((entry) => entry.id === negotiation.driverId);
  if (!driver) return negotiation;
  const years = Math.max(1, Math.min(3, Math.min(negotiation.years, 5 - (driver.contractYearsRemaining ?? 1))));
  const base = driverNegotiationSalaryBase(driver, years);
  const askingSalary = Math.max(negotiation.askingSalary, Math.round(base * 1.2 * 10) / 10);
  return {
    ...negotiation,
    years,
    askingSalary,
    offeredSalary: Math.max(0.1, Math.round(negotiation.offeredSalary * 10) / 10),
    acceptanceLikelihood: driverExtensionOfferScore(state, driver, years, negotiationOfferMultiplier(driver, years, negotiation.offeredSalary), negotiation.clauseType),
    response: negotiation.response === 'countered' ? 'countered' : 'editing',
  };
}

export function deterministicCounterSalary(driver: Driver, years: number, offeredSalary: number, score: number): number {
  const base = driverNegotiationSalaryBase(driver, years);
  const gap = Math.max(1, 58 - score) / 44;
  return Math.round(Math.max(offeredSalary + 0.1, base * (negotiationOfferMultiplier(driver, years, offeredSalary) + gap)) * 10) / 10;
}
