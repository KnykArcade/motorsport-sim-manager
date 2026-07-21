import { describe, expect, it } from 'vitest';
import '../testDataSetup';
import { createNewGame } from '../game/initialCareer';
import { staffRecommendations } from './staffRecommendationsViewModel';

describe('staffRecommendationsViewModel', () => {
  it('returns no personnel recommendations until the player delegates the desk', () => {
    const state = createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'staff-c-recommendations' });
    expect(staffRecommendations(state)).toEqual([]);
  });

  it('recommends exact vacancy candidates with confidence and player boundary', () => {
    const state = createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'staff-c-candidates' });
    const recommendations = staffRecommendations({
      ...state,
      staff: [],
      staffResponsibilityPolicies: { 'staff-recruitment': 'staff_advisory' },
    });
    const recommendation = recommendations.find((item) => item.kind === 'recruitment');
    expect(recommendation).toMatchObject({
      responsibility: 'staff-recruitment',
      owner: 'People operations desk',
      route: expect.stringMatching(/^\/staff\?tab=market&role=.*&staffId=/),
      routeLabel: 'Review Candidate',
    });
    expect(['Low', 'Normal', 'High']).toContain(recommendation?.confidence);
    expect(recommendation?.consequence).toContain('remain your decision');
  });

  it('prioritizes expiring staff renewals without creating an offer', () => {
    const state = createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'staff-c-contracts' });
    const staff = {
      id: 'staff-contract-test',
      name: 'Contract Test',
      role: 'Race Engineer' as const,
      nationality: 'GBR',
      rating: 82,
      salary: 1,
      signingFee: 1,
      contractYearsRemaining: 1,
      bio: 'Test staff member',
    };
    const recommendations = staffRecommendations({
      ...state,
      staff: [staff],
      staffResponsibilityPolicies: { 'staff-contracts': 'staff_advisory' },
    });
    expect(recommendations[0]).toMatchObject({
      kind: 'contract',
      route: `/staff?tab=contracts&staffId=${staff?.id}`,
      routeLabel: 'Review Contract',
    });
    expect(recommendations[0]?.recommendation).toContain('renewal review');
  });
});
