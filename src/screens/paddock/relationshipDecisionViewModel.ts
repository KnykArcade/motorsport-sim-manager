import type { GameState } from '../../game/careerState';
import type { PaddockEvent } from '../../types/careerPhaseTypes';
import type { CharacterInteractionTarget } from '../../types/characterInteractionTypes';
import type { AdvisorRecommendation } from '../../types/phase18Types';
import {
  relationshipAttentionForTarget,
  type RelationshipAttentionProfile,
} from '../../sim/relationshipAttentionEngine';
import { advisorTrustChangeForChoice } from '../../sim/phase18AdvisorEngine';

export type AdvisorOptionImpactPreview = {
  supporting: number;
  overruled: number;
  netTrustChange: number;
  highConfidenceObjections: number;
};

function eventTargets(event: PaddockEvent): CharacterInteractionTarget[] {
  if (event.characterRequest) {
    return [{
      type: event.characterRequest.targetType,
      id: event.characterRequest.targetId,
      name: event.characterRequest.targetName,
      teamId: event.characterRequest.teamId,
    }];
  }
  if (event.characterDispute) {
    return [event.characterDispute.characterA, event.characterDispute.characterB];
  }
  if (event.characterInitiative) return [event.characterInitiative.target];
  if (event.characterBreakingPoint) return [event.characterBreakingPoint.target];
  return [];
}

export function relationshipStakeholdersForDecision(
  state: GameState,
  event: PaddockEvent,
): RelationshipAttentionProfile[] {
  const seen = new Set<string>();
  return eventTargets(event)
    .filter((target) => {
      const key = `${target.type}:${target.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((target) => relationshipAttentionForTarget(state, target));
}

export function advisorOptionImpactPreview(
  recommendations: AdvisorRecommendation[],
  selectedOptionId: string,
): AdvisorOptionImpactPreview {
  const pending = recommendations.filter((recommendation) => recommendation.status === 'Pending');
  return pending.reduce<AdvisorOptionImpactPreview>((preview, recommendation) => {
    const supporting = recommendation.recommendedOptionId === selectedOptionId;
    if (supporting) preview.supporting += 1;
    else {
      preview.overruled += 1;
      if (recommendation.confidence >= 75) preview.highConfidenceObjections += 1;
    }
    preview.netTrustChange += advisorTrustChangeForChoice(recommendation, selectedOptionId);
    return preview;
  }, { supporting: 0, overruled: 0, netTrustChange: 0, highConfidenceObjections: 0 });
}
