import type { GameState } from '../game/careerState';
import type { PaddockEvent, PaddockEventOption } from '../types/careerPhaseTypes';
import type { CharacterFutureIntent, CharacterRequestResolution } from '../types/characterInteractionTypes';
import { driverExtensionSigningFee, extendedDriverSalaryMillions } from './contractEngine';
import { makeTransaction } from './financeEngine';
import { characterOpinionFor } from './characterOpinionEngine';
import { characterFutureIntentLabel } from './characterFutureIntentEngine';
import { addRivalRelationshipEvent } from './phase18RivalRelationshipEngine';
import { extendedStaffSalaryMillions, staffExtensionSigningFee } from './staffEngine';
import { cancelPendingPersonnelMove, schedulePersonnelMove } from './personnelMoveEngine';

export type MarketApproachResolution = {
  state: GameState;
  outcome: string;
  tone: CharacterRequestResolution['tone'];
  effects: string[];
};

function roundOf(state: GameState): number {
  return state.careerPhase?.currentRound ?? state.currentRaceIndex + 1;
}

function formatMoney(value: number): string {
  return `$${(value / 1_000_000).toFixed(1)}M`;
}

function playerBudget(state: GameState): number {
  return state.teams.find((team) => team.id === state.selectedTeamId)?.budget ?? 0;
}

function deterministicNumber(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  return hash;
}

function rivalFor(state: GameState, targetId: string) {
  return state.teams
    .filter((team) => team.id !== state.selectedTeamId)
    .map((team) => ({
      team,
      score: (team.reputation ?? 50)
        + (state.teamOrgRatings?.[team.id]?.overallTeamRating ?? 50) * 0.4
        + deterministicNumber(`${state.randomSeed}-${state.seasonYear}-${targetId}-${team.id}`) % 12,
    }))
    .sort((a, b) => b.score - a.score || a.team.id.localeCompare(b.team.id))[0]?.team;
}

function counterofferCost(state: GameState, intent: CharacterFutureIntent): number {
  const racesRemaining = Math.max(1, state.calendar.length - state.currentRaceIndex);
  if (intent.target.type === 'Driver') {
    const driver = state.drivers.find((entry) => entry.id === intent.target.id)!;
    return Math.round(driverExtensionSigningFee(driver, 2, racesRemaining, state.calendar.length) * 1.35);
  }
  const member = (state.staff ?? []).find((entry) => entry.id === intent.target.id)!;
  return staffExtensionSigningFee(member, 2, racesRemaining, state.calendar.length, 1.35);
}

function option(id: string, label: string, description: string, requirement?: string): PaddockEventOption {
  return { id, label, description, requirement };
}

function isExpiring(state: GameState, intent: CharacterFutureIntent): boolean {
  if (intent.target.type === 'Driver') {
    const driver = state.drivers.find((entry) => entry.id === intent.target.id && entry.teamId === state.selectedTeamId);
    return !!driver && (driver.contractYearsRemaining ?? 1) <= 1;
  }
  if (intent.target.type === 'Staff') {
    const member = (state.staff ?? []).find((entry) => entry.id === intent.target.id);
    return !!member && (member.contractYearsRemaining ?? 2) <= 1;
  }
  return false;
}

