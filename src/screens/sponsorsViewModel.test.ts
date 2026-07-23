import { describe, expect, it } from 'vitest';
import type { Sponsor } from '../types/sponsorTypes';
import {
  SPONSOR_PAGE_SIZE,
  SPONSORS_WORKSPACE_TABS,
  sponsorObjectiveSummary,
  sponsorPage,
  sponsorPageCount,
  sortSponsorNegotiations,
  sortSponsorOffers,
} from './sponsorsViewModel';
import type { SponsorNegotiation } from '../types/sponsorTypes';

function sponsor(id: string, statuses: Array<'Pending' | 'Met' | 'Failed'> = []): Sponsor {
  return {
    id,
    name: id,
    type: 'Secondary',
    annualValue: 1,
    bonusTerms: [],
    objectives: statuses.map((status, index) => ({
      id: `${id}-${index}`,
      description: status,
      category: 'Performance',
      status,
    })),
    confidence: 50,
    contractYearsRemaining: 1,
    renewalChance: 0.5,
  };
}

describe('sponsorsViewModel', () => {
  it('defines the sponsor workspaces including negotiated contracts', () => {
    expect(SPONSORS_WORKSPACE_TABS.map((tab) => tab.id)).toEqual([
      'portfolio',
      'opportunities',
      'negotiations',
      'objectives',
      'public',
      'owner',
    ]);
  });

  it('limits sponsor pages to four cards and clamps invalid pages', () => {
    const sponsors = Array.from({ length: 9 }, (_, index) => sponsor(`s-${index}`));
    expect(SPONSOR_PAGE_SIZE).toBe(4);
    expect(sponsorPageCount(sponsors.length)).toBe(3);
    expect(sponsorPage(sponsors, 1).map((item) => item.id)).toEqual(['s-4', 's-5', 's-6', 's-7']);
    expect(sponsorPage(sponsors, 99).map((item) => item.id)).toEqual(['s-8']);
    expect(sponsorPage(sponsors, -1).map((item) => item.id)).toEqual(['s-0', 's-1', 's-2', 's-3']);
  });

  it('summarizes pending, met, and failed objectives', () => {
    expect(sponsorObjectiveSummary([
      sponsor('a', ['Pending', 'Met']),
      sponsor('b', ['Failed', 'Pending']),
    ])).toEqual({ Pending: 2, Met: 1, Failed: 1 });
  });

  it('sorts sponsor opportunities and negotiations by decision-relevant values', () => {
    const offers = [
      { ...sponsor('a'), annualValue: 2, confidence: 60 },
      { ...sponsor('b'), annualValue: 5, confidence: 40 },
    ];
    expect(sortSponsorOffers(offers, { key: 'annualValue', direction: 'desc' }).map((item) => item.id)).toEqual(['b', 'a']);
    const negotiation = (id: string, patience: number, value: number): SponsorNegotiation => ({
      id,
      sponsorId: id,
      sponsorName: id,
      kind: 'New',
      status: 'Draft',
      openedRound: 1,
      deadlineRound: 4,
      patience,
      attempts: 1,
      proposedTerms: { annualValue: value, contractYears: 2, bonusMultiplier: 1, objectiveLevel: 'Standard' },
    });
    expect(sortSponsorNegotiations([negotiation('a', 40, 2), negotiation('b', 80, 5)], { key: 'patience', direction: 'desc' }).map((item) => item.id)).toEqual(['b', 'a']);
    expect(sortSponsorNegotiations([negotiation('a', 40, 2), negotiation('b', 80, 5)], { key: 'annualValue', direction: 'desc' }).map((item) => item.id)).toEqual(['b', 'a']);
  });
});
