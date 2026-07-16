import { describe, expect, it } from 'vitest';
import { FACILITY_SPECS } from '../sim/facilityEngine';
import type { Facility } from '../types/facilityTypes';
import {
  FACILITIES_WORKSPACE_TABS,
  FACILITY_PORTFOLIO_GROUPS,
  averageFacilityLevel,
  facilitiesForPortfolioGroup,
} from './facilitiesViewModel';

function facility(type: Facility['type'], level: number): Facility {
  return {
    id: `facility-${type}`,
    teamId: 'team-test',
    type,
    level,
    maxLevel: 5,
    upgradeCost: 5,
    upgradeDurationWeeks: 12,
    effects: {},
  };
}

describe('facilities view model', () => {
  it('exposes three focused facilities workspaces', () => {
    expect(FACILITIES_WORKSPACE_TABS.map((tab) => tab.id)).toEqual([
      'impacts',
      'planner',
      'specialization',
    ]);
  });

  it('groups every facility type exactly once and caps a planner view at four cards', () => {
    const groupedTypes = FACILITY_PORTFOLIO_GROUPS.flatMap((group) => group.facilityTypes);

    expect(new Set(groupedTypes).size).toBe(groupedTypes.length);
    expect([...groupedTypes].sort()).toEqual(Object.keys(FACILITY_SPECS).sort());
    expect(Math.max(...FACILITY_PORTFOLIO_GROUPS.map((group) => group.facilityTypes.length))).toBe(4);
  });

  it('returns facilities in the declared group order and computes their average level', () => {
    const facilities = [
      facility('DataCenter', 4),
      facility('Simulator', 2),
      facility('WindTunnel', 3),
    ];

    expect(facilitiesForPortfolioGroup(facilities, 'development').map((entry) => entry.type)).toEqual([
      'WindTunnel',
      'Simulator',
      'DataCenter',
    ]);
    expect(averageFacilityLevel(facilities)).toBe(3);
    expect(averageFacilityLevel([])).toBe(0);
  });
});
