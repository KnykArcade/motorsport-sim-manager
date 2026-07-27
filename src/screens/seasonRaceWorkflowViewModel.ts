import type { CareerPhase } from '../types/careerPhaseTypes';

export type SeasonWorkflowStage =
  | 'preseason'
  | 'calendar'
  | 'paddock'
  | 'briefing'
  | 'weekend'
  | 'review'
  | 'season'
  | 'offseason';

export const SEASON_WORKFLOW_STAGES: ReadonlyArray<{
  id: SeasonWorkflowStage;
  label: string;
  shortLabel: string;
}> = [
  { id: 'preseason', label: 'Preseason', shortLabel: 'Pre' },
  { id: 'calendar', label: 'Calendar', shortLabel: 'Cal' },
  { id: 'paddock', label: 'Paddock Week', shortLabel: 'Pad' },
  { id: 'briefing', label: 'Race Briefing', shortLabel: 'Brief' },
  { id: 'weekend', label: 'Race Weekend', shortLabel: 'Race' },
  { id: 'review', label: 'Post-Race', shortLabel: 'Review' },
  { id: 'season', label: 'Season Review', shortLabel: 'Season' },
  { id: 'offseason', label: 'Offseason', shortLabel: 'Off' },
];

const PHASE_TO_STAGE: Partial<Record<CareerPhase, SeasonWorkflowStage>> = {
  pre_season_setup: 'preseason',
  paddock_week: 'paddock',
  pre_race_briefing: 'briefing',
  race_weekend: 'weekend',
  post_race_review: 'review',
};

export function workflowStageForPhase(
  phase: CareerPhase | undefined,
  seasonComplete = false,
): SeasonWorkflowStage {
  if (seasonComplete && phase !== 'post_race_review') return 'season';
  return (phase && PHASE_TO_STAGE[phase]) || 'calendar';
}

export function workflowStageIndex(stage: SeasonWorkflowStage): number {
  return Math.max(0, SEASON_WORKFLOW_STAGES.findIndex((entry) => entry.id === stage));
}

export function workflowStageState(
  item: SeasonWorkflowStage,
  active: SeasonWorkflowStage,
): 'complete' | 'active' | 'upcoming' {
  const itemIndex = workflowStageIndex(item);
  const activeIndex = workflowStageIndex(active);
  if (itemIndex < activeIndex) return 'complete';
  if (itemIndex === activeIndex) return 'active';
  return 'upcoming';
}

export function selectedWorkflowEntry<T extends { id: string }>(
  entries: readonly T[],
  selectedId: string | undefined,
  preferredId?: string,
): T | undefined {
  return entries.find((entry) => entry.id === selectedId)
    ?? entries.find((entry) => entry.id === preferredId)
    ?? entries[0];
}
