import type { GameState } from '../game/careerState';
import { researchStateForTeam } from './technicalAdapters';
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

export type RivalActionContext = {
  fit: 'Favored' | 'Neutral' | 'Risky';
  reason: string;
  effectPreview: string;
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

export function rivalActionContext(state: GameState, rivalTeamId: string, action: RivalAction): RivalActionContext | undefined {
  const ensured = ensureRivalRelationships(state);
  const relationship = rivalRelationship(ensured, ensured.selectedTeamId, rivalTeamId);
  if (!relationship) return undefined;

  if (action === 'OpenDialogue') {
    if ((relationship.score <= -15 || relationship.technicalSuspicion >= 60) && relationship.sportingRespect >= 35) {
      return { fit: 'Favored', reason: `Tension is actionable: relationship ${relationship.score}, suspicion ${relationship.technicalSuspicion}/100, respect ${relationship.sportingRespect}/100.`, effectPreview: 'Stronger trust gain and suspicion reduction because there is still enough sporting respect to talk.' };
    }
    if (relationship.sportingRespect <= 25 && relationship.politicalAlignment <= -35) {
      return { fit: 'Risky', reason: `Low respect (${relationship.sportingRespect}/100) and opposed politics (${relationship.politicalAlignment}) limit private diplomacy.`, effectPreview: 'Dialogue can still help, but the improvement is reduced.' };
    }
    return { fit: 'Neutral', reason: `Relationship is ${relationship.score}; no urgent tension modifier applies.`, effectPreview: 'Standard private channel to improve alignment, trust, and technical temperature.' };
  }

  if (action === 'TechnicalExchange') {
    if (relationship.technicalSuspicion >= 75 || (relationship.tags.includes('TechnicalRival') && relationship.commercialTrust <= 35)) {
      return { fit: 'Risky', reason: `Technical suspicion is ${relationship.technicalSuspicion}/100 and trust is ${relationship.commercialTrust}/100.`, effectPreview: 'Exchange still lowers suspicion, but rival trust gains are limited.' };
    }
    if (relationship.commercialTrust >= 55 || relationship.politicalAlignment >= 20 || relationship.tags.includes('CommercialAlly')) {
      return { fit: 'Favored', reason: `Trust ${relationship.commercialTrust}/100 and politics ${relationship.politicalAlignment} create room for controlled cooperation.`, effectPreview: 'Stronger trust gain and suspicion reduction from a credible limited exchange.' };
    }
    return { fit: 'Neutral', reason: `Trust is ${relationship.commercialTrust}/100 and suspicion is ${relationship.technicalSuspicion}/100.`, effectPreview: 'Standard cooperation play: useful, but not strongly supported by the current relationship.' };
  }

  if (action === 'ScoutPersonnel') {
    if (relationship.score >= 15 || relationship.commercialTrust >= 65 || relationship.tags.includes('PoliticalBlocAlly')) {
      return { fit: 'Risky', reason: `This relationship has cooperative value: score ${relationship.score}, trust ${relationship.commercialTrust}/100.`, effectPreview: 'Market pressure may damage a useful paddock channel.' };
    }
    if (relationship.tags.includes('DriverMarketRival') || relationship.tags.includes('StaffPoachingRival') || relationship.score <= -20) {
      return { fit: 'Favored', reason: 'Existing driver/staff-market rivalry means personnel monitoring matches the actual conflict.', effectPreview: 'Sharper market intelligence, with expected relationship damage.' };
    }
    return { fit: 'Neutral', reason: `Relationship is ${relationship.score}; no market-rival tag is active.`, effectPreview: 'Creates useful pressure but will still increase rivalry.' };
  }

  if (relationship.technicalSuspicion >= 70) {
    return { fit: 'Favored', reason: `Technical suspicion is high at ${relationship.technicalSuspicion}/100.`, effectPreview: 'Higher chance of an upheld protest and less blowback if it succeeds.' };
  }
  if (relationship.technicalSuspicion <= 45 || relationship.sportingRespect >= 70) {
    return { fit: 'Risky', reason: `Suspicion is ${relationship.technicalSuspicion}/100 and sporting respect is ${relationship.sportingRespect}/100.`, effectPreview: 'Weak evidence or a respected rival makes a formal protest likely to backfire.' };
  }
  return { fit: 'Neutral', reason: `Technical suspicion is ${relationship.technicalSuspicion}/100.`, effectPreview: 'A formal escalation with meaningful cost and uncertain political consequences.' };
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
  const playerResearch = researchStateForTeam(state, state.selectedTeamId);
  for (const rival of state.teams.filter((team) => team.id !== state.selectedTeamId)) {
    const rivalResearch = researchStateForTeam(state, rival.id);
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
    const strong = (relation.score <= -15 || relation.technicalSuspicion >= 60) && relation.sportingRespect >= 35;
    const limited = relation.sportingRespect <= 25 && relation.politicalAlignment <= -35;
    event = { round, action, amount: strong ? 7 : limited ? 3 : 5, alignmentDelta: strong ? 5 : limited ? 1 : 3, trustDelta: strong ? 6 : limited ? 2 : 4, suspicionDelta: strong ? -4 : limited ? -1 : -2, reason: strong ? 'Leadership used existing sporting respect to cool a live paddock tension.' : limited ? 'Leadership opened dialogue, but low respect and opposed politics limited the breakthrough.' : 'Leadership opened direct dialogue to lower paddock tension.', category: 'Political' };
    headline = `${team.name} opens dialogue with ${rival.name}`;
  } else if (action === 'TechnicalExchange') {
    const risky = relation.technicalSuspicion >= 75 || (relation.tags.includes('TechnicalRival') && relation.commercialTrust <= 35);
    const favored = !risky && (relation.commercialTrust >= 55 || relation.politicalAlignment >= 20 || relation.tags.includes('CommercialAlly'));
    event = { round, action, amount: favored ? 6 : risky ? 1 : 4, trustDelta: favored ? 8 : risky ? 2 : 6, suspicionDelta: favored ? -9 : risky ? -3 : -7, reason: favored ? 'A credible limited technical and safety exchange strengthened a useful paddock channel.' : risky ? 'A technical exchange lowered some suspicion, but mistrust kept cooperation narrow.' : 'A limited technical and safety exchange improved trust.', category: 'Technical', tags: ['CommercialAlly'] };
    headline = `${team.name} and ${rival.name} agree limited technical exchange`;
  } else if (action === 'ScoutPersonnel') {
    const risky = relation.score >= 15 || relation.commercialTrust >= 65 || relation.tags.includes('PoliticalBlocAlly');
    const favored = !risky && (relation.tags.includes('DriverMarketRival') || relation.tags.includes('StaffPoachingRival') || relation.score <= -20);
    event = { round, action, amount: risky ? -7 : favored ? -3 : -4, trustDelta: risky ? -6 : favored ? -2 : -3, suspicionDelta: risky ? 6 : favored ? 3 : 4, reason: risky ? 'Targeted personnel monitoring damaged a relationship that still had cooperative paddock value.' : favored ? 'Targeted personnel monitoring matched an existing market rivalry and sharpened competitive pressure.' : 'Targeted monitoring of rival personnel intensified market competition.', category: 'Staff', tags: ['StaffPoachingRival', 'DriverMarketRival'] };
    headline = `${team.name} steps up monitoring of ${rival.name} personnel`;
  } else {
    const rng = createSeededRandom(deriveSeed(ensured.randomSeed, rival.id, round, relation.technicalSuspicion, 'rival-protest'));
    const success = rng.chance(Math.min(0.85, 0.25 + relation.technicalSuspicion / 140));
    const weakCase = relation.technicalSuspicion <= 45 || relation.sportingRespect >= 70;
    event = { round, action, amount: success ? -6 : weakCase ? -16 : -12, alignmentDelta: success ? -5 : weakCase ? -10 : -8, trustDelta: success ? -6 : weakCase ? -13 : -10, suspicionDelta: success ? -10 : weakCase ? 8 : 5, respectDelta: success ? -2 : weakCase ? -5 : -3, reason: `A formal protest against ${rival.name} was ${success ? 'upheld by scrutineers' : 'dismissed for insufficient evidence'}.`, category: 'Political', tags: ['HistoricRival'] };
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
