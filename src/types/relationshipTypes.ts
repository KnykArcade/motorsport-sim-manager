// Driver relationships & team orders (Living Universe Phase 1 — types only).
//
// Models the human side of a team: loyalty, engineer chemistry, teammate
// rivalry, morale/frustration and number-one status. Team-order decisions act on
// these and ripple into media, sponsors and future contract talks.

export type DriverRelationship = {
  driverId: string;
  teamId: string;
  teammateId?: string;
  teamLoyalty: number; // 0-100
  engineerChemistry: number; // 0-100
  teammateRelationship: number; // 0-100 (low = rivalry)
  morale: number; // 0-100
  frustration: number; // 0-100
  numberOneExpectation: boolean;
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
