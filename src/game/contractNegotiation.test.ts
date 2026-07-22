import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from './initialCareer';
import { activeDriversForTeam, teamById, type GameState } from './careerState';
import { gameReducer } from './gameReducer';
import { driverExtensionOfferScore, negotiationOfferMultiplier } from '../sim/driverContractNegotiationEngine';

function newGame(): GameState {
  return createNewGame({ gameMode: 'Career', seasonYear: 1994, series: 'F1', teamId: 't-williams', seed: 'negotiation-flow' });
}

describe('driver contract negotiation flow', () => {
  it('starts and edits a deterministic negotiation', () => {
    let state = newGame();
    const driver = activeDriversForTeam(state, state.selectedTeamId)[0];
    state = gameReducer(state, { type: 'START_DRIVER_CONTRACT_NEGOTIATION', driverId: driver.id })!;
    const first = state.contractNegotiation!;
    state = gameReducer(state, { type: 'UPDATE_DRIVER_CONTRACT_NEGOTIATION', offeredSalary: first.offeredSalary + 1, years: 1, clauseType: 'SeatGuarantee' })!;
    expect(state.contractNegotiation).toMatchObject({ driverId: driver.id, years: 1, clauseType: 'SeatGuarantee', response: 'editing' });
    expect(state.contractNegotiation!.acceptanceLikelihood).toBeTypeOf('number');
  });

  it('surfaces a counter when a close offer is rejected', () => {
    let state = newGame();
    const driver = activeDriversForTeam(state, state.selectedTeamId)[0];
    state = gameReducer(state, { type: 'START_DRIVER_CONTRACT_NEGOTIATION', driverId: driver.id })!;
    const negotiation = state.contractNegotiation!;
    // Tune the relationship to a real score inside the deterministic counter band.
    for (let value = 0; value <= 80; value += 5) {
      const candidate = {
        ...state,
        driverRelationships: {
          ...state.driverRelationships,
          [driver.id]: { ...state.driverRelationships![driver.id], morale: value, teamLoyalty: value, trustInPrincipal: value, frustration: 60 },
        },
      };
      const score = driverExtensionOfferScore(candidate, driver, negotiation.years, negotiationOfferMultiplier(driver, negotiation.years, negotiation.offeredSalary), negotiation.clauseType);
      if (score >= 45 && score < 58) { state = candidate; break; }
    }
    state = gameReducer(state, { type: 'SUBMIT_DRIVER_CONTRACT_NEGOTIATION' })!;
    expect(state.contractNegotiation?.response).toBe('countered');
    expect(state.contractNegotiation?.counterSalary).toBeGreaterThan(negotiation.offeredSalary);
  });

  it('accepts a strong package through the existing extension path and clears talks', () => {
    let state = newGame();
    const driver = activeDriversForTeam(state, state.selectedTeamId)[0];
    const beforeYears = driver.contractYearsRemaining ?? 1;
    const beforeBudget = teamById(state, state.selectedTeamId)!.budget;
    state = gameReducer(state, { type: 'START_DRIVER_CONTRACT_NEGOTIATION', driverId: driver.id })!;
    state = gameReducer(state, { type: 'UPDATE_DRIVER_CONTRACT_NEGOTIATION', offeredSalary: state.contractNegotiation!.askingSalary * 1.6, years: 1 })!;
    state = gameReducer(state, { type: 'SUBMIT_DRIVER_CONTRACT_NEGOTIATION' })!;
    expect(state.contractNegotiation).toBeUndefined();
    expect(state.drivers.find((entry) => entry.id === driver.id)!.contractYearsRemaining).toBe(beforeYears + 1);
    expect(teamById(state, state.selectedTeamId)!.budget).toBeLessThan(beforeBudget);
    expect(state.news[0].headline).toContain('agrees');
  });

  it('blocks talks in Single Season', () => {
    let state = createNewGame({ gameMode: 'SingleSeason', seasonYear: 1994, series: 'F1', teamId: 't-williams', seed: 'single-talks' });
    const driver = activeDriversForTeam(state, state.selectedTeamId)[0];
    state = gameReducer(state, { type: 'START_DRIVER_CONTRACT_NEGOTIATION', driverId: driver.id })!;
    expect(state.contractNegotiation).toBeUndefined();
  });
});
