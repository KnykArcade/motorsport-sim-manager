// Sponsor & commercial system (Living Universe Phase 1 — types only).
//
// Sponsors are a major income source AND a pressure system: each carries
// objectives and confidence that rise/fall with results, feeding the unified
// team budget and (later) renewal/withdrawal storylines. All money is in $M.

export type SponsorType =
  | 'Title'
  | 'Secondary'
  | 'TechnicalPartner'
  | 'DriverLinked'
  | 'PayDriver'
  | 'OneRace';

export type SponsorObjectiveCategory =
  | 'Performance'
  | 'Driver'
  | 'Marketability'
  | 'Nationality'
  | 'Reliability'
  | 'Financial';

// A measurable expectation attached to a sponsor. Meeting it pays `reward`;
// missing it by `deadline` costs `penalty` and dents confidence.
export type SponsorObjective = {
  id: string;
  description: string;
  category: SponsorObjectiveCategory;
  targetValue?: number;
  deadline?: string; // Legacy marker; in-season evaluation converts this to a championship round.
  deadlineRound?: number;
  progressValue?: number;
  progressLabel?: string;
  lastReviewedRound?: number;
  resolvedRound?: number;
  originalTargetValue?: number;
  revisionNote?: string;
  reward?: number; // $M bonus on completion
  penalty?: number; // $M / confidence hit on failure
  status?: 'Pending' | 'Met' | 'Failed';
};

export type SponsorRelationshipStatus = 'Secure' | 'Monitoring' | 'Warning' | 'Breach';

export type SponsorReview = {
  id: string;
  sponsorId: string;
  round: number;
  kind: 'Progress' | 'Midseason' | 'Revision' | 'Deadline' | 'Warning' | 'Breach';
  headline: string;
  detail: string;
  confidenceDelta: number;
};

// A conditional performance bonus (e.g. per win / per podium / points threshold).
export type SponsorBonus = {
  id: string;
  description: string;
  trigger: 'PerWin' | 'PerPodium' | 'PerPole' | 'PointsThreshold' | 'TitleWon';
  threshold?: number;
  amount: number; // $M paid per trigger
};

export type SponsorObjectiveLevel = 'Flexible' | 'Standard' | 'Stretch';

export type SponsorContractTerms = {
  annualValue: number;
  contractYears: number;
  bonusMultiplier: number;
  objectiveLevel: SponsorObjectiveLevel;
};

export type SponsorNegotiationStatus =
  | 'Draft'
  | 'Countered'
  | 'Accepted'
  | 'Rejected'
  | 'Withdrawn'
  | 'Cancelled';

export type SponsorNegotiation = {
  id: string;
  sponsorId: string;
  sponsorName: string;
  kind: 'New' | 'Renewal';
  status: SponsorNegotiationStatus;
  openedRound: number;
  deadlineRound: number;
  patience: number;
  attempts: number;
  proposedTerms: SponsorContractTerms;
  counterTerms?: SponsorContractTerms;
  outcomeMessage?: string;
};

export type Sponsor = {
  id: string;
  name: string;
  type: SponsorType;
  annualValue: number; // $M / year base
  bonusTerms: SponsorBonus[];
  objectives: SponsorObjective[];
  confidence: number; // 0-100
  contractYearsRemaining: number;
  renewalChance: number; // 0-1
  relationshipStatus?: SponsorRelationshipStatus;
  lastReviewRound?: number;
  // Optional linkage when the sponsor is tied to a specific driver.
  linkedDriverId?: string;
};

// The player team's overall commercial state, persisted in career mode.
export type CommercialState = {
  teamId: string;
  sponsors: Sponsor[];
  // Cached commercial reputation used when courting new sponsors (0-100).
  commercialReputation: number;
  reviews?: SponsorReview[];
  // Optional for backward compatibility with saves created before negotiated
  // sponsor contracts. Completed talks remain as a compact commercial history.
  negotiations?: SponsorNegotiation[];
  unavailableOfferIds?: string[];
};
