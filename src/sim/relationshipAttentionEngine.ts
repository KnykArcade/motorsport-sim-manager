import type { GameState } from '../game/careerState';
import type { PaddockEvent } from '../types/careerPhaseTypes';
import type {
  CharacterInteractionTarget,
  CharacterInteractionTargetType,
} from '../types/characterInteractionTypes';
import { stabilityForTarget } from './characterBreakingPointEngine';
import { futureIntentForTarget } from './characterFutureIntentEngine';
import { characterRolePower, influenceForTarget } from './characterInfluenceEngine';
import { characterOpinionFor, currentCharacterTargets } from './characterOpinionEngine';

export type RelationshipAttentionStatus = 'MustActNow' | 'WatchClosely' | 'Stable';

export type RelationshipAuthorityRank = 1 | 2 | 4 | 7 | 8;

export type RelationshipActionWindow = 'Immediate' | 'NextRound' | 'Soon' | 'Background';

export type RelationshipAttentionProfile = {
  target: CharacterInteractionTarget;
  authorityRank: RelationshipAuthorityRank;
  authorityLabel: string;
  influence: number;
  status: RelationshipAttentionStatus;
  actionWindow: RelationshipActionWindow;
  reasons: string[];
};

const AUTHORITY: Record<CharacterInteractionTargetType, {
  rank: RelationshipAuthorityRank;
  label: string;
}> = {
  Owner: { rank: 1, label: 'Owner — controls your position' },
  Driver: { rank: 2, label: 'Race driver — core sporting priority' },
  Staff: { rank: 4, label: 'Team staff — internal delivery priority' },
  RivalPrincipal: { rank: 7, label: 'Rival principal — paddock relationship' },
  StaffCandidate: { rank: 8, label: 'External candidate — recruitment priority' },
};

const ATTENTION_ORDER: Record<RelationshipAttentionStatus, number> = {
  MustActNow: 0,
  WatchClosely: 1,
  Stable: 2,
};

function sameTarget(a: CharacterInteractionTarget, b: CharacterInteractionTarget): boolean {
  return a.type === b.type && a.id === b.id;
}

function currentRound(state: GameState): number {
  return state.careerPhase?.currentRound ?? state.currentRaceIndex + 1;
}

function roundsUntil(state: GameState, dueSeason: number, dueRound: number): number {
  const roundsPerSeason = Math.max(1, state.calendar.length);
  return (dueSeason - state.seasonYear) * roundsPerSeason + dueRound - currentRound(state);
}

function eventTargetsCharacter(event: PaddockEvent, target: CharacterInteractionTarget): boolean {
  if (event.characterRequest) {
    return event.characterRequest.targetType === target.type && event.characterRequest.targetId === target.id;
  }
  if (event.characterDispute) {
    return sameTarget(event.characterDispute.characterA, target) || sameTarget(event.characterDispute.characterB, target);
  }
  if (event.characterInitiative) return sameTarget(event.characterInitiative.target, target);
  if (event.characterBreakingPoint) return sameTarget(event.characterBreakingPoint.target, target);
  return false;
}

function uniqueReasons(reasons: string[]): string[] {
  return [...new Set(reasons)].slice(0, 4);
}

function relationshipActionWindow(
  status: RelationshipAttentionStatus,
  reasons: string[],
): RelationshipActionWindow {
  if (status === 'MustActNow') return 'Immediate';
  if (status === 'Stable') return 'Background';
  const joined = reasons.join(' ');
  if (/due within 1 round|ultimatum|critical|breaking point/i.test(joined)) return 'NextRound';
  return 'Soon';
}

export function relationshipAuthorityFor(target: CharacterInteractionTarget): {
  rank: RelationshipAuthorityRank;
  label: string;
} {
  return AUTHORITY[target.type];
}

