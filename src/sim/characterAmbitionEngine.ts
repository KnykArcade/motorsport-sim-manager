import type { GameState } from '../game/careerState';
import type { PaddockEvent, PaddockEventCategory } from '../types/careerPhaseTypes';
import type {
  CharacterAgenda,
  CharacterAmbition,
  CharacterAmbitionPressure,
  CharacterInteractionTarget,
} from '../types/characterInteractionTypes';
import type { StaffRole } from '../types/staffTypes';
import type { DepartmentId } from '../types/phase18Types';
import {
  characterAgendaLabel,
  characterOpinionFor,
  currentCharacterTargets,
  ensureCharacterOpinions,
  recordCharacterMemory,
} from './characterOpinionEngine';
import { ensurePhase18FoundationState } from './phase18FoundationEngine';
import { addRivalRelationshipEvent, rivalRelationship } from './phase18RivalRelationshipEngine';
import { propagateCharacterReaction } from './characterConnectionEngine';

const STAFF_DEPARTMENT: Record<StaffRole, DepartmentId> = {
  'Technical Director': 'Technical',
  'Race Engineer': 'Engineering',
  'Pit Crew Chief': 'RaceOperations',
  Strategist: 'RaceOperations',
};

const AMBITION_COPY: Record<CharacterAgenda, { title: string; description: string }> = {
  CompetitiveStatus: { title: 'Prove the competitive direction', description: 'They expect visible evidence that their standing and performance are moving forward.' },
  CareerSecurity: { title: 'Clarify their future', description: 'They want credible security rather than another vague assurance about what comes next.' },
  TeamHarmony: { title: 'Repair the working environment', description: 'They expect management to reduce friction and make the garage function as one team.' },
  FinancialReward: { title: 'Recognize their value', description: 'They want their contribution acknowledged before they trust future contract discussions.' },
  Recognition: { title: 'Recognize the department', description: 'They expect the department and its work to receive visible backing from management.' },
  TechnicalFreedom: { title: 'Respect technical judgment', description: 'They want meaningful influence over priorities instead of being treated as an implementer.' },
  Resources: { title: 'Relieve department strain', description: 'They expect workload and resource pressure to return to a sustainable level.' },
  Stability: { title: 'Restore stability', description: 'They want consistent leadership and fewer disruptive changes around the team.' },
  ImmediateResults: { title: 'Deliver near-term progress', description: 'Ownership expects evidence that the team is moving toward its stated competitive target.' },
  FinancialDiscipline: { title: 'Demonstrate financial control', description: 'Ownership expects spending decisions to match the team’s priorities and means.' },
  LongTermGrowth: { title: 'Show the rebuild is working', description: 'Ownership wants measurable progress that supports the long-term plan.' },
  Prestige: { title: 'Raise the team’s standing', description: 'Ownership wants the project to gain stature with fans, sponsors, and the paddock.' },
  Tradition: { title: 'Protect continuity', description: 'Ownership expects loyalty, stability, and respect for the team’s established identity.' },
  Cooperation: { title: 'Keep a workable paddock channel', description: 'They expect competition without allowing the relationship to become needlessly destructive.' },
  PoliticalInfluence: { title: 'Find political common ground', description: 'They want a relationship that can support useful alignment when paddock interests overlap.' },
  TechnicalAdvantage: { title: 'Reduce technical hostility', description: 'They expect professional boundaries and fewer actions that deepen technical suspicion.' },
  PublicStanding: { title: 'Lower the public temperature', description: 'They want disputes managed without turning every disagreement into a media confrontation.' },
};

function clamp(value: number, low = 0, high = 100): number {
  return Math.max(low, Math.min(high, Math.round(value)));
}

function roundOf(state: GameState): number {
  return state.careerPhase?.currentRound ?? state.currentRaceIndex + 1;
}

function addRounds(state: GameState, season: number, round: number, amount: number): { season: number; round: number } {
  const roundsInSeason = Math.max(1, state.calendar.length);
  let nextSeason = season;
  let nextRound = round + amount;
  while (nextRound > roundsInSeason) {
    nextRound -= roundsInSeason;
    nextSeason += 1;
  }
  return { season: nextSeason, round: nextRound };
}

