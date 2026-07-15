import type { GameState } from '../game/careerState';
import type { PaddockEvent, PaddockEventCategory } from '../types/careerPhaseTypes';
import type {
  CharacterInfluenceProfile,
  CharacterInfluenceStance,
  CharacterInteractionTarget,
} from '../types/characterInteractionTypes';
import type { DepartmentId } from '../types/phase18Types';
import type { StaffRole } from '../types/staffTypes';
import { ensureCharacterConnections, factionsForTarget } from './characterConnectionEngine';
import { characterOpinionFor, characterOpinionKey, currentCharacterTargets } from './characterOpinionEngine';
import { ensurePhase18FoundationState } from './phase18FoundationEngine';

const STAFF_DEPARTMENT: Record<StaffRole, DepartmentId> = {
  'Technical Director': 'Technical',
  'Race Engineer': 'Engineering',
  'Pit Crew Chief': 'RaceOperations',
  Strategist: 'RaceOperations',
};

function clamp(value: number, low = 0, high = 100): number {
  return Math.max(low, Math.min(high, Math.round(value)));
}

function roundOf(state: GameState): number {
  return state.careerPhase?.currentRound ?? state.currentRaceIndex + 1;
}

function stanceFor(support: number): CharacterInfluenceStance {
  if (support >= 50) return 'Champion';
  if (support >= 20) return 'Supportive';
  if (support > -20) return 'Neutral';
  if (support > -50) return 'Resistant';
  return 'Obstructive';
}

function rolePower(state: GameState, target: CharacterInteractionTarget): number {
  if (target.type === 'Owner') return 95;
  if (target.type === 'Staff') {
    const rating = state.staff?.find((entry) => entry.id === target.id)?.rating ?? 5;
    return clamp(45 + rating * 5);
  }
  if (target.type === 'Driver') {
    const rating = state.drivers.find((entry) => entry.id === target.id)?.ratings.overall ?? 5;
    return clamp(45 + rating * 5);
  }
  if (target.type === 'RivalPrincipal') return 70;
  return 35;
}

function effectLabel(target: CharacterInteractionTarget, stance: CharacterInfluenceStance): string {
  const positive = stance === 'Champion' || stance === 'Supportive';
  const negative = stance === 'Resistant' || stance === 'Obstructive';
  if (target.type === 'Driver') return positive ? 'Reinforces driver trust and morale' : negative ? 'Drains driver trust and morale' : 'No weekly driver effect';
  if (target.type === 'Staff') return positive ? 'Helps department morale and alignment' : negative ? 'Slows department alignment' : 'No weekly department effect';
  if (target.type === 'Owner') return positive ? 'Strengthens board and job backing' : negative ? 'Weakens board and job backing' : 'Ownership remains watchful';
  if (target.type === 'RivalPrincipal') return positive ? 'Makes paddock cooperation easier' : negative ? 'Creates external political resistance' : 'No current paddock leverage';
  return 'No weekly effect';
}

function calculateProfile(state: GameState, target: CharacterInteractionTarget): CharacterInfluenceProfile {
  const opinion = characterOpinionFor(state, target);
  const current = state.characterInteractions!;
  let support = opinion.score;
  const basis = [`Personal opinion ${opinion.score > 0 ? '+' : ''}${opinion.score}`];
  const factions = factionsForTarget(state, target);
  for (const faction of factions) {
    const modifier = faction.stance === 'Aligned' ? 6 : faction.stance === 'Fractured' ? -8 : -2;
    support += modifier;
    basis.push(`${faction.name} ${modifier > 0 ? '+' : ''}${modifier}`);
  }

  const targetDisputes = current.disputes.filter((entry) =>
    (entry.characterA.type === target.type && entry.characterA.id === target.id)
      || (entry.characterB.type === target.type && entry.characterB.id === target.id));
  const disputePenalty = targetDisputes.reduce((total, entry) => total + (entry.status === 'Escalating' ? -18 : entry.status === 'Active' ? -8 : entry.status === 'Mediated' ? -3 : 0), 0);
  if (disputePenalty) {
    support += disputePenalty;
    basis.push(`Unresolved conflict ${disputePenalty}`);
  }

  const commitments = current.commitments.filter((entry) => entry.target.type === target.type && entry.target.id === target.id);
  const recentCommitment = [...commitments].reverse().find((entry) => entry.status !== 'Active'
    && entry.resolvedSeason === state.seasonYear
    && roundOf(state) - (entry.resolvedRound ?? 0) <= 4);
  if (recentCommitment?.status === 'Fulfilled') {
    support += 10;
    basis.push('Recent commitment fulfilled +10');
  } else if (recentCommitment?.status === 'Broken') {
    support -= 15;
    basis.push('Recent commitment broken -15');
  } else if (commitments.some((entry) => entry.status === 'Active')) {
    support -= 2;
    basis.push('Active commitment pressure -2');
  }

  const normalizedSupport = clamp(support, -100, 100);
  const stance = stanceFor(normalizedSupport);
  return {
    target,
    power: rolePower(state, target),
    support: normalizedSupport,
    stance,
    basis: basis.slice(0, 4),
    effectLabel: effectLabel(target, stance),
    lastReportedStance: stance,
    lastUpdatedSeason: state.seasonYear,
    lastUpdatedRound: roundOf(state),
  };
}

