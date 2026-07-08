// Driver relationships & team orders (Living Universe Phase 1 — types only).
//
// Models the human side of a team: loyalty, engineer chemistry, teammate
// rivalry, morale/frustration and number-one status. Team-order decisions act on
// these and ripple into media, sponsors and future contract talks.
//
// Extended with Driver Confidence / Trust / Ego system: self-confidence, trust
// in car/team/principal, ego/role expectation, personality traits, wants, and
// promises.

export type DriverPersonalityTrait =
  | 'Team Leader'
  | 'High Ego'
  | 'Loyal'
  | 'Ambitious'
  | 'Pressure Sensitive'
  | 'Calm Under Pressure'
  | 'Setup Focused'
  | 'Risk Taker'
  | 'Political'
  | 'Media Friendly'
  | 'Demanding'
  | 'Mentor'
  | 'Rivalry Prone'
  | 'Resilient'
  | 'Confidence Driven'
  | 'Money Motivated'
  | 'Youthful'
  | 'Veteran Professional';

export type ConfidenceState =
  | 'Inspired'
  | 'Confident'
  | 'Settled'
  | 'Neutral'
  | 'Concerned'
  | 'Frustrated'
  | 'Disillusioned'
  | 'Checked Out';

export type DriverWant =
  | 'number_one_status'
  | 'equal_treatment'
  | 'better_reliability'
  | 'development_priority'
  | 'contract_renewal'
  | 'race_seat_security'
  | 'less_risky_strategy'
  | 'more_aggressive_strategy'
  | 'better_teammate_treatment'
  | 'podium_capable_car'
  | 'title_contending_car'
  | 'better_salary'
  | 'academy_promotion'
  | 'practice_time'
  | 'team_stability';

export type PromiseStatus = 'active' | 'kept' | 'broken' | 'expired' | 'cancelled';

export type PromiseType =
  | 'equal_treatment'
  | 'number_one_status'
  | 'improved_reliability'
  | 'development_priority'
  | 'contract_renewal'
  | 'promotion'
  | 'reserve_practice_time'
  | 'no_midseason_replacement'
  | 'better_strategy_support'
  | 'priority_upgrades'
  | 'fight_teammate'
  | 'calmer_risk_approach';

export type DriverPromise = {
  id: string;
  driverId: string;
  promiseType: PromiseType;
  madeRound: number;
  madeSeason: number;
  dueRound?: number;
  dueSeason?: number;
  status: PromiseStatus;
  trustImpact: number;
  moraleImpact: number;
  notes?: string;
};

export type DriverRelationship = {
  driverId: string;
  teamId: string;
  teammateId?: string;
  // Existing relationship fields.
  teamLoyalty: number; // 0-100
  engineerChemistry: number; // 0-100
  teammateRelationship: number; // 0-100 (low = rivalry)
  morale: number; // 0-100
  frustration: number; // 0-100
  numberOneExpectation: boolean;
  // Driver Confidence / Trust / Ego system.
  selfConfidence: number; // 0-100
  trustInCar: number; // 0-100
  trustInTeam: number; // 0-100
  trustInPrincipal: number; // 0-100
  teamTrustInDriver: number; // 0-100
  ego: number; // 0-100 (high = expects priority treatment)
  personalityTraits: DriverPersonalityTrait[];
  wants: DriverWant[];
};

// The set of team-order calls available during/before a race.
export type TeamOrder =
  | 'HoldPosition'
  | 'LetThemRace'
  | 'SwapPositions'
  | 'ProtectLeadDriver'
  | 'BlockRival'
  | 'SacrificeSecondDriver'
  | 'PriorityPitStop';

// A team-order decision taken in a race, retained for consequence resolution.
export type TeamOrderDecision = {
  id: string;
  raceId: string;
  order: TeamOrder;
  favoredDriverId?: string;
  disadvantagedDriverId?: string;
  lap?: number;
};

// The fallout of a team order / on-track event on relationships and standing.
export type RelationshipConsequence = {
  driverId: string;
  moraleDelta: number;
  loyaltyDelta: number;
  teammateRelationshipDelta: number;
  mediaReaction?: string;
  sponsorReaction?: string;
};
