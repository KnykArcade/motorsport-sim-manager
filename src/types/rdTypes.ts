import type { CarRatings } from './gameTypes';

export const RD_BRANCH_IDS = [
  'engine',
  'aero',
  'reliability',
  'chassis',
  'tires',
  'operations',
  'manufacturing',
  'electronics',
  'driver_staff',
  'commercial_political',
] as const;

export type RDBranchId = (typeof RD_BRANCH_IDS)[number];

export type RDCostBand = 'Low' | 'Medium' | 'High' | 'Very High' | 'Extreme';
export type RDDurationBand = 'Short' | 'Medium' | 'Long' | 'Very Long' | 'Season Project';

export type RDModifierScope = 'car' | 'race_weekend' | 'team' | 'department' | 'risk' | 'finance';

export type RDModifier = {
  id: string;
  sourceNodeId: string;
  scope: RDModifierScope;
  target: string;
  value: number;
  description: string;
  appliedSeasonYear: number;
};

export type RDNodeDefinition = {
  id: string;
  branchId: RDBranchId;
  sourceId: string;
  name: string;
  tier: number;
  path: string;
  unlockRequirement: string;
  prerequisiteNodeIds: string[];
  cashCostBand: RDCostBand;
  tppCostBand: RDCostBand;
  durationBand: RDDurationBand;
  mainEffects: string;
  tradeoffsAndRisks: string;
  partsUnlocked: string;
  eraNotes: string;
  branchCategory: string;
  developmentEffectType: string;
  gameLogicNote: string;
};

export type TeamPrincipalPointReason =
  | 'initial_allocation'
  | 'season_allocation'
  | 'research_project'
  | 'goal_reward'
  | 'political_action'
  | 'manual_adjustment';

export type TeamPrincipalPointTransaction = {
  id: string;
  seasonYear: number;
  round: number;
  amount: number;
  balanceAfter: number;
  reason: TeamPrincipalPointReason;
  description: string;
  nodeId?: string;
};

export type TeamPrincipalPointsState = {
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  ledger: TeamPrincipalPointTransaction[];
};

export type ResearchFocusState = {
  branchId: RDBranchId;
  selectedSeasonYear: number;
  lockedThroughSeasonYear: number;
};

export type RDActiveProject = {
  id: string;
  nodeId: string;
  teamId: string;
  startedSeasonYear: number;
  startedRound: number;
  progressRounds: number;
  durationRounds: number;
  cashCost: number;
  tppCost: number;
};

export type RDCompletedNode = {
  nodeId: string;
  teamId: string;
  completedSeasonYear: number;
  completedRound: number;
};

export type TeamResearchState = {
  teamId: string;
  focus?: ResearchFocusState;
  tpp: TeamPrincipalPointsState;
  activeProjects: RDActiveProject[];
  completedNodes: RDCompletedNode[];
  modifiers: RDModifier[];
};

export type TeamResearchMap = Record<string, TeamResearchState>;

export type RDProgressResult = {
  teamResearch: TeamResearchState;
  carRatingDeltas: Partial<CarRatings>;
  completedNodeIds: string[];
  messages: string[];
};
