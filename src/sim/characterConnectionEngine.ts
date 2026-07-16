import type { GameState } from '../game/careerState';
import type { PaddockEvent, PaddockEventCategory } from '../types/careerPhaseTypes';
import type {
  CharacterConnection,
  CharacterConnectionBand,
  CharacterConnectionKind,
  CharacterFaction,
  CharacterInteractionRecord,
  CharacterInteractionTarget,
  CharacterMemory,
} from '../types/characterInteractionTypes';
import type { StaffRole } from '../types/staffTypes';
import type { DepartmentId } from '../types/phase18Types';
import {
  characterOpinionFor,
  characterOpinionKey,
  currentCharacterTargets,
  ensureCharacterOpinions,
} from './characterOpinionEngine';
import { ensurePhase18FoundationState } from './phase18FoundationEngine';
import { rivalRelationship } from './phase18RivalRelationshipEngine';

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

function bandFor(affinity: number): CharacterConnectionBand {
  if (affinity >= 60) return 'Allied';
  if (affinity >= 25) return 'Friendly';
  if (affinity > -25) return 'Neutral';
  if (affinity > -60) return 'Tense';
  return 'Hostile';
}

function kindFor(affinity: number, fallback: CharacterConnectionKind): CharacterConnectionKind {
  if (affinity >= 60) return 'Alliance';
  if (affinity <= -35) return 'Rivalry';
  return fallback;
}

function canonicalPair(a: CharacterInteractionTarget, b: CharacterInteractionTarget): [CharacterInteractionTarget, CharacterInteractionTarget] {
  return characterOpinionKey(a).localeCompare(characterOpinionKey(b)) <= 0 ? [a, b] : [b, a];
}

function connectionId(a: CharacterInteractionTarget, b: CharacterInteractionTarget): string {
  const [first, second] = canonicalPair(a, b);
  return `connection-${characterOpinionKey(first)}-${characterOpinionKey(second)}`;
}

function makeConnection(
  state: GameState,
  a: CharacterInteractionTarget,
  b: CharacterInteractionTarget,
  affinity: number,
  strength: number,
  fallbackKind: CharacterConnectionKind,
  basis: string,
): CharacterConnection {
  const [characterA, characterB] = canonicalPair(a, b);
  const normalizedAffinity = clamp(affinity, -100, 100);
  const band = bandFor(normalizedAffinity);
  return {
    id: connectionId(a, b), characterA, characterB,
    kind: kindFor(normalizedAffinity, fallbackKind), affinity: normalizedAffinity,
    strength: clamp(strength), basis, band, lastReportedBand: band,
    lastUpdatedSeason: state.seasonYear, lastUpdatedRound: roundOf(state),
  };
}

