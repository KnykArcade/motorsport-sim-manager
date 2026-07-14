// Phase 18+ living-paddock foundation models.
//
// This file intentionally contains persistence shapes only. The gameplay
// engines that evolve identity, culture, advice, intelligence, clauses,
// rivalries, legacy, and narratives are delivered in later reviewable phases.

export const PHASE_18_FOUNDATION_VERSION = 1;

export type PrincipalIdentity =
  | 'BalancedLeader'
  | 'TechnicalVisionary'
  | 'PeopleManager'
  | 'PoliticalOperator'
  | 'CommercialStrategist'
  | 'MediaFigure'
  | 'RiskTakingInnovator';

export const PRINCIPAL_IDENTITIES: readonly PrincipalIdentity[] = [
  'BalancedLeader',
  'TechnicalVisionary',
  'PeopleManager',
  'PoliticalOperator',
  'CommercialStrategist',
  'MediaFigure',
  'RiskTakingInnovator',
];

export type PrincipalIdentityEvent = {
  id: string;
  seasonYear: number;
  round?: number;
  identity: PrincipalIdentity;
  amount: number;
  reason: string;
};

export type PrincipalIdentityState = {
  principalId: string;
  scores: Record<PrincipalIdentity, number>;
  dominantIdentity: PrincipalIdentity;
  secondaryIdentity?: PrincipalIdentity;
  totalIdentityXp: number;
  history: PrincipalIdentityEvent[];
};

export type AdvisorRole =
  | 'TechnicalDirector'
  | 'ChiefDesigner'
  | 'RaceEngineer'
  | 'SportingDirector'
  | 'CommercialDirector'
  | 'PoliticalLegalDirector'
  | 'OwnerRepresentative'
  | 'DriverRepresentative';

export type AdvisorRecommendationStatus =
  | 'Pending'
  | 'Accepted'
  | 'Rejected'
  | 'Overruled'
  | 'Expired';

export type AdvisorRecommendation = {
  id: string;
  teamId: string;
  advisorRole: AdvisorRole;
  advisorId?: string;
  advisorName?: string;
  decisionType: string;
  decisionId?: string;
  recommendedOptionId?: string;
  recommendation: string;
  rationale: string;
  confidence: number;
  urgency: 'Low' | 'Normal' | 'High' | 'Critical';
  status: AdvisorRecommendationStatus;
  resolvedOptionId?: string;
  resolutionNote?: string;
  trustChange?: number;
  createdSeasonYear: number;
  createdRound?: number;
  expiresSeasonYear?: number;
  expiresRound?: number;
  departmentId?: DepartmentId;
};

export type DepartmentId =
  | 'Technical'
  | 'Aerodynamics'
  | 'Engineering'
  | 'RaceOperations'
  | 'Commercial'
  | 'PoliticalLegal'
  | 'DriverManagement'
  | 'Academy';

export const DEPARTMENT_IDS: readonly DepartmentId[] = [
  'Technical',
  'Aerodynamics',
  'Engineering',
  'RaceOperations',
  'Commercial',
  'PoliticalLegal',
  'DriverManagement',
  'Academy',
];

export type DepartmentMood = {
  departmentId: DepartmentId;
  morale: number;
  trustInPrincipal: number;
  strategicAlignment: number;
  workload: number;
  preferredPriority?: string;
  conflictReasons: string[];
  lastUpdatedSeasonYear: number;
  lastUpdatedRound?: number;
};

export type IntelligenceSubjectType =
  | 'Team'
  | 'Driver'
  | 'Staff'
  | 'Research'
  | 'Part'
  | 'Contract'
  | 'Politics'
  | 'Calendar';

export type IntelligenceReport = {
  id: string;
  subjectType: IntelligenceSubjectType;
  subjectId: string;
  targetTeamId?: string;
  title: string;
  summary: string;
  source: 'Scouting' | 'StaffContact' | 'Media' | 'PaddockRumor' | 'Supplier' | 'PoliticalContact';
  confidence: number;
  reliability: number;
  assessment: 'Unverified' | 'Plausible' | 'Likely' | 'Confirmed' | 'Disproven';
  status?: 'Active' | 'Resolved' | 'Dismissed' | 'Expired';
  hiddenTruth?: 'True' | 'False' | 'Mixed';
  category?: 'Development' | 'Performance' | 'Reliability' | 'DriverMarket' | 'Finance' | 'Politics' | 'Commercial';
  detailLevel?: 'Headline' | 'Briefing' | 'Detailed';
  gameplayRelevance?: 'Low' | 'Medium' | 'High' | 'Critical';
  visibility?: 'Private' | 'Public' | 'Leaked';
  possibleActions?: Array<'Investigate' | 'AskAdvisor' | 'Monitor' | 'Ignore'>;
  actionHistory?: Array<{ seasonYear: number; round?: number; action: string; outcome: string }>;
  aiKnownTeamIds?: string[];
  aiResponses?: Array<{ teamId: string; action: string; reason: string }>;
  revealedOutcome?: string;
  discoveredSeasonYear: number;
  discoveredRound?: number;
  expiresSeasonYear?: number;
  expiresRound?: number;
  actionTaken?: string;
};

