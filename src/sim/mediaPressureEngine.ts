import type { GameState } from '../game/careerState';
import type { RaceResult } from '../types/gameTypes';
import type {
  JournalistMemory,
  MediaCrisis,
  MediaQuestion,
  MediaResponseStyle,
  MediaState,
  MediaStoryCategory,
  MediaStoryThread,
  PublicMediaPromise,
  PublicMediaPromiseType,
} from '../types/mediaTypes';
import { applyPublicReaction } from './publicReputationEngine';

const clamp = (value: number, low = 0, high = 100): number =>
  Math.max(low, Math.min(high, Math.round(value)));

export function mediaPressureState(state: GameState): MediaState {
  return {
    sessions: state.media?.sessions ?? [],
    declinedDuties: state.media?.declinedDuties ?? 0,
    journalistMemory: state.media?.journalistMemory ?? [],
    publicPromises: state.media?.publicPromises ?? [],
    storyThreads: state.media?.storyThreads ?? [],
    crises: state.media?.crises ?? [],
    managementStanding: state.media?.managementStanding ?? 50,
  };
}

export function ensureMediaPressureState(state: GameState): GameState {
  const current = mediaPressureState(state);
  if (
    state.media?.journalistMemory
    && state.media.publicPromises
    && state.media.storyThreads
    && state.media.crises
    && state.media.managementStanding !== undefined
  ) return state;
  return { ...state, media: current };
}

export function latestJournalistMemory(state: GameState): JournalistMemory | undefined {
  return mediaPressureState(state).journalistMemory?.at(0);
}

export function rememberedFollowUp(
  state: GameState,
  sessionId: string,
  index: number,
): MediaQuestion | undefined {
  const memory = latestJournalistMemory(state);
  if (!memory) return undefined;
  return {
    id: `${sessionId}-q${index}`,
    topic: memory.topic,
    prompt: `Earlier you took a ${memory.style.toLowerCase()} position on ${memory.topic.toLowerCase()}. Has your position changed?`,
    context: memory.statement,
    teamId: state.selectedTeamId,
    challengeMemoryId: memory.id,
  };
}

function positionsConflict(previous: MediaResponseStyle, current: MediaResponseStyle): boolean {
  if (previous === current) return false;
  const controlled = previous === 'Diplomatic' || previous === 'Protective';
  const aggressive = current === 'Demanding' || current === 'Confrontational';
  const reverseControlled = current === 'Diplomatic' || current === 'Protective';
  const reverseAggressive = previous === 'Demanding' || previous === 'Confrontational';
  return (controlled && aggressive) || (reverseControlled && reverseAggressive);
}

function upsertStory(
  state: GameState,
  input: {
    id: string;
    scope: 'Player' | 'AI';
    teamId: string;
    category: MediaStoryCategory;
    headline: string;
    summary: string;
    pressure: number;
    round: number;
    sourceId: string;
  },
): GameState {
  const media = mediaPressureState(state);
  const existing = media.storyThreads?.find((story) => story.id === input.id);
  const pressure = clamp(Math.max(existing?.pressure ?? 0, input.pressure));
  const stage: MediaStoryThread['stage'] =
    pressure >= 80 ? 'Flashpoint' : pressure >= 50 ? 'Escalating' : 'Emerging';
  const story: MediaStoryThread = {
    id: input.id,
    scope: input.scope,
    teamId: input.teamId,
    category: input.category,
    headline: input.headline,
    summary: input.summary,
    stage,
    pressure,
    status: 'Active',
    createdSeasonYear: existing?.createdSeasonYear ?? state.seasonYear,
    createdRound: existing?.createdRound ?? input.round,
    updatedSeasonYear: state.seasonYear,
    updatedRound: input.round,
    sourceIds: [...new Set([...(existing?.sourceIds ?? []), input.sourceId])].slice(-20),
  };
  return {
    ...state,
    media: {
      ...media,
      storyThreads: [story, ...(media.storyThreads ?? []).filter((entry) => entry.id !== story.id)].slice(0, 80),
    },
  };
}

