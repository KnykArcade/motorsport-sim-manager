import { describe, it, expect } from 'vitest';
import { createNewGame } from './initialCareer';
import { gameReducer } from './gameReducer';
import { getMaxQualifiers } from '../data';
import { getOrCreatePhaseState, togglePreseasonChecklistItem } from './careerPhaseEngine';
import type { GameState } from './careerState';

function newGame(seasonYear: number, series: 'F1' | 'IndyCar', teamId: string) {
  return createNewGame({ gameMode: 'Career', seasonYear, series, teamId, seed: 'cap-seed' });
}

function advanceToRaceWeekend(state: GameState): GameState {
  const phaseState = getOrCreatePhaseState(state);
  let s = state;
  for (const item of phaseState.preseasonChecklist ?? []) {
    if (!item.completed) s = togglePreseasonChecklistItem(s, item.id);
  }
  s = gameReducer(s, { type: 'COMPLETE_PRESEASON_SETUP' })!;
  s = gameReducer(s, { type: 'ADVANCE_TO_RACE_WEEKEND' })!;
  return s as GameState;
}

describe('qualifying cap (DNQ)', () => {
  it('caps F1 grids at 24 cars', () => {
    expect(getMaxQualifiers('F1')).toBe(24);
    expect(getMaxQualifiers('IndyCar')).toBeUndefined();
  });

  it('flags the slowest cars as DNQ when F1 entries exceed the cap', () => {
    let state = advanceToRaceWeekend(newGame(1994, 'F1', 't-williams'));
    const raceId = state.calendar[state.currentRaceIndex].id;
    state = gameReducer(state, { type: 'RUN_QUALIFYING', decisions: [] })!;

    const results = state.qualifyingResults[raceId];
    expect(results.length).toBe(28); // 14 teams * 2 cars
    const dnq = results.filter((r) => r.dnq);
    expect(dnq.length).toBe(4); // 28 - 24

    // DNQ cars are exactly the slowest (positions 25..28).
    for (const r of dnq) expect(r.position).toBeGreaterThan(24);
    for (const r of results.filter((r) => !r.dnq)) expect(r.position).toBeLessThanOrEqual(24);
  });

  it('only lets the 24 qualified cars score race results', () => {
    let state = advanceToRaceWeekend(newGame(1994, 'F1', 't-williams'));
    const raceId = state.calendar[state.currentRaceIndex].id;
    state = gameReducer(state, { type: 'RUN_QUALIFYING', decisions: [] })!;
    const dnqIds = new Set(state.qualifyingResults[raceId].filter((r) => r.dnq).map((r) => r.driverId));

    state = gameReducer(state, { type: 'RUN_RACE', decisions: [] })!;
    const results = state.completedRaceResults[raceId];
    expect(results.length).toBe(24);
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
