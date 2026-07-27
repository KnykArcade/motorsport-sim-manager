import { describe, expect, it } from 'vitest';
import '../testDataSetup';
import { createNewGame } from '../game/initialCareer';
import { STAFF_ROLES } from '../types/staffTypes';
import { staffRecommendations } from './staffRecommendationsViewModel';

describe('staffRecommendationsViewModel', () => {
  it('uses real permanent-department ratings instead of fictional recruitment advice', () => {
    const state = createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'staff-c-recommendations' });
    const recommendations = staffRecommendations({
      ...state,
      principal: { ...state.principal!, skillPoints: 2 },
      staff: STAFF_ROLES.map((role, index) => ({
        id: `department-${index}`,
        name: `${role} Department`,
        role,
        nationality: 'Team',
        rating: 55 + index * 10,
        salary: 0,
        signingFee: 0,
        bio: 'Permanent department',
      })),
    });
    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0]).toMatchObject({
      kind: 'department',
      route: '/staff',
      rating: 55,
    });
    expect(recommendations.every((recommendation) => !['recruitment', 'contract'].includes(recommendation.kind))).toBe(true);
  });

  it('prioritizes an urgent driver promise and explains the real deadline', () => {
    const state = createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'staff-c-promises' });
    const driver = state.drivers.find((candidate) => candidate.teamId === state.selectedTeamId)!;
    const recommendations = staffRecommendations({
      ...state,
      driverPromises: [{
        id: 'promise-now',
        driverId: driver.id,
        promiseType: 'equal_treatment',
        madeRound: 1,
        madeSeason: 1995,
        dueRound: 2,
        dueSeason: 1995,
        status: 'active',
        trustImpact: 5,
        moraleImpact: 5,
        notes: 'Equal treatment must be demonstrated.',
      }],
    });
    expect(recommendations[0]).toMatchObject({
      id: 'staff-advice-promise-promise-now',
      kind: 'relationship',
      target: driver.name,
      confidence: 'High',
      route: '/relationships',
    });
    expect(recommendations[0].whyItMatters).toContain('Equal treatment');
  });

  it('surfaces technical condition without performing a repair', () => {
    const state = createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'staff-c-condition' });
    const recommendations = staffRecommendations({
      ...state,
      principal: { ...state.principal!, skillPoints: 0 },
      cars: state.cars.map((car) => car.teamId === state.selectedTeamId ? { ...car, condition: 60 } : car),
    });
    expect(recommendations[0]).toMatchObject({
      id: 'staff-advice-car-condition',
      kind: 'technical',
      confidence: 'High',
      route: '/technical',
    });
    expect(recommendations[0].consequence).toContain('No repair');
  });
});
