import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { getStaffPool } from '../data';
import { activeDriversForTeam, type GameState } from '../game/careerState';
import { gameReducer } from '../game/gameReducer';
import { createNewGame } from '../game/initialCareer';
import { resolveCharacterRequest } from './characterRequestEngine';
import { generateCharacterMarketApproachEvents } from './characterMarketApproachEngine';

function freshState(): GameState {
  return createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'market-approach-test' });
}

function atRisk(
  state: GameState,
  type: 'Driver' | 'Staff',
  id: string,
  status: 'TestingMarket' | 'WantsExit' = 'TestingMarket',
  trust = 70,
): GameState {
  const key = `${type}:${id}`;
  return {
    ...state,
    currentRaceIndex: state.calendar.length - 2,
    drivers: state.drivers.map((driver) => driver.id === id ? { ...driver, contractYearsRemaining: 1 } : driver),
    staff: (state.staff ?? []).map((member) => member.id === id ? { ...member, contractYearsRemaining: 1 } : member),
    characterInteractions: {
      ...state.characterInteractions!,
      opinions: {
        ...state.characterInteractions!.opinions,
        [key]: { ...state.characterInteractions!.opinions[key], score: trust - 50, trust, respect: trust },
      },
      futureIntentions: state.characterInteractions!.futureIntentions.map((entry) => {
        if (entry.target.type === type && entry.target.id === id) {
          return { ...entry, status, leverage: status === 'WantsExit' ? 90 : 55, negotiationModifier: status === 'WantsExit' ? -22 : -10 };
        }
        if (entry.target.type === 'Driver' || entry.target.type === 'Staff') {
          return { ...entry, status: 'Committed' as const, leverage: 20, negotiationModifier: 8 };
        }
        return entry;
      }),
    },
  };
}

function driverTarget(state: GameState) {
  return activeDriversForTeam(state, state.selectedTeamId)[0];
}

function resolve(state: GameState, optionId: string): GameState {
  const event = generateCharacterMarketApproachEvents(state)[0];
  return resolveCharacterRequest(state, event, optionId);
}