export function recordJournalistAnswer(
  state: GameState,
  sessionId: string,
  question: MediaQuestion,
  style: MediaResponseStyle,
  statement: string,
  round: number,
): GameState {
  const media = mediaPressureState(state);
  const challenged = question.challengeMemoryId
    ? media.journalistMemory?.find((memory) => memory.id === question.challengeMemoryId)
    : media.journalistMemory?.find((memory) => memory.topic === question.topic);
  const contradicted = challenged ? positionsConflict(challenged.style, style) : false;
  const memory: JournalistMemory = {
    id: `memory-${state.seasonYear}-${round}-${question.id}-${style}`,
    topic: question.topic,
    style,
    statement,
    seasonYear: state.seasonYear,
    round,
    sessionId,
    questionId: question.id,
  };
  let next: GameState = {
    ...state,
    media: {
      ...media,
      journalistMemory: [memory, ...(media.journalistMemory ?? []).filter((entry) => entry.id !== memory.id)].slice(0, 60),
      managementStanding: clamp((media.managementStanding ?? 50) + (contradicted ? -4 : style === 'Diplomatic' || style === 'Protective' ? 1 : 0)),
    },
  };
  if (contradicted && challenged) {
    next = upsertStory(next, {
      id: `media-story-${state.seasonYear}-contradiction-${question.topic}`,
      scope: 'Player',
      teamId: state.selectedTeamId,
      category: 'Contradiction',
      headline: `Journalists challenge changing ${question.topic.toLowerCase()} message`,
      summary: `The latest answer conflicts with the team’s earlier ${challenged.style.toLowerCase()} position. The contradiction is now part of the ongoing news cycle.`,
      pressure: 58,
      round,
      sourceId: question.id,
    });
    next = applyPublicReaction(next, {
      trigger: 'Controversy',
      delta: -3,
      headline: 'Contradictory public position draws scrutiny',
      detail: 'Journalists and supporters are comparing the latest answer with the team’s earlier statement.',
      round,
      idSuffix: `contradiction-${question.id}`,
    });
  }
  return next;
}

function promiseSpec(
  state: GameState,
  question: MediaQuestion,
): { type: PublicMediaPromiseType; statement: string; driverId?: string } | undefined {
  switch (question.topic) {
    case 'Performance':
    case 'Expectations':
      return { type: 'Results', statement: 'The team will deliver a points-scoring result within the next three races.' };
    case 'Reliability':
      return { type: 'Reliability', statement: 'The team will complete a race without a mechanical retirement within the next three races.' };
    case 'DriverSupport':
    case 'TeamOrders':
      return { type: 'DriverSupport', statement: 'The team will demonstrate clear public and sporting support for its drivers.', driverId: question.driverId };
    case 'Sponsors':
      return { type: 'SponsorResolution', statement: 'The team will resolve its active sponsor dispute within the next three races.' };
    case 'BoardPressure':
      return { type: 'BoardTarget', statement: 'The team will stabilize its championship position and satisfy the board’s immediate demand.' };
    default:
      return undefined;
  }
}

export function canMakePublicMediaPromise(state: GameState, question: MediaQuestion): boolean {
  const media = mediaPressureState(state);
  const spec = promiseSpec(state, question);
  return Boolean(spec && !(media.publicPromises ?? []).some((promise) =>
    promise.status === 'Active' && promise.type === spec.type));
}

export function makePublicMediaPromise(
  state: GameState,
  sessionId: string,
  questionId: string,
): GameState {
  const media = mediaPressureState(state);
  const session = media.sessions.find((entry) => entry.id === sessionId);
  const question = session?.questions.find((entry) => entry.id === questionId);
  if (!session || !question || !session.answers.some((answer) => answer.questionId === questionId)) return state;
  const spec = promiseSpec(state, question);
  if (!spec || !canMakePublicMediaPromise(state, question)) return state;
  const finalRound = Math.max(1, state.calendar.length);
  const deadlineRound = Math.min(finalRound, Math.max(session.round + 3, 1));
  const promise: PublicMediaPromise = {
    id: `media-promise-${state.seasonYear}-${questionId}`,
    type: spec.type,
    statement: spec.statement,
    seasonYear: state.seasonYear,
    createdRound: session.round,
    deadlineRound,
    status: 'Active',
    sourceSessionId: sessionId,
    sourceQuestionId: questionId,
    driverId: spec.driverId,
  };
  return {
    ...state,
    media: {
      ...media,
      publicPromises: [promise, ...(media.publicPromises ?? [])].slice(0, 60),
    },
  };
}