export type IntelligenceAction = 'Investigate' | 'AskAdvisor' | 'Monitor' | 'Ignore';

export type CarLaunchApproach = 'Measured' | 'CommercialShowcase' | 'PerformanceStatement';
export type PreseasonTestingFocus = 'Balanced' | 'Performance' | 'Reliability' | 'RaceOperations' | 'Experimental';
export type PreseasonFlawArea = 'PowerUnit' | 'Aerodynamics' | 'Mechanical' | 'Reliability' | 'Operations';

export type PreseasonHiddenFlaw = {
  id: string;
  area: PreseasonFlawArea;
  severity: number;
  discovered: boolean;
  resolved: boolean;
  description: string;
};

export type PreseasonTestingReport = {
  day: number;
  headline: string;
  summary: string;
  paceSignal: number;
  reliabilitySignal: number;
  confidence: number;
};

export type PreseasonProgramState = {
  teamId: string;
  seasonYear: number;
  launchApproach?: CarLaunchApproach;
  launchCompleted: boolean;
  testingFocus?: PreseasonTestingFocus;
  testingCompleted: boolean;
  testingReports: PreseasonTestingReport[];
  hiddenFlaws: PreseasonHiddenFlaw[];
  readiness: { pace: number; reliability: number; operations: number; knowledge: number; overall: number };
  aiDecisionReason?: string;
};

export type PreseasonRivalReport = {
  id: string;
  teamId: string;
  claim: string;
  confidence: number;
  assessment: 'Unverified' | 'Plausible' | 'Likely';
  hiddenTruth: 'True' | 'False' | 'Mixed';
};

export type PreseasonHubState = {
  seasonYear: number;
  programs: Record<string, PreseasonProgramState>;
  rivalReports: PreseasonRivalReport[];
};

export type ContractPartyType = 'Driver' | 'Staff' | 'TeamPrincipal';

export type ContractClauseType =
  | 'NumberOneStatus'
  | 'EqualTreatment'
  | 'PerformanceExit'
  | 'ChampionshipExit'
  | 'SeatGuarantee'
  | 'FacilityInvestment'
  | 'ResearchDirection'
  | 'ResearchSuccessBonus'
  | 'SalaryEscalator'
  | 'ReleaseFee'
  | 'SponsorObligation'
  | 'MediaObligation';

export type ContractClause = {
  id: string;
  contractId: string;
  teamId: string;
  partyType: ContractPartyType;
  partyId: string;
  clauseType: ContractClauseType;
  title?: string;
  description: string;
  status: 'Active' | 'Satisfied' | 'Breached' | 'Waived' | 'Expired';
  risk?: 'Secure' | 'Watch' | 'AtRisk' | 'Triggered';
  triggerDescription?: string;
  breachConsequence?: string;
  renegotiationCost?: number;
  mediaRisk?: 'Low' | 'Medium' | 'High';
  visibleToPlayer?: boolean;
  aiRelevant?: boolean;
  startSeasonYear: number;
  dueSeasonYear?: number;
  dueRound?: number;
  threshold?: number;
  financialValue?: number;
  linkedPromiseId?: string;
  fulfilledSeasonYear?: number;
  breachedSeasonYear?: number;
  lastEvaluatedSeasonYear?: number;
  lastEvaluatedRound?: number;
  resolutionNote?: string;
};

export type ContractBreachResponse = 'Apologize' | 'Compensate' | 'PromiseCorrection' | 'AcceptDamage';

export type TeamCultureAxis =
  | 'Innovation'
  | 'Discipline'
  | 'PeopleFocus'
  | 'PoliticalFocus'
  | 'RiskAppetite'
  | 'CommercialFocus';

