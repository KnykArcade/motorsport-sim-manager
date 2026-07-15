import type { GameState } from '../game/careerState';
import type { PaddockEvent, PaddockEventCategory } from '../types/careerPhaseTypes';
import type { CharacterInitiative, CharacterInteractionTarget, CharacterMandate } from '../types/characterInteractionTypes';
import type { DepartmentId } from '../types/phase18Types';
import type { StaffRole } from '../types/staffTypes';
import { ensureCharacterInteractionState } from './characterInteractionEngine';
import { recordCharacterMemory } from './characterOpinionEngine';
import { ensurePhase18FoundationState } from './phase18FoundationEngine';
import { addRivalRelationshipEvent, rivalRelationship } from './phase18RivalRelationshipEngine';
import { staffRatingOutOfTen } from './staffEngine';

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

function deadlineReached(state: GameState, mandate: CharacterMandate): boolean {
  const seasonLength = Math.max(1, state.calendar.length);
  return state.seasonYear * seasonLength + roundOf(state) >= mandate.dueSeason * seasonLength + mandate.dueRound;
}

function targetIsActive(state: GameState, target: CharacterInteractionTarget): boolean {
  if (target.type === 'Driver') return state.drivers.some((driver) => driver.id === target.id && driver.teamId === state.selectedTeamId);
  if (target.type === 'Staff') return (state.staff ?? []).some((member) => member.id === target.id);
  if (target.type === 'Owner') return target.teamId === state.selectedTeamId && !!state.teamReputations?.[state.selectedTeamId];
  if (target.type === 'RivalPrincipal') return !!target.teamId && state.teams.some((team) => team.id === target.teamId);
  return false;
}

function measure(state: GameState, mandate: CharacterMandate): number {
  if (mandate.kind === 'GarageLeadership') return state.driverRelationships?.[mandate.target.id]?.teamTrustInDriver ?? 0;
  if (mandate.kind === 'DepartmentAuthority') {
    const member = state.staff?.find((entry) => entry.id === mandate.target.id);
    if (!member) return 0;
    const phase18 = ensurePhase18FoundationState(state.phase18, state);
    return phase18.departmentMoods[state.selectedTeamId][STAFF_DEPARTMENT[member.role]].strategicAlignment;
  }
  if (mandate.kind === 'OwnershipBacking') return state.teamReputations?.[state.selectedTeamId]?.ownerPatience ?? 0;
  if (mandate.target.teamId) return clamp((rivalRelationship(state, state.selectedTeamId, mandate.target.teamId)?.score ?? -50) + 50);
  return 0;
}

function kindFor(target: CharacterInteractionTarget): CharacterMandate['kind'] {
  if (target.type === 'Driver') return 'GarageLeadership';
  if (target.type === 'Staff') return 'DepartmentAuthority';
  if (target.type === 'Owner') return 'OwnershipBacking';
  return 'PaddockChannel';
}

function copyFor(target: CharacterInteractionTarget): Pick<CharacterMandate, 'title' | 'description' | 'measureLabel'> {
  if (target.type === 'Driver') return {
    title: `${target.name}: garage leadership mandate`,
    description: 'The driver has authority to set standards and must earn measurable trust from the team.',
    measureLabel: 'Team trust in driver',
  };
  if (target.type === 'Staff') return {
    title: `${target.name}: department authority mandate`,
    description: 'The staff member has authority to coordinate priorities and must improve department alignment.',
    measureLabel: 'Department alignment',
  };
  if (target.type === 'Owner') return {
    title: `${target.name}: backing mandate`,
    description: 'Ownership has agreed to visibly support management and must sustain that backing through the review period.',
    measureLabel: 'Owner patience',
  };
  return {
    title: `${target.name}: paddock channel mandate`,
    description: 'The rival principal has responsibility for keeping the private understanding productive.',
    measureLabel: 'Paddock relationship',
  };
}

export function ensureCharacterMandates(state: GameState): GameState {
  const interactions = ensureCharacterInteractionState(state.characterInteractions);
  return { ...state, characterInteractions: { ...interactions, mandates: interactions.mandates ?? [] } };
}

export function createCharacterMandateFromInitiative(state: GameState, initiative: CharacterInitiative, optionId: string): GameState {
  const authority = optionId === 'empower' || optionId === 'address-concerns' ? 'Full' as const
    : optionId === 'limited-mandate' || optionId === 'negotiate-boundaries' ? 'Limited' as const
      : undefined;
  if (!authority) return state;
  const seeded = ensureCharacterMandates(state);
  const current = seeded.characterInteractions!;
  if (current.mandates.some((entry) => entry.status === 'Active' && entry.target.type === initiative.target.type && entry.target.id === initiative.target.id)) return seeded;
  const due = addRounds(seeded, 3);
  const baselineDraft: CharacterMandate = {
    id: `mandate-${seeded.seasonYear}-${roundOf(seeded)}-${initiative.target.type}-${initiative.target.id}`,
    sourceInitiativeId: initiative.id,
    target: initiative.target,
    kind: kindFor(initiative.target),
    authority,
    ...copyFor(initiative.target),
    currentValue: 0,
    targetValue: 0,
    createdSeason: seeded.seasonYear,
    createdRound: roundOf(seeded),
    dueSeason: due.season,
    dueRound: due.round,
    status: 'Active',
    lastAppliedSeason: seeded.seasonYear,
    lastAppliedRound: roundOf(seeded),
  };
  const currentValue = measure(seeded, baselineDraft);
  const mandate = { ...baselineDraft, currentValue, targetValue: clamp(currentValue + (authority === 'Full' ? 4 : 2)) };
  return { ...seeded, characterInteractions: { ...current, mandates: [...current.mandates, mandate].slice(-250) } };
}

