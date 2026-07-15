import type { GameState } from '../game/careerState';
import type { PaddockEvent, PaddockEventOption } from '../types/careerPhaseTypes';
import type {
  CharacterConnection,
  CharacterDispute,
  CharacterInteractionTarget,
} from '../types/characterInteractionTypes';
import { characterOpinionKey, recordCharacterMemory } from './characterOpinionEngine';

function clamp(value: number, low = 0, high = 100): number {
  return Math.max(low, Math.min(high, Math.round(value)));
}

function roundOf(state: GameState): number {
  return state.careerPhase?.currentRound ?? state.currentRaceIndex + 1;
}

function connectionBand(affinity: number): CharacterConnection['band'] {
  if (affinity >= 60) return 'Allied';
  if (affinity >= 25) return 'Friendly';
  if (affinity > -25) return 'Neutral';
  if (affinity > -60) return 'Tense';
  return 'Hostile';
}

function issueFor(connection: CharacterConnection): string {
  if (connection.characterA.type === 'Driver' && connection.characterB.type === 'Driver') return 'status, resources, and competitive priority inside the garage';
  if (connection.characterA.type === 'Owner' || connection.characterB.type === 'Owner') return 'authority, expectations, and the direction of the team';
  if (connection.characterA.type === 'Staff' && connection.characterB.type === 'Staff') return 'department priorities and responsibility for results';
  return 'working methods, trust, and how the team should move forward';
}

function eligible(connection: CharacterConnection): boolean {
  return connection.strength >= 60 && connection.affinity <= -25
    && connection.characterA.type !== 'StaffCandidate' && connection.characterB.type !== 'StaffCandidate';
}

export function refreshCharacterDisputes(state: GameState): GameState {
  const current = state.characterInteractions;
  if (!current) return state;
  const round = roundOf(state);
  const existing = new Map(current.disputes.map((dispute) => [dispute.connectionId, dispute]));
  const liveConnectionIds = new Set(current.connections.map((connection) => connection.id));
  const disputes: CharacterDispute[] = [];

  for (const connection of current.connections) {
    const prior = existing.get(connection.id);
    if (!eligible(connection)) {
      if (prior && liveConnectionIds.has(prior.connectionId)) disputes.push({ ...prior, status: 'Resolved', intensity: Math.abs(Math.min(0, connection.affinity)) });
      continue;
    }
    const roundsSinceReview = prior?.lastReviewedSeason === state.seasonYear && prior.lastReviewedRound
      ? round - prior.lastReviewedRound
      : Number.POSITIVE_INFINITY;
    const coolingDown = prior?.status === 'Resolved'
      ? roundsSinceReview < 4
      : prior?.status === 'Mediated' && roundsSinceReview < 2;
    if (prior && coolingDown) {
      disputes.push(prior);
      continue;
    }
    disputes.push({
      ...(prior ?? {
        id: `dispute-${connection.id}`,
        connectionId: connection.id,
        characterA: connection.characterA,
        characterB: connection.characterB,
        issue: issueFor(connection),
        startedSeason: state.seasonYear,
        startedRound: round,
      }),
      status: connection.affinity <= -60 ? 'Escalating' : 'Active',
      intensity: clamp(Math.abs(connection.affinity)),
    });
  }
  return { ...state, characterInteractions: { ...current, disputes: disputes.slice(-100) } };
}

function option(id: string, label: string, description: string, risk = 0): PaddockEventOption {
  return { id, label, description, risk };
}

export function generateCharacterDisputeEvents(state: GameState): PaddockEvent[] {
  const round = roundOf(state);
  const weekId = state.careerPhase?.paddockWeekId ?? `pw-${state.seasonYear}-${round}`;
  const dispute = (state.characterInteractions?.disputes ?? [])
    .filter((entry) => (entry.status === 'Active' || entry.status === 'Escalating')
      && (entry.lastReviewedSeason !== state.seasonYear || entry.lastReviewedRound !== round))
    .sort((a, b) => b.intensity - a.intensity || a.id.localeCompare(b.id))[0];
  if (!dispute) return [];
  const required = dispute.status === 'Escalating' || dispute.intensity >= 70;
  return [{
    id: `pe-${weekId}-${dispute.id}`,
    weekId,
    season: state.seasonYear,
    series: state.series,
    round,
    category: dispute.characterA.type === 'Driver' || dispute.characterB.type === 'Driver' ? 'driver_morale' : 'staff',
    title: `${dispute.characterA.name} and ${dispute.characterB.name} need intervention`,
    description: `Their disagreement over ${dispute.issue} has reached ${dispute.intensity}/100 intensity. Your response will be remembered by both sides and can reshape their relationship.`,
    severity: required ? 'major' : 'minor',
    isRequiredDecision: required,
    options: [
      option('mediate-private', 'Mediate in private', 'Hear both sides, define common ground, and ask each person to make a concession.'),
      option('back-a', `Back ${dispute.characterA.name}`, `Give ${dispute.characterA.name} the decision and accept the reaction from ${dispute.characterB.name}.`, 2),
      option('back-b', `Back ${dispute.characterB.name}`, `Give ${dispute.characterB.name} the decision and accept the reaction from ${dispute.characterA.name}.`, 2),
      option('impose-compromise', 'Impose a compromise', 'Settle the immediate issue through authority. Neither side gets everything they wanted.', 1),
    ],
    effectsApplied: false,
    createdAt: new Date(Date.UTC(state.seasonYear, 0, Math.max(1, round + 1))).toISOString(),
    characterDispute: { disputeId: dispute.id, characterA: dispute.characterA, characterB: dispute.characterB },
  }];
}