export function ensureCharacterInfluence(state: GameState): GameState {
  const seeded = ensureCharacterConnections(state);
  const existing = new Map((seeded.characterInteractions?.influence ?? []).map((entry) => [characterOpinionKey(entry.target), entry]));
  const influence = currentCharacterTargets(seeded).map((target) => existing.get(characterOpinionKey(target)) ?? calculateProfile(seeded, target));
  return { ...seeded, characterInteractions: { ...seeded.characterInteractions!, influence } };
}

export function refreshCharacterInfluence(state: GameState): GameState {
  const seeded = ensureCharacterInfluence(state);
  const existing = new Map(seeded.characterInteractions!.influence.map((entry) => [characterOpinionKey(entry.target), entry]));
  const influence = currentCharacterTargets(seeded).map((target) => {
    const calculated = calculateProfile(seeded, target);
    const previous = existing.get(characterOpinionKey(target));
    return {
      ...calculated,
      lastReportedStance: previous?.stance ?? calculated.stance,
      lastAppliedSeason: previous?.lastAppliedSeason,
      lastAppliedRound: previous?.lastAppliedRound,
    };
  });
  return { ...seeded, characterInteractions: { ...seeded.characterInteractions!, influence } };
}

function stanceEffect(stance: CharacterInfluenceStance): number {
  if (stance === 'Champion' || stance === 'Supportive') return 1;
  if (stance === 'Resistant') return -1;
  if (stance === 'Obstructive') return -2;
  return 0;
}

