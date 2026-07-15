import { activeDriversForTeam, type GameState } from '../game/careerState';
import type { PaddockEvent, PaddockEventOption } from '../types/careerPhaseTypes';
import type {
  CharacterRequestResolution,
  CharacterRequestKind,
} from '../types/characterInteractionTypes';
import type { DriverWant, PromiseType } from '../types/relationshipTypes';
import type { StaffRole } from '../types/staffTypes';
import type { DepartmentId } from '../types/phase18Types';
import { makePromise, hasActivePromiseOfType } from './driverConfidenceEngine';
import { makeTransaction } from './financeEngine';
import { ensureCharacterInteractionState } from './characterInteractionEngine';
import { ensurePhase18FoundationState } from './phase18FoundationEngine';
import { addRivalRelationshipEvent, rivalRelationship } from './phase18RivalRelationshipEngine';
import { characterOpinionFor, recordCharacterMemory } from './characterOpinionEngine';
import { propagateCharacterReaction } from './characterConnectionEngine';
import { createCharacterCommitmentFromRequest } from './characterCommitmentEngine';
import { resolveCharacterMarketApproach } from './characterMarketApproachEngine';

const STAFF_DEPARTMENT: Record<StaffRole, DepartmentId> = {
  'Technical Director': 'Technical',
  'Race Engineer': 'Engineering',
  'Pit Crew Chief': 'RaceOperations',
  Strategist: 'RaceOperations',
};

const WANT_LABEL: Record<DriverWant, string> = {
  number_one_status: 'number-one status',
  equal_treatment: 'equal treatment',
  better_reliability: 'better reliability',
  development_priority: 'development priority',
  contract_renewal: 'a contract renewal',
  race_seat_security: 'race-seat security',
  less_risky_strategy: 'a less risky strategy approach',
  more_aggressive_strategy: 'a more aggressive strategy approach',
  better_teammate_treatment: 'fairer teammate treatment',
  podium_capable_car: 'a podium-capable car',
  title_contending_car: 'a title-contending car',
  better_salary: 'a better salary',
  academy_promotion: 'academy promotion',
  practice_time: 'more practice time',
  team_stability: 'greater team stability',
};

const WANT_PROMISE: Partial<Record<DriverWant, PromiseType>> = {
  number_one_status: 'number_one_status',
  equal_treatment: 'equal_treatment',
  better_reliability: 'improved_reliability',
  development_priority: 'development_priority',
  contract_renewal: 'contract_renewal',
  race_seat_security: 'no_midseason_replacement',
  less_risky_strategy: 'calmer_risk_approach',
  more_aggressive_strategy: 'better_strategy_support',
  practice_time: 'reserve_practice_time',
};