function promiseFulfilled(state: GameState, promise: PublicMediaPromise, results: RaceResult[]): boolean {
  if (promise.type === 'Results') return results.some((result) => result.points > 0);
  if (promise.type === 'Reliability') return results.length > 0 && results.every((result) =>
    result.status === 'Finished' || !result.incidents.join(' ').toLowerCase().match(/engine|gearbox|mechanical|electrical|hydraulic/));
  if (promise.type === 'DriverSupport') {
    const relationships = promise.driverId
      ? [state.driverRelationships?.[promise.driverId]]
      : Object.values(state.driverRelationships ?? {}).filter((relationship) => relationship.teamId === state.selectedTeamId);
    return relationships.filter(Boolean).every((relationship) => (relationship?.trustInPrincipal ?? 0) >= 50);
  }
  if (promise.type === 'SponsorResolution') {
    return !state.commercial?.sponsors.some((sponsor) => sponsor.relationshipStatus === 'Breach');
  }
  return !state.boardroom?.ultimatum;
}

function evolveStories(state: GameState, round: number): GameState {
  const media = mediaPressureState(state);
  const momentum = state.publicReputation?.momentum ?? 0;
  const stories = (media.storyThreads ?? []).map((story): MediaStoryThread => {
    if (story.status !== 'Active') return story;
    const playerShift = story.scope === 'Player'
      ? momentum <= -20 ? 8 : momentum >= 20 ? -8 : -2
      : -4;
    const pressure = clamp(story.pressure + playerShift);
    if (pressure <= 12) return {
      ...story, pressure, status: 'Resolved', stage: 'Resolved',
      updatedSeasonYear: state.seasonYear, updatedRound: round,
    };
    const stage: MediaStoryThread['stage'] =
      pressure >= 80 ? 'Flashpoint' : pressure >= 50 ? 'Escalating' : pressure < story.pressure ? 'Cooling' : 'Emerging';
    return { ...story, pressure, stage, updatedSeasonYear: state.seasonYear, updatedRound: round };
  });
  return { ...state, media: { ...media, storyThreads: stories } };
}

function applyStoryStakeholderReactions(state: GameState, round: number): GameState {
  const media = mediaPressureState(state);
  const story = (media.storyThreads ?? []).find((entry) =>
    entry.scope === 'Player'
    && entry.status === 'Active'
    && (entry.stage === 'Escalating' || entry.stage === 'Flashpoint')
    && (entry.lastStakeholderReactionSeasonYear !== state.seasonYear || entry.lastStakeholderReactionRound !== round));
  if (!story) return state;
  const driverPressure = story.category === 'DriverConflict'
    || story.category === 'InternalLeak'
    || story.category === 'Scandal';
  const driverRelationships = driverPressure && state.driverRelationships
    ? Object.fromEntries(Object.entries(state.driverRelationships).map(([id, relationship]) => [
        id,
        relationship.teamId === state.selectedTeamId
          ? {
              ...relationship,
              trustInPrincipal: clamp(relationship.trustInPrincipal - 1),
              frustration: clamp(relationship.frustration + 1),
            }
          : relationship,
      ]))
    : state.driverRelationships;
  const rivalRelationships = state.phase18?.rivalRelationships
    ? Object.fromEntries(Object.entries(state.phase18.rivalRelationships).map(([id, relationship]) => [
        id,
        relationship.teamAId === state.selectedTeamId || relationship.teamBId === state.selectedTeamId
          ? {
              ...relationship,
              score: Math.max(-100, Math.min(100, relationship.score - 2)),
              sportingRespect: clamp(relationship.sportingRespect - 1),
            }
          : relationship,
      ]))
    : state.phase18?.rivalRelationships;
  return {
    ...state,
    driverRelationships,
    phase18: state.phase18 ? { ...state.phase18, rivalRelationships: rivalRelationships ?? state.phase18.rivalRelationships } : state.phase18,
    media: {
      ...media,
      storyThreads: (media.storyThreads ?? []).map((entry) => entry.id === story.id
        ? {
            ...entry,
            lastStakeholderReactionSeasonYear: state.seasonYear,
            lastStakeholderReactionRound: round,
          }
        : entry),
    },
  };
}

function generateAIStories(state: GameState, allResults: RaceResult[], round: number, raceId: string): GameState {
  let next = state;
  const byTeam = new Map<string, RaceResult[]>();
  for (const result of allResults) {
    if (result.teamId === state.selectedTeamId) continue;
    byTeam.set(result.teamId, [...(byTeam.get(result.teamId) ?? []), result]);
  }
  for (const [teamId, results] of byTeam) {
    const team = state.teams.find((entry) => entry.id === teamId);
    const doubleDnf = results.length >= 2 && results.every((result) => result.status !== 'Finished');
    const incidentTotal = results.reduce((total, result) => total + result.incidents.length, 0);
    if (!doubleDnf && incidentTotal < 3) continue;
    next = upsertStory(next, {
      id: `media-story-${state.seasonYear}-ai-${teamId}-reliability`,
      scope: 'AI',
      teamId,
      category: doubleDnf ? 'Reliability' : 'PerformanceRumor',
      headline: doubleDnf
        ? `${team?.name ?? teamId} faces growing reliability pressure`
        : `${team?.name ?? teamId} paddock rumors intensify`,
      summary: doubleDnf
        ? 'A double retirement has triggered questions about technical leadership and the direction of the programme.'
        : 'Repeated incidents have prompted scrutiny of the team’s drivers and operational standards.',
      pressure: doubleDnf ? 62 : 42,
      round,
      sourceId: raceId,
    });
  }
  return next;
}