function desiredConnections(state: GameState): CharacterConnection[] {
  const connections: CharacterConnection[] = [];
  const targets = currentCharacterTargets(state);
  const drivers = targets.filter((target) => target.type === 'Driver');
  const staff = targets.filter((target) => target.type === 'Staff');
  const owner = targets.find((target) => target.type === 'Owner');
  const rivals = targets.filter((target) => target.type === 'RivalPrincipal');

  for (let i = 0; i < drivers.length; i += 1) {
    for (let j = i + 1; j < drivers.length; j += 1) {
      const a = state.driverRelationships?.[drivers[i].id];
      const b = state.driverRelationships?.[drivers[j].id];
      const relationship = ((a?.teammateRelationship ?? 50) + (b?.teammateRelationship ?? 50)) / 2;
      connections.push(makeConnection(state, drivers[i], drivers[j], (relationship - 50) * 2, 85, 'WorkingRelationship', 'Shared garage and teammate relationship'));
    }
  }

  for (const driver of drivers) {
    const relationship = state.driverRelationships?.[driver.id];
    for (const memberTarget of staff) {
      const member = (state.staff ?? []).find((entry) => entry.id === memberTarget.id);
      const roleStrength = member?.role === 'Race Engineer' ? 88 : member?.role === 'Technical Director' ? 76 : 64;
      const chemistry = relationship?.engineerChemistry ?? 50;
      connections.push(makeConnection(state, driver, memberTarget, (chemistry - 50) * 2, roleStrength, chemistry >= 70 ? 'Mentorship' : 'WorkingRelationship', 'Driver and technical-team working chemistry'));
    }
    if (owner) {
      const patience = state.teamReputations?.[state.selectedTeamId]?.ownerPatience ?? 50;
      const loyalty = relationship?.teamLoyalty ?? 50;
      connections.push(makeConnection(state, driver, owner, ((patience + loyalty) / 2 - 50) * 2, 72, 'Patronage', 'Ownership backing and driver loyalty'));
    }
  }

  const phase18 = ensurePhase18FoundationState(state.phase18, state);
  for (let i = 0; i < staff.length; i += 1) {
    const a = (state.staff ?? []).find((entry) => entry.id === staff[i].id);
    if (!a) continue;
    const aMood = phase18.departmentMoods[state.selectedTeamId][STAFF_DEPARTMENT[a.role]];
    for (let j = i + 1; j < staff.length; j += 1) {
      const b = (state.staff ?? []).find((entry) => entry.id === staff[j].id);
      if (!b) continue;
      const bMood = phase18.departmentMoods[state.selectedTeamId][STAFF_DEPARTMENT[b.role]];
      const alignment = (aMood.strategicAlignment + bMood.strategicAlignment) / 2;
      connections.push(makeConnection(state, staff[i], staff[j], (alignment - 50) * 1.5, 68, 'WorkingRelationship', 'Shared technical and operational priorities'));
    }
    if (owner) {
      const patience = state.teamReputations?.[state.selectedTeamId]?.ownerPatience ?? 50;
      connections.push(makeConnection(state, staff[i], owner, ((patience + aMood.trustInPrincipal) / 2 - 50) * 1.5, 65, 'Patronage', 'Leadership-circle trust and ownership stability'));
    }
  }

  if (owner) {
    for (const rival of rivals) {
      if (!rival.teamId) continue;
      const relationship = rivalRelationship(state, state.selectedTeamId, rival.teamId);
      connections.push(makeConnection(state, owner, rival, relationship?.score ?? 0, 58, 'PoliticalRelationship', 'Cross-team political and commercial relationship'));
    }
  }
  return connections;
}

function factionStance(cohesion: number): CharacterFaction['stance'] {
  if (cohesion >= 65) return 'Aligned';
  if (cohesion >= 40) return 'Uneasy';
  return 'Fractured';
}

