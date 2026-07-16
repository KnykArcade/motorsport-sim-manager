export type StaffWorkspaceTab = 'roster' | 'contracts' | 'council' | 'market';

export const STAFF_WORKSPACE_TABS: Array<{ id: StaffWorkspaceTab; label: string }> = [
  { id: 'roster', label: 'Current Roster' },
  { id: 'contracts', label: 'Contracts' },
  { id: 'council', label: 'Advisor Council' },
  { id: 'market', label: 'Recruitment' },
];

export const STAFF_PAGE_SIZE = 3;

export function staffPageCount(totalEntries: number): number {
  return Math.max(1, Math.ceil(totalEntries / STAFF_PAGE_SIZE));
}

export function staffPage<T>(entries: T[], page: number): T[] {
  const pageCount = staffPageCount(entries.length);
  const safePage = Math.max(0, Math.min(pageCount - 1, page));
  return entries.slice(safePage * STAFF_PAGE_SIZE, (safePage + 1) * STAFF_PAGE_SIZE);
}
