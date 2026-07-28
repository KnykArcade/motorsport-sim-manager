import { describe, expect, it } from 'vitest';
import {
  readNavigationHistory,
  updateNavigationHistory,
  writeNavigationHistory,
  type NavigationHistoryEntry,
} from './layoutHistory';

describe('navigation history menu', () => {
  it('keeps the most recent unique destinations first', () => {
    const first: NavigationHistoryEntry = { to: '/drivers', title: 'Drivers', visitedAt: 1 };
    const second: NavigationHistoryEntry = { to: '/teams', title: 'Teams', visitedAt: 2 };
    const revisited: NavigationHistoryEntry = { to: '/drivers?driver=d1', title: 'Driver', visitedAt: 3 };
    let entries = updateNavigationHistory([], first);
    entries = updateNavigationHistory(entries, second);
    entries = updateNavigationHistory(entries, revisited);
    expect(entries.map((entry) => entry.to)).toEqual([
      '/drivers?driver=d1',
      '/teams',
      '/drivers',
    ]);
  });

  it('round-trips valid entries and rejects malformed storage', () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
    };
    const entries = [{ to: '/inbox', title: 'Inbox', visitedAt: 10 }];
    writeNavigationHistory(storage, entries);
    expect(readNavigationHistory(storage)).toEqual(entries);
    memory.set('msm-navigation-history-v1', '{broken');
    expect(readNavigationHistory(storage)).toEqual([]);
  });
});
