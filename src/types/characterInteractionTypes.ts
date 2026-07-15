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
  source: 'Interaction' | 'Request' | 'Ambition' | 'Connection' | 'Dispute' | 'Commitment' | 'Initiative' | 'Mandate';
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

export type CharacterConnectionKind =
  | 'Alliance'
  | 'Rivalry'
  | 'WorkingRelationship'
  | 'Mentorship'
  | 'Patronage'
  | 'PoliticalRelationship';

export type CharacterConnectionBand = 'Allied' | 'Friendly' | 'Neutral' | 'Tense' | 'Hostile';

export type CharacterConnection = {
  id: string;
  characterA: CharacterInteractionTarget;
  characterB: CharacterInteractionTarget;
  kind: CharacterConnectionKind;
  affinity: number;
  strength: number;
  basis: string;
  band: CharacterConnectionBand;
  lastReportedBand: CharacterConnectionBand;
  lastUpdatedSeason: number;
  lastUpdatedRound: number;
  manualAffinityAdjustment?: number;
};

export type CharacterDisputeStatus = 'Active' | 'Mediated' | 'Resolved' | 'Escalating';

export type CharacterDispute = {
  id: string;
  connectionId: string;
  characterA: CharacterInteractionTarget;
  characterB: CharacterInteractionTarget;
  issue: string;
  status: CharacterDisputeStatus;
  intensity: number;
  startedSeason: number;
  startedRound: number;
  lastReviewedSeason?: number;
  lastReviewedRound?: number;
  resolutionLabel?: string;
};

export type CharacterFaction = {
  id: string;
  name: string;
  kind: 'GarageAlliance' | 'DriverCamp' | 'LeadershipCircle' | 'PaddockBloc';
  memberKeys: string[];
  cohesion: number;
  influence: number;
  stance: 'Aligned' | 'Uneasy' | 'Fractured';
  description: string;
  lastUpdatedSeason: number;
  lastUpdatedRound: number;
};

export type CharacterCommitment = {
  id: string;
  sourceEventId: string;
  target: CharacterInteractionTarget;
  kind: 'DriverPromise' | 'DepartmentSupport' | 'CompetitiveTarget' | 'PrivateChannel';
  title: string;
  description: string;
  measureLabel: string;
  currentValue: number;
  targetValue: number;
  direction: 'AtLeast' | 'AtMost';
  createdSeason: number;
  createdRound: number;
  dueSeason: number;
  dueRound: number;
  status: 'Active' | 'Fulfilled' | 'Broken';
  linkedPromiseId?: string;
  resolvedSeason?: number;
  resolvedRound?: number;
};

export type CharacterInfluenceStance =
  | 'Champion'
  | 'Supportive'
  | 'Neutral'
  | 'Resistant'
  | 'Obstructive';

export type CharacterInfluenceProfile = {
  target: CharacterInteractionTarget;
  power: number;
  support: number;
  stance: CharacterInfluenceStance;
  basis: string[];
  effectLabel: string;
  lastReportedStance: CharacterInfluenceStance;
  lastUpdatedSeason: number;
  lastUpdatedRound: number;
  lastAppliedSeason?: number;
  lastAppliedRound?: number;
};

export type CharacterInitiativeKind =
  | 'DriverLeadership'
  | 'DriverChallenge'
  | 'StaffProposal'
  | 'StaffResistance'
  | 'OwnerBacking'
  | 'OwnerIntervention'
  | 'RivalOutreach'
  | 'RivalPressure';

export type CharacterInitiative = {
  id: string;
  target: CharacterInteractionTarget;
  kind: CharacterInitiativeKind;
  title: string;
  description: string;
  motive: string;
  powerAtStart: number;
  supportAtStart: number;
  startedSeason: number;
  startedRound: number;
  status: 'Active' | 'Accepted' | 'Compromised' | 'Rejected' | 'Expired';
  optionId?: string;
  optionLabel?: string;
  outcome?: string;
  effects?: string[];
  resolvedSeason?: number;
  resolvedRound?: number;
};

export type CharacterMandate = {
  id: string;
  sourceInitiativeId: string;
  target: CharacterInteractionTarget;
  kind: 'GarageLeadership' | 'DepartmentAuthority' | 'OwnershipBacking' | 'PaddockChannel';
  authority: 'Full' | 'Limited';
  title: string;
  description: string;
  measureLabel: string;
  currentValue: number;
  targetValue: number;
  createdSeason: number;
  createdRound: number;
  dueSeason: number;
  dueRound: number;
  status: 'Active' | 'Succeeded' | 'Failed' | 'Revoked';
  lastAppliedSeason?: number;
  lastAppliedRound?: number;
  resolvedSeason?: number;
  resolvedRound?: number;
  outcome?: string;
};

export type CharacterInteractionState = {
  version: 10;
  history: CharacterInteractionRecord[];
  lastInteractionByTarget: Record<string, { seasonYear: number; round: number }>;
  recruitmentInterest: Record<string, number>;
  requestHistory: CharacterRequestResolution[];
  opinions: Record<string, CharacterOpinion>;
  memories: CharacterMemory[];
  ambitions: CharacterAmbition[];
  connections: CharacterConnection[];
  factions: CharacterFaction[];
  disputes: CharacterDispute[];
  commitments: CharacterCommitment[];
  influence: CharacterInfluenceProfile[];
  initiatives: CharacterInitiative[];
  mandates: CharacterMandate[];
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
