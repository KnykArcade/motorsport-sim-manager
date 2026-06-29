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
  deadline?: string; // ISO date or 'midseason' | 'seasonend' marker
  reward?: number; // $M bonus on completion
  penalty?: number; // $M / confidence hit on failure
  status?: 'Pending' | 'Met' | 'Failed';
};

// A conditional performance bonus (e.g. per win / per podium / points threshold).
export type SponsorBonus = {
  id: string;
  description: string;
  trigger: 'PerWin' | 'PerPodium' | 'PerPole' | 'PointsThreshold' | 'TitleWon';
  threshold?: number;
  amount: number; // $M paid per trigger
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
  // Optional linkage when the sponsor is tied to a specific driver.
  linkedDriverId?: string;
};

// The player team's overall commercial state, persisted in career mode.
export type CommercialState = {
  teamId: string;
  sponsors: Sponsor[];
  // Cached commercial reputation used when courting new sponsors (0-100).
  commercialReputation: number;
};