export function generateCharacterMarketApproachEvents(state: GameState): PaddockEvent[] {
  if (state.gameMode === 'SingleSeason') return [];
  const racesRemaining = Math.max(0, state.calendar.length - state.currentRaceIndex);
  if (racesRemaining === 0 || racesRemaining > 4) return [];
  const resolvedTargets = new Set(
    (state.characterInteractions?.requestHistory ?? [])
      .filter((entry) => entry.seasonYear === state.seasonYear && (entry.requestKind === 'DriverMarketApproach' || entry.requestKind === 'StaffMarketApproach'))
      .map((entry) => `${entry.targetType}:${entry.targetId}`),
  );
  const intent = (state.characterInteractions?.futureIntentions ?? [])
    .filter((entry) => (entry.target.type === 'Driver' || entry.target.type === 'Staff')
      && (entry.status === 'TestingMarket' || entry.status === 'WantsExit')
      && isExpiring(state, entry)
      && !resolvedTargets.has(`${entry.target.type}:${entry.target.id}`))
    .sort((a, b) => (b.status === 'WantsExit' ? 1 : 0) - (a.status === 'WantsExit' ? 1 : 0)
      || b.leverage - a.leverage
      || a.target.id.localeCompare(b.target.id))[0];
  if (!intent) return [];
  const rival = rivalFor(state, intent.target.id);
  if (!rival) return [];
  const cost = counterofferCost(state, intent);
  const round = roundOf(state);
  const weekId = state.careerPhase?.paddockWeekId ?? `pw-${state.seasonYear}-${round}`;
  const role = intent.target.type === 'Driver'
    ? 'race seat'
    : (state.staff ?? []).find((entry) => entry.id === intent.target.id)?.role ?? 'staff role';
  return [{
    id: `pe-${weekId}-market-approach-${intent.target.type}-${intent.target.id}`,
    weekId,
    season: state.seasonYear,
    series: state.series,
    round,
    category: intent.target.type === 'Driver' ? 'driver_morale' : 'staff',
    title: `${rival.name} approaches ${intent.target.name}`,
    description: `${rival.name} has offered ${intent.target.name} a ${role} for next season while their current deal expires. Their stated position is “${characterFutureIntentLabel(intent.target, intent.status)}” with leverage ${intent.leverage}/100.`,
    severity: 'major',
    isRequiredDecision: true,
    options: [
      option('match-rival-package', 'Make an aggressive counteroffer', `Offer a two-year extension with improved salary and a ${formatMoney(cost)} retention payment. Strong terms help, but a broken relationship can still sink the deal.`, `Available budget: ${formatMoney(playerBudget(state))}`),
      option('make-personal-pitch', 'Sell the project personally', 'Use trust, respect, and your people-management reputation to seek a one-year bridge agreement on current terms. A weak relationship may make this backfire.'),
      option('accept-departure-plan', 'Plan an orderly departure', `Do not compete with ${rival.name}. The current contract will expire at season rollover and the team must fill the vacancy.`),
    ],
    effectsApplied: false,
    createdAt: new Date(Date.UTC(state.seasonYear, 0, Math.max(1, round + 1))).toISOString(),
    characterRequest: {
      requestKind: intent.target.type === 'Driver' ? 'DriverMarketApproach' : 'StaffMarketApproach',
      targetType: intent.target.type,
      targetId: intent.target.id,
      targetName: intent.target.name,
      teamId: state.selectedTeamId,
      rivalTeamId: rival.id,
      rivalTeamName: rival.name,
      counterofferCost: cost,
    },
  }];
}

function chargeRetention(state: GameState, amount: number, label: string): GameState {
  const transaction = makeTransaction(state.seasonYear, label.includes('driver') ? 'Driver Signing' : 'Staff', label, -amount);
  return {
    ...state,
    teams: state.teams.map((team) => team.id === state.selectedTeamId ? { ...team, budget: team.budget - amount } : team),
    finance: [...(state.finance ?? []), transaction],
  };
}

function adjustRival(state: GameState, event: PaddockEvent, amount: number, reason: string): GameState {
  const rivalTeamId = event.characterRequest?.rivalTeamId;
  if (!rivalTeamId) return state;
  return addRivalRelationshipEvent(state, state.selectedTeamId, rivalTeamId, {
    round: roundOf(state),
    amount,
    trustDelta: Math.min(0, amount),
    suspicionDelta: Math.abs(Math.min(0, amount)),
    reason,
    category: event.characterRequest?.targetType === 'Staff' ? 'Staff' : 'Driver',
    tags: event.characterRequest?.targetType === 'Staff' ? ['StaffPoachingRival'] : ['DriverMarketRival'],
  });
}

