import type { GameState } from '../game/careerState';
import type { StaffRole } from '../types/staffTypes';
import type {
  CharacterInteractionAction,
  CharacterInteractionRecord,
  CharacterInteractionState,
  CharacterInteractionTarget,
  CharacterInteractionTargetType,
} from '../types/characterInteractionTypes';
import type { DepartmentId } from '../types/phase18Types';
import { ensurePhase18FoundationState } from './phase18FoundationEngine';
import { addRivalRelationshipEvent } from './phase18RivalRelationshipEngine';
import { recordCharacterMemory } from './characterOpinionEngine';
import { propagateCharacterReaction } from './characterConnectionEngine';

export type CharacterActionSpec = {
  id: CharacterInteractionAction;
  label: string;
  description: string;
  effectPreview: string;
  targetTypes: CharacterInteractionTargetType[];
};

export const CHARACTER_ACTION_SPECS: CharacterActionSpec[] = [
  { id: 'PrivateConversation', label: 'Private Conversation', description: 'Listen without making a formal promise.', effectPreview: 'Builds trust and lowers frustration.', targetTypes: ['Driver'] },
  { id: 'PraisePerformance', label: 'Praise Performance', description: 'Publicly recognize the driver’s recent contribution.', effectPreview: 'Raises morale and confidence; may feed ego.', targetTypes: ['Driver'] },
  { id: 'ChallengePerformance', label: 'Challenge Performance', description: 'Demand more and make expectations explicit.', effectPreview: 'Can sharpen standards but risks morale and trust.', targetTypes: ['Driver'] },
  { id: 'MediateConflict', label: 'Mediate Teammate Conflict', description: 'Intervene before internal tension damages the garage.', effectPreview: 'Improves teammate relations and reduces frustration.', targetTypes: ['Driver'] },
  { id: 'DiscussFuture', label: 'Discuss Their Future', description: 'Hold an honest conversation about their place in the project.', effectPreview: 'Improves trust, especially when contract concerns are active.', targetTypes: ['Driver'] },
  { id: 'SeekAdvice', label: 'Seek Their Advice', description: 'Invite the specialist into the management process.', effectPreview: 'Improves trust and strategic alignment.', targetTypes: ['Staff'] },
  { id: 'PraiseStaffWork', label: 'Praise Their Work', description: 'Recognize the specialist and their department.', effectPreview: 'Raises department morale and trust.', targetTypes: ['Staff'] },
  { id: 'SetExpectations', label: 'Set Clear Expectations', description: 'Clarify priorities and accountability for the coming round.', effectPreview: 'Raises alignment and workload; may reduce trust slightly.', targetTypes: ['Staff'] },
  { id: 'ApproachRecruitment', label: 'Sound Out Interest', description: 'Make a discreet, non-binding recruitment approach.', effectPreview: 'Builds interest and can reduce the eventual signing fee.', targetTypes: ['StaffCandidate'] },
  { id: 'PresentLongTermPlan', label: 'Present Long-Term Plan', description: 'Show ownership how current decisions support a larger strategy.', effectPreview: 'Can improve owner patience and job security.', targetTypes: ['Owner'] },
  { id: 'RequestOwnerBacking', label: 'Request Public Backing', description: 'Ask the board to reinforce your authority.', effectPreview: 'High board confidence helps; a weak case can backfire.', targetTypes: ['Owner'] },
  { id: 'ReviewBudgetDiscipline', label: 'Review Budget Discipline', description: 'Demonstrate control of spending and financial priorities.', effectPreview: 'Financial discipline influences the owner’s response.', targetTypes: ['Owner'] },
  { id: 'OpenPrincipalDialogue', label: 'Open Private Dialogue', description: 'Establish a direct channel with the rival principal.', effectPreview: 'Improves paddock trust and reduces tension.', targetTypes: ['RivalPrincipal'] },
  { id: 'ExchangePaddockInformation', label: 'Exchange Paddock Information', description: 'Share limited non-sensitive information to build cooperation.', effectPreview: 'Improves trust while lowering technical suspicion.', targetTypes: ['RivalPrincipal'] },
  { id: 'ApplyPublicPressure', label: 'Apply Public Pressure', description: 'Challenge the rival principal’s conduct through the media.', effectPreview: 'Raises their pressure but damages the relationship.', targetTypes: ['RivalPrincipal'] },
];

