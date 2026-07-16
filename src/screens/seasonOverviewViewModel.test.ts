import { describe, expect, it } from 'vitest';
import type { Race, StandingsEntry } from '../types/gameTypes';
import {
  CALENDAR_PAGE_SIZE,
  CURVE_PAGE_SIZE,
  STANDINGS_PAGE_SIZE,
  calendarEntriesForTab,
  compactPage,
  pageCount,
  standingsPage,
} from './seasonOverviewViewModel';

const race = (round: number, completed: boolean): Race => ({
  id: `race-${round}`,
  round,
  gpName: `Round ${round}`,
  trackId: `track-${round}`,
  trackName: `Track ${round}`,
  laps: 60,
  completed,
});

describe('compact season overview screens', () => {
  it('separates remaining schedule from completed results', () => {
    const calendar = [race(1, true), race(2, true), race(3, false), race(4, false)];
    expect(calendarEntriesForTab(calendar, 'schedule').map((entry) => entry.round)).toEqual([3, 4]);
    expect(calendarEntriesForTab(calendar, 'results').map((entry) => entry.round)).toEqual([1, 2]);
  });

  it('uses compact page sizes and clamps page boundaries', () => {
    expect(CALENDAR_PAGE_SIZE).toBe(6);
    expect(STANDINGS_PAGE_SIZE).toBe(10);
    expect(CURVE_PAGE_SIZE).toBe(3);
    expect(pageCount(24, STANDINGS_PAGE_SIZE)).toBe(3);
    expect(compactPage(Array.from({ length: 8 }, (_, index) => index + 1), 99, 3)).toEqual([7, 8]);
  });

  it('keeps championship positions stable across pages', () => {
    const entries: StandingsEntry[] = Array.from({ length: 24 }, (_, index) => ({
      entityId: `driver-${index + 1}`,
      points: 24 - index,
      wins: 0,
      podiums: 0,
      dnfs: 0,
    }));
    expect(standingsPage(entries, 1).map((entry) => entry.entityId)).toEqual(
      Array.from({ length: 10 }, (_, index) => `driver-${index + 11}`),
    );
  });
});
