export type PersonnelCareerKind = 'TeamPrincipal' | 'Staff';

export type PersonnelCareerTenure = {
  id: string;
  kind: PersonnelCareerKind;
  personId: string;
  personName: string;
  role: string;
  teamId: string;
  teamName: string;
  startedSeason: number;
  endedSeason?: number;
  joinedReason: string;
  leftReason?: string;
};
