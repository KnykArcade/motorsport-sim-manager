import type { GameState } from '../../game/careerState';
import type {
  CharacterInteractionTargetType,
  CharacterMemory,
} from '../../types/characterInteractionTypes';
import type { AdvisorRecommendation } from '../../types/phase18Types';

export type RelationshipActivityTone = CharacterMemory['tone'];

export type RelationshipActivityItem = {
  id: string;
  seasonYear: number;
  round: number;
  targetName: string;
  targetType: CharacterInteractionTargetType | 'Department';
  source: CharacterMemory['source'] | 'AdvisorCouncil';
  title: string;
  detail: string;
  tone: RelationshipActivityTone;
  effects: string[];
  opinionDelta?: number;
};

export function relationshipActivityFromSources(
  memories: CharacterMemory[],
  recommendations: AdvisorRecommendation[],
  selectedTeamId: string,
): RelationshipActivityItem[] {
  const items = new Map<string, RelationshipActivityItem>();

  for (const memory of memories) {
    items.set(`memory:${memory.id}`, {
      id: `memory:${memory.id}`,
      seasonYear: memory.seasonYear,
      round: memory.round,
      targetName: memory.targetName,
      targetType: memory.targetType,
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
    items.set(`advisor:${recommendation.id}`, {
      id: `advisor:${recommendation.id}`,
      seasonYear: recommendation.createdSeasonYear,
      round: recommendation.createdRound ?? 0,
      targetName: recommendation.advisorName ?? recommendation.advisorRole,
      targetType: 'Department',
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
    state.selectedTeamId,
  );
}