describe('character market approaches', () => {
  it('creates one deterministic late-season rival approach for an expiring at-risk driver', () => {
    const base = freshState();
    const driver = driverTarget(base);
    const state = atRisk(base, 'Driver', driver.id);
    const [event] = generateCharacterMarketApproachEvents(state);
    expect(event.title).toContain(driver.name);
    expect(event.characterRequest?.requestKind).toBe('DriverMarketApproach');
    expect(event.characterRequest?.rivalTeamId).not.toBe(state.selectedTeamId);
    expect(event.characterRequest?.counterofferCost).toBeGreaterThan(0);
    expect(event.isRequiredDecision).toBe(true);
    expect(generateCharacterMarketApproachEvents({ ...state, currentRaceIndex: 0 })).toHaveLength(0);
    expect(generateCharacterMarketApproachEvents({ ...state, gameMode: 'SingleSeason' })).toHaveLength(0);
  });

  it('retains a receptive driver with a funded two-year counteroffer and records the decision', () => {
    const base = freshState();
    const driver = driverTarget(base);
    const willing = atRisk(base, 'Driver', driver.id, 'TestingMarket', 85);
    const state = {
      ...willing,
      teams: willing.teams.map((team) => team.id === willing.selectedTeamId ? { ...team, budget: 100_000_000 } : team),
    };
    const beforeBudget = state.teams.find((team) => team.id === state.selectedTeamId)!.budget;
    const retained = resolve(state, 'match-rival-package');
    expect(retained.drivers.find((entry) => entry.id === driver.id)?.contractYearsRemaining).toBe(3);
    expect(retained.teams.find((team) => team.id === state.selectedTeamId)!.budget).toBeLessThan(beforeBudget);
    expect(retained.characterInteractions!.requestHistory.at(-1)?.requestKind).toBe('DriverMarketApproach');
    expect(retained.news[0].headline).toContain('aggressive counteroffer');
  });

  it('allows a hostile driver to reject even an aggressive package without charging the team', () => {
    const base = freshState();
    const driver = driverTarget(base);
    const hostile = atRisk(base, 'Driver', driver.id, 'WantsExit', 20);
    const state = {
      ...hostile,
      teams: hostile.teams.map((team) => team.id === hostile.selectedTeamId ? { ...team, budget: 100_000_000 } : team),
    };
    const beforeBudget = state.teams.find((team) => team.id === state.selectedTeamId)!.budget;
    const rejected = resolve(state, 'match-rival-package');
    expect(rejected.drivers.find((entry) => entry.id === driver.id)?.contractYearsRemaining).toBe(1);
    expect(rejected.teams.find((team) => team.id === state.selectedTeamId)!.budget).toBe(beforeBudget);
    expect(rejected.news[0].body).toContain('rejected');
    expect(rejected.characterInteractions!.personnelMoves.at(-1)).toMatchObject({
      targetType: 'Driver',
      targetId: driver.id,
      effectiveSeason: state.seasonYear + 1,
      status: 'Pending',
    });
  });

  it('rewards a strong personal relationship with a one-year bridge agreement', () => {
    const base = freshState();
    const driver = driverTarget(base);
    const retained = resolve(atRisk(base, 'Driver', driver.id, 'TestingMarket', 95), 'make-personal-pitch');
    expect(retained.drivers.find((entry) => entry.id === driver.id)?.contractYearsRemaining).toBe(2);
    expect(retained.characterInteractions!.requestHistory.at(-1)?.effects).toContain('One-year bridge agreement');
  });

  it('records an orderly departure plan without extending the contract', () => {
    const base = freshState();
    const driver = driverTarget(base);
    const released = resolve(atRisk(base, 'Driver', driver.id), 'accept-departure-plan');
    expect(released.drivers.find((entry) => entry.id === driver.id)?.contractYearsRemaining).toBe(1);
    expect(released.characterInteractions!.futureIntentions.find((entry) => entry.target.id === driver.id)?.status).toBe('WantsExit');
    expect(released.characterInteractions!.personnelMoves.at(-1)).toMatchObject({
      targetId: driver.id,
      destinationTeamId: expect.not.stringMatching(base.selectedTeamId),
      status: 'Pending',
    });
    expect(generateCharacterMarketApproachEvents(released)).toHaveLength(0);
  });

  it('uses the same approach and retention lifecycle for staff contracts', () => {
    const base = freshState();
    const candidate = getStaffPool(base.seasonYear, base.series)[0];
    const hired = gameReducer(base, { type: 'HIRE_STAFF', staffId: candidate.id })!;
    const willing = atRisk(hired, 'Staff', candidate.id, 'TestingMarket', 85);
    const state = {
      ...willing,
      teams: willing.teams.map((team) => team.id === willing.selectedTeamId ? { ...team, budget: 100_000_000 } : team),
    };
    const event = generateCharacterMarketApproachEvents(state)[0];
    expect(event.characterRequest?.requestKind).toBe('StaffMarketApproach');
    const retained = resolveCharacterRequest(state, event, 'match-rival-package');
    expect(retained.staff?.find((member) => member.id === candidate.id)?.contractYearsRemaining).toBe(3);
  });

  it('resolves through the real Paddock Week reducer and clears the required decision', () => {
    const base = freshState();
    const driver = driverTarget(base);
    const atRiskState = atRisk(base, 'Driver', driver.id, 'TestingMarket', 90);
    const funded = {
      ...atRiskState,
      teams: atRiskState.teams.map((team) => team.id === atRiskState.selectedTeamId ? { ...team, budget: 100_000_000 } : team),
    };
    const event = generateCharacterMarketApproachEvents(funded)[0];
    const state: GameState = {
      ...funded,
      careerPhase: {
        ...funded.careerPhase!,
        currentPhase: 'paddock_week',
        paddockEvents: [event],
        requiredDecisionsComplete: false,
      },
    };
    const resolved = gameReducer(state, { type: 'RESOLVE_PADDOCK_EVENT', eventId: event.id, optionId: 'match-rival-package' })!;
    expect(resolved.careerPhase?.paddockEvents[0].resolvedOptionId).toBe('match-rival-package');
    expect(resolved.careerPhase?.requiredDecisionsComplete).toBe(true);
    expect(resolved.characterInteractions!.requestHistory.at(-1)?.eventId).toBe(event.id);
  });
});
