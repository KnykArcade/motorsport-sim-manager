import type {
  CarRatings,
  DevelopmentCategory,
  DevelopmentHorizon,
  DevelopmentOutcomeResult,
  ProjectRiskLevel,
  ProjectSize,
} from './gameTypes';
import type {
  RDCompletedNode,
  RDModifier,
  RDModifierTemplate,
  RDProjectHistoryEntry,
  RDProjectRiskLevel,
  RDBranchId,
  ResearchFocusState,
  TeamPrincipalPointsState,
} from './rdTypes';

export type TechnicalUpgradeProgram = {
  kind: 'upgrade';
  id: string;
  teamId: string;
  progressTicks: number;
  durationTicks: number;
  baseDurationTicks: number;
  cashCost: number;
  tppCost: 0;
  name: string;
  category: DevelopmentCategory;
  horizon: DevelopmentHorizon;
  successChance: number;
  size?: ProjectSize;
  risk?: string;
  riskLevel?: ProjectRiskLevel;
  carryoverRate: number;
  regulationSensitivity: number;
  currentSeasonEffects?: Partial<CarRatings>;
  nextSeasonEffects?: Partial<CarRatings>;
  facilityEffects?: Record<string, number>;
  relevantFacilityTypes?: string[];
  outcomeResult?: DevelopmentOutcomeResult;
  rushed?: boolean;
  facilityLevelAtStart?: number;
};

export type TechnicalResearchProgram = {
  kind: 'research';
  id: string;
  teamId: string;
  progressTicks: number;
  durationTicks: number;
  cashCost: number;
  tppCost: number;
  nodeId: string;
  startedSeasonYear?: number;
  startedRound?: number;
  nodeName?: string;
  sourceId?: string;
  branchId?: RDBranchId;
  tier?: number;
  path?: string;
  riskLevel?: RDProjectRiskLevel;
  seriesWeight?: number;
  modifierTemplates?: RDModifierTemplate[];
};

export type TechnicalProgram = TechnicalUpgradeProgram | TechnicalResearchProgram;

export type CompletedUpgradeProgram = {
  kind: 'upgrade';
  id: string;
  teamId: string;
  completedTicks: number;
  program: TechnicalUpgradeProgram;
};

export type CompletedResearchProgram = {
  kind: 'research';
  id: string;
  teamId: string;
  completedTicks: number;
  node?: RDCompletedNode;
  historyEntry?: RDProjectHistoryEntry;
};

export type CompletedProgram = CompletedUpgradeProgram | CompletedResearchProgram;

export type TeamTechnicalState = {
  teamId: string;
  tpp: TeamPrincipalPointsState;
  focus?: ResearchFocusState;
  activeProjects: TechnicalProgram[];
  completedPrograms: CompletedProgram[];
  modifiers: RDModifier[];
};

export type TeamTechnicalMap = Record<string, TeamTechnicalState>;