const STAFF_DEPARTMENT: Record<StaffRole, DepartmentId> = {
  'Technical Director': 'Technical',
  'Race Engineer': 'Engineering',
  'Pit Crew Chief': 'RaceOperations',
  Strategist: 'RaceOperations',
};

function clamp(value: number, low = 0, high = 100): number {
  return Math.max(low, Math.min(high, Math.round(value)));
}

function currentRound(state: GameState): number {
  return state.careerPhase?.currentRound ?? state.currentRaceIndex + 1;
}

export function interactionTargetKey(target: CharacterInteractionTarget): string {
  return `${target.type}:${target.id}`;
}

export function ensureCharacterInteractionState(
  interactionState?: CharacterInteractionState,
): CharacterInteractionState {
  return {
    version: 13,
    history: interactionState?.history ?? [],
    lastInteractionByTarget: interactionState?.lastInteractionByTarget ?? {},
    recruitmentInterest: interactionState?.recruitmentInterest ?? {},
    requestHistory: interactionState?.requestHistory ?? [],
    opinions: interactionState?.opinions ?? {},
    memories: interactionState?.memories ?? [],
    ambitions: interactionState?.ambitions ?? [],
    connections: interactionState?.connections ?? [],
    factions: interactionState?.factions ?? [],
    disputes: interactionState?.disputes ?? [],
    commitments: interactionState?.commitments ?? [],
    influence: interactionState?.influence ?? [],
    initiatives: interactionState?.initiatives ?? [],
    mandates: interactionState?.mandates ?? [],
    stability: interactionState?.stability ?? [],
    breakingPoints: interactionState?.breakingPoints ?? [],
    futureIntentions: interactionState?.futureIntentions ?? [],
    personnelMoves: interactionState?.personnelMoves ?? [],
  };
}

export function isCharacterInteractionAvailable(
  state: GameState,
  target: CharacterInteractionTarget,
): boolean {
  const interactions = ensureCharacterInteractionState(state.characterInteractions);
  const last = interactions.lastInteractionByTarget[interactionTargetKey(target)];
  return !last || last.seasonYear !== state.seasonYear || last.round < currentRound(state);
}

export function availableCharacterActions(
  state: GameState,
  target: CharacterInteractionTarget,
): CharacterActionSpec[] {
  if (target.type === 'Driver') {
    const relationship = state.driverRelationships?.[target.id];
    if (!relationship || relationship.teamId !== state.selectedTeamId) return [];
  }
  if (target.type === 'Staff' && !(state.staff ?? []).some((member) => member.id === target.id)) return [];
  if (target.type === 'Owner' && target.teamId !== state.selectedTeamId) return [];
  if (target.type === 'RivalPrincipal' && (!target.teamId || target.teamId === state.selectedTeamId)) return [];
  return CHARACTER_ACTION_SPECS.filter((spec) => spec.targetTypes.includes(target.type));
}

function recordInteraction(
  state: GameState,
  target: CharacterInteractionTarget,
  action: CharacterInteractionAction,
  outcome: string,
  tone: CharacterInteractionRecord['tone'],
  effects: string[],
): GameState {
  const round = currentRound(state);
  const interactions = ensureCharacterInteractionState(state.characterInteractions);
  const spec = CHARACTER_ACTION_SPECS.find((candidate) => candidate.id === action)!;
  const record: CharacterInteractionRecord = {
    id: `interaction-${state.seasonYear}-${round}-${target.type}-${target.id}-${interactions.history.length + 1}`,
    targetType: target.type,
    targetId: target.id,
    targetName: target.name,
    teamId: target.teamId,
    action,
    actionLabel: spec.label,
    seasonYear: state.seasonYear,
    round,
    outcome,
    tone,
    effects,
  };
  return {
    ...state,
    characterInteractions: {
      ...interactions,
      history: [...interactions.history, record].slice(-250),
      lastInteractionByTarget: {
        ...interactions.lastInteractionByTarget,
        [interactionTargetKey(target)]: { seasonYear: state.seasonYear, round },
      },
    },
  };
}