function setIntentStatus(state: GameState, event: PaddockEvent, status: CharacterFutureIntent['status'], reason: string): GameState {
  if (!state.characterInteractions) return state;
  return {
    ...state,
    characterInteractions: {
      ...state.characterInteractions,
      futureIntentions: state.characterInteractions.futureIntentions.map((entry) =>
        entry.target.type === event.characterRequest?.targetType && entry.target.id === event.characterRequest.targetId
          ? { ...entry, status, reason, lastUpdatedSeason: state.seasonYear, lastUpdatedRound: roundOf(state) }
          : entry),
    },
  };
}

function planRivalMove(state: GameState, event: PaddockEvent, reason: string): GameState {
  const meta = event.characterRequest;
  if (!meta?.rivalTeamId || !meta.rivalTeamName || (meta.targetType !== 'Driver' && meta.targetType !== 'Staff')) return state;
  return schedulePersonnelMove(state, {
    targetType: meta.targetType,
    targetId: meta.targetId,
    targetName: meta.targetName,
    sourceTeamId: state.selectedTeamId,
    destinationTeamId: meta.rivalTeamId,
    destinationTeamName: meta.rivalTeamName,
    agreedSeason: state.seasonYear,
    effectiveSeason: state.seasonYear + 1,
    reason,
  });
}

function extendTarget(state: GameState, event: PaddockEvent, addedYears: number): GameState {
  const meta = event.characterRequest!;
  if (meta.targetType === 'Driver') {
    return {
      ...state,
      drivers: state.drivers.map((driver) => driver.id === meta.targetId ? {
        ...driver,
        contractYearsRemaining: (driver.contractYearsRemaining ?? 1) + addedYears,
        salary: Math.max(driver.salary ?? 0, extendedDriverSalaryMillions(driver, addedYears)),
      } : driver),
    };
  }
  return {
    ...state,
    staff: (state.staff ?? []).map((member) => member.id === meta.targetId ? {
      ...member,
      contractYearsRemaining: (member.contractYearsRemaining ?? 2) + addedYears,
      salary: Math.max(member.salary, extendedStaffSalaryMillions(member, addedYears)),
    } : member),
  };
}

function interestScore(state: GameState, event: PaddockEvent, aggressive: boolean): number {
  const meta = event.characterRequest!;
  const target = { type: meta.targetType, id: meta.targetId, name: meta.targetName, teamId: meta.teamId };
  const opinion = characterOpinionFor(state, target);
  const intent = state.characterInteractions?.futureIntentions.find((entry) => entry.target.type === meta.targetType && entry.target.id === meta.targetId);
  const principalSkill = meta.targetType === 'Driver'
    ? state.principal?.attributes.driverManagement ?? 50
    : state.principal?.attributes.development ?? 50;
  return Math.round(
    (aggressive ? 60 : 25)
      + opinion.trust * (aggressive ? 0.12 : 0.28)
      + opinion.respect * (aggressive ? 0.1 : 0.18)
      + principalSkill * (aggressive ? 0.05 : 0.16)
      + (intent?.negotiationModifier ?? 0)
      - (intent?.leverage ?? 50) * (aggressive ? 0.08 : 0.1),
  );
}

