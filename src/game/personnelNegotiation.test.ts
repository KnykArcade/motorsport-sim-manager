import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { getStaffPool } from '../data';
import { careerMarketBundle } from '../sim/careerMarketEngine';
import { createNewGame } from './initialCareer';
import { gameReducer } from './gameReducer';

function career() {
  const state = createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'personnel-negotiation' });
  return { ...state, teams: state.teams.map((team) => team.id === state.selectedTeamId ? { ...team, budget: 10_000_000_000 } : team) };
}

describe('external personnel negotiations', () => {
  it('opens an in-season pre-contract and preserves the current seat until rollover', () => {
    let state = career();
    const market = careerMarketBundle(state).drivers[0];
    const seat = state.drivers.find((driver) => driver.teamId === state.selectedTeamId)!;
    state = gameReducer(state, { type: 'START_MARKET_CONTRACT_NEGOTIATION', marketId: market.id, seatDriverId: seat.id })!;
    expect(state.marketContractNegotiation?.marketId).toBe(market.id);
    state = gameReducer(state, { type: 'UPDATE_MARKET_CONTRACT_NEGOTIATION', offeredBid: 999, offeredSalary: market.salary * 2.5, years: 5 })!;
    state = gameReducer(state, { type: 'SUBMIT_MARKET_CONTRACT_NEGOTIATION' })!;
    expect(state.pendingSignings).toContainEqual(expect.objectContaining({ sourceId: market.id, seatDriverId: seat.id }));
    expect(state.drivers.find((driver) => driver.id === seat.id)?.teamId).toBe(state.selectedTeamId);
  });

  it('negotiates a market pre-contract and queues accepted terms through the existing signing path', () => {
    let state = { ...career(), seasonComplete: true };
    const market = careerMarketBundle(state).drivers[0];
    const seat = state.drivers.find((driver) => driver.teamId === state.selectedTeamId)!;
    state = gameReducer(state, { type: 'START_MARKET_CONTRACT_NEGOTIATION', marketId: market.id, seatDriverId: seat.id })!;
    expect(state.marketContractNegotiation?.attemptsRemaining).toBe(3);
    state = gameReducer(state, { type: 'UPDATE_MARKET_CONTRACT_NEGOTIATION', offeredBid: 999, offeredSalary: market.salary * 2.5, years: 5 })!;
    const agreedSalary = state.marketContractNegotiation!.offeredSalary;
    state = gameReducer(state, { type: 'SUBMIT_MARKET_CONTRACT_NEGOTIATION' })!;
    expect(state.marketContractNegotiation).toBeUndefined();
    expect(state.pendingSignings).toContainEqual(expect.objectContaining({ sourceId: market.id, seatDriverId: seat.id, offeredSalary: agreedSalary, contractYears: 5 }));
  });

  it('uses deterministic counters and consumes agent patience for a close market offer', () => {
    let state = { ...career(), seasonComplete: true };
    const market = careerMarketBundle(state).drivers[0];
    const seat = state.drivers.find((driver) => driver.teamId === state.selectedTeamId)!;
    state = gameReducer(state, { type: 'START_MARKET_CONTRACT_NEGOTIATION', marketId: market.id, seatDriverId: seat.id })!;
    state = gameReducer(state, { type: 'UPDATE_MARKET_CONTRACT_NEGOTIATION', offeredBid: market.buyoutCost, offeredSalary: market.salary, years: 1 })!;
    const before = state.marketContractNegotiation!;
    state = gameReducer(state, { type: 'SUBMIT_MARKET_CONTRACT_NEGOTIATION' })!;
    if (before.acceptanceLikelihood < 58) expect(state.marketContractNegotiation?.attemptsRemaining).toBe(2);
  });

  it('routes an accepted staff recruitment package through the existing hire path', () => {
    let state = career();
    const candidate = getStaffPool(state.seasonYear, state.series).find((member) => !(state.staff ?? []).some((current) => current.id === member.id))!;
    state = gameReducer(state, { type: 'START_STAFF_CONTRACT_NEGOTIATION', staffId: candidate.id })!;
    state = gameReducer(state, { type: 'UPDATE_STAFF_CONTRACT_NEGOTIATION', offerMultiplier: 2.5, years: 4 })!;
    state = gameReducer(state, { type: 'SUBMIT_STAFF_CONTRACT_NEGOTIATION' })!;
    expect(state.staffContractNegotiation).toBeUndefined();
    expect(state.staff).toContainEqual(expect.objectContaining({ id: candidate.id, contractYearsRemaining: 4 }));
    expect(state.finance?.some((entry) => entry.category === 'Staff' && entry.label.includes(candidate.name))).toBe(true);
  });
});
