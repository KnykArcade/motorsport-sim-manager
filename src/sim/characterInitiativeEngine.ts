import type { GameState } from '../game/careerState';
import type { PaddockEvent, PaddockEventCategory, PaddockEventOption } from '../types/careerPhaseTypes';
import type {
  CharacterInfluenceProfile,
  CharacterInitiative,
  CharacterInitiativeKind,
  CharacterInteractionRecord,
  CharacterInteractionTarget,
} from '../types/characterInteractionTypes';
import type { DepartmentId } from '../types/phase18Types';
import type { StaffRole } from '../types/staffTypes';
import { ensureCharacterInfluence } from './characterInfluenceEngine';
import { propagateCharacterReaction } from './characterConnectionEngine';
import { recordCharacterMemory } from './characterOpinionEngine';
import { ensurePhase18FoundationState } from './phase18FoundationEngine';
import { addRivalRelationshipEvent } from './phase18RivalRelationshipEngine';
import { createCharacterMandateFromInitiative } from './characterMandateEngine';

const STAFF_DEPARTMENT: Record<StaffRole, DepartmentId> = {
  'Technical Director': 'Technical',
  'Race Engineer': 'Engineering',
  'Pit Crew Chief': 'RaceOperations',
  Strategist: 'RaceOperations',
};

