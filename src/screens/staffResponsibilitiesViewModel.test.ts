import { describe, expect, it } from 'vitest';
import '../testDataSetup';
import { createNewGame } from '../game/initialCareer';
import { staffResponsibilities } from './staffResponsibilitiesViewModel';

describe('staffResponsibilitiesViewModel', () => {
  it('shows permanent department ratings and effects', () => {
    const state = createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'staff-responsibilities' });
    const responsibilities = staffResponsibilities({
      ...state,
      technicalManagementMode: 'assisted',
      technicalAdvisorPriority: 'reliability',
    });

    expect(responsibilities).toHaveLength(4);
    expect(responsibilities[0]).toMatchObject({
      area: 'Technical programme',
      status: 'Level 5 · 50/100',
      effect: 'Raises car development success rate.',
      detail: 'Permanent department rating improved with Principal Points.',
      route: '/staff',
      routeLabel: 'Open Departments',
    });
    expect(responsibilities.find((item) => item.role === 'Race Engineer')?.route).toBe('/staff');
  });

  it('does not expose delegation controls for departments', () => {
    const state = createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'staff-policy' });
    const playerLed = staffResponsibilities(state).find((item) => item.id === 'race-engineering');
    expect(playerLed).toMatchObject({
      policy: 'player',
      policyLabel: 'Player-led',
      approvalBoundary: 'You set the department level and retain final control.',
    });
  });
});
