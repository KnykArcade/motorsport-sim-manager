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

    expect(responsibilities).toHaveLength(4);
    expect(responsibilities[0]).toMatchObject({
      area: 'Technical programme',
      status: 'Assisted factory',
      effect: 'Raises car development success rate.',
      detail: 'TD recommendations are advisory · Reliability first priority',
      route: '/technical',
    });
    expect(responsibilities.find((item) => item.role === 'Race Engineer')?.route).toBe('/weekend');
  });
});
