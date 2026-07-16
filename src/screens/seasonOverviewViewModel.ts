import type { Race, StandingsEntry } from '../types/gameTypes';

export type CalendarTab = 'schedule' | 'results';
export type StandingsTab = 'drivers' | 'constructors';

export const CALENDAR_PAGE_SIZE = 6;
export const STANDINGS_PAGE_SIZE = 10;
export const CURVE_PAGE_SIZE = 3;

export function calendarEntriesForTab(calendar: Race[], tab: CalendarTab): Race[] {
  return calendar.filter((race) => tab === 'results' ? race.completed : !race.completed);
}

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function compactPage<T>(entries: T[], requestedPage: number, pageSize: number): T[] {
  const safePage = Math.max(0, Math.min(pageCount(entries.length, pageSize) - 1, requestedPage));
  return entries.slice(safePage * pageSize, (safePage + 1) * pageSize);
}

export function standingsPage(entries: StandingsEntry[], requestedPage: number) {
  return compactPage(entries, requestedPage, STANDINGS_PAGE_SIZE);
}
