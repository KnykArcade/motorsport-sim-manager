// Team Principal job market (Living Universe Phase 1 — types only).
//
// The player is a Team Principal with their own reputation, contract, job
// security and career record. Over a long career they can be approached, sacked,
// renewed, or move between teams — turning the game into a manager career.

export type PrincipalCareerStats = {
  seasonsCompleted: number;
  raceWins: number;
  podiums: number;
  driverTitles: number;
  constructorTitles: number;
  teamsManaged: string[]; // teamIds, in order
};

// Skill/standing ratings for the principal (0-100 unless noted).
export type PrincipalAttributes = {
  mediaImage: number;
  boardConfidence: number;
  financialDiscipline: number;
  driverManagement: number;
  development: number;
  strategy: number;
};

export type TeamPrincipalProfile = {
  id: string;
  name: string;
  reputation: number; // 0-100
  currentTeamId: string;
  contractYearsRemaining: number;
  jobSecurity: number; // 0-100
  attributes: PrincipalAttributes;
  careerStats: PrincipalCareerStats;
};

// A job approach/offer from another team in the universe.
export type JobOffer = {
  id: string;
  teamId: string;
  seasonYear: number;
  contractYears: number;
  // Stated remit & resources, used to evaluate the offer.
  objective: string;
  prestige: number; // 0-100
  budgetTier: string;
  // Whether this is a firm offer or an informal rumor/approach.
  kind: 'Offer' | 'Rumor';
  expiresSeasonYear: number;
};
