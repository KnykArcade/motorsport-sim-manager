import type { RaceWeekendPackageType } from './raceWeekendPackageTypes';
import type { QualifyingTyreApproach } from './simTypes';

export type WeekendRecommendationResolution =
  | 'Accepted'
  | 'Modified'
  | 'Declined'
  | 'Delegated';

export type WeekendPlanDriver = {
  driverId: string;
  gridPosition: number;
  qualifyingPlanId: string;
  qualifyingRuns: number;
  qualifyingTyreApproach: QualifyingTyreApproach;
  raceStrategyId: string;
  instructionId: string;
  setupConfidence: number;
  parcFermeLocked: boolean;
};

export type ConfirmedWeekendPlan = {
  raceId: string;
  teamId: string;
  seasonYear: number;
  round: number;
  preparationFocus: string;
  packageType: RaceWeekendPackageType;
  weatherCondition: string;
  practiceKnowledge: {
    setup: number;
    tyres: number;
    reliability: number;
  };
  drivers: WeekendPlanDriver[];
  recommendationResolutions: Array<{
    recommendationId: string;
    resolution: WeekendRecommendationResolution;
  }>;
  unresolvedWarningCount: number;
};

export type GarageAddressTone =
  | 'CalmExecute'
  | 'EncourageTrust'
  | 'DemandResult'
  | 'AttackOpportunity'
  | 'ProtectFinish'
  | 'ProvePoint';

export type GarageReactionLabel =
  | 'Confident'
  | 'Reassured'
  | 'Focused'
  | 'Concerned'
  | 'Frustrated'
  | 'Confused';

export type GarageFollowUpType = 'Reassure' | 'Challenge' | 'ClarifyPlan';

export type GarageAddressDriverReaction = {
  driverId: string;
  reaction: GarageReactionLabel;
  reason: string;
  fit: number;
  performanceModifier: number;
  mistakeRiskMultiplier: number;
  trustDelta: number;
};

export type GarageAddressAccountability = {
  resultSummary: string;
  planComparison: string;
  trustOutcome: 'BuiltTrust' | 'Neutral' | 'DamagedTrust';
  supportingEvidence: string[];
};

export type GarageAddressRecord = {
  raceId: string;
  teamId: string;
  seasonYear: number;
  round: number;
  tone: GarageAddressTone;
  messageLabel: string;
  delegated: boolean;
  recommendedTone: GarageAddressTone;
  recommendationReason: string;
  reactions: GarageAddressDriverReaction[];
  followUp?: {
    driverId: string;
    type: GarageFollowUpType;
    label: string;
    reason: string;
    trustDelta: number;
  };
  accountability?: GarageAddressAccountability;
};
