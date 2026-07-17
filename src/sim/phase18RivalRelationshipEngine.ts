import type { GameState } from '../game/careerState';
import type { NewsItem, RaceResult } from '../types/gameTypes';
import type { RivalAction, RivalRelationship, RivalRelationshipEvent, RivalRelationshipTag } from '../types/phase18Types';
import { makeTransaction } from './financeEngine';
import { ensurePhase18FoundationState, rivalRelationshipId } from './phase18FoundationEngine';
import { createSeededRandom, deriveSeed } from './random';

export const RIVAL_ACTION_COST: Record<RivalAction, number> = {
  OpenDialogue: 0,
  TechnicalExchange: 300_000,
  ScoutPersonnel: 200_000,
  FileProtest: 400_000,
};

const RIVAL_ACTION_HISTORY_MARKER: Record<RivalAction, string> = {
  OpenDialogue: 'opened direct dialogue',
  TechnicalExchange: 'limited technical and safety exchange',
  ScoutPersonnel: 'monitoring of rival personnel',
  FileProtest: 'formal protest',
};

function clamp(value: number, low = -100, high = 100): number {
  const clamped = Math.max(low, Math.min(high, Math.round(value)));
  return Object.is(clamped, -0) ? 0 : clamped;
}
function tagSet(tags: RivalRelationshipTag[], ...add: RivalRelationshipTag[]): RivalRelationshipTag[] { return [...new Set([...tags, ...add])]; }

function seedRelationship(state: GameState, teamAId: string, teamBId: string): RivalRelationship {
  const teamA = state.teams.find((team) => team.id === teamAId)!;
  const teamB = state.teams.find((team) => team.id === teamBId)!;
  const rng = createSeededRandom(deriveSeed(state.randomSeed, state.seasonYear, teamAId, teamBId, 'rival-relationship'));
  const competitive = 18 - Math.min(18, Math.abs(teamA.reputation - teamB.reputation) * 0.35);
  const sportingRespect = clamp(46 + competitive + rng.int(-10, 10), 0, 100);
  const politicalAlignment = clamp(rng.int(-24, 24));
  const commercialTrust = clamp(38 + rng.int(-12, 16), 0, 100);
  const technicalSuspicion = clamp(28 + competitive + rng.int(-8, 14), 0, 100);
  const score = clamp((sportingRespect - 50) * 0.35 + politicalAlignment * 0.3 + (commercialTrust - 50) * 0.25 - technicalSuspicion * 0.18);
  const tags: RivalRelationshipTag[] = [];
  if (competitive >= 12) tags.push('TechnicalRival', 'DriverMarketRival');
  if (politicalAlignment >= 15) tags.push('PoliticalBlocAlly');
  if (commercialTrust >= 52) tags.push('CommercialAlly');
  if (score <= -12 && competitive >= 10) tags.push('HistoricRival');
  return { id: rivalRelationshipId(teamAId, teamBId), teamAId, teamBId, score, sportingRespect, politicalAlignment, commercialTrust, technicalSuspicion, tags, history: [] };
}

export function ensureRivalRelationships(state: GameState): GameState {
  const phase18 = state.phase18 ?? ensurePhase18FoundationState(undefined, state);
  const relationships = { ...(phase18.rivalRelationships ?? {}) };
  for (let i = 0; i < state.teams.length; i += 1) {
    for (let j = i + 1; j < state.teams.length; j += 1) {
      const id = rivalRelationshipId(state.teams[i].id, state.teams[j].id);
      relationships[id] ??= seedRelationship(state, state.teams[i].id, state.teams[j].id);
    }
  }
  return { ...state, phase18: { ...phase18, rivalRelationships: relationships } };
}

export function rivalRelationship(state: GameState, teamAId: string, teamBId: string): RivalRelationship | undefined {
  return state.phase18?.rivalRelationships[rivalRelationshipId(teamAId, teamBId)];
}

export function rivalRelationshipLabel(score: number): string {
  if (score >= 35) return 'Strategic ally';
  if (score >= 15) return 'Cooperative';
  if (score > -15) return 'Competitive neutral';
  if (score > -35) return 'Hostile rival';
  return 'Bitter rival';
}

