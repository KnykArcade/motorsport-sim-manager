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

export type AdvisorCouncilRead = {
  alignment: 'BroadlyAligned' | 'MixedRoom' | 'InternalResistance' | 'StrongObjection';
  label: string;
  tone: 'positive' | 'caution' | 'warning';
  read: string;
  watch: string;
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

export function advisorCouncilReadForOption(
  recommendations: AdvisorRecommendation[],
  selectedOptionId: string,
): AdvisorCouncilRead {
  const preview = advisorOptionImpactPreview(recommendations, selectedOptionId);
  if (preview.supporting > 0 && preview.overruled === 0) {
    return {
      alignment: 'BroadlyAligned',
      label: 'Council broadly aligned',
      tone: 'positive',
      read: 'This looks like the room would mostly understand the call.',
      watch: 'Still watch whether expectations rise after you follow the advice.',
    };
  }
  if (preview.highConfidenceObjections > 0) {
    return {
      alignment: 'StrongObjection',
      label: 'Strong objection possible',
      tone: 'warning',
      read: 'A senior voice may feel overruled if you choose this path.',
      watch: 'Watch for internal trust or strategic alignment to become more fragile.',
    };
  }
  if (preview.overruled > preview.supporting) {
    return {
      alignment: 'InternalResistance',
      label: 'Some internal resistance likely',
      tone: 'caution',
      read: 'The council may need extra reassurance before this feels settled.',
      watch: 'Watch for department confidence if results or execution dip.',
    };
  }
  return {
    alignment: 'MixedRoom',
    label: 'Council split',
    tone: 'caution',
    read: 'There is enough support to justify the call, but not enough to silence debate.',
    watch: 'Watch which department owns the follow-through after the decision.',
  };
}
