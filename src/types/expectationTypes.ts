// Team reputation & owner expectations (Living Universe Phase 1 — types only).
//
// Each team carries a reputation/prestige profile plus per-season owner
// expectations. Meeting or missing expectations feeds job security, budget,
// sponsor confidence, driver interest and media pressure.

// Slow-moving reputation/standing attributes for a team (0-100 unless noted).
export type TeamReputation = {
  teamId: string;
  reputation: number; // overall standing in the paddock
  financialStability: number;
  ownerPatience: number;
  fanExpectation: number;
  sponsorConfidence: number;
  historicalPrestige: number;
  currentCompetitiveness: number;
};

// The owner's stated goals for a given season.
export type TeamExpectation = {
  teamId: string;
  seasonYear: number;
  primaryObjective: string;
  secondaryObjectives: string[];
  minimumConstructorPosition?: number;
  targetPoints?: number;
  requiredWins?: number;
  budgetDisciplineTarget?: boolean;
  ownerPatience: number; // 0-100; drains when expectations are missed
};

// An end-of-period assessment of how the player met expectations.
export type ExpectationReview = {
  teamId: string;
  seasonYear: number;
  primaryObjectiveMet: boolean;
  score: number; // -100..100, net over/under-performance
  patienceDelta: number;
  summary: string;
};
