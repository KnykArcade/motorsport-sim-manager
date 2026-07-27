import { describe, expect, it } from 'vitest';
import '../testDataSetup';
import { createNewGame } from '../game/initialCareer';
import type { JobOffer } from '../types/principalTypes';
import {
  PRINCIPAL_COMMAND_TABS,
  PRINCIPAL_OFFERS_PER_PAGE,
  principalCareerTimeline,
  principalCommitmentRows,
  principalJobOfferPage,
  principalRelationshipRows,
  principalTabFromQuery,
  selectedPrincipalJobOffer,
} from './teamPrincipalViewModel';

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
  const state = createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'principal-profile-model' });

  it('keeps each management area in its own named tab', () => {
    expect(PRINCIPAL_COMMAND_TABS.map((tab) => tab.id)).toEqual(['standing', 'relationships', 'identity', 'culture', 'departments', 'career']);
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

  it('keeps a selected offer visible and falls back to the first current offer', () => {
    const offers = [offer(1), offer(2)];
    expect(selectedPrincipalJobOffer(offers, 'offer-2')).toBe(offers[1]);
    expect(selectedPrincipalJobOffer(offers, 'missing')).toBe(offers[0]);
    expect(selectedPrincipalJobOffer([], 'missing')).toBeUndefined();
  });

  it('resolves every principal profile section from a query', () => {
    expect(principalTabFromQuery('relationships')).toBe('relationships');
    expect(principalTabFromQuery('career')).toBe('career');
    expect(principalTabFromQuery('missing')).toBe('standing');
  });

  it('consolidates driver trust and active commitments without changing them', () => {
    const driver = state.drivers.find((candidate) => candidate.teamId === state.selectedTeamId)!;
    const withCommitments = {
      ...state,
      driverRelationships: {
        ...state.driverRelationships,
        [driver.id]: {
          ...state.driverRelationships![driver.id],
          trustInPrincipal: 32,
          frustration: 76,
        },
      },
      driverPromises: [{
        id: 'profile-promise',
        driverId: driver.id,
        promiseType: 'equal_treatment' as const,
        madeRound: 1,
        madeSeason: 1995,
        dueRound: 4,
        dueSeason: 1995,
        status: 'active' as const,
        trustImpact: 6,
        moraleImpact: 4,
      }],
      media: {
        sessions: [],
        declinedDuties: 0,
        publicPromises: [{
          id: 'public-profile-promise',
          type: 'Results' as const,
          statement: 'We will score points.',
          seasonYear: 1995,
          createdRound: 1,
          deadlineRound: 5,
          status: 'Active' as const,
          sourceSessionId: 'session',
          sourceQuestionId: 'question',
        }],
      },
    };
    expect(principalRelationshipRows(withCommitments)[0]).toMatchObject({
      driverId: driver.id,
      trust: 32,
      frustration: 76,
      activePromises: 1,
    });
    expect(principalCommitmentRows(withCommitments).map((commitment) => commitment.scope)).toEqual(['Driver', 'Public']);
  });

  it('provides a current-tenure timeline fallback for old saves', () => {
    const timeline = principalCareerTimeline({ ...state, personnelCareerHistory: undefined });
    expect(timeline).toHaveLength(1);
    expect(timeline[0]).toMatchObject({ current: true, role: 'Team Principal' });
  });
});