export function relationshipAttentionForTarget(
  state: GameState,
  target: CharacterInteractionTarget,
): RelationshipAttentionProfile {
  const mustAct: string[] = [];
  const watch: string[] = [];
  const interactions = state.characterInteractions;
  const stability = stabilityForTarget(state, target);
  const futureIntent = futureIntentForTarget(state, target);
  const influence = influenceForTarget(state, target);
  const opinion = characterOpinionFor(state, target);

  const requiredEvent = state.careerPhase?.paddockEvents.find((event) =>
    event.isRequiredDecision && !event.resolvedOptionId && eventTargetsCharacter(event, target));
  if (requiredEvent) mustAct.push(`A required decision is waiting: ${requiredEvent.title}.`);

  const activeBreakingPoint = interactions?.breakingPoints.find((entry) =>
    entry.status === 'Active' && sameTarget(entry.target, target));
  if (activeBreakingPoint) mustAct.push(`${target.name} has reached a breaking point: ${activeBreakingPoint.trigger}.`);

  const ambitionPressure = { Ultimatum: 0, Pressing: 1, Watchful: 2, Calm: 3 } as const;
  const ambition = interactions?.ambitions
    .filter((entry) => entry.status === 'Active' && entry.targetType === target.type && entry.targetId === target.id)
    .sort((a, b) => ambitionPressure[a.pressure] - ambitionPressure[b.pressure])[0];
  if (ambition?.pressure === 'Ultimatum') {
    mustAct.push(`${target.name} has issued an ultimatum over ${ambition.title.toLowerCase()}.`);
  } else if (ambition?.pressure === 'Pressing') {
    watch.push(`${target.name} is pressing for progress on ${ambition.title.toLowerCase()}.`);
  }

  const commitment = interactions?.commitments
    .filter((entry) => entry.status === 'Active' && sameTarget(entry.target, target))
    .sort((a, b) => roundsUntil(state, a.dueSeason, a.dueRound) - roundsUntil(state, b.dueSeason, b.dueRound))[0];
  if (commitment) {
    const remaining = roundsUntil(state, commitment.dueSeason, commitment.dueRound);
    if (remaining <= 0) mustAct.push(`Your commitment, “${commitment.title},” is due now.`);
    else if (remaining <= 2) watch.push(`Your commitment, “${commitment.title},” is due within ${remaining} round${remaining === 1 ? '' : 's'}.`);
  }

  if (target.type === 'Driver') {
    const promise = state.driverPromises
      ?.filter((entry) => entry.driverId === target.id && entry.status === 'active'
        && entry.id !== commitment?.linkedPromiseId
        && entry.dueSeason !== undefined && entry.dueRound !== undefined)
      .sort((a, b) => roundsUntil(state, a.dueSeason!, a.dueRound!) - roundsUntil(state, b.dueSeason!, b.dueRound!))[0];
    if (promise?.dueSeason !== undefined && promise.dueRound !== undefined) {
      const remaining = roundsUntil(state, promise.dueSeason, promise.dueRound);
      if (remaining <= 0) mustAct.push(`A promise to ${target.name} is due now.`);
      else if (remaining <= 2) watch.push(`A promise to ${target.name} is due within ${remaining} round${remaining === 1 ? '' : 's'}.`);
    }
  }

  if (target.type === 'Owner') {
    const jobSecurity = state.principal?.jobSecurity ?? 50;
    const ownerPatience = state.teamReputations?.[state.selectedTeamId]?.ownerPatience ?? 50;
    if (jobSecurity <= 20 || ownerPatience <= 20) {
      mustAct.push(`Ownership confidence is critical: job security ${jobSecurity}, owner patience ${ownerPatience}.`);
    } else if (jobSecurity <= 40 || ownerPatience <= 40) {
      watch.push(`Ownership confidence is under pressure: job security ${jobSecurity}, owner patience ${ownerPatience}.`);
    }
  }

  const dispute = interactions?.disputes
    .filter((entry) => (entry.status === 'Active' || entry.status === 'Escalating')
      && (sameTarget(entry.characterA, target) || sameTarget(entry.characterB, target)))
    .sort((a, b) => Number(b.status === 'Escalating') - Number(a.status === 'Escalating')
      || b.intensity - a.intensity)[0];
  if (dispute) watch.push(`${target.name} is involved in an ${dispute.status.toLowerCase()} dispute over ${dispute.issue}.`);

  if (stability?.band === 'BreakingPoint') {
    mustAct.push(`${target.name}'s relationship stability is at breaking point (${stability.score}/100).`);
  } else if (stability?.band === 'Unsettled') {
    watch.push(`${target.name}'s relationship stability is unsettled (${stability.score}/100).`);
  }

  if (futureIntent?.status === 'WantsExit') {
    watch.push(`${target.name} wants to leave: ${futureIntent.reason}`);
  } else if (futureIntent?.status === 'TestingMarket') {
    watch.push(`${target.name} is testing alternatives: ${futureIntent.reason}`);
  }

  if (influence?.stance === 'Obstructive' || influence?.stance === 'Resistant') {
    watch.push(`${target.name} is ${influence.stance.toLowerCase()} and may work against your plans.`);
  }
  if (opinion.score <= -25) watch.push(`${target.name}'s opinion of you is negative (${opinion.score}).`);

  const authority = relationshipAuthorityFor(target);
  const status: RelationshipAttentionStatus = mustAct.length
    ? 'MustActNow'
    : watch.length
      ? 'WatchClosely'
      : 'Stable';
  const reasons = status === 'MustActNow'
    ? uniqueReasons([...mustAct, ...watch])
    : status === 'WatchClosely'
      ? uniqueReasons(watch)
      : ['No active deadline, dispute, or relationship crisis requires attention.'];

  return {
    target,
    authorityRank: authority.rank,
    authorityLabel: authority.label,
    influence: influence?.power ?? characterRolePower(state, target),
    status,
    actionWindow: relationshipActionWindow(status, reasons),
    reasons,
  };
}

export function currentRelationshipAttention(state: GameState): RelationshipAttentionProfile[] {
  return currentCharacterTargets(state)
    .map((target) => relationshipAttentionForTarget(state, target))
    .sort((a, b) => ATTENTION_ORDER[a.status] - ATTENTION_ORDER[b.status]
      || a.authorityRank - b.authorityRank
      || b.influence - a.influence
      || a.target.name.localeCompare(b.target.name));
}
