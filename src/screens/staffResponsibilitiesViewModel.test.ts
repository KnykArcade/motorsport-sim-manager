import { describe, expect, it } from 'vitest';
import '../testDataSetup';
import { createNewGame } from '../game/initialCareer';
import { staffResponsibilities } from './staffResponsibilitiesViewModel';

describe('staffResponsibilitiesViewModel', () => {
  it('shows named owners and the current technical operating plan', () => {
    const state = createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'staff-responsibilities' });
    const responsibilities = staffResponsibilities({
      ...state,
      technicalManagementMode: 'assisted',
      technicalAdvisorPriority: 'reliability',
    });

    expect(responsibilities).toHaveLength(7);
    expect(responsibilities[0]).toMatchObject({
      area: 'Technical programme',
      status: 'Assisted factory',
      effect: 'Raises car development success rate.',
      detail: 'TD recommendations are advisory · Reliability first priority',
      route: '/technical',
    });
    expect(responsibilities.find((item) => item.role === 'Race Engineer')?.route).toBe('/weekend');
    expect(responsibilities.find((item) => item.id === 'driver-development')).toMatchObject({
      route: '/curves',
      status: 'Recommendations remain advisory',
      approvalBoundary: 'You retain preparation and final control.',
    });
  });

  it('defaults to player control and exposes the staff-prepared boundary', () => {
    const state = createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'staff-policy' });
    const playerLed = staffResponsibilities(state).find((item) => item.id === 'race-engineering');
    expect(playerLed).toMatchObject({
      policy: 'player',
      policyLabel: 'Player-led',
      approvalBoundary: 'You retain preparation and final control.',
    });

    const prepared = staffResponsibilities({
      ...state,
      staffResponsibilityPolicies: { 'race-engineering': 'staff_prepare_player_approval' },
    }).find((item) => item.id === 'race-engineering');
    expect(prepared).toMatchObject({
      policy: 'staff_prepare_player_approval',
      policyLabel: 'Staff-prepared · player approval',
      approvalBoundary: 'Staff prepares the recommendation; you approve the decision.',
    });
  });
});
