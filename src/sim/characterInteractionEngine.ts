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
import {
  OWNER_PERSONALITY_LABELS,
  type OwnerPersonality,
} from '../types/expectationTypes';
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

export type OwnerActionPersonalityContext = {
  fit: 'Favored' | 'Neutral' | 'Skeptical';
  ownerLabel: string;
  explanation: string;
};

export type DriverActionRelationshipContext = {
  fit: 'Favored' | 'Neutral' | 'Risky';
  explanation: string;
};

const OWNER_ACTION_FIT: Record<OwnerPersonality, Record<'PresentLongTermPlan' | 'RequestOwnerBacking' | 'ReviewBudgetDiscipline', OwnerActionPersonalityContext['fit']>> = {
  PatientBuilder: { PresentLongTermPlan: 'Favored', RequestOwnerBacking: 'Neutral', ReviewBudgetDiscipline: 'Neutral' },
  WinNowTycoon: { PresentLongTermPlan: 'Skeptical', RequestOwnerBacking: 'Favored', ReviewBudgetDiscipline: 'Skeptical' },
  BudgetHawk: { PresentLongTermPlan: 'Neutral', RequestOwnerBacking: 'Skeptical', ReviewBudgetDiscipline: 'Favored' },
  RacingPurist: { PresentLongTermPlan: 'Favored', RequestOwnerBacking: 'Neutral', ReviewBudgetDiscipline: 'Neutral' },
  Showman: { PresentLongTermPlan: 'Skeptical', RequestOwnerBacking: 'Favored', ReviewBudgetDiscipline: 'Skeptical' },
  OldGuard: { PresentLongTermPlan: 'Favored', RequestOwnerBacking: 'Neutral', ReviewBudgetDiscipline: 'Neutral' },
};

const OWNER_FIT_EXPLANATION: Record<OwnerPersonality, Record<OwnerActionPersonalityContext['fit'], string>> = {
  PatientBuilder: {
    Favored: 'Values patient progress and gives credible long-term plans extra room.',
    Neutral: 'Will judge this on the strength of the evidence rather than personal preference.',
    Skeptical: 'Prefers patient progress over a short-term presentation.',
  },
  WinNowTycoon: {
    Favored: 'Rewards decisive authority when the principal has the standing to support it.',
    Neutral: 'Will judge this against immediate competitive results.',
    Skeptical: 'Wants proof now; planning or control without results carries less weight.',
  },
  BudgetHawk: {
    Favored: 'Financial discipline is a defining ownership priority and is judged strictly.',
    Neutral: 'Will listen, but remains focused on cost control and financial evidence.',
    Skeptical: 'Dislikes requests that are not backed by clear financial control.',
  },
  RacingPurist: {
    Favored: 'Supports plans built around sporting development, integrity, and the racing project.',
    Neutral: 'Will judge this against the team’s sporting identity.',
    Skeptical: 'Resists arguments that neglect the team’s sporting identity.',
  },
  Showman: {
    Favored: 'Likes visible leadership, bold positioning, and a strong public story.',
    Neutral: 'Will judge whether the idea creates public or commercial momentum.',
    Skeptical: 'Routine planning and restraint do little to satisfy a demand for momentum.',
  },
  OldGuard: {
    Favored: 'Values continuity and will give an established plan time to work.',
    Neutral: 'Will judge this through loyalty, stability, and established practice.',
    Skeptical: 'Distrusts proposals that discard continuity without a compelling reason.',
  },
};

export function ownerActionPersonalityContext(
  state: GameState,
  action: CharacterInteractionAction,
): OwnerActionPersonalityContext | undefined {
  if (action !== 'PresentLongTermPlan' && action !== 'RequestOwnerBacking' && action !== 'ReviewBudgetDiscipline') return undefined;
  const personality = state.teamReputations?.[state.selectedTeamId]?.ownerPersonality ?? 'PatientBuilder';
  const fit = OWNER_ACTION_FIT[personality][action];
  return {
    fit,
    ownerLabel: OWNER_PERSONALITY_LABELS[personality],
    explanation: OWNER_FIT_EXPLANATION[personality][fit],
  };
}

