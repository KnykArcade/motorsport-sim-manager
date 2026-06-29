// Regulation voting / political system (Living Universe Phase 1 — types only).
//
// Teams (and manufacturers) lobby and vote on future regulations. Big teams and
// works engine suppliers carry more influence. This mainly drives Career Mode
// offseason storylines and how the rule set evolves year-to-year.

export type RegulationCategory =
  | 'Engine'
  | 'Aero'
  | 'Safety'
  | 'Testing'
  | 'Budget'
  | 'Points'
  | 'Qualifying'
  | 'Calendar'
  | 'Tires';

export type RegulationVote = 'Support' | 'Oppose' | 'Abstain';

export type RegulationProposal = {
  id: string;
  seasonYearEffective: number;
  title: string;
  description: string;
  category: RegulationCategory;
  // Named effects applied to the rule set if the proposal passes.
  effects: Record<string, number | string>;
  // Each team's stance/weight toward the proposal (teamId -> -100..100).
  supportByTeam: Record<string, number>;
  playerVote?: RegulationVote;
};

// The political weight a team can exert, derived from prestige + engine deal.
export type PoliticalInfluence = {
  teamId: string;
  influence: number; // 0-100
};

// The outcome of a vote, retained in history for the universe record.
export type RegulationVoteResult = {
  proposalId: string;
  passed: boolean;
  supportWeight: number;
  opposeWeight: number;
  seasonYearEffective: number;
};
