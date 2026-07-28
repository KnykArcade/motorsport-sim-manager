import { describe, expect, it } from 'vitest';
import '../testDataSetup';
import { createNewGame } from '../game/initialCareer';
import {
  staffResponsibilities,
  staffResponsibilityConfidence,
} from './staffResponsibilitiesViewModel';

describe('staffResponsibilitiesViewModel', () => {
  it('shows all responsibility areas with persistent-policy defaults', () => {
    const state = createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'staff-responsibilities' });
    const responsibilities = staffResponsibilities({
      ...state,
      technicalManagementMode: 'assisted',
      technicalAdvisorPriority: 'reliability',
    });

    expect(responsibilities).toHaveLength(7);
    expect(responsibilities[0]).toMatchObject({
      area: 'Technical programme',
      status: 'Level 5 · 50/100',
      policy: 'player',
      policyLabel: 'You Handle',
      route: '/staff',
      routeLabel: 'Open Staff Responsibilities',
    });
    expect(responsibilities.map((item) => item.id)).toEqual([
      'technical',
      'race-engineering',
      'pit-operations',
      'race-strategy',
      'staff-recruitment',
      'staff-contracts',
      'driver-development',
    ]);
  });

  it('uses saved responsibility policies and retains hard approval boundaries', () => {
    const state = createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'staff-policy' });
    const delegated = staffResponsibilities({
      ...state,
      staffResponsibilityPolicies: { 'race-engineering': 'staff_execute_routine' },
    }).find((item) => item.id === 'race-engineering');
    expect(delegated).toMatchObject({
      policy: 'staff_execute_routine',
      policyLabel: 'Staff Handles Routine Work',
    });
    expect(delegated?.approvalBoundary).toContain('Final setup confirmation');
    expect(delegated?.approvalBoundary).toContain('Qualifying plan');
  });

  it('escalates low-confidence routine work', () => {
    expect(staffResponsibilityConfidence(0)).toEqual({ value: 50, label: 'Low' });
    expect(staffResponsibilityConfidence(50)).toEqual({ value: 75, label: 'Normal' });
    expect(staffResponsibilityConfidence(100)).toEqual({ value: 100, label: 'High' });
  });
});
