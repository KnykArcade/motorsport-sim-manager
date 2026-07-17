import { describe, expect, it } from 'vitest';
import {
  EVENT_PAGE_SIZE,
  PRE_RACE_BRIEFING_TABS,
  RACE_RESULTS_TABS,
  RESULT_PAGE_SIZE,
  SEASON_REVIEW_TABS,
  canOpenRaceWeekendPhase,
  visibleRaceWeekendPhases,
  transitionPage,
  transitionPageCount,
} from './raceTransitionViewModel';

describe('race transition view model', () => {
  it('exposes bounded tab groups for each transition screen', () => {
    expect(PRE_RACE_BRIEFING_TABS.map((tab) => tab.id)).toEqual(['overview', 'preparation', 'team', 'paddock']);
    expect(RACE_RESULTS_TABS.map((tab) => tab.id)).toEqual(['summary', 'classification', 'story', 'championships']);
    expect(SEASON_REVIEW_TABS.map((tab) => tab.id)).toEqual(['honours', 'drivers', 'constructors', 'next']);
  });

  it('uses compact result and event pages', () => {
    expect(RESULT_PAGE_SIZE).toBe(10);
    expect(EVENT_PAGE_SIZE).toBe(8);
    expect(transitionPageCount(24, RESULT_PAGE_SIZE)).toBe(3);
    expect(transitionPageCount(0, RESULT_PAGE_SIZE)).toBe(1);
  });

  it('keeps race-weekend tabs behind the reached workflow stage', () => {
    expect(canOpenRaceWeekendPhase('practice', 'practice', false)).toBe(true);
    expect(canOpenRaceWeekendPhase('setup', 'practice', false)).toBe(false);
    expect(canOpenRaceWeekendPhase('race-strategy', 'quali-review', false)).toBe(false);
    expect(canOpenRaceWeekendPhase('briefing', 'quali-review', false)).toBe(true);
  });

  it('removes practice and setup only for the minimum operations package', () => {
    expect(visibleRaceWeekendPhases(true).map((phase) => phase.id)).toEqual([
      'hub',
      'briefing',
      'quali-run',
      'quali-review',
      'race-strategy',
      'race-instructions',
    ]);
    expect(canOpenRaceWeekendPhase('practice', 'briefing', true)).toBe(false);
  });

  it('clamps requested pages without changing source order', () => {
    const entries = Array.from({ length: 23 }, (_, index) => index + 1);
    expect(transitionPage(entries, 1)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(transitionPage(entries, 99)).toEqual([21, 22, 23]);
    expect(transitionPage(entries, -3, EVENT_PAGE_SIZE)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
