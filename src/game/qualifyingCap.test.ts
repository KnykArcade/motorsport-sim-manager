import { describe, it, expect } from 'vitest';
import { createNewGame } from './initialCareer';
import { gameReducer } from './gameReducer';
import { getMaxQualifiers } from '../data';
import { approvePreseasonTab, getCareerPhase } from './careerPhaseEngine';
import type { GameState } from './careerState';

function newGame(seasonYear: number, series: 'F1' | 'IndyCar', teamId: string) {
  return createNewGame({ gameMode: 'Career', seasonYear, series, teamId, seed: 'cap-seed' });
}

function advanceToRaceWeekend(state: GameState): GameState {
  let s = state;
  s = approvePreseasonTab(s, 'teamOverview');
  s = approvePreseasonTab(s, 'budget');
  s = approvePreseasonTab(s, 'driverLineup');
  s = approvePreseasonTab(s, 'carDevelopment');
  s = approvePreseasonTab(s, 'sponsorsEngine');
  s = approvePreseasonTab(s, 'seasonObjectives');
  s = approvePreseasonTab(s, 'roundOnePreview');
  s = gameReducer(s, { type: 'SELECT_RACE_WEEKEND_PACKAGE', packageType: 'Standard' })!;
  s = gameReducer(s, { type: 'COMPLETE_PRESEASON_SETUP' })!;
  s = gameReducer(s, { type: 'ADVANCE_TO_RACE_WEEKEND' })!;
  expect(getCareerPhase(s)).toBe('race_weekend');
  return s as GameState;
}

describe('qualifying cap (DNQ)', () => {
  it('caps F1 grids at 26 cars', () => {
    expect(getMaxQualifiers('F1')).toBe(26);
    expect(getMaxQualifiers('NASCAR')).toBe(43);
    expect(getMaxQualifiers('IndyCar')).toBe(28);
    expect(getMaxQualifiers('CART')).toBe(26);
    expect(getMaxQualifiers('Champ Car')).toBe(26);
    expect(getMaxQualifiers('Super Formula')).toBeUndefined();
  });

  it('flags the slowest cars as DNQ when F1 entries exceed the cap', () => {
    let state = advanceToRaceWeekend(newGame(1994, 'F1', 't-williams'));
    const raceId = state.calendar[state.currentRaceIndex].id;
    state = gameReducer(state, { type: 'RUN_QUALIFYING', decisions: [] })!;

    const results = state.qualifyingResults[raceId];
    expect(results.length).toBe(28); // 14 teams * 2 cars
    const dnq = results.filter((r) => r.dnq);
    expect(dnq.length).toBe(2); // 28 - 26

    // DNQ cars are exactly the slowest (positions 27..28).
    for (const r of dnq) expect(r.position).toBeGreaterThan(26);
    for (const r of results.filter((r) => !r.dnq)) expect(r.position).toBeLessThanOrEqual(26);
  });

  it('only lets the 26 qualified cars score race results', () => {
    let state = advanceToRaceWeekend(newGame(1994, 'F1', 't-williams'));
    const raceId = state.calendar[state.currentRaceIndex].id;
    state = gameReducer(state, { type: 'RUN_QUALIFYING', decisions: [] })!;
    const dnqIds = new Set(state.qualifyingResults[raceId].filter((r) => r.dnq).map((r) => r.driverId));

    state = gameReducer(state, { type: 'RUN_RACE', decisions: [] })!;
    const results = state.completedRaceResults[raceId];
    expect(results.length).toBe(26);
    for (const r of results) expect(dnqIds.has(r.driverId)).toBe(false);
  });

  it('does not flag DNQ when the field is within the cap (IndyCar)', () => {
    let state = advanceToRaceWeekend(newGame(2026, 'IndyCar', 't-team-penske'));
    const raceId = state.calendar[state.currentRaceIndex].id;
    state = gameReducer(state, { type: 'RUN_QUALIFYING', decisions: [] })!;
    const results = state.qualifyingResults[raceId];
    expect(results.length).toBeLessThanOrEqual(24);
    expect(results.some((r) => r.dnq)).toBe(false);
  });
});