export function resolveCharacterMarketApproach(state: GameState, event: PaddockEvent, optionId: string): MarketApproachResolution {
  const meta = event.characterRequest;
  if (!meta || (meta.requestKind !== 'DriverMarketApproach' && meta.requestKind !== 'StaffMarketApproach') || (meta.targetType !== 'Driver' && meta.targetType !== 'Staff')) {
    return { state, outcome: 'The market approach closed without a valid contract target.', tone: 'Informational', effects: [] };
  }
  const rivalName = meta.rivalTeamName ?? 'A rival team';
  if (optionId === 'accept-departure-plan') {
    const released = planRivalMove(setIntentStatus(
      adjustRival(state, event, -2, `${rivalName} secured permission to complete a personnel approach.`),
      event,
      'WantsExit',
      `${meta.targetName} and the team agreed to separate when the current contract expires.`,
    ), event, `${meta.targetName} accepted ${rivalName}'s offer after an orderly departure was agreed.`);
    return {
      state: released,
      outcome: `${meta.targetName} will complete the current deal and join ${rivalName} after season rollover. Management can now plan the vacancy openly.`,
      tone: 'Mixed',
      effects: ['Departure planned at contract expiry', '-2 rival relationship'],
    };
  }

  const aggressive = optionId === 'match-rival-package';
  const cost = aggressive ? meta.counterofferCost ?? 0 : 0;
  if (cost > playerBudget(state)) {
    const planned = planRivalMove(state, event, `${meta.targetName}'s rival offer remained active after the team could not fund a counteroffer.`);
    return {
      state: planned,
      outcome: `The team could not fund the ${formatMoney(cost)} counteroffer. ${meta.targetName}'s current contract remains set to expire before the agreed move to ${rivalName}.`,
      tone: 'Negative',
      effects: ['Counteroffer blocked by budget', `Move to ${rivalName} planned at contract expiry`],
    };
  }
  const score = interestScore(state, event, aggressive);
  const accepted = score >= 58;
  if (!accepted) {
    const worsened = adjustRival(state, event, -4, `${rivalName}'s approach survived a failed retention attempt.`);
    const departing = planRivalMove(
      setIntentStatus(worsened, event, 'WantsExit', `${meta.targetName} rejected the retention attempt and intends to leave at contract expiry.`),
      event,
      `${meta.targetName} accepted ${rivalName}'s offer after rejecting the retention attempt.`,
    );
    return {
      state: departing,
      outcome: aggressive
        ? `${meta.targetName} rejected the improved package and intends to accept ${rivalName}'s offer. Interest score: ${score}.`
        : `${meta.targetName} was not persuaded by the personal pitch and now expects to leave for ${rivalName}. Interest score: ${score}.`,
      tone: 'Negative',
      effects: ['Retention attempt failed', 'Departure expected at contract expiry', '-4 rival relationship'],
    };
  }

  let retained = extendTarget(state, event, aggressive ? 2 : 1);
  if (aggressive && cost > 0) retained = chargeRetention(retained, cost, `Retained ${meta.targetType === 'Driver' ? 'driver' : 'staff member'} ${meta.targetName} after ${rivalName} approach`);
  retained = adjustRival(retained, event, -6, `${rivalName}'s personnel approach was defeated by a successful counteroffer.`);
  retained = setIntentStatus(
    retained,
    event,
    aggressive ? 'Committed' : 'OpenToTalk',
    aggressive
      ? `${meta.targetName} accepted improved terms and recommitted to the team.`
      : `${meta.targetName} accepted a one-year bridge agreement after a direct conversation.`,
  );
  retained = cancelPendingPersonnelMove(retained, meta.targetType, meta.targetId);
  if (meta.targetType === 'Driver' && retained.driverRelationships?.[meta.targetId]) {
    const relationship = retained.driverRelationships[meta.targetId];
    retained = {
      ...retained,
      driverRelationships: {
        ...retained.driverRelationships,
        [meta.targetId]: {
          ...relationship,
          trustInPrincipal: Math.min(100, relationship.trustInPrincipal + (aggressive ? 5 : 8)),
          teamLoyalty: Math.min(100, relationship.teamLoyalty + (aggressive ? 4 : 7)),
          frustration: Math.max(0, relationship.frustration - (aggressive ? 4 : 7)),
        },
      },
    };
  }
  return {
    state: retained,
    outcome: aggressive
      ? `${meta.targetName} accepted the two-year counteroffer and rejected ${rivalName}.`
      : `${meta.targetName} accepted a one-year bridge deal after the personal pitch and postponed a move to ${rivalName}.`,
    tone: 'Positive',
    effects: [aggressive ? `-${formatMoney(cost)} retention payment` : 'One-year bridge agreement', aggressive ? '+2 contract years' : '+1 contract year', '-6 rival relationship'],
  };
}
