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
  // Consecutive seasons the team has been AtRisk/Critical — drives the drift
  // toward Survival Mode (and recovery back out of it).
  seasonsInTrouble: number;
  // Last final constructor position, used for the Team Overview trend + goals.
  lastConstructorPosition?: number;
};