function contribution(state: GameState, mandate: CharacterMandate): number {
  if (mandate.authority === 'Limited') return 1;
  if (mandate.kind === 'GarageLeadership') return (state.drivers.find((entry) => entry.id === mandate.target.id)?.ratings.overall ?? 0) >= 8 ? 2 : 1;
  if (mandate.kind === 'DepartmentAuthority') return staffRatingOutOfTen(state.staff?.find((entry) => entry.id === mandate.target.id)?.rating ?? 0) >= 8 ? 2 : 1;
  return 2;
}

function applyContribution(state: GameState, mandate: CharacterMandate): GameState {
  const amount = contribution(state, mandate);
  if (mandate.kind === 'GarageLeadership') {
    const relationship = state.driverRelationships?.[mandate.target.id];
    if (!relationship) return state;
    return { ...state, driverRelationships: { ...state.driverRelationships!, [mandate.target.id]: { ...relationship, teamTrustInDriver: clamp(relationship.teamTrustInDriver + amount), teammateRelationship: clamp(relationship.teammateRelationship + 1) } } };
  }
  if (mandate.kind === 'DepartmentAuthority') {
    const member = state.staff?.find((entry) => entry.id === mandate.target.id);
    if (!member) return state;
    const phase18 = ensurePhase18FoundationState(state.phase18, state);
    const departmentId = STAFF_DEPARTMENT[member.role];
    const mood = phase18.departmentMoods[state.selectedTeamId][departmentId];
    return { ...state, phase18: { ...phase18, departmentMoods: { ...phase18.departmentMoods, [state.selectedTeamId]: { ...phase18.departmentMoods[state.selectedTeamId], [departmentId]: { ...mood, strategicAlignment: clamp(mood.strategicAlignment + amount), workload: clamp(mood.workload - 1), lastUpdatedSeasonYear: state.seasonYear, lastUpdatedRound: roundOf(state) } } } } };
  }
  if (mandate.kind === 'OwnershipBacking') {
    const reputation = state.teamReputations?.[state.selectedTeamId];
    if (!reputation) return state;
    return { ...state, teamReputations: { ...state.teamReputations!, [state.selectedTeamId]: { ...reputation, ownerPatience: clamp(reputation.ownerPatience + amount) } } };
  }
  if (!mandate.target.teamId) return state;
  return addRivalRelationshipEvent(state, state.selectedTeamId, mandate.target.teamId, { round: roundOf(state), amount, trustDelta: amount, suspicionDelta: -1, reason: `${mandate.target.name} worked on the delegated paddock channel.`, category: 'Political' });
}

function applyAccountability(state: GameState, mandate: CharacterMandate, succeeded: boolean): GameState {
  const delta = succeeded ? 2 : -3;
  if (mandate.kind === 'GarageLeadership') {
    const relationship = state.driverRelationships?.[mandate.target.id];
    if (!relationship) return state;
    const updated = { ...relationship, teamTrustInDriver: clamp(relationship.teamTrustInDriver + delta), morale: clamp(relationship.morale + delta) };
    return { ...state, driverRelationships: { ...state.driverRelationships!, [mandate.target.id]: updated }, drivers: state.drivers.map((driver) => driver.id === mandate.target.id ? { ...driver, morale: updated.morale } : driver) };
  }
  if (mandate.kind === 'DepartmentAuthority') {
    const member = state.staff?.find((entry) => entry.id === mandate.target.id);
    if (!member) return state;
    const phase18 = ensurePhase18FoundationState(state.phase18, state);
    const departmentId = STAFF_DEPARTMENT[member.role];
    const mood = phase18.departmentMoods[state.selectedTeamId][departmentId];
    return { ...state, phase18: { ...phase18, departmentMoods: { ...phase18.departmentMoods, [state.selectedTeamId]: { ...phase18.departmentMoods[state.selectedTeamId], [departmentId]: { ...mood, trustInPrincipal: clamp(mood.trustInPrincipal + delta), morale: clamp(mood.morale + delta), lastUpdatedSeasonYear: state.seasonYear, lastUpdatedRound: roundOf(state) } } } } };
  }
  if (mandate.kind === 'OwnershipBacking' && state.principal) return { ...state, principal: { ...state.principal, jobSecurity: clamp(state.principal.jobSecurity + delta), attributes: { ...state.principal.attributes, boardConfidence: clamp(state.principal.attributes.boardConfidence + delta) } } };
  if (mandate.target.teamId) return addRivalRelationshipEvent(state, state.selectedTeamId, mandate.target.teamId, { round: roundOf(state), amount: delta, trustDelta: delta, reason: succeeded ? 'The delegated paddock channel delivered its objective.' : 'The delegated paddock channel failed to deliver its objective.', category: 'Political' });
  return state;
}

