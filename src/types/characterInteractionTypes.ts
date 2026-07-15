export type CharacterInteractionTargetType =
  | 'Driver'
  | 'Staff'
  | 'StaffCandidate'
  | 'Owner'
  | 'RivalPrincipal';

export type CharacterInteractionAction =
  | 'PrivateConversation'
  | 'PraisePerformance'
  | 'ChallengePerformance'
  | 'MediateConflict'
  | 'DiscussFuture'
  | 'SeekAdvice'
  | 'PraiseStaffWork'
  | 'SetExpectations'
  | 'ApproachRecruitment'
  | 'PresentLongTermPlan'
  | 'RequestOwnerBacking'
  | 'ReviewBudgetDiscipline'
  | 'OpenPrincipalDialogue'
  | 'ExchangePaddockInformation'
  | 'ApplyPublicPressure';

export type CharacterInteractionTarget = {
  type: CharacterInteractionTargetType;
  id: string;
  name: string;
  teamId?: string;
};

export type CharacterInteractionRecord = {
  id: string;
  targetType: CharacterInteractionTargetType;
  targetId: string;
  targetName: string;
  teamId?: string;
  action: CharacterInteractionAction;
  actionLabel: string;
  seasonYear: number;
  round: number;
  outcome: string;
  tone: 'Positive' | 'Mixed' | 'Negative' | 'Informational';
  effects: string[];
};

export type CharacterAgenda =
  | 'CompetitiveStatus'
  | 'CareerSecurity'
  | 'TeamHarmony'
  | 'FinancialReward'
  | 'Recognition'
  | 'TechnicalFreedom'
  | 'Resources'
  | 'Stability'
  | 'ImmediateResults'
  | 'FinancialDiscipline'
  | 'LongTermGrowth'
  | 'Prestige'
  | 'Tradition'
  | 'Cooperation'
  | 'PoliticalInfluence'
  | 'TechnicalAdvantage'
  | 'PublicStanding';

export type CharacterOpinion = {
  targetType: CharacterInteractionTargetType;
  targetId: string;
  targetName: string;
  teamId?: string;
  score: number;
  trust: number;
  respect: number;
  agenda: CharacterAgenda;
  traits: string[];
  lastUpdatedSeason: number;
  lastUpdatedRound: number;
};

export type CharacterMemory = {
  id: string;
  targetType: CharacterInteractionTargetType;
  targetId: string;
  targetName: string;
  teamId?: string;
  seasonYear: number;
  round: number;
  source: 'Interaction' | 'Request' | 'Ambition';
  label: string;
  description: string;
  tone: CharacterInteractionRecord['tone'];
  strength: 1 | 2 | 3 | 4 | 5;
  opinionDelta: number;
  effects: string[];
};

export type CharacterAmbitionStatus = 'Active' | 'Satisfied' | 'Failed';
export type CharacterAmbitionPressure = 'Calm' | 'Watchful' | 'Pressing' | 'Ultimatum';

export type CharacterAmbition = {
  id: string;
  targetType: CharacterInteractionTargetType;
  targetId: string;
  targetName: string;
  teamId?: string;
  agenda: CharacterAgenda;
  title: string;
  description: string;
  measureLabel: string;
  currentValue: number;
  targetValue: number;
  startedSeason: number;
  startedRound: number;
  deadlineSeason: number;
  deadlineRound: number;
  status: CharacterAmbitionStatus;
  pressure: CharacterAmbitionPressure;
  resolvedSeason?: number;
  resolvedRound?: number;
  outcome?: string;
};

export type CharacterInteractionState = {
  version: 4;
  history: CharacterInteractionRecord[];
  lastInteractionByTarget: Record<string, { seasonYear: number; round: number }>;
  recruitmentInterest: Record<string, number>;
  requestHistory: CharacterRequestResolution[];
  opinions: Record<string, CharacterOpinion>;
  memories: CharacterMemory[];
  ambitions: CharacterAmbition[];
};

export type CharacterRequestKind =
  | 'DriverConcern'
  | 'StaffSupport'
  | 'OwnerReview'
  | 'RivalApproach';

export type CharacterRequestResolution = {
  id: string;
  eventId: string;
  requestKind: CharacterRequestKind;
  targetType: CharacterInteractionTargetType;
  targetId: string;
  targetName: string;
  teamId?: string;
  seasonYear: number;
  round: number;
  optionId: string;
  optionLabel: string;
  outcome: string;
  tone: CharacterInteractionRecord['tone'];
  effects: string[];
};