function performDriverAction(
  state: GameState,
  target: CharacterInteractionTarget,
  action: CharacterInteractionAction,
): { state: GameState; outcome: string; tone: CharacterInteractionRecord['tone']; effects: string[] } | undefined {
  const relationship = state.driverRelationships?.[target.id];
  if (!relationship) return undefined;
  const next = { ...relationship };
  let outcome: string;
  let tone: CharacterInteractionRecord['tone'] = 'Positive';
  const effects: string[] = [];
  if (action === 'PrivateConversation') {
    next.trustInPrincipal = clamp(next.trustInPrincipal + 3);
    next.morale = clamp(next.morale + 1);
    next.frustration = clamp(next.frustration - 2);
    outcome = `${target.name} appreciated being heard without being given an empty promise.`;
    effects.push('+3 principal trust', '+1 morale', '-2 frustration');
  } else if (action === 'PraisePerformance') {
    next.trustInPrincipal = clamp(next.trustInPrincipal + 1);
    next.morale = clamp(next.morale + 3);
    next.selfConfidence = clamp(next.selfConfidence + 3);
    next.ego = clamp(next.ego + 1);
    outcome = `${target.name} responded well to the recognition and carries more confidence into the next round.`;
    effects.push('+3 morale', '+3 confidence', '+1 principal trust', '+1 ego');
  } else if (action === 'ChallengePerformance') {
    const receptive = next.teamTrustInDriver >= 55 || next.personalityTraits.includes('Resilient');
    next.teamTrustInDriver = clamp(next.teamTrustInDriver + 2);
    next.morale = clamp(next.morale - (receptive ? 1 : 3));
    next.frustration = clamp(next.frustration + (receptive ? 1 : 3));
    next.trustInPrincipal = clamp(next.trustInPrincipal + (receptive ? 1 : -2));
    outcome = receptive
      ? `${target.name} accepted the challenge and understood the standard being demanded.`
      : `${target.name} felt singled out and left the meeting more defensive than motivated.`;
    tone = receptive ? 'Mixed' : 'Negative';
    effects.push('+2 team performance expectation', receptive ? '-1 morale, +1 trust' : '-3 morale, -2 trust');
  } else if (action === 'MediateConflict') {
    next.teammateRelationship = clamp(next.teammateRelationship + 4);
    next.frustration = clamp(next.frustration - 2);
    next.trustInPrincipal = clamp(next.trustInPrincipal + 1);
    outcome = `${target.name} accepted the intervention and agreed to reset the working relationship inside the garage.`;
    effects.push('+4 teammate relationship', '-2 frustration', '+1 principal trust');
  } else if (action === 'DiscussFuture') {
    const contractConcern = next.wants.includes('contract_renewal') || next.wants.includes('race_seat_security');
    next.trustInPrincipal = clamp(next.trustInPrincipal + (contractConcern ? 3 : 2));
    next.frustration = clamp(next.frustration - (contractConcern ? 2 : 1));
    outcome = contractConcern
      ? `${target.name} still wants a formal commitment, but valued the direct discussion about their future.`
      : `${target.name} left with a clearer understanding of their place in the team.`;
    effects.push(contractConcern ? '+3 principal trust' : '+2 principal trust', contractConcern ? '-2 frustration' : '-1 frustration');
  } else return undefined;
  return {
    state: { ...state, driverRelationships: { ...state.driverRelationships!, [target.id]: next } },
    outcome,
    tone,
    effects,
  };
}

