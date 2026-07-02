// Team organization ratings — Career Mode Phase 1.
//
// Every team gets a detailed set of organization ratings (0-100) on top of the
// car's on-track ratings. These describe the team as a business/operation and
// are reused by later systems (driver bidding, sponsors, scouting, academy
// capacity, owner expectations, job security, etc.). The overall rating is a
// weighted roll-up of the categories.

export type TeamOrganizationRatings = {
  teamId: string;
  carPerformance: number;
  marketing: number;
  research: number;
  facilities: number;
  scouting: number;
  fanSupport: number;
  // Era-appropriate: in older eras this is press attention / fanbase size /
  // commercial visibility / TV/broadcast reach; modern eras also fold in social
  // media and digital/global brand reach.
  mediaReach: number;
  financialStability: number;
  staffQuality: number;
  driverAppeal: number;
  sponsorAppeal: number;
  operations: number;
  reliabilityDepartment: number;
  pitCrew: number;
  youthAcademy: number;
  overallTeamRating: number;
};
