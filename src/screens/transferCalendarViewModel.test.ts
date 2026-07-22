import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import { transferCalendarView } from './transferCalendarViewModel';

describe('transfer calendar view model', () => {
  it('null-guards old saves and derives expiring contracts from state', () => {
    const base = createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'calendar-view' });
    const state = { ...base, drivers: base.drivers.map((driver, index) => ({ ...driver, contractYearsRemaining: index === 0 ? 1 : 3 })) };
    expect(transferCalendarView(state).expiringDrivers).toHaveLength(1);
    expect(transferCalendarView(state).rivalOffers).toEqual([]);
  });
});
