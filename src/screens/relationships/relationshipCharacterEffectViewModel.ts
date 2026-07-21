import type { GameState } from '../../game/careerState';
import {
  computeConfidenceState,
  overallConfidenceScore,
} from '../../sim/driverConfidenceEngine';
import {
  characterInfluenceRoundDelta,
  influenceForTarget,
} from '../../sim/characterInfluenceEngine';
import { RENEW_THRESHOLD, SACK_THRESHOLD } from '../../sim/principalEngine';
import type { RelationshipAttentionProfile } from '../../sim/relationshipAttentionEngine';
import type { CharacterInfluenceStance } from '../../types/characterInteractionTypes';

export type CharacterGameplayEffect = {
  label: string;
  value: string;
  detail: string;
  tone: 'Positive' | 'Neutral' | 'Negative';
};

function influenceDriftRead(stance: CharacterInfluenceStance | undefined, area: 'ownership' | 'driver'): string {
  if (!stance || stance === 'Neutral') return `Current influence is not creating visible ${area} drift.`;
  if (stance === 'Champion' || stance === 'Supportive') return area === 'ownership'
    ? 'Supportive influence may buy political patience between results.'
    : 'Supportive influence may steady morale and principal trust between race weekends.';
  return area === 'ownership'
    ? 'Resistant influence may thin political patience between results.'
    : 'Resistant influence may cool morale and principal trust between race weekends.';
}

function careerPositionRead(jobSecurity: number): string {
  if (jobSecurity < SACK_THRESHOLD) return 'Job looks immediately vulnerable';
  if (jobSecurity < 35) return 'Job security looks fragile';
  if (jobSecurity < RENEW_THRESHOLD) return 'Board confidence looks watchable';
  return 'Board confidence looks steady';
}

function ownerPatienceRead(ownerPatience: number): string {
  if (ownerPatience < 30) return 'Owner patience looks thin';
  if (ownerPatience < 55) return 'Owner patience could swing';
  return 'Owner patience looks manageable';
}

function paceReadFromConfidence(score: number): CharacterGameplayEffect['tone'] {
  if (score >= 65) return 'Positive';
  if (score < 45) return 'Negative';
  return 'Neutral';
}

function confidencePaceRead(score: number): string {
  if (score >= 80) return 'Pace may lift if the race weekend starts cleanly';
  if (score >= 65) return 'Small pace edge is possible';
  if (score >= 45) return 'Pace effect looks broadly neutral';
  if (score >= 25) return 'Confidence could create a pace drag';
  return 'Pace may suffer until confidence is repaired';
}

export function characterGameplayEffect(
  state: GameState,
  profile: RelationshipAttentionProfile,
): CharacterGameplayEffect | undefined {
  const influence = influenceForTarget(state, profile.target);
  const roundDelta = influence ? characterInfluenceRoundDelta(influence.stance) : 0;

  if (profile.target.type === 'Owner' && state.principal) {
    const jobSecurity = state.principal.jobSecurity;
    const ownerPatience = state.teamReputations?.[state.selectedTeamId]?.ownerPatience ?? 50;
    return {
      label: 'Career position',
      value: careerPositionRead(jobSecurity),
      detail: `${influenceDriftRead(influence?.stance, 'ownership')} ${ownerPatienceRead(ownerPatience)}.`,
      tone: jobSecurity < SACK_THRESHOLD || roundDelta < 0
        ? 'Negative'
        : jobSecurity >= RENEW_THRESHOLD && roundDelta > 0
          ? 'Positive'
          : 'Neutral',
    };
  }

  if (profile.target.type === 'Driver') {
    const relationship = state.driverRelationships?.[profile.target.id];
    if (!relationship) return undefined;
    const confidenceScore = overallConfidenceScore(relationship);
    const confidenceState = computeConfidenceState(relationship);
    return {
      label: 'Qualifying and race pace',
      value: confidencePaceRead(confidenceScore),
      detail: `${confidenceState} confidence can shape qualifying and race execution. ${influenceDriftRead(influence?.stance, 'driver')}`,
      tone: paceReadFromConfidence(confidenceScore),
    };
  }

  return undefined;
}