export function addRivalRelationshipEvent(
  state: GameState,
  teamAId: string,
  teamBId: string,
  event: Omit<RivalRelationshipEvent, 'id' | 'seasonYear'> & { tags?: RivalRelationshipTag[]; suspicionDelta?: number; respectDelta?: number; alignmentDelta?: number; trustDelta?: number },
): GameState {
  const ensured = ensureRivalRelationships(state);
  const id = rivalRelationshipId(teamAId, teamBId);
  const current = ensured.phase18!.rivalRelationships[id];
  if (!current) return ensured;
  const historyEvent: RivalRelationshipEvent = { id: `${id}-${ensured.seasonYear}-${event.round ?? 0}-${current.history.length + 1}`, seasonYear: ensured.seasonYear, round: event.round, action: event.action, amount: event.amount, reason: event.reason, category: event.category };
  const updated: RivalRelationship = {
    ...current,
    score: clamp(current.score + event.amount),
    sportingRespect: clamp(current.sportingRespect + (event.respectDelta ?? (event.category === 'Sporting' ? event.amount : 0)), 0, 100),
    politicalAlignment: clamp(current.politicalAlignment + (event.alignmentDelta ?? (event.category === 'Political' ? event.amount : 0))),
    commercialTrust: clamp(current.commercialTrust + (event.trustDelta ?? (event.category === 'Commercial' ? event.amount : 0)), 0, 100),
    technicalSuspicion: clamp(current.technicalSuspicion + (event.suspicionDelta ?? (event.category === 'Technical' ? -event.amount : 0)), 0, 100),
    tags: tagSet(current.tags, ...(event.tags ?? [])),
    history: [...current.history, historyEvent].slice(-60),
  };
  return { ...ensured, phase18: { ...ensured.phase18!, rivalRelationships: { ...ensured.phase18!.rivalRelationships, [id]: updated } } };
}

export function evolveRivalRelationshipsAfterRace(state: GameState, round: number, results: RaceResult[]): GameState {
  let next = ensureRivalRelationships(state);
  const playerResults = results.filter((result) => result.teamId === state.selectedTeamId && result.position !== null);
  const playerBest = playerResults.sort((a, b) => (a.position ?? 99) - (b.position ?? 99))[0];
  if (!playerBest) return next;
  const nearest = results.filter((result) => result.teamId !== state.selectedTeamId && result.position !== null).sort((a, b) => Math.abs((a.position ?? 99) - (playerBest.position ?? 99)) - Math.abs((b.position ?? 99) - (playerBest.position ?? 99)))[0];
  if (nearest) {
    next = addRivalRelationshipEvent(next, state.selectedTeamId, nearest.teamId, { round, amount: 2, respectDelta: 3, suspicionDelta: 1, reason: `Close competition in round ${round} increased sporting respect and technical attention.`, category: 'Sporting', tags: ['TechnicalRival'] });
  }
  const playerResearch = state.teamResearch?.[state.selectedTeamId];
  for (const rival of state.teams.filter((team) => team.id !== state.selectedTeamId)) {
    const rivalResearch = state.teamResearch?.[rival.id];
    const sameBranch = playerResearch?.focus?.branchId && playerResearch.focus.branchId === rivalResearch?.focus?.branchId;
    if (sameBranch) next = addRivalRelationshipEvent(next, state.selectedTeamId, rival.id, { round, amount: -1, suspicionDelta: 3, reason: `Both teams concentrated development on ${playerResearch!.focus!.branchId}, increasing copying suspicion.`, category: 'Technical', tags: ['TechnicalRival'] });
    const relation = rivalRelationship(next, state.selectedTeamId, rival.id);
    if (relation && relation.technicalSuspicion >= 65 && relation.score <= -15) {
      const rng = createSeededRandom(deriveSeed(state.randomSeed, state.seasonYear, round, rival.id, 'ai-rival-scrutiny'));
      if (rng.chance(Math.min(0.55, 0.12 + relation.technicalSuspicion / 250))) {
        next = addRivalRelationshipEvent(next, state.selectedTeamId, rival.id, {
          round,
          amount: -5,
          trustDelta: -4,
          suspicionDelta: 2,
          reason: `${rival.name} asked scrutineers for increased technical scrutiny after the race.`,
          category: 'Technical',
          tags: ['HistoricRival'],
        });
        const news: NewsItem = {
          id: `news-ai-scrutiny-${state.seasonYear}-${round}-${rival.id}`,
          headline: `${rival.name} questions ${state.teams.find((team) => team.id === state.selectedTeamId)?.name ?? 'their rival'} development`,
          body: `${rival.name} has requested increased technical scrutiny as paddock tensions rise.`,
          timestamp: new Date().toISOString(),
          category: 'paddock',
          priority: 'normal',
          careerPhase: state.careerPhase?.currentPhase,
          teamId: rival.id,
        };
        next = { ...next, news: [news, ...next.news].slice(0, 80) };
      }
    }
  }
  return next;
}

export function recordRegulationVoteRelationships(state: GameState, proposalId: string, playerVote: 'Support' | 'Oppose' | 'Abstain'): GameState {
  const proposal = state.regulationProposals?.find((item) => item.id === proposalId);
  if (!proposal || playerVote === 'Abstain') return ensureRivalRelationships(state);
  let next = ensureRivalRelationships(state);
  const playerSide = playerVote === 'Support' ? 1 : -1;
  for (const team of state.teams.filter((entry) => entry.id !== state.selectedTeamId)) {
    const rivalSide = Math.sign(proposal.supportByTeam[team.id] ?? 0);
    const aligned = rivalSide === 0 || rivalSide === playerSide;
    next = addRivalRelationshipEvent(next, state.selectedTeamId, team.id, { amount: aligned ? 2 : -2, alignmentDelta: aligned ? 4 : -4, reason: `${aligned ? 'Aligned' : 'Opposed'} positions on “${proposal.title}”.`, category: 'Political', tags: aligned ? ['PoliticalBlocAlly'] : [] });
  }
  return next;
}