function crisisCandidate(state: GameState, round: number): MediaCrisis | undefined {
  const media = mediaPressureState(state);
  const open = (media.crises ?? []).find((crisis) => crisis.status === 'Open');
  if (open) return undefined;
  const sponsor = state.commercial?.sponsors.find((entry) => entry.relationshipStatus === 'Breach');
  if (sponsor) return {
    id: `media-crisis-${state.seasonYear}-${round}-sponsor-${sponsor.id}`,
    kind: 'SponsorDispute',
    headline: `${sponsor.name} dispute becomes a public crisis`,
    detail: 'The sponsor wants reassurance while journalists question the stability of the commercial programme.',
    seasonYear: state.seasonYear,
    round,
    status: 'Open',
    linkedSponsorId: sponsor.id,
  };
  const driver = Object.values(state.driverRelationships ?? {}).find((relationship) =>
    relationship.teamId === state.selectedTeamId && (relationship.trustInPrincipal <= 25 || relationship.frustration >= 80));
  if (driver) return {
    id: `media-crisis-${state.seasonYear}-${round}-driver-${driver.driverId}`,
    kind: 'DriverConflict',
    headline: 'Driver conflict spills into the public arena',
    detail: 'Private tension has become a media story, forcing management to choose between openness, containment, and denial.',
    seasonYear: state.seasonYear,
    round,
    status: 'Open',
    linkedDriverId: driver.driverId,
  };
  const contradiction = (media.storyThreads ?? []).find((story) =>
    story.scope === 'Player'
    && story.category === 'Contradiction'
    && story.status === 'Active'
    && story.pressure >= 80);
  if (contradiction) return {
    id: `media-crisis-${state.seasonYear}-${round}-scandal`,
    kind: 'Scandal',
    headline: 'Contradictory statements become a leadership scandal',
    detail: 'Journalists, rival principals, and drivers are now openly challenging the credibility of the team’s public account.',
    seasonYear: state.seasonYear,
    round,
    status: 'Open',
  };
  if ((media.declinedDuties ?? 0) >= 3 || (media.managementStanding ?? 50) <= 30) return {
    id: `media-crisis-${state.seasonYear}-${round}-leak`,
    kind: 'InternalLeak',
    headline: 'Internal briefing leaks to the paddock press',
    detail: 'Conflicting accounts from inside the team are driving a damaging news cycle.',
    seasonYear: state.seasonYear,
    round,
    status: 'Open',
  };
  return undefined;
}

export function processMediaPressureAfterRace(
  state: GameState,
  playerResults: RaceResult[],
  allResults: RaceResult[],
  round: number,
  raceId: string,
): GameState {
  let next = ensureMediaPressureState(state);
  let media = mediaPressureState(next);
  let standingDelta = 0;
  const publicPromises = (media.publicPromises ?? []).map((promise): PublicMediaPromise => {
    if (promise.status !== 'Active') return promise;
    if (promiseFulfilled(next, promise, playerResults)) {
      standingDelta += 3;
      return { ...promise, status: 'Kept', outcome: 'The public commitment was delivered using real team results and relationship evidence.' };
    }
    if (state.seasonYear > promise.seasonYear || round >= promise.deadlineRound) {
      standingDelta -= 5;
      return { ...promise, status: 'Broken', outcome: 'The deadline passed without the promised outcome.' };
    }
    return promise;
  });
  media = {
    ...media,
    publicPromises,
    managementStanding: clamp((media.managementStanding ?? 50) + standingDelta),
  };
  next = { ...next, media };
  if (standingDelta !== 0) {
    const principalReputation = next.principal?.reputation;
    next = applyPublicReaction(next, {
      trigger: 'MediaResponse',
      delta: standingDelta > 0 ? 3 : -5,
      headline: standingDelta > 0 ? 'Public commitment delivered' : 'Broken public promise deepens pressure',
      detail: standingDelta > 0
        ? 'Journalists and supporters credit the team for matching its public words with real results.'
        : 'The public deadline passed without the promised outcome, and the earlier statement is being replayed.',
      round,
      idSuffix: `media-promise-${raceId}-${standingDelta > 0 ? 'kept' : 'broken'}`,
    });
    if (state.gameMode === 'SingleSeason' && next.principal && principalReputation !== undefined) {
      next = { ...next, principal: { ...next.principal, reputation: principalReputation } };
    }
  }
  if (standingDelta !== 0 && state.gameMode !== 'SingleSeason' && next.principal) {
    next = {
      ...next,
      principal: {
        ...next.principal,
        reputation: clamp(next.principal.reputation + Math.sign(standingDelta)),
      },
    };
  }
  next = evolveStories(next, round);
  next = applyStoryStakeholderReactions(next, round);
  next = generateAIStories(next, allResults, round, raceId);
  const crisis = crisisCandidate(next, round);
  if (crisis) {
    const current = mediaPressureState(next);
    next = {
      ...next,
      media: { ...current, crises: [crisis, ...(current.crises ?? [])].slice(0, 40) },
    };
    next = upsertStory(next, {
      id: `media-story-${crisis.id}`,
      scope: 'Player',
      teamId: state.selectedTeamId,
      category: crisis.kind,
      headline: crisis.headline,
      summary: crisis.detail,
      pressure: 78,
      round,
      sourceId: crisis.id,
    });
  }
  return next;
}

