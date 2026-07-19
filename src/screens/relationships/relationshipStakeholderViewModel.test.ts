import { describe, expect, it } from 'vitest';
import type { TeamOrganizationRatings } from '../../types/teamRatingsTypes';
import {
  DEPARTMENT_IDS,
  type DepartmentId,
  type DepartmentMood,
} from '../../types/phase18Types';
import {
  commercialStakeholderProfile,
  currentCollectiveStakeholders,
  departmentStakeholderProfile,
} from './relationshipStakeholderViewModel';

function departments(overrides: Partial<Record<DepartmentId, Partial<DepartmentMood>>> = {}) {
  return Object.fromEntries(DEPARTMENT_IDS.map((departmentId) => [departmentId, {
    departmentId,
    morale: 70,
    trustInPrincipal: 70,
    strategicAlignment: 70,
    workload: 35,
    conflictReasons: [],
    lastUpdatedSeasonYear: 2026,
    ...overrides[departmentId],
  }])) as Record<DepartmentId, DepartmentMood>;
}

function organization(overrides: Partial<TeamOrganizationRatings> = {}): TeamOrganizationRatings {
  return {
    teamId: 'team-1',
    carPerformance: 60,
    marketing: 60,
    research: 60,
    facilities: 60,
    scouting: 60,
    fanSupport: 60,
    mediaReach: 60,
    financialStability: 60,
    staffQuality: 60,
    driverAppeal: 60,
    sponsorAppeal: 60,
    operations: 60,
    reliabilityDepartment: 60,
    pitCrew: 60,
    youthAcademy: 60,
    overallTeamRating: 60,
    ...overrides,
  };
}

function sponsor(confidence: number) {
  return {
    id: 'sponsor-1',
    name: 'Partner One',
    type: 'Title' as const,
    annualValue: 20,
    bonusTerms: [],
    objectives: [],
    confidence,
    contractYearsRemaining: 2,
    renewalChance: 0.7,
  };
}

describe('collective stakeholder priorities', () => {
  it('keeps healthy department committees stable without creating noise', () => {
    const profile = departmentStakeholderProfile(departments());

    expect(profile).toMatchObject({
      id: 'Departments',
      authorityRank: 4,
      status: 'Stable',
    });
    expect(profile?.reasons[0]).toContain('All 8 department committees are aligned');
  });

  it('raises a critical department signal with a specific plain-language reason', () => {
    const profile = departmentStakeholderProfile(departments({
      Engineering: { trustInPrincipal: 18, workload: 94 },
    }));

    expect(profile?.status).toBe('MustActNow');
    expect(profile?.reasons[0]).toContain('Engineering: trust 18, workload 94');
  });

  it('uses sponsor confidence for urgency while keeping fan support contextual', () => {
    const critical = commercialStakeholderProfile({
      selectedTeamId: 'team-1',
      commercial: { teamId: 'team-1', sponsors: [sponsor(14)], commercialReputation: 65 },
      teamOrgRatings: { 'team-1': organization() },
    });
    const stableLowFanBase = commercialStakeholderProfile({
      selectedTeamId: 'team-1',
      commercial: { teamId: 'team-1', sponsors: [sponsor(75)], commercialReputation: 70 },
      teamOrgRatings: { 'team-1': organization({ fanSupport: 20 }) },
    });

    expect(critical?.status).toBe('MustActNow');
    expect(critical?.reasons.some((reason) => reason.includes('Partner One confidence is 14'))).toBe(true);
    expect(stableLowFanBase?.status).toBe('Stable');
    expect(stableLowFanBase?.metrics.find((metric) => metric.label === 'Fan support')?.value).toBe('20');
  });

  it('orders an urgent collective relationship ahead of a stable higher-authority committee', () => {
    const profiles = currentCollectiveStakeholders({
      selectedTeamId: 'team-1',
      phase18: { departmentMoods: { 'team-1': departments() } } as never,
      commercial: { teamId: 'team-1', sponsors: [sponsor(12)], commercialReputation: 65 },
      teamOrgRatings: { 'team-1': organization() },
    });

    expect(profiles.map((profile) => profile.id)).toEqual(['Commercial', 'Departments']);
    expect(profiles[0].authorityRank).toBe(5);
    expect(profiles[1].authorityRank).toBe(4);
  });
});