export const TEAM_CULTURE_AXES: readonly TeamCultureAxis[] = [
  'Innovation',
  'Discipline',
  'PeopleFocus',
  'PoliticalFocus',
  'RiskAppetite',
  'CommercialFocus',
];

export type TeamCultureTag =
  | 'EnginePowerhouse'
  | 'AeroInnovator'
  | 'ReliabilityRebuilder'
  | 'StrategyTeam'
  | 'TireWhisperer'
  | 'DevelopmentFactory'
  | 'PoliticalOperator'
  | 'DriverAcademy'
  | 'CommercialMachine'
  | 'Traditionalist'
  | 'Chaotic';

export type TeamCultureDrift = {
  id: string;
  seasonYear: number;
  round?: number;
  axis: TeamCultureAxis;
  amount: number;
  reason: string;
};

export type TeamCultureState = {
  teamId: string;
  axes: Record<TeamCultureAxis, number>;
  tags: TeamCultureTag[];
  cohesion: number;
  stability: number;
  driftHistory: TeamCultureDrift[];
};

export type RivalRelationshipTag =
  | 'TechnicalRival'
  | 'PoliticalBlocAlly'
  | 'SupplierPartner'
  | 'StaffPoachingRival'
  | 'DriverMarketRival'
  | 'HistoricRival'
  | 'CommercialAlly';

export type RivalRelationshipEvent = {
  id: string;
  seasonYear: number;
  round?: number;
  amount: number;
  reason: string;
  category: 'Sporting' | 'Technical' | 'Political' | 'Commercial' | 'Staff' | 'Driver';
};

export type RivalRelationship = {
  id: string;
  teamAId: string;
  teamBId: string;
  score: number;
  sportingRespect: number;
  politicalAlignment: number;
  commercialTrust: number;
  technicalSuspicion: number;
  tags: RivalRelationshipTag[];
  history: RivalRelationshipEvent[];
};

export type LegacyRecordCategory =
  | 'RaceWin'
  | 'Podium'
  | 'Pole'
  | 'FastestLap'
  | 'DriverTitle'
  | 'ConstructorTitle'
  | 'TeamTurnaround'
  | 'ResearchBreakthrough'
  | 'PoliticalVictory'
  | 'StaffDevelopment';

export type LegacyMilestone = {
  id: string;
  category: LegacyRecordCategory;
  seasonYear: number;
  round?: number;
  teamId?: string;
  subjectId?: string;
  title: string;
  description: string;
  legacyPoints: number;
};

export type HallOfFameEntry = {
  id: string;
  subjectType: 'Driver' | 'TeamPrincipal' | 'Staff' | 'Team';
  subjectId: string;
  inductionSeasonYear: number;
  title: string;
  summary: string;
};

export type AlternateHistoryRecord = {
  id: string;
  seasonYear: number;
  category: string;
  historicalOutcome?: string;
  careerOutcome: string;
  significance: number;
};

export type CareerLegacyState = {
  score: number;
  milestones: LegacyMilestone[];
  hallOfFame: HallOfFameEntry[];
  alternateHistory: AlternateHistoryRecord[];
};

export type NarrativeStory = {
  id: string;
  threadId?: string;
  category: 'Technical' | 'Driver' | 'Staff' | 'Financial' | 'Political' | 'Commercial' | 'Rivalry' | 'Legacy';
  headline: string;
  summary: string;
  urgency: 'Background' | 'Developing' | 'Important' | 'Critical';
  confidence: number;
  status: 'Active' | 'Resolved' | 'Expired';
  createdSeasonYear: number;
  createdRound?: number;
  updatedSeasonYear: number;
  updatedRound?: number;
  linkedTeamIds: string[];
  linkedDriverIds: string[];
  linkedStaffIds: string[];
  actionRoute?: string;
  sourceEventIds: string[];
};

export type Phase18FoundationState = {
  version: typeof PHASE_18_FOUNDATION_VERSION;
  principalIdentity: PrincipalIdentityState;
  aiPrincipalIdentities: Record<string, PrincipalIdentityState>;
  advisorRecommendations: AdvisorRecommendation[];
  departmentMoods: Record<string, Record<DepartmentId, DepartmentMood>>;
  intelligenceReports: IntelligenceReport[];
  preseason?: PreseasonHubState;
  contractClauses: ContractClause[];
  teamCultures: Record<string, TeamCultureState>;
  rivalRelationships: Record<string, RivalRelationship>;
  legacy: CareerLegacyState;
  narratives: NarrativeStory[];
};
