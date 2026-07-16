export type TeamDetailTab = 'overview' | 'identity' | 'ratings' | 'lineup' | 'moves';

export const TEAM_DETAIL_TABS: Array<{ id: TeamDetailTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'identity', label: 'Identity & Strategy' },
  { id: 'ratings', label: 'Ratings' },
  { id: 'lineup', label: 'Lineup & Academy' },
  { id: 'moves', label: 'Recent Moves' },
];

export const TEAM_OVERVIEW_PAGE_SIZE = 8;

export function teamOverviewPageCount(totalRows: number): number {
  return Math.max(1, Math.ceil(totalRows / TEAM_OVERVIEW_PAGE_SIZE));
}

export function teamOverviewPage<T>(rows: T[], page: number): T[] {
  const pageCount = teamOverviewPageCount(rows.length);
  const safePage = Math.max(0, Math.min(pageCount - 1, page));
  return rows.slice(safePage * TEAM_OVERVIEW_PAGE_SIZE, (safePage + 1) * TEAM_OVERVIEW_PAGE_SIZE);
}
