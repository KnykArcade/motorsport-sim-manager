import type { Sponsor, SponsorNegotiation, SponsorObjective } from '../types/sponsorTypes';

export type SponsorsWorkspaceTab = 'portfolio' | 'opportunities' | 'negotiations' | 'objectives' | 'public' | 'owner';

export const SPONSORS_WORKSPACE_TABS: ReadonlyArray<{
  id: SponsorsWorkspaceTab;
  label: string;
}> = [
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'opportunities', label: 'Opportunities' },
  { id: 'negotiations', label: 'Negotiations' },
  { id: 'objectives', label: 'Objectives & Bonuses' },
  { id: 'public', label: 'Fans & Reputation' },
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

export type SponsorOfferSortKey = 'name' | 'type' | 'annualValue' | 'confidence' | 'contractYears';
export type SponsorNegotiationSortKey = 'sponsorName' | 'status' | 'deadlineRound' | 'patience' | 'attempts' | 'annualValue';

export type SponsorSort<Key extends string> = {
  key: Key;
  direction: 'asc' | 'desc';
};

export function sortSponsorOffers(offers: readonly Sponsor[], sort: SponsorSort<SponsorOfferSortKey>): Sponsor[] {
  const direction = sort.direction === 'asc' ? 1 : -1;
  return [...offers].sort((left, right) => {
    const leftValue = sponsorOfferSortValue(left, sort.key);
    const rightValue = sponsorOfferSortValue(right, sort.key);
    if (leftValue < rightValue) return -1 * direction;
    if (leftValue > rightValue) return direction;
    return left.name.localeCompare(right.name);
  });
}

export function sortSponsorNegotiations(
  negotiations: readonly SponsorNegotiation[],
  sort: SponsorSort<SponsorNegotiationSortKey>,
): SponsorNegotiation[] {
  const direction = sort.direction === 'asc' ? 1 : -1;
  return [...negotiations].sort((left, right) => {
    const leftValue = sponsorNegotiationSortValue(left, sort.key);
    const rightValue = sponsorNegotiationSortValue(right, sort.key);
    if (leftValue < rightValue) return -1 * direction;
    if (leftValue > rightValue) return direction;
    return left.sponsorName.localeCompare(right.sponsorName);
  });
}

function sponsorOfferSortValue(sponsor: Sponsor, key: SponsorOfferSortKey): number | string {
  if (key === 'name') return sponsor.name;
  if (key === 'type') return sponsor.type;
  if (key === 'contractYears') return sponsor.contractYearsRemaining;
  return sponsor[key];
}

function sponsorNegotiationSortValue(negotiation: SponsorNegotiation, key: SponsorNegotiationSortKey): number | string {
  if (key === 'sponsorName') return negotiation.sponsorName;
  if (key === 'status') return negotiation.status;
  if (key === 'annualValue') return negotiation.counterTerms?.annualValue ?? negotiation.proposedTerms.annualValue;
  return negotiation[key];
}
