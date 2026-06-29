// Driver market & academy types (Phase C foundation).
//
// These describe the off-grid talent pools seeded from the 1995 Driver Market
// workbook: senior/feeder drivers available to sign, and under-18 youth
// prospects for a team academy. They are intentionally separate from the runtime
// `Driver` type — a market driver is only converted into a full `Driver` when
// signed to a race seat.

// The ten core driving skills shared by every talent record (1-10 scale).
export type MarketSkillRatings = {
  cornering: number;
  braking: number;
  straights: number;
  tractionAcceleration: number;
  elevationBlindCorners: number;
  technical: number;
  overtakingRacecraft: number;
  surfaceGripBumpiness: number;
  riskManagement: number;
  enduranceConsistency: number;
};

// A senior / feeder-series driver available on the transfer market.
export type MarketDriver = {
  id: string;
  name: string;
  age: number;
  nationality: string;
  context: string; // current series / context
  marketPool: string;
  marketStatus: string;
  primaryRole: string;
  immediateF1Eligible: boolean;
  skills: MarketSkillRatings;
  overall: number;
  potential: number;
  potentialDelta: number;
  developmentRate: number;
  f1Readiness: number; // 0-100
  salary: number; // $M / year
  sponsorValue: number; // $M / year brought in
  buyoutCost: number; // $M one-off approach/buyout
  negotiationDifficulty: string;
  suggestedUse: string;
  notes: string;
};

// An under-18 prospect for the team academy.
export type YouthProspect = {
  id: string;
  name: string;
  age: number;
  birthYear: number;
  nationality: string;
  currentLevel: string;
  marketPool: string;
  marketStatus: string;
  academyEligibleNow: boolean;
  earliestFullAcademyYear: number;
  skills: MarketSkillRatings;
  overall: number;
  potential: number;
  potentialDelta: number;
  developmentRate: number;
  yearsUntilF1Ready: number;
  signingCost: number; // $M one-off
  yearlyAcademyCost: number; // $M / year
  riskLevel: string;
  suggestedPath: string;
  notes: string;
};