export function applyCharacterInfluenceEffects(state: GameState): GameState {
  const current = state.characterInteractions;
  if (!current) return state;
  const round = roundOf(state);
  const due = current.influence.filter((profile) => profile.target.type !== 'RivalPrincipal'
    && (profile.lastAppliedSeason !== state.seasonYear || profile.lastAppliedRound !== round));
  if (!due.length) return state;

  const driverRelationships = state.driverRelationships ? { ...state.driverRelationships } : undefined;
  let drivers = state.drivers;
  const phase18 = ensurePhase18FoundationState(state.phase18, state);
  const departmentDelta = new Map<DepartmentId, number>();
  let ownerDelta = 0;

  for (const profile of due) {
    const delta = stanceEffect(profile.stance);
    if (profile.target.type === 'Driver' && driverRelationships?.[profile.target.id] && delta !== 0) {
      const relationship = driverRelationships[profile.target.id];
      const updated = {
        ...relationship,
        trustInPrincipal: clamp(relationship.trustInPrincipal + delta),
        morale: clamp(relationship.morale + delta),
        frustration: clamp(relationship.frustration - delta),
      };
      driverRelationships[profile.target.id] = updated;
      drivers = drivers.map((driver) => driver.id === profile.target.id ? { ...driver, morale: updated.morale } : driver);
    } else if (profile.target.type === 'Staff' && delta !== 0) {
      const member = state.staff?.find((entry) => entry.id === profile.target.id);
      if (member) departmentDelta.set(STAFF_DEPARTMENT[member.role], clamp((departmentDelta.get(STAFF_DEPARTMENT[member.role]) ?? 0) + delta, -2, 2));
    } else if (profile.target.type === 'Owner') {
      ownerDelta = clamp(ownerDelta + delta, -2, 2);
    }
  }

  const teamDepartments = { ...phase18.departmentMoods[state.selectedTeamId] };
  for (const [departmentId, delta] of departmentDelta) {
    const mood = teamDepartments[departmentId];
    teamDepartments[departmentId] = {
      ...mood,
      morale: clamp(mood.morale + delta),
      strategicAlignment: clamp(mood.strategicAlignment + delta),
      lastUpdatedSeasonYear: state.seasonYear,
      lastUpdatedRound: round,
    };
  }

  const reputation = state.teamReputations?.[state.selectedTeamId];
  const principal = state.principal && ownerDelta !== 0 ? {
    ...state.principal,
    jobSecurity: clamp(state.principal.jobSecurity + ownerDelta),
    attributes: { ...state.principal.attributes, boardConfidence: clamp(state.principal.attributes.boardConfidence + ownerDelta) },
  } : state.principal;
  const teamReputations = reputation && ownerDelta !== 0 ? {
    ...state.teamReputations,
    [state.selectedTeamId]: { ...reputation, ownerPatience: clamp(reputation.ownerPatience + ownerDelta) },
  } : state.teamReputations;
  const appliedKeys = new Set(due.map((profile) => characterOpinionKey(profile.target)));
  const influence = current.influence.map((profile) => appliedKeys.has(characterOpinionKey(profile.target))
    ? { ...profile, lastAppliedSeason: state.seasonYear, lastAppliedRound: round }
    : profile);

  return {
    ...state,
    drivers,
    driverRelationships,
    principal,
    teamReputations,
    phase18: { ...phase18, departmentMoods: { ...phase18.departmentMoods, [state.selectedTeamId]: teamDepartments } },
    characterInteractions: { ...current, influence },
  };
}

function eventCategory(profile: CharacterInfluenceProfile): PaddockEventCategory {
  if (profile.target.type === 'Driver') return 'driver_morale';
  if (profile.target.type === 'Owner') return 'finance';
  if (profile.target.type === 'RivalPrincipal') return 'regulation';
  return 'staff';
}

export function generateCharacterInfluenceEvents(state: GameState): PaddockEvent[] {
  const round = roundOf(state);
  const weekId = state.careerPhase?.paddockWeekId ?? `pw-${state.seasonYear}-${round}`;
  return (state.characterInteractions?.influence ?? [])
    .filter((profile) => profile.stance !== profile.lastReportedStance)
    .sort((a, b) => b.power - a.power || Math.abs(b.support) - Math.abs(a.support))
    .slice(0, 4)
    .map((profile) => ({
      id: `pe-${weekId}-influence-${profile.target.type}-${profile.target.id}-${profile.stance}`,
      weekId,
      season: state.seasonYear,
      series: state.series,
      round,
      category: eventCategory(profile),
      title: `${profile.target.name} is now ${profile.stance.toLowerCase()}`,
      description: `${profile.target.name}'s internal stance moved from ${profile.lastReportedStance.toLowerCase()} to ${profile.stance.toLowerCase()}. ${profile.effectLabel}.`,
      severity: profile.stance === 'Obstructive' ? 'major' as const : profile.stance === 'Champion' ? 'minor' as const : 'info' as const,
      isRequiredDecision: false,
      effectsApplied: true,
      createdAt: new Date(Date.UTC(state.seasonYear, 0, Math.max(1, round + 1))).toISOString(),
    }));
}

export function influenceForTarget(state: GameState, target: CharacterInteractionTarget): CharacterInfluenceProfile | undefined {
  const key = characterOpinionKey(target);
  return state.characterInteractions?.influence.find((entry) => characterOpinionKey(entry.target) === key);
}

export function internalCharacterInfluence(state: GameState): CharacterInfluenceProfile[] {
  return (state.characterInteractions?.influence ?? [])
    .filter((entry) => entry.target.type !== 'RivalPrincipal' && entry.target.type !== 'StaffCandidate')
    .sort((a, b) => b.power - a.power || b.support - a.support);
}