export function driverActionRelationshipContext(
  state: GameState,
  target: CharacterInteractionTarget,
  action: CharacterInteractionAction,
): DriverActionRelationshipContext | undefined {
  if (target.type !== 'Driver') return undefined;
  const relationship = state.driverRelationships?.[target.id];
  if (!relationship) return undefined;
  const traits = relationship.personalityTraits;

  if (action === 'PrivateConversation') {
    const needsListening = relationship.frustration >= 45
      || relationship.trustInPrincipal < 50
      || traits.some((trait) => trait === 'Pressure Sensitive' || trait === 'Demanding' || trait === 'Political');
    return needsListening
      ? { fit: 'Favored', explanation: 'Current frustration, trust, or personality makes a private listening session especially valuable.' }
      : { fit: 'Neutral', explanation: 'A safe trust-building conversation, but no urgent personal concern increases its effect.' };
  }

  if (action === 'PraisePerformance') {
    const valuesRecognition = relationship.selfConfidence < 50
      || traits.some((trait) => trait === 'High Ego' || trait === 'Confidence Driven' || trait === 'Media Friendly');
    return valuesRecognition
      ? { fit: 'Favored', explanation: 'This driver currently needs confidence or has traits that respond strongly to recognition.' }
      : { fit: 'Neutral', explanation: 'Recognition should help, though this driver has no strong current need for it.' };
  }

  if (action === 'ChallengePerformance') {
    const vulnerable = relationship.selfConfidence < 40
      || relationship.morale < 40
      || traits.includes('Pressure Sensitive');
    if (vulnerable) return { fit: 'Risky', explanation: 'Low confidence, low morale, or pressure sensitivity makes a direct challenge likely to backfire.' };
    const receptive = relationship.teamTrustInDriver >= 55
      && traits.some((trait) => trait === 'Resilient' || trait === 'Calm Under Pressure' || trait === 'Ambitious');
    return receptive
      ? { fit: 'Favored', explanation: 'Strong internal standing and a resilient or ambitious temperament make this driver receptive to a challenge.' }
      : { fit: 'Neutral', explanation: 'The driver may accept the standard, but their current profile offers no clear advantage.' };
  }

  if (action === 'MediateConflict') {
    const needsMediation = relationship.teammateRelationship < 55
      || traits.includes('Rivalry Prone')
      || relationship.wants.includes('better_teammate_treatment');
    return needsMediation
      ? { fit: 'Favored', explanation: 'Teammate tension, rivalry traits, or an active fairness concern makes mediation timely.' }
      : { fit: 'Neutral', explanation: 'The garage relationship is not currently tense enough to amplify the intervention.' };
  }

  if (action === 'DiscussFuture') {
    const futureConcern = relationship.wants.some((want) =>
      want === 'contract_renewal'
      || want === 'race_seat_security'
      || want === 'number_one_status'
      || want === 'better_salary'
      || want === 'academy_promotion');
    return futureConcern
      ? { fit: 'Favored', explanation: 'An active contract, role, salary, or seat concern makes an honest future discussion especially important.' }
      : { fit: 'Neutral', explanation: 'The driver has no urgent future-status concern, so this mainly provides general clarity.' };
  }

  return undefined;
}

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
  const context = driverActionRelationshipContext(state, target, action);
  const fit = context?.fit ?? 'Neutral';
  let outcome: string;
  let tone: CharacterInteractionRecord['tone'] = 'Positive';
  const effects: string[] = [];
  if (action === 'PrivateConversation') {
    const trustDelta = fit === 'Favored' ? 4 : 3;
    const moraleDelta = fit === 'Favored' ? 2 : 1;
    const frustrationDelta = fit === 'Favored' ? -3 : -2;
    next.trustInPrincipal = clamp(next.trustInPrincipal + trustDelta);
    next.morale = clamp(next.morale + moraleDelta);
    next.frustration = clamp(next.frustration + frustrationDelta);
    outcome = fit === 'Favored'
      ? `${target.name} needed the private channel and responded strongly to being heard without an empty promise.`
      : `${target.name} appreciated being heard without being given an empty promise.`;
    effects.push(`+${trustDelta} principal trust`, `+${moraleDelta} morale`, `${frustrationDelta} frustration`);
  } else if (action === 'PraisePerformance') {
    const moraleDelta = fit === 'Favored' ? 4 : 3;
    const confidenceDelta = fit === 'Favored' ? 4 : 3;
    const egoDelta = next.personalityTraits.includes('High Ego') ? 2 : 1;
    next.trustInPrincipal = clamp(next.trustInPrincipal + 1);
    next.morale = clamp(next.morale + moraleDelta);
    next.selfConfidence = clamp(next.selfConfidence + confidenceDelta);
    next.ego = clamp(next.ego + egoDelta);
    outcome = fit === 'Favored'
      ? `${target.name} strongly valued the recognition and carries a larger confidence lift into the next round.`
      : `${target.name} responded well to the recognition and carries more confidence into the next round.`;
    effects.push(`+${moraleDelta} morale`, `+${confidenceDelta} confidence`, '+1 principal trust', `+${egoDelta} ego`);
  } else if (action === 'ChallengePerformance') {
    const trustDelta = fit === 'Favored' ? 1 : fit === 'Risky' ? -3 : 0;
    const moraleDelta = fit === 'Favored' ? -1 : fit === 'Risky' ? -4 : -2;
    const frustrationDelta = fit === 'Favored' ? 1 : fit === 'Risky' ? 4 : 2;
    next.teamTrustInDriver = clamp(next.teamTrustInDriver + 2);
    next.morale = clamp(next.morale + moraleDelta);
    next.frustration = clamp(next.frustration + frustrationDelta);
    next.trustInPrincipal = clamp(next.trustInPrincipal + trustDelta);
    outcome = fit === 'Favored'
      ? `${target.name} accepted the challenge and understood the standard being demanded.`
      : fit === 'Risky'
        ? `${target.name} felt singled out at a vulnerable moment and left the meeting more defensive than motivated.`
        : `${target.name} understood the standard but left the meeting under additional pressure.`;
    tone = fit === 'Risky' ? 'Negative' : 'Mixed';
    effects.push(
      '+2 team trust in driver',
      `${moraleDelta} morale`,
      `+${frustrationDelta} frustration`,
      ...(trustDelta ? [`${trustDelta > 0 ? '+' : ''}${trustDelta} principal trust`] : []),
    );
  } else if (action === 'MediateConflict') {
    const teammateDelta = fit === 'Favored' ? 5 : 4;
    const frustrationDelta = fit === 'Favored' ? -3 : -2;
    const trustDelta = fit === 'Favored' ? 2 : 1;
    next.teammateRelationship = clamp(next.teammateRelationship + teammateDelta);
    next.frustration = clamp(next.frustration + frustrationDelta);
    next.trustInPrincipal = clamp(next.trustInPrincipal + trustDelta);
    outcome = fit === 'Favored'
      ? `${target.name} accepted the timely intervention and made meaningful progress toward resetting the garage relationship.`
      : `${target.name} accepted the intervention and agreed to reset the working relationship inside the garage.`;
    effects.push(`+${teammateDelta} teammate relationship`, `${frustrationDelta} frustration`, `+${trustDelta} principal trust`);
  } else if (action === 'DiscussFuture') {
    const trustDelta = fit === 'Favored' ? 4 : 2;
    const frustrationDelta = fit === 'Favored' ? -3 : -1;
    next.trustInPrincipal = clamp(next.trustInPrincipal + trustDelta);
    next.frustration = clamp(next.frustration + frustrationDelta);
    outcome = fit === 'Favored'
      ? `${target.name} still wants a formal commitment, but valued the direct discussion about their future.`
      : `${target.name} left with a clearer understanding of their place in the team.`;
    effects.push(`+${trustDelta} principal trust`, `${frustrationDelta} frustration`);
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
  let tone: CharacterInteractionRecord['tone'];
  const context = ownerActionPersonalityContext(state, action);
  const fit = context?.fit ?? 'Neutral';
  if (action === 'PresentLongTermPlan') {
    patienceDelta = fit === 'Favored' ? 3 : fit === 'Skeptical' ? 1 : 2;
    securityDelta = fit === 'Favored' ? 3 : fit === 'Skeptical' ? 1 : 2;
    boardDelta = 1;
    outcome = fit === 'Favored'
      ? `The ${context?.ownerLabel} strongly backed the long-term logic and granted management more room to execute it.`
      : fit === 'Skeptical'
        ? `The ${context?.ownerLabel} accepted parts of the plan but still wants more immediate proof.`
        : 'Ownership accepted the long-term logic and granted management slightly more room to execute it.';
    tone = fit === 'Skeptical' ? 'Mixed' : 'Positive';
  } else if (action === 'RequestOwnerBacking') {
    const credible = principal.attributes.boardConfidence >= 55 && principal.reputation >= 40;
    patienceDelta = credible ? (fit === 'Favored' ? 1 : fit === 'Skeptical' ? -1 : 0) : fit === 'Favored' ? -1 : fit === 'Skeptical' ? -3 : -2;
    securityDelta = credible ? (fit === 'Favored' ? 4 : 3) : -2;
    boardDelta = credible ? (fit === 'Skeptical' ? 0 : 1) : -2;
    outcome = credible
      ? fit === 'Favored'
        ? `The ${context?.ownerLabel} embraced the visible show of authority and reinforced your position.`
        : fit === 'Skeptical'
          ? `The ${context?.ownerLabel} backed your authority but disliked being asked to make it public.`
          : 'Ownership publicly reinforced your authority after accepting the case you presented.'
      : `The ${context?.ownerLabel ?? 'owner'} felt the request was premature and questioned why public backing was necessary.`;
    tone = credible ? (fit === 'Skeptical' ? 'Mixed' : 'Positive') : 'Negative';
  } else if (action === 'ReviewBudgetDiscipline') {
    const disciplined = principal.attributes.financialDiscipline >= 55;
    patienceDelta = disciplined ? (fit === 'Favored' ? 4 : fit === 'Skeptical' ? 1 : 2) : fit === 'Favored' ? -3 : -1;
    securityDelta = 0;
    boardDelta = disciplined ? (fit === 'Favored' ? 3 : fit === 'Skeptical' ? 1 : 2) : fit === 'Favored' ? -2 : -1;
    outcome = disciplined
      ? fit === 'Favored'
        ? `The ${context?.ownerLabel} considered the disciplined budget review exactly the evidence ownership wanted.`
        : fit === 'Skeptical'
          ? `The ${context?.ownerLabel} accepted the financial control but remains focused on other priorities.`
          : 'The budget review strengthened ownership’s confidence in your financial control.'
      : fit === 'Favored'
        ? `The ${context?.ownerLabel} treated the gaps in financial control as a serious failure of ownership’s core priority.`
        : 'The review exposed gaps in financial control and failed to reassure ownership.';
    tone = disciplined ? (fit === 'Skeptical' ? 'Mixed' : 'Positive') : 'Negative';
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
