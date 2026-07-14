// AI Team Management — Career Mode Phase C.
//
// Every non-player team runs itself through a simplified but believable brain:
// a management personality/archetype, a budget model with a financial-health
// grade, and a season goal. These are persisted per team and recomputed at the
// offseason rollover so the AI paddock evolves across seasons. The concrete
// offseason *actions* (driver market, development, staff, sponsors, engine)
// build on this state in Phase D.

// Management personality. Biases every AI decision: how aggressively a team
// spends, how much it leans on youth/pay drivers, and its risk appetite.
export type AITeamArchetype =
  | 'ChampionshipContender'
  | 'AmbitiousBuilder'
  | 'DevelopmentFocused'
  | 'FinanciallyConservative'
  | 'PayDriverReliant'
  | 'AggressiveSpender'
  | 'YouthFocused'
  | 'SurvivalMode';

// Financial-health grade shown on the Team Overview screen and used to gate AI
// spending (a Critical team retrenches; an Excellent one can chase upgrades).
export type AIFinancialHealth = 'Excellent' | 'Stable' | 'Tight' | 'AtRisk' | 'Critical';

// The team's headline objective for the upcoming season.
export type AITeamGoal =
  | 'TitleChallenge'
  | 'Podiums'
  | 'PointsFinish'
  | 'MidfieldImprovement'
  | 'Survival'
  | 'YouthDevelopment';

// Persistent identity traits that define a team's character beyond its current
// archetype. These are assigned at initialization and drift slowly, giving each
// team a recognizable personality across seasons even as archetypes evolve.
export type TeamPhilosophyTrait =
  | 'TechnicalInnovator'    // pushes boundaries, experimental approach
  | 'Traditionalist'        // values experience and proven methods
  | 'RiskTaker'             // bold strategic calls, aggressive development
  | 'PeopleFirst'           // invests in staff and driver relationships
  | 'DataDriven'            // analytics-heavy, systematic approach
  | 'Maverick'              // unconventional, unpredictable decisions
  | 'Disciplined'           // methodical, process-oriented
  | 'StarMaker';            // known for developing young talent

export type TeamPhilosophy = {
  // 2-3 persistent traits that define the team's character.
  traits: TeamPhilosophyTrait[];
  // A short, human-readable description of the team's identity.
  description: string;
};

// A simplified annual budget for an AI team, all values in raw dollars.
// Prize money is banked per-race into Team.budget during the season, so at
// rollover only sponsorIncome is added and the annual expenses are deducted.
export type AITeamBudget = {
  startingCash: number; // Team.budget at the time of estimation
  sponsorIncome: number; // annual (net of sponsor-expectation penalty)
  prizeMoney: number; // estimated annual (informational; banked per race)
  driverSalaries: number;
  staffSalaries: number;
  developmentSpend: number;
  facilitySpend: number;
  engineCost: number;
  operatingCost: number;
  // Ongoing costs that scale with the team's programmes and put long-run
  // pressure on budgets so they cannot inflate endlessly.
  testingCost: number;
  academyCost: number;
  // Reduced future sponsor income from missing on-track expectations.
  sponsorPenalty: number;
  // Discretionary spend beyond car dev/facilities (marketing, extra staff,
  // war-chest deployment) — the mechanism that spends down excess cash so a
  // healthy team settles around a stable budget instead of hoarding forever.
  otherInvestment: number;
  totalExpenses: number;
  netResult: number; // income - totalExpenses (the rollover cash delta)
  projectedCash: number; // startingCash + netResult
  reserveTarget: number; // minimum cash the team tries to keep
};

// Persisted AI brain state for one team.
export type AITeamState = {
  teamId: string;
  archetype: AITeamArchetype;
  financialHealth: AIFinancialHealth;
  goal: AITeamGoal;
  budget: AITeamBudget;
  // Persistent team identity — traits and description that survive across seasons.
  philosophy?: TeamPhilosophy;
  principalAttributes?: import('./principalTypes').PrincipalAttributes;
  // Consecutive seasons the team has been AtRisk/Critical — drives the drift
  // toward Survival Mode (and recovery back out of it).
  seasonsInTrouble: number;
  // Last final constructor position, used for the Team Overview trend + goals.
  lastConstructorPosition?: number;
  // In-season technical-director bookkeeping. Actual projects and components
  // live in teamResearch/teamParts; these fields keep budget discipline and a
  // concise audit trail on the AI brain itself.
  technicalSpendThisSeason?: number;
  lastTechnicalDecision?: string;
  lastTechnicalDecisionRound?: number;
};

// Multi-season memory: track a team's historical performance to influence
// future decisions. Stored per team and updated at each offseason.
export type TeamMemoryEntry = {
  teamId: string;
  seasonsTracked: number;
  lastConstructorPosition?: number;
  bestConstructorPosition?: number;
  worstConstructorPosition?: number;
  avgConstructorPosition?: number;
  trendDirection: 'improving' | 'declining' | 'stable';
  seasonsSincePodium: number;
  seasonsSinceWin: number;
  totalWins: number;
  totalPodiums: number;
};
