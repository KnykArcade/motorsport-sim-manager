export type DevelopmentTab = 'active' | 'results' | 'catalog';

export const DEVELOPMENT_PAGE_SIZES = {
  active: 3,
  results: 3,
  catalog: 2,
} as const;

export function developmentTabs() {
  const tabs: Array<{ id: DevelopmentTab; label: string }> = [
    { id: 'active', label: 'Active' },
    { id: 'results', label: 'Results' },
    { id: 'catalog', label: 'Project Catalog' },
  ];
  return tabs;
}

export function developmentPageCount(totalEntries: number, pageSize: number): number {
  return Math.max(1, Math.ceil(totalEntries / pageSize));
}

export function developmentPage<T>(entries: T[], page: number, pageSize: number): T[] {
  const pageCount = developmentPageCount(entries.length, pageSize);
  const safePage = Math.max(0, Math.min(pageCount - 1, page));
  return entries.slice(safePage * pageSize, (safePage + 1) * pageSize);
}
