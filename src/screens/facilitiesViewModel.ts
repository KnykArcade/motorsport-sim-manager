import type { Facility, FacilityType } from '../types/facilityTypes';

export type FacilitiesWorkspaceTab = 'impacts' | 'planner' | 'specialization';
export type FacilityPortfolioGroupId = 'development' | 'operations' | 'talent';

export const FACILITIES_WORKSPACE_TABS: ReadonlyArray<{
  id: FacilitiesWorkspaceTab;
  label: string;
}> = [
  { id: 'impacts', label: 'Impacts' },
  { id: 'planner', label: 'Upgrade Planner' },
  { id: 'specialization', label: 'Specialization' },
];

export const FACILITY_PORTFOLIO_GROUPS: ReadonlyArray<{
  id: FacilityPortfolioGroupId;
  label: string;
  description: string;
  facilityTypes: FacilityType[];
}> = [
  {
    id: 'development',
    label: 'Development',
    description: 'Research, simulation, and design capacity',
    facilityTypes: ['WindTunnel', 'Simulator', 'DataCenter'],
  },
  {
    id: 'operations',
    label: 'Race Operations',
    description: 'Production, reliability, repairs, and pit work',
    facilityTypes: ['Factory', 'Manufacturing', 'ReliabilityLab', 'PitCrewCenter'],
  },
  {
    id: 'talent',
    label: 'Talent & Intelligence',
    description: 'Youth development and scouting accuracy',
    facilityTypes: ['DriverAcademy', 'ScoutingNetwork'],
  },
];

export function facilitiesForPortfolioGroup(
  facilities: Facility[],
  groupId: FacilityPortfolioGroupId,
) {
  const group = FACILITY_PORTFOLIO_GROUPS.find((candidate) => candidate.id === groupId);
  if (!group) return [];
  return group.facilityTypes
    .map((type) => facilities.find((facility) => facility.type === type))
    .filter((facility): facility is Facility => facility !== undefined);
}

export function averageFacilityLevel(facilities: Facility[]) {
  if (facilities.length === 0) return 0;
  return facilities.reduce((sum, facility) => sum + facility.level, 0) / facilities.length;
}
