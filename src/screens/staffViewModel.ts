import type { StaffMember } from '../types/staffTypes';

export type StaffWorkspaceTab = 'roster' | 'contracts' | 'council' | 'market';

export const STAFF_WORKSPACE_TABS: Array<{ id: StaffWorkspaceTab; label: string }> = [
  { id: 'roster', label: 'Current Roster' },
  { id: 'contracts', label: 'Contracts' },
  { id: 'council', label: 'Advisor Council' },
  { id: 'market', label: 'Recruitment' },
];

export function staffTabFromQuery(value: string | null): StaffWorkspaceTab {
  return STAFF_WORKSPACE_TABS.some((tab) => tab.id === value)
    ? value as StaffWorkspaceTab
    : 'roster';
}

export const STAFF_PAGE_SIZE = 3;

export function staffPageCount(totalEntries: number): number {
  return Math.max(1, Math.ceil(totalEntries / STAFF_PAGE_SIZE));
}

export function staffPage<T>(entries: T[], page: number): T[] {
  const pageCount = staffPageCount(entries.length);
  const safePage = Math.max(0, Math.min(pageCount - 1, page));
  return entries.slice(safePage * STAFF_PAGE_SIZE, (safePage + 1) * STAFF_PAGE_SIZE);
}

export function staffVacancyCount(staff: StaffMember[]): number {
  const filledRoles = new Set(staff.map((member) => member.role));
  return Math.max(0, 4 - filledRoles.size);
}
