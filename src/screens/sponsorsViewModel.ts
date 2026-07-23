import type { Sponsor, SponsorObjective } from '../types/sponsorTypes';

export type SponsorsWorkspaceTab = 'portfolio' | 'opportunities' | 'negotiations' | 'objectives' | 'owner';

export const SPONSORS_WORKSPACE_TABS: ReadonlyArray<{
  id: SponsorsWorkspaceTab;
  label: string;
}> = [
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'opportunities', label: 'Opportunities' },
  { id: 'negotiations', label: 'Negotiations' },
  { id: 'objectives', label: 'Objectives & Bonuses' },
  { id: 'owner', label: 'Boardroom' },
];

export const SPONSOR_PAGE_SIZE = 4;

export function sponsorPageCount(totalSponsors: number) {
  return Math.max(1, Math.ceil(totalSponsors / SPONSOR_PAGE_SIZE));
}

export function sponsorPage(sponsors: Sponsor[], requestedPage: number) {
  const pageCount = sponsorPageCount(sponsors.length);
  const page = Math.max(0, Math.min(requestedPage, pageCount - 1));
  const start = page * SPONSOR_PAGE_SIZE;
  return sponsors.slice(start, start + SPONSOR_PAGE_SIZE);
}

export function sponsorObjectiveSummary(sponsors: Sponsor[]) {
  const objectives = sponsors.flatMap((sponsor) => sponsor.objectives);
  return objectives.reduce(
    (summary, objective) => {
      const status = objective.status ?? 'Pending';
      summary[status] += 1;
      return summary;
    },
    { Pending: 0, Met: 0, Failed: 0 } as Record<NonNullable<SponsorObjective['status']>, number>,
  );
}
