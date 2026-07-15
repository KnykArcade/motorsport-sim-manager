import type { GameState } from '../game/careerState';
import type { PaddockEvent, PaddockEventCategory, PaddockEventOption } from '../types/careerPhaseTypes';
import type {
  CharacterBreakingPoint,
  CharacterInteractionTarget,
  CharacterStabilityBand,
  CharacterStabilityProfile,
} from '../types/characterInteractionTypes';
import type { DepartmentId } from '../types/phase18Types';
import type { StaffRole } from '../types/staffTypes';
import { ensureCharacterInfluence } from './characterInfluenceEngine';
import { characterOpinionFor, characterOpinionKey, currentCharacterTargets, recordCharacterMemory } from './characterOpinionEngine';
import { ensurePhase18FoundationState } from './phase18FoundationEngine';
import { addRivalRelationshipEvent } from './phase18RivalRelationshipEngine';

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

function timelineIndex(state: GameState, season: number, round: number): number {
  return season * Math.max(1, state.calendar.length) + round;
}

function bandFor(score: number): CharacterStabilityBand {
  if (score >= 65) return 'Secure';
  if (score >= 45) return 'Watchful';
  if (score >= 25) return 'Unsettled';
  return 'BreakingPoint';
}

function sameTarget(target: CharacterInteractionTarget, entry: { target: CharacterInteractionTarget }): boolean {
  return entry.target.type === target.type && entry.target.id === target.id;
}

function lastForTarget<T extends { target: CharacterInteractionTarget }>(entries: T[], target: CharacterInteractionTarget): T | undefined {
  return entries.filter((entry) => sameTarget(target, entry)).at(-1);
}

function calculateProfile(state: GameState, target: CharacterInteractionTarget, prior?: CharacterStabilityProfile): CharacterStabilityProfile {
  const interactions = state.characterInteractions!;
  const opinion = characterOpinionFor(state, target);
  const influence = interactions.influence.find((entry) => sameTarget(target, entry));
  const ambition = interactions.ambitions.filter((entry) => entry.targetType === target.type && entry.targetId === target.id).at(-1);
  const commitment = lastForTarget(interactions.commitments, target);
  const mandate = lastForTarget(interactions.mandates, target);
  const dispute = [...interactions.disputes].reverse().find((entry) =>
    (entry.characterA.type === target.type && entry.characterA.id === target.id)
    || (entry.characterB.type === target.type && entry.characterB.id === target.id));
  const memories = interactions.memories
    .filter((entry) => entry.targetType === target.type && entry.targetId === target.id)
    .slice(-5);

  let score = 50 + opinion.score * 0.4 + (influence?.support ?? 0) * 0.12;
  const reasons: string[] = [];
  if (opinion.score <= -25) reasons.push('Low trust in your leadership');
  else if (opinion.score >= 25) reasons.push('Strong trust in your leadership');
  if (influence?.stance === 'Obstructive' || influence?.stance === 'Resistant') reasons.push(`${influence.stance} internal stance`);
  if (influence?.stance === 'Champion' || influence?.stance === 'Supportive') reasons.push(`${influence.stance} internal support`);

  if (ambition?.status === 'Failed') { score -= 12; reasons.push('A recent ambition was missed'); }
  if (ambition?.status === 'Satisfied') { score += 8; reasons.push('A recent ambition was satisfied'); }
  if (commitment?.status === 'Broken') { score -= 14; reasons.push('A commitment to them was broken'); }
  if (commitment?.status === 'Fulfilled') { score += 8; reasons.push('A commitment to them was fulfilled'); }
  if (mandate?.status === 'Failed') { score -= 12; reasons.push('Their delegated mandate failed'); }
  if (mandate?.status === 'Succeeded') { score += 8; reasons.push('Their delegated mandate succeeded'); }
  if (dispute && dispute.status !== 'Resolved') {
    score -= dispute.status === 'Escalating' ? 12 : Math.min(8, Math.round(dispute.intensity / 12));
    reasons.push(dispute.status === 'Escalating' ? 'An active dispute is escalating' : 'An unresolved dispute is adding pressure');
  }
  for (const memory of memories) {
    if (memory.tone === 'Negative') score -= memory.strength * 1.5;
    if (memory.tone === 'Positive') score += memory.strength;
  }
  const rounded = clamp(score);
  const band = bandFor(rounded);
  return {
    target,
    score: rounded,
    band,
    reasons: reasons.slice(0, 4),
    lastReportedBand: prior?.band ?? band,
    lastUpdatedSeason: state.seasonYear,
    lastUpdatedRound: roundOf(state),
  };
}