function performStaffAction(
  state: GameState,
  target: CharacterInteractionTarget,
  action: CharacterInteractionAction,
): { state: GameState; outcome: string; tone: CharacterInteractionRecord['tone']; effects: string[] } | undefined {
  if (target.type === 'StaffCandidate' && action === 'ApproachRecruitment') {
    const interactions = ensureCharacterInteractionState(state.characterInteractions);
    const interest = clamp((interactions.recruitmentInterest[target.id] ?? 0) + 20);
    return {
      state: { ...state, characterInteractions: { ...interactions, recruitmentInterest: { ...interactions.recruitmentInterest, [target.id]: interest } } },
      outcome: `${target.name} is receptive to further talks but has not committed to joining the team.`,
      tone: 'Positive',
      effects: [`Recruitment interest ${interest}/100`, `Potential signing-fee reduction ${Math.round(recruitmentSigningDiscount({ ...state, characterInteractions: { ...interactions, recruitmentInterest: { ...interactions.recruitmentInterest, [target.id]: interest } } }, target.id) * 100)}%`],
    };
  }
  const member = (state.staff ?? []).find((candidate) => candidate.id === target.id);
  if (!member) return undefined;
  const phase18 = ensurePhase18FoundationState(state.phase18, state);
  const departmentId = STAFF_DEPARTMENT[member.role];
  const current = phase18.departmentMoods[state.selectedTeamId][departmentId];
  const mood = { ...current };
  let outcome: string;
  let tone: CharacterInteractionRecord['tone'] = 'Positive';
  const effects: string[] = [];
  if (action === 'SeekAdvice') {
    mood.trustInPrincipal = clamp(mood.trustInPrincipal + 2);
    mood.strategicAlignment = clamp(mood.strategicAlignment + 2);
    outcome = `${target.name} valued being consulted and offered a clearer view of the department’s priorities.`;
    effects.push('+2 department trust', '+2 strategic alignment');
  } else if (action === 'PraiseStaffWork') {
    mood.trustInPrincipal = clamp(mood.trustInPrincipal + 2);
    mood.morale = clamp(mood.morale + 3);
    outcome = `${target.name} shared the recognition with the department, lifting confidence in the current direction.`;
    effects.push('+2 department trust', '+3 department morale');
  } else if (action === 'SetExpectations') {
    mood.strategicAlignment = clamp(mood.strategicAlignment + 3);
    mood.workload = clamp(mood.workload + 2);
    mood.trustInPrincipal = clamp(mood.trustInPrincipal - 1);
    outcome = `${target.name} understands the target, but the extra pressure will increase the department’s workload.`;
    tone = 'Mixed';
    effects.push('+3 strategic alignment', '+2 workload', '-1 department trust');
  } else return undefined;
  return {
    state: {
      ...state,
      phase18: {
        ...phase18,
        departmentMoods: {
          ...phase18.departmentMoods,
          [state.selectedTeamId]: {
            ...phase18.departmentMoods[state.selectedTeamId],
            [departmentId]: mood,
          },
        },
      },
    },
    outcome,
    tone,
    effects,
  };
}

function performOwnerAction(
  state: GameState,
  target: CharacterInteractionTarget,
  action: CharacterInteractionAction,
): { state: GameState; outcome: string; tone: CharacterInteractionRecord['tone']; effects: string[] } | undefined {
  if (target.teamId !== state.selectedTeamId) return undefined;
  const reputation = state.teamReputations?.[state.selectedTeamId];
  const principal = state.principal;
  if (!reputation || !principal) return undefined;
  let patienceDelta: number;
  let securityDelta: number;
  let boardDelta: number;
  let outcome: string;
  let tone: CharacterInteractionRecord['tone'] = 'Positive';
  if (action === 'PresentLongTermPlan') {
    patienceDelta = 2;
    securityDelta = 2;
    boardDelta = 1;
    outcome = 'Ownership accepted the long-term logic and granted management slightly more room to execute it.';
  } else if (action === 'RequestOwnerBacking') {
    const credible = principal.attributes.boardConfidence >= 55 && principal.reputation >= 40;
    patienceDelta = credible ? 0 : -2;
    securityDelta = credible ? 3 : -2;
    boardDelta = credible ? 1 : -2;
    outcome = credible
      ? 'Ownership publicly reinforced your authority after accepting the case you presented.'
      : 'Ownership felt the request was premature and questioned why public backing was necessary.';
    tone = credible ? 'Positive' : 'Negative';
  } else if (action === 'ReviewBudgetDiscipline') {
    const disciplined = principal.attributes.financialDiscipline >= 55;
    patienceDelta = disciplined ? 2 : -1;
    securityDelta = 0;
    boardDelta = disciplined ? 2 : -1;
    outcome = disciplined
      ? 'The budget review strengthened ownership’s confidence in your financial control.'
      : 'The review exposed gaps in financial control and failed to reassure ownership.';
    tone = disciplined ? 'Positive' : 'Negative';
  } else return undefined;
  const updatedReputation = { ...reputation, ownerPatience: clamp(reputation.ownerPatience + patienceDelta) };
  const updatedPrincipal = {
    ...principal,
    jobSecurity: clamp(principal.jobSecurity + securityDelta),
    attributes: { ...principal.attributes, boardConfidence: clamp(principal.attributes.boardConfidence + boardDelta) },
  };
  const effects = [
    ...(patienceDelta ? [`Owner patience ${patienceDelta > 0 ? '+' : ''}${patienceDelta}`] : []),
    ...(securityDelta ? [`Job security ${securityDelta > 0 ? '+' : ''}${securityDelta}`] : []),
    ...(boardDelta ? [`Board confidence ${boardDelta > 0 ? '+' : ''}${boardDelta}`] : []),
  ];
  return { state: { ...state, teamReputations: { ...state.teamReputations!, [state.selectedTeamId]: updatedReputation }, principal: updatedPrincipal }, outcome, tone, effects };
}