type ResolutionResult = {
  state: GameState;
  outcome: string;
  tone: CharacterRequestResolution['tone'];
  effects: string[];
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function roundOf(state: GameState): number {
  return state.careerPhase?.currentRound ?? state.currentRaceIndex + 1;
}

function option(id: string, label: string, description: string, risk = 0): PaddockEventOption {
  return { id, label, description, risk };
}

function requestEvent(
  state: GameState,
  requestKind: CharacterRequestKind,
  target: Omit<NonNullable<PaddockEvent['characterRequest']>, 'requestKind'>,
  category: PaddockEvent['category'],
  title: string,
  description: string,
  options: PaddockEventOption[],
  required = true,
): PaddockEvent {
  const round = roundOf(state);
  const weekId = state.careerPhase?.paddockWeekId ?? `pw-${state.seasonYear}-${round}`;
  return {
    id: `pe-${weekId}-${category}-character-${requestKind}-${target.targetId}`,
    weekId,
    season: state.seasonYear,
    series: state.series,
    round,
    category,
    title,
    description,
    severity: required ? 'major' : 'minor',
    isRequiredDecision: required,
    options,
    effectsApplied: false,
    createdAt: new Date(Date.UTC(state.seasonYear, 0, Math.max(1, round + 1))).toISOString(),
    characterRequest: { ...target, requestKind },
  };
}

function driverRequest(state: GameState): PaddockEvent | undefined {
  const driver = activeDriversForTeam(state, state.selectedTeamId)
    .map((candidate) => ({ candidate, relationship: state.driverRelationships?.[candidate.id] }))
    .filter((entry) => !!entry.relationship)
    .sort((a, b) => {
      const aOpinion = characterOpinionFor(state, { type: 'Driver', id: a.candidate.id, name: a.candidate.name, teamId: a.candidate.teamId }).score;
      const bOpinion = characterOpinionFor(state, { type: 'Driver', id: b.candidate.id, name: b.candidate.name, teamId: b.candidate.teamId }).score;
      const aScore = a.relationship!.frustration + (100 - a.relationship!.trustInPrincipal) + a.relationship!.wants.length * 5 + Math.max(0, -aOpinion);
      const bScore = b.relationship!.frustration + (100 - b.relationship!.trustInPrincipal) + b.relationship!.wants.length * 5 + Math.max(0, -bOpinion);
      return bScore - aScore || a.candidate.id.localeCompare(b.candidate.id);
    })[0];
  if (!driver) return undefined;
  const want = driver.relationship!.wants[0];
  const concern = want ? WANT_LABEL[want] : 'their role and the direction of the team';
  const opinion = characterOpinionFor(state, { type: 'Driver', id: driver.candidate.id, name: driver.candidate.name, teamId: driver.candidate.teamId });
  const required = driver.relationship!.frustration >= 55 || driver.relationship!.trustInPrincipal <= 35 || opinion.score <= -25;
  return requestEvent(
    state,
    'DriverConcern',
    { targetType: 'Driver', targetId: driver.candidate.id, targetName: driver.candidate.name, teamId: driver.candidate.teamId },
    'driver_morale',
    `${driver.candidate.name} asks for a private meeting`,
    `${driver.candidate.name} wants clarity about ${concern}. Their trust in you is ${driver.relationship!.trustInPrincipal}/100 and frustration is ${driver.relationship!.frustration}/100.`,
    [
      option('listen-honestly', 'Listen without promising', 'Hear the concern, explain the team position, and avoid making a commitment you may not keep.'),
      option('make-commitment', 'Make a clear commitment', `Promise action on ${concern}. This builds trust now but creates an obligation when the request maps to a formal promise.`, 1),
      option('set-boundary', 'Set a firm boundary', 'Protect management authority and reject pressure for special treatment.', 2),
    ],
    required,
  );
}

function staffRequest(state: GameState): PaddockEvent | undefined {
  const phase18 = ensurePhase18FoundationState(state.phase18, state);
  const member = [...(state.staff ?? [])]
    .sort((a, b) => {
      const aMood = phase18.departmentMoods[state.selectedTeamId][STAFF_DEPARTMENT[a.role]];
      const bMood = phase18.departmentMoods[state.selectedTeamId][STAFF_DEPARTMENT[b.role]];
      const aOpinion = characterOpinionFor(state, { type: 'Staff', id: a.id, name: a.name, teamId: state.selectedTeamId }).score;
      const bOpinion = characterOpinionFor(state, { type: 'Staff', id: b.id, name: b.name, teamId: state.selectedTeamId }).score;
      const aPressure = aMood.workload - aMood.morale + Math.max(0, -aOpinion);
      const bPressure = bMood.workload - bMood.morale + Math.max(0, -bOpinion);
      return bPressure - aPressure || a.id.localeCompare(b.id);
    })[0];
  if (!member) return undefined;
  const departmentId = STAFF_DEPARTMENT[member.role];
  const mood = phase18.departmentMoods[state.selectedTeamId][departmentId];
  const opinion = characterOpinionFor(state, { type: 'Staff', id: member.id, name: member.name, teamId: state.selectedTeamId });
  const required = mood.workload >= 75 || mood.morale <= 35 || mood.trustInPrincipal <= 30 || opinion.score <= -25;
  return requestEvent(
    state,
    'StaffSupport',
    { targetType: 'Staff', targetId: member.id, targetName: member.name, teamId: state.selectedTeamId },
    'staff',
    `${member.name} requests a department review`,
    `${member.name} says the ${departmentId} department needs clearer support. Morale is ${mood.morale}/100, workload is ${mood.workload}/100, trust is ${mood.trustInPrincipal}/100, and their personal opinion of you is ${opinion.score > 0 ? '+' : ''}${opinion.score}.`,
    [
      option('hear-department', 'Hear the department out', 'Invite the staff member into the planning process and adjust priorities together.'),
      option('fund-support', 'Fund workload support', 'Commit $500K to temporary support and reduce the department workload.', 1),
      option('hold-line', 'Hold the current line', 'Demand delivery with existing resources and accept relationship risk.', 2),
    ],
    required,
  );
}

function ownerRequest(state: GameState): PaddockEvent | undefined {
  const team = state.teams.find((candidate) => candidate.id === state.selectedTeamId);
  const reputation = state.teamReputations?.[state.selectedTeamId];
  if (!team || !reputation || !state.principal) return undefined;
  const target = { type: 'Owner' as const, id: `owner-${team.id}`, name: `${team.name} Ownership`, teamId: team.id };
  const opinion = characterOpinionFor(state, target);
  const required = reputation.ownerPatience <= 40 || state.principal.jobSecurity <= 35 || opinion.score <= -25;
  return requestEvent(
    state,
    'OwnerReview',
    { targetType: target.type, targetId: target.id, targetName: target.name, teamId: target.teamId },
    'finance',
    `${team.name} ownership calls a progress review`,
    `Ownership wants a direct account of results, spending, and the plan ahead. Owner patience is ${reputation.ownerPatience}/100, its opinion of you is ${opinion.score > 0 ? '+' : ''}${opinion.score}, and your job security is ${state.principal.jobSecurity}/100.`,
    [
      option('present-evidence', 'Present the evidence', 'Use performance, development, and financial evidence to defend the current plan.'),
      option('commit-target', 'Commit to a near-term target', 'Ask for patience by putting your authority behind the next competitive milestone.', 1),
      option('push-back', 'Push back on interference', 'Defend your control of the team, risking board confidence and patience.', 2),
    ],
    required,
  );
}

function rivalRequest(state: GameState): PaddockEvent | undefined {
  const rival = state.teams
    .filter((team) => team.id !== state.selectedTeamId)
    .map((team) => ({ team, relationship: rivalRelationship(state, state.selectedTeamId, team.id) }))
    .filter((entry) => !!entry.relationship)
    .sort((a, b) => a.relationship!.score - b.relationship!.score || a.team.id.localeCompare(b.team.id))[0];
  if (!rival) return undefined;
  const principal = state.aiPrincipals?.[rival.team.id];
  const name = principal?.name ?? `${rival.team.shortName} Team Principal`;
  const target = { type: 'RivalPrincipal' as const, id: principal?.principalId ?? `principal-${rival.team.id}`, name, teamId: rival.team.id };
  const opinion = characterOpinionFor(state, target);
  return requestEvent(
    state,
    'RivalApproach',
    { targetType: target.type, targetId: target.id, targetName: target.name, teamId: target.teamId },
    'regulation',
    `${name} seeks a paddock conversation`,
    `${name} has approached you as relations with ${rival.team.name} sit at ${rival.relationship!.score} and their personal opinion of you is ${opinion.score > 0 ? '+' : ''}${opinion.score}. The conversation could lower tension or become another public confrontation.`,
    [
      option('private-channel', 'Keep it private', 'Open a discreet channel and look for limited common ground.'),
      option('public-response', 'Take the issue public', 'Use the media to apply pressure and strengthen your public position.', 2),
      option('decline-meeting', 'Decline the meeting', 'Avoid immediate escalation but leave the underlying tension unresolved.', 1),
    ],
    opinion.score <= -60,
  );
}

export function generateCharacterRequestEvents(state: GameState): PaddockEvent[] {
  const round = roundOf(state);
  const primary = round % 3 === 0
    ? ownerRequest(state) ?? driverRequest(state)
    : round % 3 === 2
      ? staffRequest(state) ?? driverRequest(state)
      : driverRequest(state) ?? ownerRequest(state);
  const events = primary ? [primary] : [];
  if (round % 4 === 0) {
    const rival = rivalRequest(state);
    if (rival) events.push(rival);
  }
  return events;
}

function resolveDriverRequest(state: GameState, event: PaddockEvent, optionId: string): ResolutionResult {
  const meta = event.characterRequest!;
  const relationship = state.driverRelationships?.[meta.targetId];
  if (!relationship) return { state, outcome: 'The meeting was recorded, but the driver relationship was no longer active.', tone: 'Informational', effects: [] };
  const next = { ...relationship };
  let outcome: string;
  let tone: CharacterRequestResolution['tone'];
  const effects: string[] = [];
  let driverPromises = state.driverPromises ?? [];
  let promiseCounter = state.promiseCounter ?? 0;
  if (optionId === 'listen-honestly') {
    next.trustInPrincipal = clamp(next.trustInPrincipal + 4);
    next.morale = clamp(next.morale + 2);
    next.frustration = clamp(next.frustration - 4);
    outcome = `${meta.targetName} valued the honest conversation even without a formal promise.`;
    tone = 'Positive';
    effects.push('+4 principal trust', '+2 morale', '-4 frustration');
  } else if (optionId === 'make-commitment') {
    next.trustInPrincipal = clamp(next.trustInPrincipal + 6);
    next.morale = clamp(next.morale + 4);
    next.frustration = clamp(next.frustration - 5);
    const want = next.wants[0];
    const promiseType = want ? WANT_PROMISE[want] : undefined;
    if (promiseType && !hasActivePromiseOfType(driverPromises, meta.targetId, promiseType)) {
      promiseCounter += 1;
      driverPromises = [...driverPromises, makePromise(meta.targetId, promiseType, state.seasonYear, roundOf(state), state.seasonYear, roundOf(state) + 3, promiseCounter)];
      effects.push(`New promise: ${promiseType.replace(/_/g, ' ')}`);
    }
    outcome = `${meta.targetName} left reassured, but they will judge management by whether the commitment is delivered.`;
    tone = 'Positive';
    effects.push('+6 principal trust', '+4 morale', '-5 frustration');
  } else {
    next.trustInPrincipal = clamp(next.trustInPrincipal - 4);
    next.morale = clamp(next.morale - 3);
    next.frustration = clamp(next.frustration + 5);
    next.ego = clamp(next.ego - 2);
    outcome = `${meta.targetName} accepted the decision but felt their concerns were dismissed.`;
    tone = 'Negative';
    effects.push('-4 principal trust', '-3 morale', '+5 frustration', '-2 ego');
  }
  return {
    state: {
      ...state,
      driverRelationships: { ...state.driverRelationships!, [meta.targetId]: next },
      drivers: state.drivers.map((driver) => driver.id === meta.targetId ? { ...driver, morale: next.morale } : driver),
      driverPromises,
      promiseCounter,
    },
    outcome,
    tone,
    effects,
  };
}

function resolveStaffRequest(state: GameState, event: PaddockEvent, optionId: string): ResolutionResult {
  const meta = event.characterRequest!;
  const member = (state.staff ?? []).find((candidate) => candidate.id === meta.targetId);
  if (!member) return { state, outcome: 'The department request closed because the staff member is no longer with the team.', tone: 'Informational', effects: [] };
  const phase18 = ensurePhase18FoundationState(state.phase18, state);
  const departmentId = STAFF_DEPARTMENT[member.role];
  const mood = { ...phase18.departmentMoods[state.selectedTeamId][departmentId] };
  const effects: string[] = [];
  let outcome: string;
  let tone: CharacterRequestResolution['tone'];
  let teams = state.teams;
  let finance = state.finance;
  if (optionId === 'hear-department') {
    mood.trustInPrincipal = clamp(mood.trustInPrincipal + 4);
    mood.morale = clamp(mood.morale + 3);
    mood.strategicAlignment = clamp(mood.strategicAlignment + 4);
    mood.workload = clamp(mood.workload - 1);
    outcome = `${meta.targetName} felt heard and returned to the department with clearer priorities.`;
    tone = 'Positive';
    effects.push('+4 department trust', '+3 morale', '+4 alignment', '-1 workload');
  } else if (optionId === 'fund-support') {
    const cost = 500_000;
    const team = state.teams.find((candidate) => candidate.id === state.selectedTeamId);
    if ((team?.budget ?? 0) < cost) return { state, outcome: 'The support package could not be funded, leaving the department disappointed.', tone: 'Negative', effects: ['Support request unfunded'] };
    mood.trustInPrincipal = clamp(mood.trustInPrincipal + 3);
    mood.morale = clamp(mood.morale + 6);
    mood.strategicAlignment = clamp(mood.strategicAlignment + 2);
    mood.workload = clamp(mood.workload - 8);
    teams = state.teams.map((candidate) => candidate.id === state.selectedTeamId ? { ...candidate, budget: candidate.budget - cost } : candidate);
    finance = [...(state.finance ?? []), makeTransaction(state.seasonYear, 'Operations', `${departmentId} workload support`, -cost, roundOf(state))];
    outcome = `${meta.targetName} secured temporary support and the department workload eased immediately.`;
    tone = 'Positive';
    effects.push('-$500K budget', '+6 department morale', '-8 workload', '+3 trust');
  } else {
    mood.trustInPrincipal = clamp(mood.trustInPrincipal - 4);
    mood.morale = clamp(mood.morale - 3);
    mood.strategicAlignment = clamp(mood.strategicAlignment + 2);
    mood.workload = clamp(mood.workload + 2);
    outcome = `${meta.targetName} understands the instruction, but the department feels management ignored the strain.`;
    tone = 'Negative';
    effects.push('-4 department trust', '-3 morale', '+2 alignment', '+2 workload');
  }
  return {
    state: { ...state, teams, finance, phase18: { ...phase18, departmentMoods: { ...phase18.departmentMoods, [state.selectedTeamId]: { ...phase18.departmentMoods[state.selectedTeamId], [departmentId]: mood } } } },
    outcome,
    tone,
    effects,
  };
}

function resolveOwnerRequest(state: GameState, _event: PaddockEvent, optionId: string): ResolutionResult {
  const reputation = state.teamReputations?.[state.selectedTeamId];
  const principal = state.principal;
  if (!reputation || !principal) return { state, outcome: 'The review closed without a recorded ownership profile.', tone: 'Informational', effects: [] };
  const delta = optionId === 'present-evidence'
    ? { patience: 3, security: 2, board: 2, tone: 'Positive' as const }
    : optionId === 'commit-target'
      ? { patience: 2, security: 1, board: 1, tone: 'Mixed' as const }
      : { patience: -4, security: -3, board: -3, tone: 'Negative' as const };
  const outcome = optionId === 'present-evidence'
    ? 'Ownership accepted the evidence and granted management more room to execute the plan.'
    : optionId === 'commit-target'
      ? 'Ownership accepted the target but will expect visible progress in the coming rounds.'
      : 'Ownership rejected the challenge to its authority and confidence in management declined.';
  return {
    state: {
      ...state,
      teamReputations: { ...state.teamReputations!, [state.selectedTeamId]: { ...reputation, ownerPatience: clamp(reputation.ownerPatience + delta.patience) } },
      principal: { ...principal, jobSecurity: clamp(principal.jobSecurity + delta.security), attributes: { ...principal.attributes, boardConfidence: clamp(principal.attributes.boardConfidence + delta.board) } },
    },
    outcome,
    tone: delta.tone,
    effects: [`Owner patience ${delta.patience > 0 ? '+' : ''}${delta.patience}`, `Job security ${delta.security > 0 ? '+' : ''}${delta.security}`, `Board confidence ${delta.board > 0 ? '+' : ''}${delta.board}`],
  };
}

function resolveRivalRequest(state: GameState, event: PaddockEvent, optionId: string): ResolutionResult {
  const meta = event.characterRequest!;
  if (!meta.teamId) return { state, outcome: 'The paddock approach ended without a recorded rival team.', tone: 'Informational', effects: [] };
  const round = roundOf(state);
  if (optionId === 'private-channel') {
    return {
      state: addRivalRelationshipEvent(state, state.selectedTeamId, meta.teamId, { round, amount: 4, alignmentDelta: 3, trustDelta: 4, suspicionDelta: -2, reason: `A private paddock conversation with ${meta.targetName} lowered tension.`, category: 'Political' }),
      outcome: `${meta.targetName} agreed to keep a private channel open and avoid unnecessary escalation.`,
      tone: 'Positive',
      effects: ['+4 rival relationship', '+4 commercial trust', '-2 technical suspicion'],
    };
  }
  if (optionId === 'public-response') {
    const rivalPrincipal = state.aiPrincipals?.[meta.teamId];
    const pressured = addRivalRelationshipEvent(state, state.selectedTeamId, meta.teamId, { round, amount: -5, alignmentDelta: -3, trustDelta: -4, suspicionDelta: 2, reason: `Management took its dispute with ${meta.targetName} public.`, category: 'Political' });
    return {
      state: rivalPrincipal ? { ...pressured, aiPrincipals: { ...pressured.aiPrincipals!, [meta.teamId]: { ...rivalPrincipal, pressure: clamp(rivalPrincipal.pressure + 3) } } } : pressured,
      outcome: `${meta.targetName} responded through the media, turning the private approach into a public dispute.`,
      tone: 'Negative',
      effects: ['-5 rival relationship', '-4 commercial trust', '+3 rival pressure'],
    };
  }
  return {
    state: addRivalRelationshipEvent(state, state.selectedTeamId, meta.teamId, { round, amount: -1, reason: `Management declined a meeting with ${meta.targetName}.`, category: 'Political' }),
    outcome: `${meta.targetName} withdrew the invitation, leaving the underlying tension unresolved.`,
    tone: 'Mixed',
    effects: ['-1 rival relationship'],
  };
}

export function resolveCharacterRequest(state: GameState, event: PaddockEvent, optionId: string): GameState {
  const meta = event.characterRequest;
  if (!meta) return state;
  const interactions = ensureCharacterInteractionState(state.characterInteractions);
  if (interactions.requestHistory.some((record) => record.eventId === event.id)) return state;
  const optionLabel = event.options?.find((optionEntry) => optionEntry.id === optionId)?.label;
  if (!optionLabel) return state;
  const result = meta.requestKind === 'DriverConcern'
    ? resolveDriverRequest(state, event, optionId)
    : meta.requestKind === 'StaffSupport'
      ? resolveStaffRequest(state, event, optionId)
      : meta.requestKind === 'DriverMarketApproach' || meta.requestKind === 'StaffMarketApproach'
        ? resolveCharacterMarketApproach(state, event, optionId)
      : meta.requestKind === 'OwnerReview'
        ? resolveOwnerRequest(state, event, optionId)
        : resolveRivalRequest(state, event, optionId);
  const updatedInteractions = ensureCharacterInteractionState(result.state.characterInteractions);
  const record: CharacterRequestResolution = {
    id: `request-${state.seasonYear}-${roundOf(state)}-${meta.targetType}-${meta.targetId}-${updatedInteractions.requestHistory.length + 1}`,
    eventId: event.id,
    requestKind: meta.requestKind,
    targetType: meta.targetType,
    targetId: meta.targetId,
    targetName: meta.targetName,
    teamId: meta.teamId,
    seasonYear: state.seasonYear,
    round: roundOf(state),
    optionId,
    optionLabel,
    outcome: result.outcome,
    tone: result.tone,
    effects: result.effects,
  };
  const news = {
    id: `news-character-request-${record.id}`,
    headline: `${meta.targetName}: ${optionLabel}`,
    body: result.outcome,
    timestamp: new Date().toISOString(),
    category: 'career_event' as const,
    priority: event.isRequiredDecision ? 'high' as const : 'normal' as const,
    careerPhase: result.state.careerPhase?.currentPhase,
    teamId: meta.teamId,
    driverId: meta.targetType === 'Driver' ? meta.targetId : undefined,
  };
  const withRequestRecord: GameState = {
    ...result.state,
    characterInteractions: { ...updatedInteractions, requestHistory: [...updatedInteractions.requestHistory, record].slice(-250) },
    news: [news, ...result.state.news].slice(0, 80),
  };
  const target = {
    type: meta.targetType,
    id: meta.targetId,
    name: meta.targetName,
    teamId: meta.teamId,
  };
  const remembered = recordCharacterMemory(withRequestRecord, target, {
    source: 'Request',
    label: optionLabel,
    description: result.outcome,
    tone: result.tone,
    effects: result.effects,
  });
  const committed = createCharacterCommitmentFromRequest(remembered, event, optionId, result.effects);
  return propagateCharacterReaction(committed, target, result.tone, optionLabel);
}
