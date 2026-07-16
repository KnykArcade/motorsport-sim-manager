export type YouthMarketTab = 'academy' | 'prospects';

export const YOUTH_MARKET_TABS: Array<{ id: YouthMarketTab; label: string }> = [
  { id: 'academy', label: 'Your Academy' },
  { id: 'prospects', label: 'Prospect Market' },
];

export const MARKET_PAGE_SIZE = 3;

export function marketPageCount(totalEntries: number): number {
  return Math.max(1, Math.ceil(totalEntries / MARKET_PAGE_SIZE));
}

export function marketPage<T>(entries: T[], page: number): T[] {
  const pageCount = marketPageCount(entries.length);
  const safePage = Math.max(0, Math.min(pageCount - 1, page));
  return entries.slice(safePage * MARKET_PAGE_SIZE, (safePage + 1) * MARKET_PAGE_SIZE);
}
