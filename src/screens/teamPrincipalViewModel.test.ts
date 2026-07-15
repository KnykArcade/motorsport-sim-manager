import { describe, expect, it } from 'vitest';
import type { JobOffer } from '../types/principalTypes';
import { PRINCIPAL_COMMAND_TABS, PRINCIPAL_OFFERS_PER_PAGE, principalJobOfferPage } from './teamPrincipalViewModel';

function offer(index: number): JobOffer {
  return {
    id: `offer-${index}`,
    teamId: `team-${index}`,
    seasonYear: 1995,
    contractYears: 2,
    objective: 'Compete for points',
    prestige: 50,
    budgetTier: 'Midfield',
    kind: 'Offer',
    expiresSeasonYear: 1996,
  };
}

describe('Team Principal command center model', () => {
  it('keeps each management area in its own named tab', () => {
    expect(PRINCIPAL_COMMAND_TABS.map((tab) => tab.id)).toEqual(['standing', 'identity', 'culture', 'departments', 'career']);
    expect(new Set(PRINCIPAL_COMMAND_TABS.map((tab) => tab.label)).size).toBe(PRINCIPAL_COMMAND_TABS.length);
  });

  it('limits the career tab to three offers and clamps page boundaries', () => {
    const offers = Array.from({ length: 8 }, (_, index) => offer(index));
    expect(PRINCIPAL_OFFERS_PER_PAGE).toBe(3);
    expect(principalJobOfferPage(offers, 0).map((entry) => entry.id)).toEqual(['offer-0', 'offer-1', 'offer-2']);
    expect(principalJobOfferPage(offers, 1).map((entry) => entry.id)).toEqual(['offer-3', 'offer-4', 'offer-5']);
    expect(principalJobOfferPage(offers, 99).map((entry) => entry.id)).toEqual(['offer-6', 'offer-7']);
    expect(principalJobOfferPage(offers, -1).map((entry) => entry.id)).toEqual(['offer-0', 'offer-1', 'offer-2']);
  });
});