function buildFactions(state: GameState, connections: CharacterConnection[]): CharacterFaction[] {
  const round = roundOf(state);
  const targets = currentCharacterTargets(state);
  const drivers = targets.filter((target) => target.type === 'Driver');
  const staff = targets.filter((target) => target.type === 'Staff');
  const owner = targets.find((target) => target.type === 'Owner');
  const factions: CharacterFaction[] = [];
  const driverLink = drivers.length >= 2 ? connections.find((entry) => entry.id === connectionId(drivers[0], drivers[1])) : undefined;

  if (driverLink && driverLink.affinity >= 25) {
    const cohesion = clamp(55 + driverLink.affinity / 3);
    factions.push({
      id: `faction-garage-${state.selectedTeamId}`, name: 'United Garage', kind: 'GarageAlliance',
      memberKeys: [...drivers, ...staff].map(characterOpinionKey), cohesion, influence: 78,
      stance: factionStance(cohesion), description: 'The drivers and technical staff are broadly aligned around a shared competitive direction.',
      lastUpdatedSeason: state.seasonYear, lastUpdatedRound: round,
    });
  } else if (driverLink && driverLink.affinity <= -25) {
    drivers.forEach((driver, index) => {
      const allies = staff.filter((member) => [...member.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % drivers.length === index);
      const cohesion = clamp(58 + Math.abs(driverLink.affinity) / 4);
      factions.push({
        id: `faction-driver-${driver.id}`, name: `${driver.name} Camp`, kind: 'DriverCamp',
        memberKeys: [driver, ...allies].map(characterOpinionKey), cohesion, influence: clamp(55 + Math.abs(driverLink.affinity) / 3),
        stance: 'Fractured', description: 'A driver-centered camp has formed as tension divides the garage.',
        lastUpdatedSeason: state.seasonYear, lastUpdatedRound: round,
      });
    });
  } else if (driverLink) {
    const cohesion = clamp(45 + driverLink.affinity / 4);
    factions.push({
      id: `faction-garage-${state.selectedTeamId}`, name: 'Uneasy Garage', kind: 'GarageAlliance',
      memberKeys: [...drivers, ...staff].map(characterOpinionKey), cohesion, influence: 62,
      stance: 'Uneasy', description: 'The drivers share the same garage, but their working alliance has not yet become a united bloc.',
      lastUpdatedSeason: state.seasonYear, lastUpdatedRound: round,
    });
  }

  if (owner && staff.length) {
    const leadershipLinks = connections.filter((entry) => characterOpinionKey(entry.characterA) === characterOpinionKey(owner) || characterOpinionKey(entry.characterB) === characterOpinionKey(owner));
    const relevant = leadershipLinks.filter((entry) => entry.characterA.type === 'Staff' || entry.characterB.type === 'Staff');
    const cohesion = clamp(50 + (relevant.reduce((sum, entry) => sum + entry.affinity, 0) / Math.max(1, relevant.length)) / 2);
    factions.push({
      id: `faction-leadership-${state.selectedTeamId}`, name: 'Leadership Circle', kind: 'LeadershipCircle',
      memberKeys: [owner, ...staff].map(characterOpinionKey), cohesion, influence: 82,
      stance: factionStance(cohesion), description: 'Ownership and senior staff form the internal bloc that shapes resources and long-term direction.',
      lastUpdatedSeason: state.seasonYear, lastUpdatedRound: round,
    });
  }

  for (const connection of connections.filter((entry) => entry.kind === 'PoliticalRelationship' && entry.band !== 'Neutral')) {
    const other = connection.characterA.type === 'Owner' ? connection.characterB : connection.characterA;
    factions.push({
      id: `faction-paddock-${other.id}`, name: connection.affinity >= 0 ? `Paddock Understanding: ${other.name}` : `Paddock Opposition: ${other.name}`,
      kind: 'PaddockBloc', memberKeys: [characterOpinionKey(connection.characterA), characterOpinionKey(connection.characterB)],
      cohesion: clamp(50 + Math.abs(connection.affinity) / 2), influence: clamp(connection.strength),
      stance: connection.affinity >= 0 ? 'Aligned' : 'Fractured',
      description: connection.affinity >= 0 ? 'A useful cross-team understanding is taking shape.' : 'A hostile cross-team bloc is hardening around repeated conflict.',
      lastUpdatedSeason: state.seasonYear, lastUpdatedRound: round,
    });
  }
  return factions.slice(0, 40);
}

export function ensureCharacterConnections(state: GameState): GameState {
  const seeded = ensureCharacterOpinions(state);
  const existing = new Map((seeded.characterInteractions?.connections ?? []).map((entry) => [entry.id, entry]));
  const connections = desiredConnections(seeded).map((entry) => existing.get(entry.id) ?? entry);
  const factions = buildFactions(seeded, connections);
  return { ...seeded, characterInteractions: { ...seeded.characterInteractions!, connections, factions } };
}

export function refreshCharacterConnections(state: GameState): GameState {
  const seeded = ensureCharacterConnections(state);
  const existing = new Map((seeded.characterInteractions?.connections ?? []).map((entry) => [entry.id, entry]));
  const connections = desiredConnections(seeded).map((entry) => {
    const previous = existing.get(entry.id);
    const manualAffinityAdjustment = previous?.manualAffinityAdjustment ?? 0;
    const affinity = clamp(entry.affinity + manualAffinityAdjustment, -100, 100);
    return {
      ...entry,
      affinity,
      band: bandFor(affinity),
      kind: kindFor(affinity, entry.kind),
      lastReportedBand: previous?.band ?? entry.band,
      manualAffinityAdjustment,
    };
  });
  return { ...seeded, characterInteractions: { ...seeded.characterInteractions!, connections, factions: buildFactions(seeded, connections) } };
}

function otherCharacter(connection: CharacterConnection, target: CharacterInteractionTarget): CharacterInteractionTarget {
  return characterOpinionKey(connection.characterA) === characterOpinionKey(target) ? connection.characterB : connection.characterA;
}

export function connectionsForTarget(state: GameState, target: CharacterInteractionTarget): CharacterConnection[] {
  const key = characterOpinionKey(target);
  return (state.characterInteractions?.connections ?? [])
    .filter((entry) => characterOpinionKey(entry.characterA) === key || characterOpinionKey(entry.characterB) === key)
    .sort((a, b) => b.strength * Math.abs(b.affinity) - a.strength * Math.abs(a.affinity));
}

export function factionsForTarget(state: GameState, target: CharacterInteractionTarget): CharacterFaction[] {
  const key = characterOpinionKey(target);
  return (state.characterInteractions?.factions ?? []).filter((faction) => faction.memberKeys.includes(key));
}

export function connectedCharacter(connection: CharacterConnection, target: CharacterInteractionTarget): CharacterInteractionTarget {
  return otherCharacter(connection, target);
}

export function propagateCharacterReaction(
  state: GameState,
  target: CharacterInteractionTarget,
  tone: CharacterInteractionRecord['tone'],
  label: string,
): GameState {
  if (tone === 'Informational') return state;
  const seeded = ensureCharacterConnections(state);
  const links = connectionsForTarget(seeded, target)
    .filter((entry) => entry.band !== 'Neutral' && entry.strength >= 55)
    .slice(0, 3);
  if (!links.length) return seeded;
  const opinions = { ...seeded.characterInteractions!.opinions };
  const memories: CharacterMemory[] = [...seeded.characterInteractions!.memories];
  for (const connection of links) {
    const observer = otherCharacter(connection, target);
    const opinion = opinions[characterOpinionKey(observer)] ?? characterOpinionFor(seeded, observer);
    const base = tone === 'Positive' ? 3 : tone === 'Mixed' ? 1 : -4;
    const aligned = connection.affinity >= 0 ? 1 : -0.6;
    let delta = Math.round(base * aligned * (connection.strength / 100) * Math.max(0.5, Math.abs(connection.affinity) / 100));
    if (delta === 0) delta = base * aligned > 0 ? 1 : -1;
    opinions[characterOpinionKey(observer)] = {
      ...opinion,
      score: clamp(opinion.score + delta, -100, 100),
      trust: clamp(opinion.trust + delta),
      respect: clamp(opinion.respect + Math.sign(delta)),
      lastUpdatedSeason: seeded.seasonYear,
      lastUpdatedRound: roundOf(seeded),
    };
    memories.push({
      id: `memory-connection-${seeded.seasonYear}-${roundOf(seeded)}-${observer.type}-${observer.id}-${memories.length + 1}`,
      targetType: observer.type, targetId: observer.id, targetName: observer.name, teamId: observer.teamId,
      seasonYear: seeded.seasonYear, round: roundOf(seeded), source: 'Connection',
      label: `Observed: ${label}`,
      description: `${observer.name} noticed how you handled ${target.name}. Their ${connection.band.toLowerCase()} connection shaped the reaction.`,
      tone: delta > 0 ? 'Positive' : delta < 0 ? 'Negative' : 'Mixed', strength: 2,
      opinionDelta: delta, effects: [`Opinion ${delta > 0 ? '+' : ''}${delta} through ${connection.kind.toLowerCase()}`],
    });
  }
  return { ...seeded, characterInteractions: { ...seeded.characterInteractions!, opinions, memories: memories.slice(-500) } };
}

function eventCategory(connection: CharacterConnection): PaddockEventCategory {
  if (connection.characterA.type === 'Driver' || connection.characterB.type === 'Driver') return 'driver_morale';
  if (connection.characterA.type === 'Staff' || connection.characterB.type === 'Staff') return 'staff';
  return 'regulation';
}

export function generateCharacterConnectionEvents(state: GameState): PaddockEvent[] {
  const round = roundOf(state);
  const weekId = state.careerPhase?.paddockWeekId ?? `pw-${state.seasonYear}-${round}`;
  return (state.characterInteractions?.connections ?? [])
    .filter((connection) => connection.band !== connection.lastReportedBand)
    .sort((a, b) => Math.abs(b.affinity) - Math.abs(a.affinity))
    .slice(0, 4)
    .map((connection) => ({
      id: `pe-${weekId}-connection-${connection.id}`,
      weekId, season: state.seasonYear, series: state.series, round,
      category: eventCategory(connection),
      title: `${connection.characterA.name} and ${connection.characterB.name}: ${connection.band.toLowerCase()}`,
      description: connection.affinity >= 0
        ? `Their ${connection.basis.toLowerCase()} has strengthened into a ${connection.band.toLowerCase()} relationship. Decisions affecting one may now influence the other.`
        : `Their ${connection.basis.toLowerCase()} has deteriorated into a ${connection.band.toLowerCase()} relationship. Their competing interests may now produce opposite reactions.`,
      severity: connection.band === 'Hostile' ? 'major' as const : connection.band === 'Allied' ? 'minor' as const : 'info' as const,
      isRequiredDecision: false,
      effectsApplied: true,
      createdAt: new Date(Date.UTC(state.seasonYear, 0, Math.max(1, round + 1))).toISOString(),
    }));
}
