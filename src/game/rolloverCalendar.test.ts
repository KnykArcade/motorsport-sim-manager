import { describe, it, expect } from 'vitest';
import { createNewGame } from './initialCareer';
import { advanceSeason } from './seasonRollover';
import { getSeasonBundle } from '../data';

describe('season rollover calendar', () => {
  it('loads the next year schedule and points system when advancing', () => {
    let state = createNewGame({
      gameMode: 'Career',
      seasonYear: 1994,
      series: 'F1',
      teamId: 't-williams',
      seed: 'rollover-seed',
    });

    const cal1994 = state.calendar.map((r) => r.trackId);
    const next = getSeasonBundle(1995, 'F1')!.season;

    state = { ...state, seasonComplete: true };
    state = advanceSeason(state);

    expect(state.seasonYear).toBe(1995);
    expect(state.calendar.map((r) => r.trackId)).toEqual(next.calendar.map((r) => r.trackId));
    expect(state.calendar.every((r) => !r.completed)).toBe(true);
    expect(state.pointsSystemId).toBe(next.pointsSystemId);
    // The new schedule actually differs from the season we started in.
    expect(state.calendar.map((r) => r.trackId)).not.toEqual(cal1994);
  });

  it('keeps the current calendar when the next year has no data', () => {
    let state = createNewGame({
      gameMode: 'Career',
      seasonYear: 2000,
      series: 'F1',
      teamId: 't-ferrari',
      seed: 'rollover-seed-2000',
    });
    const before = state.calendar.map((r) => r.trackId);

    state = { ...state, seasonComplete: true };
    state = advanceSeason(state);

    expect(state.seasonYear).toBe(2001);
    expect(getSeasonBundle(2001, 'F1')).toBeUndefined();
    expect(state.calendar.map((r) => r.trackId)).toEqual(before);
  });
});
