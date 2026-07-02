// Career phase system types for the between-race management flow.

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

export type PaddockEventOption = {
  id: string;
  label: string;
  description: string;
  budgetChange?: number;
  carStatChange?: Partial<Record<string, number>>;
  moraleChange?: number;
  reliabilityChange?: number;
  risk?: number;
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
};