type Resolution = {
  state: GameState;
  status: CharacterInitiative['status'];
  outcome: string;
  tone: CharacterInteractionRecord['tone'];
  effects: string[];
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

function isPositive(profile: CharacterInfluenceProfile): boolean {
  return profile.stance === 'Champion' || profile.stance === 'Supportive';
}

function kindFor(profile: CharacterInfluenceProfile): CharacterInitiativeKind {
  const positive = isPositive(profile);
  if (profile.target.type === 'Driver') return positive ? 'DriverLeadership' : 'DriverChallenge';
  if (profile.target.type === 'Staff') return positive ? 'StaffProposal' : 'StaffResistance';
  if (profile.target.type === 'Owner') return positive ? 'OwnerBacking' : 'OwnerIntervention';
  return positive ? 'RivalOutreach' : 'RivalPressure';
}

function copyFor(profile: CharacterInfluenceProfile): Pick<CharacterInitiative, 'title' | 'description' | 'motive'> {
  const name = profile.target.name;
  const kind = kindFor(profile);
  if (kind === 'DriverLeadership') return {
    title: `${name} offers to lead the garage`,
    description: `${name} wants a visible role setting standards and helping align the driver group behind your direction.`,
    motive: 'Strong personal backing has become a proactive offer of leadership.',
  };
  if (kind === 'DriverChallenge') return {
    title: `${name} challenges the team's direction`,
    description: `${name} is using their status inside the garage to demand a clearer competitive role and public evidence of progress.`,
    motive: 'Low support and personal influence have turned frustration into an internal challenge.',
  };
  if (kind === 'StaffProposal') return {
    title: `${name} brings a department initiative`,
    description: `${name} wants authority to coordinate a focused improvement push across their department.`,
    motive: 'Department credibility and support for your leadership created room for initiative.',
  };
  if (kind === 'StaffResistance') return {
    title: `${name} is withholding cooperation`,
    description: `${name} believes current priorities are unworkable and is slowing execution until management addresses the disagreement.`,
    motive: 'Internal resistance is now affecting how the department carries out your direction.',
  };
  if (kind === 'OwnerBacking') return {
    title: `${name} offers visible backing`,
    description: 'Ownership is prepared to reinforce your authority and give the team a clearer signal of confidence in the plan.',
    motive: 'Strong ownership support has created an opportunity to consolidate authority.',
  };
  if (kind === 'OwnerIntervention') return {
    title: `${name} intervenes in team direction`,
    description: 'Ownership wants direct control over near-term priorities and expects a response before the team proceeds.',
    motive: 'Weak ownership support and high power have escalated into direct intervention.',
  };
  if (kind === 'RivalOutreach') return {
    title: `${name} proposes a paddock understanding`,
    description: `${name} is offering a limited private understanding on an issue where both teams can benefit.`,
    motive: 'A workable external relationship has produced a proactive political opening.',
  };
  return {
    title: `${name} applies paddock pressure`,
    description: `${name} is using media and political contacts to isolate your position and force a public response.`,
    motive: 'A hostile external relationship has become an active political maneuver.',
  };
}

function option(id: string, label: string, description: string, risk = 0): PaddockEventOption {
  return { id, label, description, risk };
}

function optionsFor(initiative: CharacterInitiative): PaddockEventOption[] {
  const positive = initiative.supportAtStart > 0;
  if (positive) return [
    option('empower', 'Give them authority', 'Back the initiative publicly and let them use their influence to help execution.'),
    option('limited-mandate', 'Approve a limited mandate', 'Use their help, but keep the scope and authority clearly bounded.', 1),
    option('decline', 'Decline the initiative', 'Keep control centralized and accept that their willingness to help may cool.', 1),
  ];
  return [
    option('address-concerns', 'Address the concerns', 'Acknowledge the leverage behind the maneuver and make a practical concession.'),
    option('negotiate-boundaries', 'Negotiate firm boundaries', 'Offer a narrow compromise while protecting your authority.', 1),
    option('assert-authority', 'Assert your authority', 'Reject the pressure and order the team to proceed on your terms.', 2),
  ];
}

function categoryFor(target: CharacterInteractionTarget): PaddockEventCategory {
  if (target.type === 'Driver') return 'driver_morale';
  if (target.type === 'Staff') return 'staff';
  if (target.type === 'Owner') return 'finance';
  return 'regulation';
}

export function ensureCharacterInitiatives(state: GameState): GameState {
  const seeded = ensureCharacterInfluence(state);
  return { ...seeded, characterInteractions: { ...seeded.characterInteractions!, initiatives: seeded.characterInteractions?.initiatives ?? [] } };
}

export function advanceCharacterInitiatives(state: GameState): GameState {
  let next = ensureCharacterInitiatives(state);
  const current = next.characterInteractions!;
  const expired = current.initiatives.filter((entry) => entry.status === 'Active'
    && (entry.startedSeason !== next.seasonYear || entry.startedRound !== roundOf(next)));
  if (!expired.length) return next;
  const expiredIds = new Set(expired.map((entry) => entry.id));
  next = {
    ...next,
    characterInteractions: {
      ...current,
      initiatives: current.initiatives.map((entry) => expiredIds.has(entry.id) ? {
        ...entry,
        status: 'Expired' as const,
        outcome: `${entry.target.name}'s initiative received no answer before the team moved on.`,
        effects: ['Initiative ignored'],
        resolvedSeason: next.seasonYear,
        resolvedRound: roundOf(next),
      } : entry),
    },
  };
  for (const entry of expired) {
    next = recordCharacterMemory(next, entry.target, {
      source: 'Initiative',
      label: `Initiative ignored: ${entry.title}`,
      description: `${entry.target.name}'s initiative received no answer before the team moved on.`,
      tone: entry.supportAtStart > 0 ? 'Mixed' : 'Negative',
      effects: ['Initiative ignored'],
    });
  }
  return next;
}

export function createCharacterInitiative(state: GameState): GameState {
  const seeded = advanceCharacterInitiatives(state);
  const current = seeded.characterInteractions!;
  const round = roundOf(seeded);
  if (current.initiatives.some((entry) => entry.status === 'Active' && entry.startedSeason === seeded.seasonYear && entry.startedRound === round)) return seeded;
  const lastGlobal = [...current.initiatives].sort((a, b) => timelineIndex(seeded, b.startedSeason, b.startedRound) - timelineIndex(seeded, a.startedSeason, a.startedRound))[0];
  if (lastGlobal && timelineIndex(seeded, seeded.seasonYear, round) - timelineIndex(seeded, lastGlobal.startedSeason, lastGlobal.startedRound) < 2) return seeded;

  const eligible = current.influence
    .filter((profile) => profile.target.type !== 'StaffCandidate' && Math.abs(profile.support) >= 20)
    .filter((profile) => {
      const prior = [...current.initiatives].reverse().find((entry) => entry.target.type === profile.target.type && entry.target.id === profile.target.id);
      return !prior || timelineIndex(seeded, seeded.seasonYear, round) - timelineIndex(seeded, prior.startedSeason, prior.startedRound) >= 4;
    })
    .sort((a, b) => {
      const aExtreme = a.stance === 'Champion' || a.stance === 'Obstructive' ? 25 : 0;
      const bExtreme = b.stance === 'Champion' || b.stance === 'Obstructive' ? 25 : 0;
      return bExtreme + b.power * Math.abs(b.support) / 100 - (aExtreme + a.power * Math.abs(a.support) / 100) || a.target.id.localeCompare(b.target.id);
    });
  const profile = eligible[0];
  if (!profile) return seeded;
  const kind = kindFor(profile);
  const initiative: CharacterInitiative = {
    id: `initiative-${seeded.seasonYear}-${round}-${profile.target.type}-${profile.target.id}`,
    target: profile.target,
    kind,
    ...copyFor(profile),
    powerAtStart: profile.power,
    supportAtStart: profile.support,
    startedSeason: seeded.seasonYear,
    startedRound: round,
    status: 'Active',
  };
  return { ...seeded, characterInteractions: { ...current, initiatives: [...current.initiatives, initiative].slice(-250) } };
}

export function generateCharacterInitiativeEvents(state: GameState): PaddockEvent[] {
  const round = roundOf(state);
  const weekId = state.careerPhase?.paddockWeekId ?? `pw-${state.seasonYear}-${round}`;
  return (state.characterInteractions?.initiatives ?? [])
    .filter((entry) => entry.status === 'Active' && entry.startedSeason === state.seasonYear && entry.startedRound === round)
    .slice(0, 1)
    .map((entry) => ({
      id: `pe-${weekId}-${entry.id}`,
      weekId,
      season: state.seasonYear,
      series: state.series,
      round,
      category: categoryFor(entry.target),
      title: entry.title,
      description: `${entry.description} Power ${entry.powerAtStart}, support ${entry.supportAtStart > 0 ? '+' : ''}${entry.supportAtStart}.`,
      severity: entry.supportAtStart <= -50 ? 'major' as const : entry.supportAtStart < 0 ? 'minor' as const : 'info' as const,
      isRequiredDecision: entry.supportAtStart < 0,
      options: optionsFor(entry),
      effectsApplied: false,
      createdAt: new Date(Date.UTC(state.seasonYear, 0, Math.max(1, round + 1))).toISOString(),
      characterInitiative: { initiativeId: entry.id, target: entry.target },
    }));
}

function resolveDriver(state: GameState, initiative: CharacterInitiative, optionId: string): Resolution {
  const relationship = state.driverRelationships?.[initiative.target.id];
  if (!relationship) return { state, status: 'Expired', outcome: 'The initiative closed because the driver is no longer on the active roster.', tone: 'Informational', effects: [] };
  const positive = initiative.supportAtStart > 0;
  const delta = positive
    ? optionId === 'empower' ? 4 : optionId === 'limited-mandate' ? 2 : -3
    : optionId === 'address-concerns' ? 4 : optionId === 'negotiate-boundaries' ? 1 : -5;
  const updated = {
    ...relationship,
    trustInPrincipal: clamp(relationship.trustInPrincipal + delta),
    morale: clamp(relationship.morale + Math.sign(delta) * (Math.abs(delta) >= 4 ? 3 : 1)),
    frustration: clamp(relationship.frustration - delta),
  };
  return {
    state: { ...state, driverRelationships: { ...state.driverRelationships!, [initiative.target.id]: updated }, drivers: state.drivers.map((driver) => driver.id === initiative.target.id ? { ...driver, morale: updated.morale } : driver) },
    status: optionId === 'empower' || optionId === 'address-concerns' ? 'Accepted' : optionId === 'limited-mandate' || optionId === 'negotiate-boundaries' ? 'Compromised' : 'Rejected',
    outcome: delta > 0 ? `${initiative.target.name} accepted the mandate and is now personally invested in making it work.` : `${initiative.target.name} saw the response as a rejection of their standing inside the team.`,
    tone: delta >= 4 ? 'Positive' : delta > 0 ? 'Mixed' : 'Negative',
    effects: [`Principal trust ${delta > 0 ? '+' : ''}${delta}`, `Driver morale ${updated.morale - relationship.morale > 0 ? '+' : ''}${updated.morale - relationship.morale}`, `Frustration ${updated.frustration - relationship.frustration > 0 ? '+' : ''}${updated.frustration - relationship.frustration}`],
  };
}

function resolveStaff(state: GameState, initiative: CharacterInitiative, optionId: string): Resolution {
  const member = state.staff?.find((entry) => entry.id === initiative.target.id);
  if (!member) return { state, status: 'Expired', outcome: 'The initiative closed because the staff member is no longer with the team.', tone: 'Informational', effects: [] };
  const phase18 = ensurePhase18FoundationState(state.phase18, state);
  const departmentId = STAFF_DEPARTMENT[member.role];
  const mood = phase18.departmentMoods[state.selectedTeamId][departmentId];
  const positive = initiative.supportAtStart > 0;
  const delta = positive
    ? optionId === 'empower' ? 4 : optionId === 'limited-mandate' ? 2 : -3
    : optionId === 'address-concerns' ? 4 : optionId === 'negotiate-boundaries' ? 1 : -5;
  const updated = { ...mood, trustInPrincipal: clamp(mood.trustInPrincipal + delta), morale: clamp(mood.morale + Math.sign(delta) * 2), strategicAlignment: clamp(mood.strategicAlignment + delta), lastUpdatedSeasonYear: state.seasonYear, lastUpdatedRound: roundOf(state) };
  return {
    state: { ...state, phase18: { ...phase18, departmentMoods: { ...phase18.departmentMoods, [state.selectedTeamId]: { ...phase18.departmentMoods[state.selectedTeamId], [departmentId]: updated } } } },
    status: optionId === 'empower' || optionId === 'address-concerns' ? 'Accepted' : optionId === 'limited-mandate' || optionId === 'negotiate-boundaries' ? 'Compromised' : 'Rejected',
    outcome: delta > 0 ? `${initiative.target.name} returned to ${departmentId} with a workable mandate and clearer authority.` : `${initiative.target.name} complied, but department resistance hardened around the rejected initiative.`,
    tone: delta >= 4 ? 'Positive' : delta > 0 ? 'Mixed' : 'Negative',
    effects: [`Department trust ${delta > 0 ? '+' : ''}${delta}`, `Morale ${updated.morale - mood.morale > 0 ? '+' : ''}${updated.morale - mood.morale}`, `Alignment ${delta > 0 ? '+' : ''}${delta}`],
  };
}

function resolveOwner(state: GameState, initiative: CharacterInitiative, optionId: string): Resolution {
  const reputation = state.teamReputations?.[state.selectedTeamId];
  if (!reputation || !state.principal) return { state, status: 'Expired', outcome: 'The initiative closed without an active ownership profile.', tone: 'Informational', effects: [] };
  const positive = initiative.supportAtStart > 0;
  const delta = positive
    ? optionId === 'empower' ? 3 : optionId === 'limited-mandate' ? 1 : -2
    : optionId === 'address-concerns' ? 3 : optionId === 'negotiate-boundaries' ? 0 : -4;
  return {
    state: {
      ...state,
      teamReputations: { ...state.teamReputations!, [state.selectedTeamId]: { ...reputation, ownerPatience: clamp(reputation.ownerPatience + delta) } },
      principal: { ...state.principal, jobSecurity: clamp(state.principal.jobSecurity + delta), attributes: { ...state.principal.attributes, boardConfidence: clamp(state.principal.attributes.boardConfidence + delta) } },
    },
    status: optionId === 'empower' || optionId === 'address-concerns' ? 'Accepted' : optionId === 'limited-mandate' || optionId === 'negotiate-boundaries' ? 'Compromised' : 'Rejected',
    outcome: delta > 0 ? 'Ownership and management agreed on a mandate, reinforcing authority inside the team.' : delta === 0 ? 'A narrow compromise contained the intervention without producing additional backing.' : 'The confrontation ended without agreement, and ownership confidence in management fell.',
    tone: delta >= 3 ? 'Positive' : delta >= 0 ? 'Mixed' : 'Negative',
    effects: [`Owner patience ${delta > 0 ? '+' : ''}${delta}`, `Job security ${delta > 0 ? '+' : ''}${delta}`, `Board confidence ${delta > 0 ? '+' : ''}${delta}`],
  };
}

function resolveRival(state: GameState, initiative: CharacterInitiative, optionId: string): Resolution {
  const teamId = initiative.target.teamId;
  if (!teamId) return { state, status: 'Expired', outcome: 'The maneuver closed without a rival team attached.', tone: 'Informational', effects: [] };
  const positive = initiative.supportAtStart > 0;
  const delta = positive
    ? optionId === 'empower' ? 5 : optionId === 'limited-mandate' ? 2 : -2
    : optionId === 'address-concerns' ? 3 : optionId === 'negotiate-boundaries' ? 0 : -5;
  const updated = addRivalRelationshipEvent(state, state.selectedTeamId, teamId, { round: roundOf(state), amount: delta, alignmentDelta: Math.sign(delta) * Math.min(3, Math.abs(delta)), trustDelta: delta, suspicionDelta: -Math.sign(delta) * 2, reason: `${initiative.title}: management chose ${optionId.replace(/-/g, ' ')}.`, category: 'Political' });
  return {
    state: updated,
    status: optionId === 'empower' || optionId === 'address-concerns' ? 'Accepted' : optionId === 'limited-mandate' || optionId === 'negotiate-boundaries' ? 'Compromised' : 'Rejected',
    outcome: delta > 0 ? `${initiative.target.name} accepted the response and the private paddock channel became more useful.` : delta === 0 ? 'Both sides contained the maneuver without resolving the underlying rivalry.' : `${initiative.target.name} escalated the disagreement after management rejected the pressure.`,
    tone: delta >= 3 ? 'Positive' : delta >= 0 ? 'Mixed' : 'Negative',
    effects: [`Rival relationship ${delta > 0 ? '+' : ''}${delta}`, `Commercial trust ${delta > 0 ? '+' : ''}${delta}`],
  };
}

export function resolveCharacterInitiative(state: GameState, event: PaddockEvent, optionId: string): GameState {
  const meta = event.characterInitiative;
  const current = state.characterInteractions;
  const optionLabel = event.options?.find((entry) => entry.id === optionId)?.label;
  if (!meta || !current || !optionLabel) return state;
  const initiative = current.initiatives.find((entry) => entry.id === meta.initiativeId);
  if (!initiative || initiative.status !== 'Active') return state;
  const resolution = initiative.target.type === 'Driver'
    ? resolveDriver(state, initiative, optionId)
    : initiative.target.type === 'Staff'
      ? resolveStaff(state, initiative, optionId)
      : initiative.target.type === 'Owner'
        ? resolveOwner(state, initiative, optionId)
        : resolveRival(state, initiative, optionId);
  const interactions = resolution.state.characterInteractions!;
  const initiatives = interactions.initiatives.map((entry) => entry.id === initiative.id ? {
    ...entry,
    status: resolution.status,
    optionId,
    optionLabel,
    outcome: resolution.outcome,
    effects: resolution.effects,
    resolvedSeason: state.seasonYear,
    resolvedRound: roundOf(state),
  } : entry);
  const recorded: GameState = {
    ...resolution.state,
    characterInteractions: { ...interactions, initiatives },
    news: [{
      id: `news-${initiative.id}-${optionId}`,
      headline: `${initiative.target.name}: ${optionLabel}`,
      body: resolution.outcome,
      timestamp: new Date().toISOString(),
      category: 'career_event' as const,
      priority: event.isRequiredDecision ? 'high' as const : 'normal' as const,
      careerPhase: resolution.state.careerPhase?.currentPhase,
      teamId: initiative.target.teamId,
      driverId: initiative.target.type === 'Driver' ? initiative.target.id : undefined,
    }, ...resolution.state.news].slice(0, 80),
  };
  const remembered = recordCharacterMemory(recorded, initiative.target, {
    source: 'Initiative',
    label: `${initiative.title}: ${optionLabel}`,
    description: resolution.outcome,
    tone: resolution.tone,
    effects: resolution.effects,
  });
  const mandated = createCharacterMandateFromInitiative(remembered, initiative, optionId);
  return propagateCharacterReaction(mandated, initiative.target, resolution.tone, initiative.title);
}

export function initiativesForTarget(state: GameState, target: CharacterInteractionTarget): CharacterInitiative[] {
  return (state.characterInteractions?.initiatives ?? [])
    .filter((entry) => entry.target.type === target.type && entry.target.id === target.id)
    .sort((a, b) => b.startedSeason - a.startedSeason || b.startedRound - a.startedRound);
}