export function resolveMediaCrisis(
  state: GameState,
  crisisId: string,
  resolution: MediaCrisis['resolution'],
): GameState {
  const media = mediaPressureState(state);
  const crisis = media.crises?.find((entry) => entry.id === crisisId);
  if (!crisis || crisis.status !== 'Open' || !resolution) return state;
  const transparent = resolution === 'TransparentBriefing';
  const privateReview = resolution === 'PrivateInvestigation';
  const publicDelta = transparent ? 4 : privateReview ? 1 : -5;
  const standingDelta = transparent ? 3 : privateReview ? 1 : -4;
  const outcome = transparent
    ? 'Management accepted scrutiny, set out the known facts, and improved public trust while keeping the story alive briefly.'
    : privateReview
      ? 'The team contained the immediate dispute and began a private investigation, limiting both the benefit and the risk.'
      : 'The denial created a sharper headline and increased the cost of any later contradiction.';
  const crises = (media.crises ?? []).map((entry) =>
    entry.id === crisis.id ? { ...entry, status: 'Resolved' as const, resolution, outcome } : entry);
  const storyThreads = (media.storyThreads ?? []).map((story) =>
    story.sourceIds.includes(crisis.id)
      ? {
          ...story,
          pressure: transparent ? Math.max(15, story.pressure - 25) : privateReview ? Math.max(20, story.pressure - 12) : clamp(story.pressure + 15),
          stage: transparent || privateReview ? 'Cooling' as const : 'Flashpoint' as const,
          updatedSeasonYear: state.seasonYear,
          updatedRound: crisis.round,
        }
      : story);
  let next: GameState = {
    ...state,
    media: {
      ...media,
      crises,
      storyThreads,
      managementStanding: clamp((media.managementStanding ?? 50) + standingDelta),
    },
  };
  if (state.gameMode !== 'SingleSeason' && next.principal) {
    next = {
      ...next,
      principal: {
        ...next.principal,
        reputation: clamp(next.principal.reputation + Math.sign(standingDelta)),
      },
    };
  }
  const principalReputation = next.principal?.reputation;
  next = applyPublicReaction(next, {
    trigger: 'Controversy',
    delta: publicDelta,
    sentiment: transparent ? 'Positive' : privateReview ? 'Mixed' : 'Negative',
    headline: transparent ? 'Transparent crisis response earns respect' : privateReview ? 'Team contains public crisis' : 'Denial deepens media pressure',
    detail: outcome,
    round: crisis.round,
    idSuffix: `${crisis.id}-${resolution}`,
  });
  if (state.gameMode === 'SingleSeason' && next.principal && principalReputation !== undefined) {
    next = { ...next, principal: { ...next.principal, reputation: principalReputation } };
  }
  return next;
}

export function mediaPromiseLabel(type: PublicMediaPromiseType): string {
  switch (type) {
    case 'Results': return 'Results commitment';
    case 'Reliability': return 'Reliability commitment';
    case 'DriverSupport': return 'Driver support commitment';
    case 'SponsorResolution': return 'Sponsor resolution commitment';
    case 'BoardTarget': return 'Board target commitment';
  }
}
