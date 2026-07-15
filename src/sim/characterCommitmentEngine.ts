import type { GameState } from '../game/careerState';
import type { PaddockEvent } from '../types/careerPhaseTypes';
import type { CharacterCommitment, CharacterInteractionTarget } from '../types/characterInteractionTypes';
import type { DepartmentId } from '../types/phase18Types';
import type { StaffRole } from '../types/staffTypes';
import { recordCharacterMemory } from './characterOpinionEngine';
import { ensurePhase18FoundationState } from './phase18FoundationEngine';
import { rivalRelationship } from './phase18RivalRelationshipEngine';

const STAFF_DEPARTMENT: Record<StaffRole, DepartmentId> = {
  'Technical Director': 'Technical',
  'Race Engineer': 'Engineering',
  'Pit Crew Chief': 'RaceOperations',
  Strategist: 'RaceOperations',
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function roundOf(state: GameState): number {
  return state.careerPhase?.currentRound ?? state.currentRaceIndex + 1;
}

function addRounds(state: GameState, amount: number): { season: number; round: number } {
  const seasonLength = Math.max(1, state.calendar.length);
  let season = state.seasonYear;
  let round = roundOf(state) + amount;
  while (round > seasonLength) {
    round -= seasonLength;
    season += 1;
  }
  return { season, round };
}

function deadlineReached(state: GameState, commitment: CharacterCommitment): boolean {
  const seasonLength = Math.max(1, state.calendar.length);
  const now = state.seasonYear * seasonLength + roundOf(state);
  const due = commitment.dueSeason * seasonLength + commitment.dueRound;
  return now >= due;
}

function measure(state: GameState, commitment: CharacterCommitment): number {
  if (commitment.kind === 'DriverPromise') {
    const promise = state.driverPromises?.find((entry) => entry.id === commitment.linkedPromiseId);
    if (promise?.status === 'kept') return 100;
    if (promise && (promise.status === 'broken' || promise.status === 'expired')) return 0;
    return 50;
  }
  if (commitment.kind === 'DepartmentSupport') {
    const member = (state.staff ?? []).find((entry) => entry.id === commitment.target.id);
    if (!member) return 100;
    const phase18 = ensurePhase18FoundationState(state.phase18, state);
    return phase18.departmentMoods[state.selectedTeamId][STAFF_DEPARTMENT[member.role]].workload;
  }
  if (commitment.kind === 'CompetitiveTarget') return state.principal?.attributes.boardConfidence ?? 0;
  if (commitment.target.teamId) return clamp((rivalRelationship(state, state.selectedTeamId, commitment.target.teamId)?.score ?? -50) + 50);
  return 0;
}

function achieved(commitment: CharacterCommitment, value: number): boolean {
  return commitment.direction === 'AtLeast' ? value >= commitment.targetValue : value <= commitment.targetValue;
}

export function createCharacterCommitmentFromRequest(state: GameState, event: PaddockEvent, optionId: string, resolutionEffects: string[] = []): GameState {
  const meta = event.characterRequest;
  const current = state.characterInteractions;
  if (!meta || !current) return state;
  const target: CharacterInteractionTarget = { type: meta.targetType, id: meta.targetId, name: meta.targetName, teamId: meta.teamId };
  const due = addRounds(state, 3);
  let draft: Omit<CharacterCommitment, 'id' | 'sourceEventId' | 'createdSeason' | 'createdRound' | 'dueSeason' | 'dueRound' | 'status'> | undefined;

  if (optionId === 'make-commitment') {
    const promise = [...(state.driverPromises ?? [])].reverse().find((entry) => entry.driverId === target.id && entry.status === 'active');
    if (promise) draft = {
      target, kind: 'DriverPromise', title: `Deliver the promise to ${target.name}`,
      description: 'A formal driver promise now carries personal accountability in the character relationship.',
      measureLabel: 'Promise delivery', currentValue: 50, targetValue: 100, direction: 'AtLeast', linkedPromiseId: promise.id,
    };
  } else if (optionId === 'fund-support' && !resolutionEffects.some((effect) => effect.toLowerCase().includes('unfunded'))) {
    const member = (state.staff ?? []).find((entry) => entry.id === target.id);
    if (member) {
      const phase18 = ensurePhase18FoundationState(state.phase18, state);
      const workload = phase18.departmentMoods[state.selectedTeamId][STAFF_DEPARTMENT[member.role]].workload;
      draft = {
        target, kind: 'DepartmentSupport', title: `Keep ${member.name}'s department workload sustainable`,
        description: 'The temporary support package must produce a lasting reduction in department strain.',
        measureLabel: 'Department workload', currentValue: workload, targetValue: clamp(workload + 5), direction: 'AtMost',
      };
    }
  } else if (optionId === 'commit-target') {
    const confidence = state.principal?.attributes.boardConfidence ?? 50;
    draft = {
      target, kind: 'CompetitiveTarget', title: 'Deliver the target promised to ownership',
      description: 'Ownership expects measurable evidence that the near-term commitment was credible.',
      measureLabel: 'Board confidence', currentValue: confidence, targetValue: clamp(confidence + 5), direction: 'AtLeast',
    };
  } else if (optionId === 'private-channel' && target.teamId) {
    const relationship = clamp((rivalRelationship(state, state.selectedTeamId, target.teamId)?.score ?? -50) + 50);
    draft = {
      target, kind: 'PrivateChannel', title: `Maintain the private channel with ${target.name}`,
      description: 'Avoid public escalation and preserve the working relationship established in private.',
      measureLabel: 'Paddock relationship', currentValue: relationship, targetValue: relationship, direction: 'AtLeast',
    };
  }
  if (!draft) return state;
  if (current.commitments.some((entry) => entry.status === 'Active' && entry.target.type === target.type && entry.target.id === target.id && entry.kind === draft.kind)) return state;
  const commitment: CharacterCommitment = {
    ...draft,
    id: `commitment-${state.seasonYear}-${roundOf(state)}-${target.type}-${target.id}-${current.commitments.length + 1}`,
    sourceEventId: event.id,
    createdSeason: state.seasonYear,
    createdRound: roundOf(state),
    dueSeason: due.season,
    dueRound: due.round,
    status: 'Active',
  };
  return { ...state, characterInteractions: { ...current, commitments: [...current.commitments, commitment].slice(-250) } };
}

export function advanceCharacterCommitments(state: GameState): GameState {
  const current = state.characterInteractions;
  if (!current) return state;
  let next = state;
  const updates = new Map<string, CharacterCommitment>();
  for (const commitment of current.commitments.filter((entry) => entry.status === 'Active')) {
    const value = measure(next, commitment);
    const linkedPromise = commitment.kind === 'DriverPromise'
      ? next.driverPromises?.find((entry) => entry.id === commitment.linkedPromiseId)
      : undefined;
    const linkedResolved = linkedPromise && linkedPromise.status !== 'active';
    if (!linkedResolved && !deadlineReached(next, commitment)) {
      updates.set(commitment.id, { ...commitment, currentValue: value });
      continue;
    }
    const fulfilled = achieved(commitment, value);
    const resolved: CharacterCommitment = {
      ...commitment, currentValue: value, status: fulfilled ? 'Fulfilled' : 'Broken',
      resolvedSeason: next.seasonYear, resolvedRound: roundOf(next),
    };
    updates.set(commitment.id, resolved);
    next = recordCharacterMemory(next, commitment.target, {
      source: 'Commitment',
      label: fulfilled ? `Commitment fulfilled: ${commitment.title}` : `Commitment broken: ${commitment.title}`,
      description: fulfilled
        ? `You delivered the measurable commitment made to ${commitment.target.name}.`
        : `The deadline passed without delivering the commitment made to ${commitment.target.name}.`,
      tone: fulfilled ? 'Positive' : 'Negative',
      effects: fulfilled ? ['Trust strengthened', `${commitment.measureLabel} target met`] : ['Trust damaged', `${commitment.measureLabel} target missed`],
    });
  }
  const interactions = next.characterInteractions!;
  return { ...next, characterInteractions: { ...interactions, commitments: interactions.commitments.map((entry) => updates.get(entry.id) ?? entry) } };
}

export function generateCharacterCommitmentEvents(state: GameState): PaddockEvent[] {
  const round = roundOf(state);
  const weekId = state.careerPhase?.paddockWeekId ?? `pw-${state.seasonYear}-${round}`;
  return (state.characterInteractions?.commitments ?? [])
    .filter((entry) => entry.resolvedSeason === state.seasonYear && entry.resolvedRound === round)
    .slice(0, 4)
    .map((entry) => ({
      id: `pe-${weekId}-${entry.id}-${entry.status}`,
      weekId, season: state.seasonYear, series: state.series, round,
      category: entry.target.type === 'Staff' ? 'staff' : entry.target.type === 'Owner' ? 'finance' : entry.target.type === 'RivalPrincipal' ? 'regulation' : 'driver_morale',
      title: `${entry.status === 'Fulfilled' ? 'Commitment delivered' : 'Commitment broken'}: ${entry.target.name}`,
      description: `${entry.title}. ${entry.measureLabel}: ${entry.currentValue}/${entry.targetValue}.`,
      severity: entry.status === 'Broken' ? 'major' as const : 'minor' as const,
      isRequiredDecision: false, effectsApplied: true,
      createdAt: new Date(Date.UTC(state.seasonYear, 0, Math.max(1, round + 1))).toISOString(),
    }));
}

export function commitmentsForTarget(state: GameState, target: CharacterInteractionTarget): CharacterCommitment[] {
  return (state.characterInteractions?.commitments ?? [])
    .filter((entry) => entry.target.type === target.type && entry.target.id === target.id)
    .sort((a, b) => (a.status === 'Active' ? -1 : 1) - (b.status === 'Active' ? -1 : 1) || b.createdSeason - a.createdSeason || b.createdRound - a.createdRound);
}
