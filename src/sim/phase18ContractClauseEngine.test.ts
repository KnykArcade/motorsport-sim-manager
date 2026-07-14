import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import type { GameState } from '../game/careerState';
import type { DriverPromise } from '../types/relationshipTypes';
import {
  applyNegotiatedDriverClause,
  ensureContractClauses,
  evaluateContractClauses,
  linkPromiseToClause,
  negotiationClauseScore,
  respondToContractBreach,
  syncClausePromiseResolution,
} from './phase18ContractClauseEngine';

function freshState(seed = 'phase18-contract-clauses'): GameState {
  return createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed });
}

describe('Phase 18 contract clauses', () => {
  it('seeds one active clause per contracted driver and remains idempotent', () => {
    const state = freshState();
    const once = ensureContractClauses(state);
    const twice = ensureContractClauses(once);
    expect(once.phase18!.contractClauses.filter((clause) => clause.partyType === 'Driver')).toHaveLength(state.drivers.length);
    expect(twice.phase18!.contractClauses).toEqual(once.phase18!.contractClauses);
  });

  it('uses a wanted clause as meaningful negotiation value and replaces the old role clause', () => {
    const state = freshState('clause-negotiation');
    const driver = state.drivers.find((candidate) => candidate.teamId === state.selectedTeamId)!;
    const rel = state.driverRelationships![driver.id];
    const wanted = { ...state, driverRelationships: { ...state.driverRelationships!, [driver.id]: { ...rel, wants: [...rel.wants, 'number_one_status' as const] } } };
    expect(negotiationClauseScore(wanted, driver, 'NumberOneStatus')).toBeGreaterThan(10);
    const next = applyNegotiatedDriverClause(wanted, driver.id, 'NumberOneStatus');
    const clauses = next.phase18!.contractClauses.filter((clause) => clause.partyId === driver.id);
    expect(clauses.filter((clause) => clause.status === 'Active')).toHaveLength(1);
    expect(clauses.find((clause) => clause.status === 'Active')?.clauseType).toBe('NumberOneStatus');
  });

  it('links promises to clauses and mirrors their resolution', () => {
    const state = freshState('clause-promise');
    const driver = state.drivers.find((candidate) => candidate.teamId === state.selectedTeamId)!;
    const promise: DriverPromise = { id: 'promise-clause-test', driverId: driver.id, promiseType: 'equal_treatment', madeRound: 1, madeSeason: state.seasonYear, status: 'active', trustImpact: 5, moraleImpact: 4 };
    const linked = linkPromiseToClause(state, promise);
    expect(linked.phase18!.contractClauses.some((clause) => clause.linkedPromiseId === promise.id)).toBe(true);
    const resolved = syncClausePromiseResolution(linked, { ...promise, status: 'broken' });
    expect(resolved.phase18!.contractClauses.find((clause) => clause.linkedPromiseId === promise.id)?.status).toBe('Breached');
  });

  it('applies a team-order breach once and lets management compensate', () => {
    let state = freshState('clause-breach');
    const driver = state.drivers.find((candidate) => candidate.teamId === state.selectedTeamId)!;
    state = applyNegotiatedDriverClause(state, driver.id, 'EqualTreatment');
    const beforeTrust = state.driverRelationships![driver.id].trustInPrincipal;
    state = { ...state, currentRaceIndex: 1, teamOrderHistory: [{ id: 'order-clause', raceId: state.calendar[0].id, order: 'SwapPositions', favoredDriverId: state.drivers.find((candidate) => candidate.teamId === state.selectedTeamId && candidate.id !== driver.id)?.id, disadvantagedDriverId: driver.id, lap: 20 }] };
    const breached = evaluateContractClauses(state);
    const clause = breached.phase18!.contractClauses.find((candidate) => candidate.partyId === driver.id && candidate.status === 'Breached')!;
    expect(clause).toBeDefined();
    expect(breached.driverRelationships![driver.id].trustInPrincipal).toBeLessThan(beforeTrust);
    expect(evaluateContractClauses(breached).driverRelationships![driver.id].trustInPrincipal).toBe(breached.driverRelationships![driver.id].trustInPrincipal);
    const correction = respondToContractBreach(breached, clause.id, 'PromiseCorrection');
    expect(correction.driverPromises?.at(-1)?.driverId).toBe(driver.id);
    expect(correction.driverPromises?.at(-1)?.status).toBe('active');
    expect(correction.phase18!.contractClauses.some((candidate) => candidate.linkedPromiseId === correction.driverPromises?.at(-1)?.id)).toBe(true);
    const budget = breached.teams.find((team) => team.id === breached.selectedTeamId)!.budget;
    const compensated = respondToContractBreach(breached, clause.id, 'Compensate');
    expect(compensated.phase18!.contractClauses.find((candidate) => candidate.id === clause.id)?.status).toBe('Waived');
    expect(compensated.teams.find((team) => team.id === compensated.selectedTeamId)!.budget).toBe(budget - clause.renegotiationCost!);
  });
});