function deadlineWindow(target: CharacterInteractionTarget): number {
  const variance = [...target.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 3;
  return (target.type === 'RivalPrincipal' ? 7 : 5) + variance;
}

function roundsBetween(state: GameState, fromSeason: number, fromRound: number, toSeason: number, toRound: number): number {
  return (toSeason - fromSeason) * Math.max(1, state.calendar.length) + toRound - fromRound;
}

function ambitionMeasure(state: GameState, target: CharacterInteractionTarget, agenda: CharacterAgenda): { label: string; value: number; floor: number } {
  if (target.type === 'Driver') {
    const driver = state.drivers.find((entry) => entry.id === target.id);
    const relationship = state.driverRelationships?.[target.id];
    if (agenda === 'CareerSecurity') return { label: 'Contract security', value: (driver?.contractYearsRemaining ?? 0) >= 2 ? 100 : 40, floor: 100 };
    if (agenda === 'TeamHarmony') return { label: 'Teammate relationship', value: relationship?.teammateRelationship ?? 50, floor: 62 };
    if (agenda === 'FinancialReward') return { label: 'Confidence in recognition', value: relationship?.trustInPrincipal ?? 50, floor: 62 };
    return { label: 'Competitive confidence', value: Math.max(relationship?.selfConfidence ?? 50, relationship?.teamTrustInDriver ?? 50), floor: 62 };
  }
  if (target.type === 'Staff') {
    const member = (state.staff ?? []).find((entry) => entry.id === target.id);
    if (member) {
      const phase18 = ensurePhase18FoundationState(state.phase18, state);
      const mood = phase18.departmentMoods[state.selectedTeamId][STAFF_DEPARTMENT[member.role]];
      if (agenda === 'Resources') return { label: 'Sustainable workload', value: 100 - mood.workload, floor: 48 };
      if (agenda === 'TechnicalFreedom') return { label: 'Strategic alignment', value: mood.strategicAlignment, floor: 62 };
      return { label: 'Department morale', value: mood.morale, floor: 62 };
    }
  }
  if (target.type === 'Owner') {
    const reputation = state.teamReputations?.[target.teamId ?? state.selectedTeamId];
    if (agenda === 'FinancialDiscipline') return { label: 'Board financial confidence', value: state.principal?.attributes.boardConfidence ?? 50, floor: 62 };
    if (agenda === 'Prestige') return { label: 'Ownership prestige confidence', value: Math.max(reputation?.reputation ?? 50, state.principal?.attributes.boardConfidence ?? 50), floor: 62 };
    if (agenda === 'ImmediateResults') return { label: 'Board confidence', value: state.principal?.attributes.boardConfidence ?? 50, floor: 62 };
    return { label: 'Owner patience', value: reputation?.ownerPatience ?? 50, floor: 62 };
  }
  if (target.type === 'RivalPrincipal' && target.teamId) {
    const relationship = rivalRelationship(state, state.selectedTeamId, target.teamId);
    if (agenda === 'PoliticalInfluence') return { label: 'Political alignment', value: clamp((relationship?.politicalAlignment ?? 0) + 50), floor: 58 };
    if (agenda === 'TechnicalAdvantage') return { label: 'Technical professionalism', value: clamp(100 - (relationship?.technicalSuspicion ?? 50)), floor: 58 };
    if (agenda === 'PublicStanding') return { label: 'Controlled public relationship', value: clamp((relationship?.score ?? 0) + 50), floor: 58 };
    return { label: 'Rival relationship', value: clamp((relationship?.score ?? 0) + 50), floor: 58 };
  }
  return { label: characterAgendaLabel(agenda), value: 50, floor: 60 };
}

function targetValue(measure: { value: number; floor: number }, target: CharacterInteractionTarget): number {
  if (measure.floor === 100) return 100;
  const improvement = target.type === 'Owner' ? 5 : target.type === 'RivalPrincipal' ? 6 : 8;
  return clamp(Math.max(measure.floor, measure.value + improvement), 0, 75);
}

function createAmbition(state: GameState, target: CharacterInteractionTarget): CharacterAmbition {
  const opinion = characterOpinionFor(state, target);
  const measure = ambitionMeasure(state, target, opinion.agenda);
  const deadline = addRounds(state, state.seasonYear, roundOf(state), deadlineWindow(target));
  const copy = AMBITION_COPY[opinion.agenda];
  const sequence = (state.characterInteractions?.ambitions.length ?? 0) + 1;
  return {
    id: `ambition-${state.seasonYear}-${roundOf(state)}-${target.type}-${target.id}-${sequence}`,
    targetType: target.type, targetId: target.id, targetName: target.name, teamId: target.teamId,
    agenda: opinion.agenda, title: copy.title, description: copy.description,
    measureLabel: measure.label, currentValue: measure.value, targetValue: targetValue(measure, target),
    startedSeason: state.seasonYear, startedRound: roundOf(state),
    deadlineSeason: deadline.season, deadlineRound: deadline.round,
    status: 'Active', pressure: opinion.score <= -25 ? 'Pressing' : 'Watchful',
  };
}

function targetFromAmbition(ambition: CharacterAmbition): CharacterInteractionTarget {
  return { type: ambition.targetType, id: ambition.targetId, name: ambition.targetName, teamId: ambition.teamId };
}

export function ensureCharacterAmbitions(state: GameState): GameState {
  const seeded = ensureCharacterOpinions(state);
  const interactions = seeded.characterInteractions!;
  const ambitions = [...(interactions.ambitions ?? [])];
  for (const target of currentCharacterTargets(seeded)) {
    const targetAmbitions = ambitions.filter((entry) => entry.targetType === target.type && entry.targetId === target.id);
    if (targetAmbitions.some((entry) => entry.status === 'Active')) continue;
    const latest = targetAmbitions.at(-1);
    if (latest?.resolvedSeason != null && latest.resolvedRound != null
      && roundsBetween(seeded, latest.resolvedSeason, latest.resolvedRound, seeded.seasonYear, roundOf(seeded)) < 3) continue;
    ambitions.push(createAmbition({ ...seeded, characterInteractions: { ...interactions, ambitions } }, target));
  }
  return { ...seeded, characterInteractions: { ...interactions, ambitions: ambitions.slice(-500) } };
}

function pressureFor(state: GameState, ambition: CharacterAmbition, value: number): CharacterAmbitionPressure {
  const opinion = characterOpinionFor(state, targetFromAmbition(ambition));
  const remaining = roundsBetween(state, state.seasonYear, roundOf(state), ambition.deadlineSeason, ambition.deadlineRound);
  if (opinion.score <= -60 || (remaining <= 1 && value < ambition.targetValue - 4)) return 'Ultimatum';
  if (opinion.score <= -25 || remaining <= 2) return 'Pressing';
  if (value >= ambition.targetValue - 3) return 'Calm';
  return 'Watchful';
}

function replaceAmbition(state: GameState, ambition: CharacterAmbition): GameState {
  return {
    ...state,
    characterInteractions: {
      ...state.characterInteractions!,
      ambitions: state.characterInteractions!.ambitions.map((entry) => entry.id === ambition.id ? ambition : entry),
    },
  };
}

function applyResolutionEffects(state: GameState, ambition: CharacterAmbition, satisfied: boolean): GameState {
  const target = targetFromAmbition(ambition);
  let next = state;
  if (target.type === 'Driver' && state.driverRelationships?.[target.id]) {
    const relationship = state.driverRelationships[target.id];
    const updated = {
      ...relationship,
      trustInPrincipal: clamp(relationship.trustInPrincipal + (satisfied ? 3 : -5)),
      morale: clamp(relationship.morale + (satisfied ? 2 : -3)),
      frustration: clamp(relationship.frustration + (satisfied ? -2 : 4)),
    };
    next = { ...next, driverRelationships: { ...state.driverRelationships, [target.id]: updated }, drivers: state.drivers.map((driver) => driver.id === target.id ? { ...driver, morale: updated.morale } : driver) };
  } else if (target.type === 'Staff') {
    const member = (state.staff ?? []).find((entry) => entry.id === target.id);
    if (member) {
      const phase18 = ensurePhase18FoundationState(state.phase18, state);
      const departmentId = STAFF_DEPARTMENT[member.role];
      const mood = phase18.departmentMoods[state.selectedTeamId][departmentId];
      const updated = { ...mood, trustInPrincipal: clamp(mood.trustInPrincipal + (satisfied ? 3 : -5)), morale: clamp(mood.morale + (satisfied ? 2 : -3)) };
      next = { ...next, phase18: { ...phase18, departmentMoods: { ...phase18.departmentMoods, [state.selectedTeamId]: { ...phase18.departmentMoods[state.selectedTeamId], [departmentId]: updated } } } };
    }
  } else if (target.type === 'Owner') {
    const reputation = state.teamReputations?.[state.selectedTeamId];
    if (reputation && state.principal) next = {
      ...next,
      teamReputations: { ...state.teamReputations!, [state.selectedTeamId]: { ...reputation, ownerPatience: clamp(reputation.ownerPatience + (satisfied ? 3 : -4)) } },
      principal: { ...state.principal, attributes: { ...state.principal.attributes, boardConfidence: clamp(state.principal.attributes.boardConfidence + (satisfied ? 2 : -3)) } },
    };
  } else if (target.type === 'RivalPrincipal' && target.teamId) {
    next = addRivalRelationshipEvent(next, state.selectedTeamId, target.teamId, {
      round: roundOf(state), amount: satisfied ? 3 : -4, trustDelta: satisfied ? 2 : -3,
      reason: `${target.name}'s ${characterAgendaLabel(ambition.agenda).toLowerCase()} ambition was ${satisfied ? 'satisfied' : 'missed'}.`, category: 'Political',
    });
  }
  const outcome = satisfied
    ? `${target.name} believes management delivered meaningful progress on ${characterAgendaLabel(ambition.agenda).toLowerCase()}.`
    : `${target.name} believes management failed to deliver on ${characterAgendaLabel(ambition.agenda).toLowerCase()} before the deadline.`;
  const remembered = recordCharacterMemory(next, target, {
    source: 'Ambition', label: satisfied ? `Ambition satisfied: ${ambition.title}` : `Ambition missed: ${ambition.title}`,
    description: outcome, tone: satisfied ? 'Positive' : 'Negative',
    effects: satisfied ? ['+3 relationship trust', '+2 morale or standing'] : ['-5 relationship trust', 'Pressure escalated'],
  });
  return propagateCharacterReaction(remembered, target, satisfied ? 'Positive' : 'Negative', ambition.title);
}

export function advanceCharacterAmbitions(state: GameState): GameState {
  let next = ensureCharacterAmbitions(state);
  const active = next.characterInteractions!.ambitions.filter((entry) => entry.status === 'Active');
  for (const existing of active) {
    if (existing.startedSeason === next.seasonYear && existing.startedRound === roundOf(next)) continue;
    const measure = ambitionMeasure(next, targetFromAmbition(existing), existing.agenda);
    const reached = measure.value >= existing.targetValue;
    const deadlineReached = roundsBetween(next, next.seasonYear, roundOf(next), existing.deadlineSeason, existing.deadlineRound) <= 0;
    let updated: CharacterAmbition = { ...existing, currentValue: measure.value, pressure: pressureFor(next, existing, measure.value) };
    if (reached || deadlineReached) {
      const satisfied = reached;
      updated = {
        ...updated, status: satisfied ? 'Satisfied' : 'Failed', pressure: satisfied ? 'Calm' : 'Ultimatum',
        resolvedSeason: next.seasonYear, resolvedRound: roundOf(next),
        outcome: satisfied ? `${existing.measureLabel} reached ${measure.value}/${existing.targetValue}.` : `${existing.measureLabel} finished at ${measure.value}/${existing.targetValue}.`,
      };
      next = replaceAmbition(next, updated);
      next = applyResolutionEffects(next, updated, satisfied);
    } else {
      next = replaceAmbition(next, updated);
    }
  }
  return next;
}

export function activeAmbitionForTarget(state: GameState, target: CharacterInteractionTarget): CharacterAmbition | undefined {
  return state.characterInteractions?.ambitions.find((entry) => entry.targetType === target.type && entry.targetId === target.id && entry.status === 'Active');
}

function eventCategory(ambition: CharacterAmbition): PaddockEventCategory {
  if (ambition.targetType === 'Driver') return 'driver_morale';
  if (ambition.targetType === 'Staff') return 'staff';
  if (ambition.targetType === 'Owner') return 'finance';
  return 'regulation';
}

export function generateCharacterAmbitionEvents(state: GameState): PaddockEvent[] {
  const round = roundOf(state);
  const weekId = state.careerPhase?.paddockWeekId ?? `pw-${state.seasonYear}-${round}`;
  return (state.characterInteractions?.ambitions ?? [])
    .filter((ambition) => (ambition.resolvedSeason === state.seasonYear && ambition.resolvedRound === round)
      || (ambition.status === 'Active' && (ambition.pressure === 'Pressing' || ambition.pressure === 'Ultimatum')))
    .sort((a, b) => (b.pressure === 'Ultimatum' ? 2 : b.pressure === 'Pressing' ? 1 : 0) - (a.pressure === 'Ultimatum' ? 2 : a.pressure === 'Pressing' ? 1 : 0))
    .slice(0, 4)
    .map((ambition) => {
      const resolved = ambition.status !== 'Active';
      const positive = ambition.status === 'Satisfied';
      return {
        id: `pe-${weekId}-ambition-${ambition.id}`,
        weekId, season: state.seasonYear, series: state.series, round,
        category: eventCategory(ambition),
        title: resolved ? `${ambition.targetName}: ambition ${positive ? 'satisfied' : 'missed'}` : `${ambition.targetName} increases the pressure`,
        description: resolved
          ? (positive ? `${ambition.title} was achieved. ${ambition.outcome}` : `${ambition.title} reached its deadline without enough progress. ${ambition.outcome}`)
          : `${ambition.title}: ${ambition.currentValue}/${ambition.targetValue} ${ambition.measureLabel.toLowerCase()}. Deadline: ${ambition.deadlineSeason}, Round ${ambition.deadlineRound}.`,
        severity: resolved ? (positive ? 'info' as const : 'major' as const) : ambition.pressure === 'Ultimatum' ? 'critical' as const : 'major' as const,
        isRequiredDecision: false,
        effectsApplied: true,
        createdAt: new Date(Date.UTC(state.seasonYear, 0, Math.max(1, round + 1))).toISOString(),
      };
    });
}