export function ensureCharacterBreakingPoints(state: GameState): GameState {
  const seeded = ensureCharacterInfluence(state);
  const current = seeded.characterInteractions!;
  const prior = new Map((current.stability ?? []).map((entry) => [characterOpinionKey(entry.target), entry]));
  const stability = currentCharacterTargets(seeded).map((target) => prior.get(characterOpinionKey(target)) ?? calculateProfile(seeded, target));
  return {
    ...seeded,
    characterInteractions: {
      ...current,
      stability,
      breakingPoints: current.breakingPoints ?? [],
    },
  };
}

export function refreshCharacterStability(state: GameState): GameState {
  const seeded = ensureCharacterBreakingPoints(state);
  const prior = new Map(seeded.characterInteractions!.stability.map((entry) => [characterOpinionKey(entry.target), entry]));
  const stability = currentCharacterTargets(seeded).map((target) => calculateProfile(seeded, target, prior.get(characterOpinionKey(target))));
  return { ...seeded, characterInteractions: { ...seeded.characterInteractions!, stability } };
}

function canOpenBreakingPoint(state: GameState, profile: CharacterStabilityProfile): boolean {
  const entries = state.characterInteractions!.breakingPoints.filter((entry) => sameTarget(profile.target, entry));
  if (entries.some((entry) => entry.status === 'Active')) return false;
  const last = entries.at(-1);
  return !last || timelineIndex(state, state.seasonYear, roundOf(state)) - timelineIndex(state, last.startedSeason, last.startedRound) >= 4;
}

export function advanceCharacterBreakingPoints(state: GameState): GameState {
  let next = refreshCharacterStability(state);
  const activeTargets = new Set(currentCharacterTargets(next).map(characterOpinionKey));
  let breakingPoints = next.characterInteractions!.breakingPoints.map((entry) =>
    entry.status === 'Active' && !activeTargets.has(characterOpinionKey(entry.target))
      ? { ...entry, status: 'Escalated' as const, outcome: 'The situation ended when the character left their role.', resolvedSeason: next.seasonYear, resolvedRound: roundOf(next) }
      : entry);
  next = { ...next, characterInteractions: { ...next.characterInteractions!, breakingPoints } };
  if (breakingPoints.some((entry) => entry.status === 'Active')) return next;

  const profile = next.characterInteractions!.stability
    .filter((entry) => entry.band === 'BreakingPoint' && canOpenBreakingPoint(next, entry))
    .sort((a, b) => a.score - b.score || a.target.id.localeCompare(b.target.id))[0];
  if (!profile) return next;
  const breakingPoint: CharacterBreakingPoint = {
    id: `breaking-point-${next.seasonYear}-${roundOf(next)}-${profile.target.type}-${profile.target.id}`,
    target: profile.target,
    trigger: profile.reasons[0] ?? 'The relationship has reached an unsustainable level.',
    reasons: profile.reasons,
    stabilityAtStart: profile.score,
    startedSeason: next.seasonYear,
    startedRound: roundOf(next),
    status: 'Active',
  };
  breakingPoints = [...breakingPoints, breakingPoint].slice(-150);
  return { ...next, characterInteractions: { ...next.characterInteractions!, breakingPoints } };
}

function categoryFor(target: CharacterInteractionTarget): PaddockEventCategory {
  if (target.type === 'Driver') return 'driver_morale';
  if (target.type === 'Staff') return 'staff';
  if (target.type === 'Owner') return 'finance';
  return 'regulation';
}

