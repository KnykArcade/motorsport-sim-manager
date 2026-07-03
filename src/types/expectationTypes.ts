// Team reputation & owner expectations (Living Universe Phase 1 — types only).
//
// Each team carries a reputation/prestige profile plus per-season owner
// expectations. Meeting or missing expectations feeds job security, budget,
// sponsor confidence, driver interest and media pressure.

// Owner personality archetypes that modulate patience, pressure, and
// expectation severity. Each gives the team's owner a recognizable character
// that affects how they react to success and failure.
export type OwnerPersonality =
  | 'PatientBuilder'      // long-term vision, slow to fire, tolerates rebuilding
  | 'WinNowTycoon'        // demands immediate results, quick to fire, high expectations
  | 'BudgetHawk'          // cost-conscious, values financial discipline over results
  | 'RacingPurist'        // cares about the sport, values fair racing and driver development
  | 'Showman'             // wants headlines and spectacle, values star signings
  | 'OldGuard';           // traditionalist, loyal to staff, slow change

export const OWNER_PERSONALITY_LABELS: Record<OwnerPersonality, string> = {
  PatientBuilder: 'Patient Builder',
  WinNowTycoon: 'Win-Now Tycoon',
  BudgetHawk: 'Budget Hawk',
  RacingPurist: 'Racing Purist',
  Showman: 'Showman',
  OldGuard: 'Old Guard',
};

export const OWNER_PERSONALITY_DESCRIPTIONS: Record<OwnerPersonality, string> = {
  PatientBuilder: 'Tolerates short-term pain for long-term gain. Slow to panic, values steady progress.',
  WinNowTycoon: 'Demands instant results. High expectations, quick to fire, rewards bold moves.',
  BudgetHawk: 'Cost-conscious and disciplined. Values financial control as much as on-track results.',
  RacingPurist: 'Loves the sport. Values fair racing, driver development, and sporting integrity.',
  Showman: 'Wants headlines and spectacle. Star signings and bold moves earn patience.',
  OldGuard: 'Traditional and loyal. Values continuity, slow to change, rewards long service.',
};

// Slow-moving reputation/standing attributes for a team (0-100 unless noted).
export type TeamReputation = {
  teamId: string;
  reputation: number; // overall standing in the paddock
  financialStability: number;
  ownerPatience: number;
  ownerPersonality?: OwnerPersonality;
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
