import { describe, expect, it } from 'vitest';
import type { RaceEvent } from '../types/simTypes';
import {
  RACE_HISTORY_PAGE_SIZE,
  RACE_HISTORY_TABS,
  RACE_STORY_PAGE_SIZE,
  isStrategyRaceEvent,
  raceHistoryPage,
  raceHistoryPageCount,
  raceStoryEvents,
} from './raceHistoryViewModel';

describe('race history view model', () => {
  it('separates classification, qualifying, pace, and story', () => {
    expect(RACE_HISTORY_TABS.map((tab) => tab.id)).toEqual([
      'classification', 'qualifying', 'pace', 'story',
    ]);
  });

  it('keeps archive tables and story logs on bounded pages', () => {
    const entries = Array.from({ length: 24 }, (_, index) => index + 1);
    expect(RACE_HISTORY_PAGE_SIZE).toBe(10);
    expect(RACE_STORY_PAGE_SIZE).toBe(8);
    expect(raceHistoryPageCount(entries.length)).toBe(3);
    expect(raceHistoryPage(entries, 1)).toEqual(Array.from({ length: 10 }, (_, index) => index + 11));
    expect(raceHistoryPage(entries, 99)).toEqual([21, 22, 23, 24]);
  });

  it('recognizes categorized and legacy strategy events', () => {
    const events: RaceEvent[] = [
      { lap: 4, text: 'Driver makes a pass', category: 'battle' },
      { lap: 12, text: 'Boxes for fresh tyres' },
      { lap: 18, text: 'Safety car deployed', category: 'race-control' },
      { lap: 22, text: 'Heavy rain arrives', category: 'weather' },
    ];
    expect(isStrategyRaceEvent(events[0])).toBe(false);
    expect(raceStoryEvents(events, 'strategy')).toEqual(events.slice(1));
    expect(raceStoryEvents(events, 'all')).toEqual(events);
  });
});
