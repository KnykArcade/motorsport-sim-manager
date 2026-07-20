import type { GameState } from '../../game/careerState';
import {
  computeConfidenceState,
  confidencePerformanceModifier,
} from '../../sim/driverConfidenceEngine';
import {
  characterInfluenceRoundDelta,
  influenceForTarget,
} from '../../sim/characterInfluenceEngine';
import { RENEW_THRESHOLD, SACK_THRESHOLD } from '../../sim/principalEngine';
import type { RelationshipAttentionProfile } from '../../sim/relationshipAttentionEngine';

export type CharacterGameplayEffect = {
  label: string;
  value: string;
  detail: string;
  tone: 'Positive' | 'Neutral' | 'Negative';
};

function signed(value: number): string {
  if (value === 0) return 'Neutral';
  return `${value > 0 ? '+' : ''}${value}`;
}

function toneFor(value: number): CharacterGameplayEffect['tone'] {
  if (value > 0) return 'Positive';
  if (value < 0) return 'Negative';
  return 'Neutral';
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
    const drift = roundDelta === 0
      ? 'Current influence causes no per-round ownership change.'
      : `Current ${influence?.stance.toLowerCase()} influence changes job security and owner patience by ${signed(roundDelta)} each round.`;
    return {
      label: 'Career position',
      value: `${jobSecurity}/100 job security`,
      detail: `${drift} Owner patience is ${ownerPatience}/100. Dismissal threshold: below ${SACK_THRESHOLD}; expiring-contract renewal: ${RENEW_THRESHOLD} or higher.`,
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
    const paceModifier = confidencePerformanceModifier(relationship);
    const confidenceState = computeConfidenceState(relationship);
    const drift = roundDelta === 0
      ? 'Current influence causes no per-round relationship change.'
      : `Current ${influence?.stance.toLowerCase()} influence changes morale and principal trust by ${signed(roundDelta)} each round.`;
    return {
      label: 'Qualifying and race pace',
      value: paceModifier === 0 ? 'Neutral' : `${paceModifier > 0 ? '+' : ''}${Math.round(paceModifier * 100)}% pace`,
      detail: `${confidenceState} confidence is applied directly in qualifying and race simulation. ${drift}`,
      tone: toneFor(paceModifier),
    };
  }

  return undefined;
}