function remember(
  state: GameState,
  target: CharacterInteractionTarget,
  label: string,
  description: string,
  tone: 'Positive' | 'Mixed' | 'Negative',
  effects: string[],
): GameState {
  return recordCharacterMemory(state, target, { source: 'Dispute', label, description, tone, effects });
}

export function resolveCharacterDispute(state: GameState, event: PaddockEvent, optionId: string): GameState {
  const meta = event.characterDispute;
  const current = state.characterInteractions;
  if (!meta || !current || !event.options?.some((optionEntry) => optionEntry.id === optionId)) return state;
  const dispute = current.disputes.find((entry) => entry.id === meta.disputeId);
  if (!dispute || (dispute.lastReviewedSeason === state.seasonYear && dispute.lastReviewedRound === roundOf(state))) return state;

  const connectionDelta = optionId === 'mediate-private' ? 20 : optionId === 'impose-compromise' ? 8 : -10;
  const label = event.options.find((entry) => entry.id === optionId)!.label;
  const connections = current.connections.map((connection) => {
    if (connection.id !== dispute.connectionId) return connection;
    const affinity = clamp(connection.affinity + connectionDelta, -100, 100);
    return {
      ...connection,
      affinity,
      band: connectionBand(affinity),
      manualAffinityAdjustment: clamp((connection.manualAffinityAdjustment ?? 0) + connectionDelta, -60, 60),
      lastUpdatedSeason: state.seasonYear,
      lastUpdatedRound: roundOf(state),
    };
  });
  const updatedConnection = connections.find((connection) => connection.id === dispute.connectionId);
  const status: CharacterDispute['status'] = updatedConnection && updatedConnection.affinity > -25
    ? 'Resolved'
    : optionId === 'mediate-private' || optionId === 'impose-compromise' ? 'Mediated' : 'Escalating';
  let next: GameState = {
    ...state,
    characterInteractions: {
      ...current,
      connections,
      disputes: current.disputes.map((entry) => entry.id === dispute.id ? {
        ...entry,
        status,
        intensity: Math.abs(Math.min(0, updatedConnection?.affinity ?? -entry.intensity)),
        lastReviewedSeason: state.seasonYear,
        lastReviewedRound: roundOf(state),
        resolutionLabel: label,
      } : entry),
    },
  };

  const aTone = optionId === 'back-a' ? 'Positive' : optionId === 'back-b' ? 'Negative' : optionId === 'mediate-private' ? 'Positive' : 'Mixed';
  const bTone = optionId === 'back-b' ? 'Positive' : optionId === 'back-a' ? 'Negative' : optionId === 'mediate-private' ? 'Positive' : 'Mixed';
  const outcome = optionId === 'mediate-private'
    ? `You brought ${meta.characterA.name} and ${meta.characterB.name} together privately and secured mutual concessions.`
    : optionId === 'impose-compromise'
      ? `You imposed a workable settlement. The immediate issue is contained, though neither side feels fully heard.`
      : `You backed ${optionId === 'back-a' ? meta.characterA.name : meta.characterB.name}, clarifying authority while deepening the other side's resentment.`;
  next = remember(next, meta.characterA, label, outcome, aTone, [`Connection ${connectionDelta > 0 ? '+' : ''}${connectionDelta}`]);
  next = remember(next, meta.characterB, label, outcome, bTone, [`Connection ${connectionDelta > 0 ? '+' : ''}${connectionDelta}`]);
  return {
    ...next,
    news: [{
      id: `news-${event.id}-${optionId}`,
      headline: `${meta.characterA.name} / ${meta.characterB.name}: ${label}`,
      body: outcome,
      timestamp: new Date().toISOString(),
      category: 'career_event' as const,
      priority: event.isRequiredDecision ? 'high' as const : 'normal' as const,
      careerPhase: next.careerPhase?.currentPhase,
      teamId: state.selectedTeamId,
    }, ...next.news].slice(0, 80),
  };
}

export function disputesForTarget(state: GameState, target: CharacterInteractionTarget): CharacterDispute[] {
  const key = characterOpinionKey(target);
  return (state.characterInteractions?.disputes ?? [])
    .filter((dispute) => characterOpinionKey(dispute.characterA) === key || characterOpinionKey(dispute.characterB) === key)
    .sort((a, b) => b.intensity - a.intensity);
}
