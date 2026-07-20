import type { GameState } from '../../game/careerState';
import type {
  CharacterInteractionTargetType,
  CharacterMemory,
} from '../../types/characterInteractionTypes';
import type { AdvisorRecommendation, CollectiveStakeholderActionRecord } from '../../types/phase18Types';

export type RelationshipActivityTone = CharacterMemory['tone'];

export type RelationshipActivityItem = {
  id: string;
  seasonYear: number;
  round: number;
  targetName: string;
  targetType: CharacterInteractionTargetType | 'Department' | 'Collective';
  hierarchyRank: string;
  hierarchyLabel: string;
  source: CharacterMemory['source'] | 'AdvisorCouncil' | 'CommitteeAction';
  title: string;
  detail: string;
  tone: RelationshipActivityTone;
  effects: string[];
  opinionDelta?: number;
};

export type RelationshipActivitySummary = {
  total: number;
  positive: number;
  negative: number;
  mixed: number;
  informational: number;
  netOpinionDelta: number;
  latest?: RelationshipActivityItem;
};

export function relationshipActivityHierarchy(
  targetType: RelationshipActivityItem['targetType'],
  targetName?: string,
): Pick<RelationshipActivityItem, 'hierarchyRank' | 'hierarchyLabel'> {
  if (targetType === 'Owner') return { hierarchyRank: '1', hierarchyLabel: 'Owner relationship' };
  if (targetType === 'Driver') return { hierarchyRank: '2–3', hierarchyLabel: 'Driver relationship' };
  if (targetType === 'Staff' || targetType === 'Department') return { hierarchyRank: '4', hierarchyLabel: 'Team & department relationship' };
  if (targetType === 'Collective') {
    return targetName === 'Commercial partners & supporters'
      ? { hierarchyRank: '5', hierarchyLabel: 'Commercial relationship' }
      : { hierarchyRank: '4', hierarchyLabel: 'Team & department relationship' };
  }
  if (targetType === 'RivalPrincipal') return { hierarchyRank: '7', hierarchyLabel: 'Rival principal relationship' };
  if (targetType === 'StaffCandidate') return { hierarchyRank: '8', hierarchyLabel: 'External talent relationship' };
  return { hierarchyRank: '4', hierarchyLabel: 'Team relationship' };
}

export function relationshipActivitySummary(
  activity: RelationshipActivityItem[],
): RelationshipActivitySummary {
  return activity.reduce<RelationshipActivitySummary>((summary, item, index) => {
    summary.total += 1;
    summary[item.tone === 'Positive'
      ? 'positive'
      : item.tone === 'Negative'
        ? 'negative'
        : item.tone === 'Mixed'
          ? 'mixed'
          : 'informational'] += 1;
    summary.netOpinionDelta += item.opinionDelta ?? 0;
    if (index === 0) summary.latest = item;
    return summary;
  }, {
    total: 0,
    positive: 0,
    negative: 0,
    mixed: 0,
    informational: 0,
    netOpinionDelta: 0,
  });
}

export function relationshipActivityFromSources(
  memories: CharacterMemory[],
  recommendations: AdvisorRecommendation[],
  collectiveActions: CollectiveStakeholderActionRecord[],
  selectedTeamId: string,
): RelationshipActivityItem[] {
  const items = new Map<string, RelationshipActivityItem>();

  for (const memory of memories) {
    const hierarchy = relationshipActivityHierarchy(memory.targetType, memory.targetName);
    items.set(`memory:${memory.id}`, {
      id: `memory:${memory.id}`,
      seasonYear: memory.seasonYear,
      round: memory.round,
      targetName: memory.targetName,
      targetType: memory.targetType,
      ...hierarchy,
      source: memory.source,
      title: memory.label,
      detail: memory.description,
      tone: memory.tone,
      effects: memory.effects,
      opinionDelta: memory.opinionDelta,
    });
  }

  for (const recommendation of recommendations) {
    if (recommendation.teamId !== selectedTeamId) continue;
    if (recommendation.status !== 'Accepted' && recommendation.status !== 'Overruled') continue;
    const trustChange = recommendation.trustChange ?? 0;
    const hierarchy = relationshipActivityHierarchy('Department');
    items.set(`advisor:${recommendation.id}`, {
      id: `advisor:${recommendation.id}`,
      seasonYear: recommendation.createdSeasonYear,
      round: recommendation.createdRound ?? 0,
      targetName: recommendation.advisorName ?? recommendation.advisorRole,
      targetType: 'Department',
      ...hierarchy,
      source: 'AdvisorCouncil',
      title: recommendation.status === 'Accepted'
        ? `Advice followed: ${recommendation.recommendation}`
        : `Advice overruled: ${recommendation.recommendation}`,
      detail: recommendation.resolutionNote ?? recommendation.rationale,
      tone: trustChange > 0 ? 'Positive' : trustChange < 0 ? 'Negative' : 'Informational',
      effects: recommendation.trustChange == null
        ? []
        : [`${recommendation.departmentId ?? 'Department'} trust ${trustChange > 0 ? '+' : ''}${trustChange}`],
    });
  }

  for (const action of collectiveActions) {
    const targetName = action.stakeholderId === 'Departments' ? 'Team & departments' : 'Commercial partners & supporters';
    const hierarchy = relationshipActivityHierarchy('Collective', targetName);
    items.set(`collective:${action.id}`, {
      id: `collective:${action.id}`,
      seasonYear: action.seasonYear,
      round: action.round,
      targetName,
      targetType: 'Collective',
      ...hierarchy,
      source: 'CommitteeAction',
      title: action.label,
      detail: action.outcome,
      tone: 'Positive',
      effects: action.effects,
    });
  }

  return [...items.values()].sort((a, b) =>
    b.seasonYear - a.seasonYear
      || b.round - a.round
      || b.id.localeCompare(a.id));
}

export function currentRelationshipActivity(
  state: Pick<GameState, 'selectedTeamId' | 'characterInteractions' | 'phase18'>,
): RelationshipActivityItem[] {
  return relationshipActivityFromSources(
    state.characterInteractions?.memories ?? [],
    state.phase18?.advisorRecommendations ?? [],
    state.phase18?.collectiveStakeholderActions ?? [],
    state.selectedTeamId,
  );
}
