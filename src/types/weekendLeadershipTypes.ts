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
