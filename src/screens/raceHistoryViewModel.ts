import type { RaceEvent } from '../types/simTypes';

export type RaceHistoryTab = 'classification' | 'qualifying' | 'pace' | 'story';
export type RaceStoryFilter = 'all' | 'strategy';

export const RACE_HISTORY_TABS: ReadonlyArray<{ id: RaceHistoryTab; label: string }> = [
  { id: 'classification', label: 'Classification' },
  { id: 'qualifying', label: 'Qualifying' },
  { id: 'pace', label: 'Race Pace' },
  { id: 'story', label: 'Race Story' },
];

export const RACE_HISTORY_PAGE_SIZE = 10;
export const RACE_STORY_PAGE_SIZE = 8;

export function raceHistoryPageCount(total: number, pageSize = RACE_HISTORY_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function raceHistoryPage<T>(entries: T[], requestedPage: number, pageSize = RACE_HISTORY_PAGE_SIZE): T[] {
  const pageCount = raceHistoryPageCount(entries.length, pageSize);
  const page = Math.max(0, Math.min(pageCount - 1, requestedPage));
  return entries.slice(page * pageSize, (page + 1) * pageSize);
}

export function isStrategyRaceEvent(event: RaceEvent): boolean {
  if (event.category === 'strategy' || event.category === 'weather' || event.category === 'race-control') return true;
  return /(pit|box|stop|tyre|tire|compound|stint|strategy|safety car|rain|weather)/i.test(event.text);
}

export function raceStoryEvents(events: RaceEvent[], filter: RaceStoryFilter): RaceEvent[] {
  return filter === 'strategy' ? events.filter(isStrategyRaceEvent) : events;
}
