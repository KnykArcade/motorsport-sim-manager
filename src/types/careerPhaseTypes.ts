// Career phase system types for the between-race management flow.

import type {
  CharacterInteractionTarget,
  CharacterInteractionTargetType,
  CharacterRequestKind,
} from './characterInteractionTypes';

export type CareerPhase =
  | 'pre_season_setup'
  | 'pre_race_briefing'
  | 'race_weekend'
  | 'post_race_review'
  | 'paddock_week';

export type PaddockEventCategory =
  | 'development'
  | 'driver_morale'
  | 'sponsor'
  | 'finance'
  | 'staff'
  | 'facility'
  | 'engine'
  | 'scouting'
  | 'regulation'
  | 'ai_team'
  | 'next_race'
  | 'general_team';

export type PaddockEventSeverity = 'info' | 'minor' | 'major' | 'critical';

export type PaddockEventOptionEffect = {
  type: 'budget' | 'carStat' | 'morale' | 'reliability' | 'sponsorConfidence' | 'news';
  target?: string;
  value: number;
  label?: string;
};

export type PaddockEventOption = {
  id: string;
  label: string;
  description: string;
  budgetChange?: number;
  carStatChange?: Partial<Record<string, number>>;
  moraleChange?: number;
  reliabilityChange?: number;
  risk?: number;
  effects?: PaddockEventOptionEffect[];
  requirement?: string;
};

export type PaddockEvent = {
  id: string;
  weekId: string;
  season: number;
  series: string;
  round: number;
  category: PaddockEventCategory;
  title: string;
  description: string;
  severity: PaddockEventSeverity;
  isRequiredDecision: boolean;
  options?: PaddockEventOption[];
  resolvedOptionId?: string;
  effectsApplied: boolean;
  createdAt: string;
  narrativeStoryId?: string;
  characterRequest?: {
    requestKind: CharacterRequestKind;
    targetType: CharacterInteractionTargetType;
    targetId: string;
    targetName: string;
    teamId?: string;
    rivalTeamId?: string;
    rivalTeamName?: string;
    counterofferCost?: number;
  };
  characterDispute?: {
    disputeId: string;
    characterA: CharacterInteractionTarget;
    characterB: CharacterInteractionTarget;
  };
  characterInitiative?: {
    initiativeId: string;
    target: CharacterInteractionTarget;
  };
  characterBreakingPoint?: {
    breakingPointId: string;
    target: CharacterInteractionTarget;
  };
};

export type PreseasonChecklistItem = {
  id: string;
  label: string;
  completed: boolean;
};

export type PreseasonApprovals = {
  teamOverview: boolean;
  budget: boolean;
  driverLineup: boolean;
  carDevelopment: boolean;
  sponsorsEngine: boolean;
  seasonObjectives: boolean;
  roundOnePreview: boolean;
};

export type CareerPhaseState = {
  currentPhase: CareerPhase;
  currentRound: number;
  lastCompletedRaceId?: string;
  nextRaceId?: string;
  paddockWeekId?: string;
  requiredDecisionsComplete: boolean;
  generatedEventsForCurrentWeek: boolean;
  generatedNewsForCurrentWeek: boolean;
  aiActionsProcessedForCurrentWeek: boolean;
  developmentUpdatesProcessedForCurrentWeek: boolean;
  preseasonSetupComplete: boolean;
  preseasonDecisionsComplete: boolean;
  preseasonEventsGenerated: boolean;
  preseasonEffectsApplied: boolean;
  paddockEvents: PaddockEvent[];
  announcedCompletedProjectIds: string[];
  racePrepFocus?: string;
  racePrepFocusApplied: boolean;
  budgetFocusBonusApplied: boolean;
  // Legacy checklist for backward compatibility with old saves.
  // Migrated to preseasonApprovals on load.
  preseasonChecklist?: PreseasonChecklistItem[];
  // New tab-based approval state.
  preseasonApprovals?: PreseasonApprovals;
};