function performRivalPrincipalAction(
  state: GameState,
  target: CharacterInteractionTarget,
  action: CharacterInteractionAction,
): { state: GameState; outcome: string; tone: CharacterInteractionRecord['tone']; effects: string[] } | undefined {
  if (!target.teamId || target.teamId === state.selectedTeamId) return undefined;
  const round = currentRound(state);
  if (action === 'OpenPrincipalDialogue') {
    return {
      state: addRivalRelationshipEvent(state, state.selectedTeamId, target.teamId, { round, amount: 4, alignmentDelta: 3, trustDelta: 4, suspicionDelta: -2, reason: `Private leadership dialogue with ${target.name} lowered paddock tension.`, category: 'Political' }),
      outcome: `${target.name} agreed to keep a direct private channel open between the two teams.`,
      tone: 'Positive',
      effects: ['+4 team relationship', '+4 commercial trust', '-2 technical suspicion'],
    };
  }
  if (action === 'ExchangePaddockInformation') {
    return {
      state: addRivalRelationshipEvent(state, state.selectedTeamId, target.teamId, { round, amount: 2, trustDelta: 3, suspicionDelta: -4, reason: `A limited information exchange with ${target.name} built cautious cooperation.`, category: 'Technical' }),
      outcome: `${target.name} reciprocated with limited information, improving trust without exposing sensitive work.`,
      tone: 'Positive',
      effects: ['+2 team relationship', '+3 commercial trust', '-4 technical suspicion'],
    };
  }
  if (action === 'ApplyPublicPressure') {
    const rival = state.aiPrincipals?.[target.teamId];
    const pressured = addRivalRelationshipEvent(state, state.selectedTeamId, target.teamId, { round, amount: -6, alignmentDelta: -3, trustDelta: -5, suspicionDelta: 2, reason: `Public criticism increased pressure on ${target.name}.`, category: 'Political', tags: ['HistoricRival'] });
    return {
      state: rival ? { ...pressured, aiPrincipals: { ...pressured.aiPrincipals!, [target.teamId]: { ...rival, pressure: clamp(rival.pressure + 4) } } } : pressured,
      outcome: `${target.name} rejected the criticism publicly, escalating tension between the teams.`,
      tone: 'Negative',
      effects: ['-6 team relationship', '-5 commercial trust', '+4 rival pressure'],
    };
  }
  return undefined;
}

export function performCharacterInteraction(
  state: GameState,
  target: CharacterInteractionTarget,
  action: CharacterInteractionAction,
): GameState {
  if (!isCharacterInteractionAvailable(state, target)) return state;
  if (!availableCharacterActions(state, target).some((spec) => spec.id === action)) return state;
  const result = target.type === 'Driver'
    ? performDriverAction(state, target, action)
    : target.type === 'Staff' || target.type === 'StaffCandidate'
      ? performStaffAction(state, target, action)
      : target.type === 'Owner'
        ? performOwnerAction(state, target, action)
        : performRivalPrincipalAction(state, target, action);
  if (!result) return state;
  const recorded = recordInteraction(result.state, target, action, result.outcome, result.tone, result.effects);
  const actionLabel = CHARACTER_ACTION_SPECS.find((spec) => spec.id === action)?.label ?? action;
  const remembered = recordCharacterMemory(recorded, target, {
    source: 'Interaction',
    label: actionLabel,
    description: result.outcome,
    tone: result.tone,
    effects: result.effects,
  });
  return propagateCharacterReaction(remembered, target, result.tone, actionLabel);
}

export function recruitmentSigningDiscount(state: GameState, staffId: string): number {
  const interest = ensureCharacterInteractionState(state.characterInteractions).recruitmentInterest[staffId] ?? 0;
  return Math.min(0.15, interest / 400);
}

export function interactionHistoryForTarget(
  state: GameState,
  target: CharacterInteractionTarget,
): CharacterInteractionRecord[] {
  return ensureCharacterInteractionState(state.characterInteractions).history
    .filter((record) => record.targetType === target.type && record.targetId === target.id)
    .reverse();
}

export function characterRequestHistoryForTarget(
  state: GameState,
  target: CharacterInteractionTarget,
) {
  return ensureCharacterInteractionState(state.characterInteractions).requestHistory
    .filter((record) => record.targetType === target.type && record.targetId === target.id)
    .reverse();
}
