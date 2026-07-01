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

// Outcome of a team exercising (or declining) first option on an academy driver
// who has turned 18 and become promotion eligible.
export type FirstOptionStatus =
  | 'pending_team_decision'
  | 'promoted_to_race_seat'
  | 'promoted_to_third_driver'
  | 'promoted_to_reserve'
  | 'promoted_to_test_driver'
  | 'extended_development_rights'
  | 'released_to_market'
  | 'driver_rejected_offer'
  | 'expired';

// The decision a team (player or AI) can make on a promotion-eligible academy
// driver during the offseason first-option window.
export type FirstOptionDecision =
  | 'race_seat' // promote into a full race seat (replaces a seat driver)
  | 'third' // sign as 3rd driver
  | 'reserve' // sign as reserve driver
  | 'test' // sign as test/development driver
  | 'extend' // extend academy/development rights another year
  | 'release'; // release to the open adult driver market

// A queued first-option decision for one of the player's promotion-eligible
// academy drivers, applied at the next season rollover.
export type AcademyDecision = {
  academyId: string;
  decision: FirstOptionDecision;
  // For a race-seat promotion: which of the team's current seats to take.
  seatDriverId?: string;
};

// A youth prospect signed into the team academy. Carries live (progressing)
// ratings derived from the seed prospect; advances each offseason toward F1.
export type AcademyMember = {
  id: string;
  prospectId: string;
  name: string;
  nationality: string;
  // Best-known birth year, so a member's age can be recomputed every season and
  // the 12–17 youth / 18+ adult boundary applied at rollover.
  birthYear: number;
  // The team that holds academy rights (and therefore first option at 18).
  academyTeamId: string;
  skills: MarketSkillRatings;
  overall: number;
  potential: number;
  developmentRate: number;
  yearsUntilF1Ready: number;
  signedYear: number;
  // Set true once the member reaches adult age (18): the academy team gets first
  // option before the driver can enter the open market.
  promotionEligible?: boolean;
  // Lifecycle of the first-option window once promotion eligible.
  firstOptionStatus?: FirstOptionStatus;
  // The season the first-option window opened (the year the member turned 18).
  firstOptionYear?: number;
  // The last season the academy team may still hold first option. Past this the
  // rights expire: the team must promote/sign to a senior role or the driver is
  // released to the adult market. Never later than the season the driver is 20.
  firstOptionDeadlineYear?: number;
};

// A queued driver change for one of the player's seats, applied at the next
// season rollover. The seat is identified by the driver currently filling it.
export type SeatSigning = {
  seatDriverId: string;
  // 'market' = sign an off-grid driver, 'academy' = promote an academy member,
  // 'reserve' = promote the team's own existing 3rd/reserve driver into a seat.
  source: 'market' | 'academy' | 'reserve';
  sourceId: string;
  name: string;
  // For contested market signings: the bid ($M) offered for the driver. Resolved
  // against rival interest at the season rollover. Absent for academy/reserve.
  bid?: number;
};