export function advanceCharacterMandates(state: GameState): GameState {
  let next = ensureCharacterMandates(state);
  const mandates = [...next.characterInteractions!.mandates];
  for (let index = 0; index < mandates.length; index += 1) {
    let mandate = mandates[index];
    if (mandate.status !== 'Active') continue;
    if (!targetIsActive(next, mandate.target)) {
      mandate = { ...mandate, status: 'Revoked', resolvedSeason: next.seasonYear, resolvedRound: roundOf(next), outcome: 'The mandate ended because the character left the role before the review.' };
      mandates[index] = mandate;
      continue;
    }
    if (mandate.lastAppliedSeason !== next.seasonYear || mandate.lastAppliedRound !== roundOf(next)) {
      next = applyContribution(next, mandate);
      mandate = { ...mandate, currentValue: measure(next, mandate), lastAppliedSeason: next.seasonYear, lastAppliedRound: roundOf(next) };
      mandates[index] = mandate;
    }
    if (!deadlineReached(next, mandate)) continue;
    const succeeded = mandate.currentValue >= mandate.targetValue;
    const outcome = succeeded
      ? `${mandate.target.name} delivered the delegated mandate and strengthened their claim to future authority.`
      : `${mandate.target.name} failed to deliver the delegated mandate and now carries responsibility for the shortfall.`;
    mandate = { ...mandate, status: succeeded ? 'Succeeded' : 'Failed', resolvedSeason: next.seasonYear, resolvedRound: roundOf(next), outcome };
    mandates[index] = mandate;
    next = applyAccountability(next, mandate, succeeded);
    next = recordCharacterMemory(next, mandate.target, {
      source: 'Mandate',
      label: `${succeeded ? 'Mandate delivered' : 'Mandate failed'}: ${mandate.title}`,
      description: outcome,
      tone: succeeded ? 'Positive' : 'Negative',
      effects: [succeeded ? 'Accountability rewarded' : 'Accountability imposed', `${mandate.measureLabel} ${mandate.currentValue}/${mandate.targetValue}`],
    });
  }
  return { ...next, characterInteractions: { ...next.characterInteractions!, mandates } };
}

function categoryFor(target: CharacterInteractionTarget): PaddockEventCategory {
  if (target.type === 'Driver') return 'driver_morale';
  if (target.type === 'Staff') return 'staff';
  if (target.type === 'Owner') return 'finance';
  return 'regulation';
}

export function generateCharacterMandateEvents(state: GameState): PaddockEvent[] {
  const round = roundOf(state);
  const weekId = state.careerPhase?.paddockWeekId ?? `pw-${state.seasonYear}-${round}`;
  return (state.characterInteractions?.mandates ?? [])
    .filter((entry) => entry.resolvedSeason === state.seasonYear && entry.resolvedRound === round)
    .slice(0, 4)
    .map((entry) => ({
      id: `pe-${weekId}-${entry.id}-${entry.status}`,
      weekId,
      season: state.seasonYear,
      series: state.series,
      round,
      category: categoryFor(entry.target),
      title: `${entry.status === 'Succeeded' ? 'Mandate delivered' : entry.status === 'Revoked' ? 'Mandate ended' : 'Mandate failed'}: ${entry.target.name}`,
      description: `${entry.outcome} ${entry.measureLabel}: ${entry.currentValue}/${entry.targetValue}.`,
      severity: entry.status === 'Failed' ? 'major' as const : entry.status === 'Succeeded' ? 'minor' as const : 'info' as const,
      isRequiredDecision: false,
      effectsApplied: true,
      createdAt: new Date(Date.UTC(state.seasonYear, 0, Math.max(1, round + 1))).toISOString(),
    }));
}

export function mandatesForTarget(state: GameState, target: CharacterInteractionTarget): CharacterMandate[] {
  return (state.characterInteractions?.mandates ?? [])
    .filter((entry) => entry.target.type === target.type && entry.target.id === target.id)
    .sort((a, b) => (a.status === 'Active' ? -1 : 1) - (b.status === 'Active' ? -1 : 1) || b.createdSeason - a.createdSeason || b.createdRound - a.createdRound);
}

export function activeCharacterMandates(state: GameState): CharacterMandate[] {
  return (state.characterInteractions?.mandates ?? [])
    .filter((entry) => entry.status === 'Active')
    .sort((a, b) => a.dueSeason - b.dueSeason || a.dueRound - b.dueRound);
}
