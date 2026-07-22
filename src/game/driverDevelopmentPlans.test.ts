import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from './initialCareer';
import { gameReducer } from './gameReducer';

describe('driver development reducer actions', () => {
  it('routes plan, testing, and mentor choices through persisted state', () => {
    let state = createNewGame({ gameMode: 'Career', seasonYear: 1994, series: 'F1', teamId: 't-williams', seed: 'development-actions' });
    const drivers = state.drivers.filter((driver) => driver.teamId === state.selectedTeamId);
    state = gameReducer(state, { type: 'SET_DRIVER_DEVELOPMENT_FOCUS', driverId: drivers[0].id, focus: 'Consistency' })!;
    state = gameReducer(state, { type: 'SET_DRIVER_TESTING_ALLOCATION', driverId: drivers[0].id, allocation: 30 })!;
    expect(state.driverDevelopmentPlans?.[drivers[0].id].focus).toBe('Consistency');
    expect(state.driverDevelopmentPlans?.[drivers[0].id].testingAllocation).toBe(30);
  });

  it('blocks plan mutations in Single Season mode', () => {
    const state = createNewGame({ gameMode: 'SingleSeason', seasonYear: 1994, series: 'F1', teamId: 't-williams', seed: 'development-single' });
    const driver = state.drivers.find((entry) => entry.teamId === state.selectedTeamId)!;
    const next = gameReducer(state, { type: 'SET_DRIVER_DEVELOPMENT_FOCUS', driverId: driver.id, focus: 'Racecraft' });
    expect(next).toBe(state);
  });
});
