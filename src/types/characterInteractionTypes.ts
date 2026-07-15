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

export type CharacterInteractionState = {
  version: 1;
  history: CharacterInteractionRecord[];
  lastInteractionByTarget: Record<string, { seasonYear: number; round: number }>;
  recruitmentInterest: Record<string, number>;
};