function options(): PaddockEventOption[] {
  return [
    { id: 'repair-trust', label: 'Make a meaningful concession', description: 'Spend political capital to repair trust and lower the immediate risk.' },
    { id: 'set-boundary', label: 'Set a firm boundary', description: 'Clarify authority and expectations without giving them everything they want.', risk: 1 },
    { id: 'accept-fallout', label: 'Accept the fallout', description: 'Refuse to bend. The character will remain for now, but the relationship and retention outlook will worsen.', risk: 2 },
  ];
}

export function generateCharacterBreakingPointEvents(state: GameState): PaddockEvent[] {
  const round = roundOf(state);
  const weekId = state.careerPhase?.paddockWeekId ?? `pw-${state.seasonYear}-${round}`;
  return (state.characterInteractions?.breakingPoints ?? [])
    .filter((entry) => entry.status === 'Active' && entry.startedSeason === state.seasonYear && entry.startedRound === round)
    .slice(0, 1)
    .map((entry) => ({
      id: `pe-${weekId}-${entry.id}`,
      weekId,
      season: state.seasonYear,
      series: state.series,
      round,
      category: categoryFor(entry.target),
      title: `${entry.target.name} reaches a breaking point`,
      description: `${entry.trigger} Stability is ${entry.stabilityAtStart}/100. This now requires a clear management response.`,
      severity: 'critical' as const,
      isRequiredDecision: true,
      options: options(),
      effectsApplied: false,
      createdAt: new Date(Date.UTC(state.seasonYear, 0, Math.max(1, round + 1))).toISOString(),
      characterBreakingPoint: { breakingPointId: entry.id, target: entry.target },
    }));
}

function applyRoleEffects(state: GameState, target: CharacterInteractionTarget, optionId: string): { state: GameState; effects: string[] } {
  const delta = optionId === 'repair-trust' ? 10 : optionId === 'set-boundary' ? 2 : -10;
  if (target.type === 'Driver') {
    const relationship = state.driverRelationships?.[target.id];
    if (!relationship) return { state, effects: [] };
    const updated = {
      ...relationship,
      trustInPrincipal: clamp(relationship.trustInPrincipal + delta),
      teamLoyalty: clamp(relationship.teamLoyalty + (delta > 0 ? Math.ceil(delta / 2) : delta)),
      frustration: clamp(relationship.frustration - delta),
    };
    return {
      state: { ...state, driverRelationships: { ...state.driverRelationships!, [target.id]: updated } },
      effects: [`Principal trust ${delta > 0 ? '+' : ''}${delta}`, `Team loyalty ${updated.teamLoyalty - relationship.teamLoyalty > 0 ? '+' : ''}${updated.teamLoyalty - relationship.teamLoyalty}`, `Frustration ${updated.frustration - relationship.frustration > 0 ? '+' : ''}${updated.frustration - relationship.frustration}`],
    };
  }
  if (target.type === 'Staff') {
    const member = state.staff?.find((entry) => entry.id === target.id);
    if (!member) return { state, effects: [] };
    const phase18 = ensurePhase18FoundationState(state.phase18, state);
    const departmentId = STAFF_DEPARTMENT[member.role];
    const mood = phase18.departmentMoods[state.selectedTeamId][departmentId];
    const updated = {
      ...mood,
      trustInPrincipal: clamp(mood.trustInPrincipal + delta),
      morale: clamp(mood.morale + Math.round(delta * 0.6)),
      workload: clamp(mood.workload + (optionId === 'accept-fallout' ? 5 : optionId === 'repair-trust' ? -3 : 0)),
      lastUpdatedSeasonYear: state.seasonYear,
      lastUpdatedRound: roundOf(state),
    };
    return {
      state: { ...state, phase18: { ...phase18, departmentMoods: { ...phase18.departmentMoods, [state.selectedTeamId]: { ...phase18.departmentMoods[state.selectedTeamId], [departmentId]: updated } } } },
      effects: [`Department trust ${delta > 0 ? '+' : ''}${delta}`, `Morale ${updated.morale - mood.morale > 0 ? '+' : ''}${updated.morale - mood.morale}`, `Workload ${updated.workload - mood.workload > 0 ? '+' : ''}${updated.workload - mood.workload}`],
    };
  }
  if (target.type === 'Owner' && state.principal) {
    const reputation = state.teamReputations?.[state.selectedTeamId];
    if (!reputation) return { state, effects: [] };
    const updatedPatience = clamp(reputation.ownerPatience + delta);
    const updatedSecurity = clamp(state.principal.jobSecurity + delta);
    return {
      state: { ...state, teamReputations: { ...state.teamReputations!, [state.selectedTeamId]: { ...reputation, ownerPatience: updatedPatience } }, principal: { ...state.principal, jobSecurity: updatedSecurity, attributes: { ...state.principal.attributes, boardConfidence: clamp(state.principal.attributes.boardConfidence + delta) } } },
      effects: [`Owner patience ${delta > 0 ? '+' : ''}${delta}`, `Job security ${updatedSecurity - state.principal.jobSecurity > 0 ? '+' : ''}${updatedSecurity - state.principal.jobSecurity}`],
    };
  }
  if (target.type === 'RivalPrincipal' && target.teamId) {
    return {
      state: addRivalRelationshipEvent(state, state.selectedTeamId, target.teamId, { round: roundOf(state), amount: delta, trustDelta: delta, suspicionDelta: delta < 0 ? 5 : -3, reason: `${target.name}'s breaking-point confrontation was answered.`, category: 'Political' }),
      effects: [`Rival relationship ${delta > 0 ? '+' : ''}${delta}`],
    };
  }
  return { state, effects: [] };
}

