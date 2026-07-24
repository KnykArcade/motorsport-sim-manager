import { describe, expect, it } from 'vitest';
import '../testDataSetup';
import { createNewGame } from '../game/initialCareer';
import { staffRecommendations } from './staffRecommendationsViewModel';

describe('staffRecommendationsViewModel', () => {
  it('returns no personnel recommendations until the player delegates the desk', () => {
    const state = createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'staff-c-recommendations' });
    expect(staffRecommendations(state)).toEqual([]);
  });

  it('does not create recruitment recommendations for permanent departments', () => {
    const state = createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'staff-c-candidates' });
    expect(staffRecommendations({
      ...state,
      staff: [],
      staffResponsibilityPolicies: { 'staff-recruitment': 'staff_advisory' },
    })).toEqual([]);
  });

  it('does not create contract recommendations for permanent departments', () => {
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
    expect(staffRecommendations({
      ...state,
      staff: [staff],
      staffResponsibilityPolicies: { 'staff-contracts': 'staff_advisory' },
    })).toEqual([]);
  });
});
