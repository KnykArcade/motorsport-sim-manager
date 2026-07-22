import type { GameState } from '../game/careerState';
import { recruitmentDecisionDesk } from './recruitmentDecisionViewModel';
import type { ScoutedEntityType } from '../types/scoutingTypes';

export type RecruitmentPipelineStage =
  | 'Scouting'
  | 'Decision ready'
  | 'Rival pressure'
  | 'Queued signing'
  | 'Confirmed move';

export type RecruitmentPipelineItem = {
  entityId: string;
  entityType: ScoutedEntityType;
  name: string;
  stage: RecruitmentPipelineStage;
  detail: string;
  deadline?: string;
  rivalTeam?: string;
  knowledgePercentage: number;
  nextAction: {
    label: string;
    route: string;
  };
};

function targetIds(state: GameState): string[] {
  const scouting = state.scouting;
  if (!scouting) return [];
  const ids = new Set<string>();
  for (const target of [
    ...(scouting.activeAssignments ?? []),
    ...(scouting.shortlist ?? []),
    ...Object.values(scouting.reports).map((report) => ({
      entityId: report.entityId,
      entityType: report.entityType,
    })),
  ]) {
    ids.add(`${target.entityType}:${target.entityId}`);
  }
  for (const story of state.transferCalendar?.stories ?? []) {
    if (story.targetType === 'MarketDriver') ids.add(`Driver:${story.targetId}`);
  }
  for (const signing of state.pendingSignings ?? []) {
    if (signing.source === 'market') ids.add(`Driver:${signing.sourceId}`);
  }
  return [...ids];
}

function pipelineStage(
  state: GameState,
  desk: NonNullable<ReturnType<typeof recruitmentDecisionDesk>>,
): RecruitmentPipelineItem {
  const marketStory = state.transferCalendar?.stories
    ?.filter((story) => story.targetType === 'MarketDriver' && story.targetId === desk.entityId)
    .sort((a, b) => b.startedRound - a.startedRound)[0];
  const signing = (state.pendingSignings ?? []).find(
    (entry) => entry.source === 'market' && entry.sourceId === desk.entityId,
  );

  if (signing) {
    return {
      ...desk,
      stage: 'Queued signing',
      detail: 'Queued for the next season; lineup confirmation remains player-controlled.',
      deadline: 'Season end',
      nextAction: { label: 'Confirm Lineup', route: '/offseason' },
    };
  }
  if (marketStory?.stage === 'Contested' || marketStory?.stage === 'Offer') {
    const contested = marketStory.stage === 'Contested';
    return {
      ...desk,
      stage: 'Rival pressure',
      detail: contested
        ? 'Your queued bid is being challenged before the market deadline.'
        : `${marketStory.destinationTeamName} is pursuing this target.`,
      deadline: `Round ${marketStory.deadlineRound}`,
      rivalTeam: marketStory.destinationTeamName,
      nextAction: {
        label: contested ? 'Review Contested Bid' : 'Review Rival Offer',
        route: `/market?target=${encodeURIComponent(desk.entityId)}`,
      },
    };
  }
  if (marketStory?.stage === 'Confirmed') {
    return {
      ...desk,
      stage: 'Confirmed move',
      detail: `The market move to ${marketStory.destinationTeamName} is confirmed for the next season.`,
      rivalTeam: marketStory.destinationTeamName,
      nextAction: {
        label: 'Review Market Outcome',
        route: `/market?target=${encodeURIComponent(desk.entityId)}`,
      },
    };
  }
  const ready = desk.status === 'Shortlisted' || desk.status === 'Full report ready';
  return {
    ...desk,
    stage: ready ? 'Decision ready' : 'Scouting',
    detail: desk.recommendation,
  };
}

export function recruitmentPipeline(state: GameState): RecruitmentPipelineItem[] {
  return targetIds(state)
    .map((key) => {
      const separator = key.indexOf(':');
      const entityType = key.slice(0, separator) as ScoutedEntityType;
      const entityId = key.slice(separator + 1);
      const desk = recruitmentDecisionDesk(state, entityId);
      return desk?.entityType === entityType ? pipelineStage(state, desk) : null;
    })
    .filter((item): item is RecruitmentPipelineItem => item !== null)
    .sort((a, b) => {
      const order: Record<RecruitmentPipelineStage, number> = {
        'Rival pressure': 0,
        'Queued signing': 1,
        'Decision ready': 2,
        Scouting: 3,
        'Confirmed move': 4,
      };
      return order[a.stage] - order[b.stage] || a.name.localeCompare(b.name);
    });
}