export function resolveCharacterBreakingPoint(state: GameState, event: PaddockEvent, optionId: string): GameState {
  const meta = event.characterBreakingPoint;
  const optionLabel = event.options?.find((entry) => entry.id === optionId)?.label;
  const breakingPoint = state.characterInteractions?.breakingPoints.find((entry) => entry.id === meta?.breakingPointId);
  if (!meta || !optionLabel || !breakingPoint || breakingPoint.status !== 'Active') return state;
  const applied = applyRoleEffects(state, breakingPoint.target, optionId);
  const status = optionId === 'repair-trust' ? 'Defused' as const : optionId === 'set-boundary' ? 'BoundarySet' as const : 'Escalated' as const;
  const outcome = status === 'Defused'
    ? `${breakingPoint.target.name} accepted a meaningful concession and stepped back from the immediate confrontation.`
    : status === 'BoundarySet'
      ? `${breakingPoint.target.name} accepted the boundary, but the underlying relationship still needs attention.`
      : `${breakingPoint.target.name} remains in place, but trust and the long-term retention outlook deteriorated.`;
  let next: GameState = {
    ...applied.state,
    characterInteractions: {
      ...applied.state.characterInteractions!,
      breakingPoints: applied.state.characterInteractions!.breakingPoints.map((entry) => entry.id === breakingPoint.id ? {
        ...entry,
        status,
        optionId,
        optionLabel,
        outcome,
        effects: applied.effects,
        resolvedSeason: state.seasonYear,
        resolvedRound: roundOf(state),
      } : entry),
    },
  };
  next = recordCharacterMemory(next, breakingPoint.target, {
    source: 'BreakingPoint',
    label: `Breaking point: ${optionLabel}`,
    description: outcome,
    tone: status === 'Defused' ? 'Positive' : status === 'BoundarySet' ? 'Mixed' : 'Negative',
    effects: applied.effects,
  });
  return refreshCharacterStability(next);
}

export function stabilityForTarget(state: GameState, target: CharacterInteractionTarget): CharacterStabilityProfile | undefined {
  return state.characterInteractions?.stability.find((entry) => sameTarget(target, entry));
}

export function breakingPointsForTarget(state: GameState, target: CharacterInteractionTarget): CharacterBreakingPoint[] {
  return (state.characterInteractions?.breakingPoints ?? []).filter((entry) => sameTarget(target, entry)).reverse();
}

export function activeCharacterBreakingPoints(state: GameState): CharacterBreakingPoint[] {
  return (state.characterInteractions?.breakingPoints ?? []).filter((entry) => entry.status === 'Active');
}

export function unstableCharacterStability(state: GameState): CharacterStabilityProfile[] {
  return (state.characterInteractions?.stability ?? [])
    .filter((entry) => entry.band === 'Unsettled' || entry.band === 'BreakingPoint')
    .sort((a, b) => a.score - b.score);
}