export function takeRivalAction(state: GameState, rivalTeamId: string, action: RivalAction): GameState {
  let ensured = ensureRivalRelationships(state);
  const team = ensured.teams.find((entry) => entry.id === ensured.selectedTeamId);
  const rival = ensured.teams.find((entry) => entry.id === rivalTeamId);
  const cost = RIVAL_ACTION_COST[action];
  if (!team || !rival || rival.id === team.id || team.budget < cost) return ensured;
  const relation = rivalRelationship(ensured, team.id, rival.id)!;
  const round = ensured.careerPhase?.currentRound ?? ensured.currentRaceIndex + 1;
  if (rivalActionUsedThisRound(ensured, rivalTeamId, action)) return ensured;
  let event: Parameters<typeof addRivalRelationshipEvent>[3];
  let headline: string;
  if (action === 'OpenDialogue') {
    event = { round, action, amount: 5, alignmentDelta: 3, trustDelta: 4, suspicionDelta: -2, reason: 'Leadership opened direct dialogue to lower paddock tension.', category: 'Political' };
    headline = `${team.name} opens dialogue with ${rival.name}`;
  } else if (action === 'TechnicalExchange') {
    event = { round, action, amount: 4, trustDelta: 6, suspicionDelta: -7, reason: 'A limited technical and safety exchange improved trust.', category: 'Technical', tags: ['CommercialAlly'] };
    headline = `${team.name} and ${rival.name} agree limited technical exchange`;
  } else if (action === 'ScoutPersonnel') {
    event = { round, action, amount: -4, trustDelta: -3, suspicionDelta: 4, reason: 'Targeted monitoring of rival personnel intensified market competition.', category: 'Staff', tags: ['StaffPoachingRival', 'DriverMarketRival'] };
    headline = `${team.name} steps up monitoring of ${rival.name} personnel`;
  } else {
    const rng = createSeededRandom(deriveSeed(ensured.randomSeed, rival.id, round, relation.technicalSuspicion, 'rival-protest'));
    const success = rng.chance(Math.min(0.85, 0.25 + relation.technicalSuspicion / 140));
    event = { round, action, amount: -12, alignmentDelta: -8, trustDelta: -10, suspicionDelta: success ? -8 : 5, respectDelta: -3, reason: `A formal protest against ${rival.name} was ${success ? 'upheld by scrutineers' : 'dismissed for insufficient evidence'}.`, category: 'Political', tags: ['HistoricRival'] };
    headline = `${team.name} protest against ${rival.name} ${success ? 'is upheld' : 'is dismissed'}`;
  }
  ensured = addRivalRelationshipEvent(ensured, team.id, rival.id, event);
  const news: NewsItem = { id: `news-rival-${ensured.seasonYear}-${round}-${rival.id}-${action}`, headline, body: event.reason, timestamp: new Date().toISOString(), category: 'paddock', priority: action === 'FileProtest' ? 'high' : 'normal', careerPhase: ensured.careerPhase?.currentPhase, teamId: team.id };
  return { ...ensured, teams: cost ? ensured.teams.map((entry) => entry.id === team.id ? { ...entry, budget: entry.budget - cost } : entry) : ensured.teams, finance: cost ? [...(ensured.finance ?? []), makeTransaction(ensured.seasonYear, action === 'ScoutPersonnel' ? 'Scouting' : 'Operations', `${action}: ${rival.name}`, -cost, round)] : ensured.finance, news: [news, ...ensured.news].slice(0, 80) };
}

export function rivalActionUsedThisRound(state: GameState, rivalTeamId: string, action: RivalAction): boolean {
  const relation = rivalRelationship(state, state.selectedTeamId, rivalTeamId);
  if (!relation) return false;
  const round = state.careerPhase?.currentRound ?? state.currentRaceIndex + 1;
  return relation.history.some((entry) =>
    entry.seasonYear === state.seasonYear
    && entry.round === round
    && (entry.action === action || (!entry.action && entry.reason.includes(RIVAL_ACTION_HISTORY_MARKER[action])))
  );
}

export function recordStaffPoach(state: GameState, sourceTeamId: string, destinationTeamId: string, round?: number): GameState {
  return addRivalRelationshipEvent(state, sourceTeamId, destinationTeamId, { round, amount: -10, trustDelta: -9, suspicionDelta: 5, reason: 'A senior team principal was poached after contract expiry.', category: 'Staff', tags: ['StaffPoachingRival'] });
}
