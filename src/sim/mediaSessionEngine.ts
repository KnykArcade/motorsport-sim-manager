import type { GameState } from '../game/careerState';
import { activeDriversForTeam } from '../game/careerState';
import type { NewsItem } from '../types/gameTypes';
import type {
  MediaAnswer,
  MediaQuestion,
  MediaQuestionTopic,
  MediaResponseStyle,
  MediaSession,
  MediaSessionType,
  MediaState,
} from '../types/mediaTypes';
import { applyPublicReaction } from './publicReputationEngine';

const clamp = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

function mediaState(state: GameState): MediaState {
  return state.media ?? { sessions: [], declinedDuties: 0 };
}

function sessionId(state: GameState, type: MediaSessionType, round: number, raceId?: string): string {
  return `media-${state.seasonYear}-${type.toLowerCase()}-${raceId ?? round}`;
}

function question(
  session: string,
  index: number,
  topic: MediaQuestionTopic,
  prompt: string,
  context: string,
  driverId?: string,
  teamId?: string,
): MediaQuestion {
  return { id: `${session}-q${index}`, topic, prompt, context, driverId, teamId };
}

function selectedTeam(state: GameState) {
  return state.teams.find((team) => team.id === state.selectedTeamId);
}

function primaryDriver(state: GameState) {
  return activeDriversForTeam(state, state.selectedTeamId)[0];
}

function lastPlayerResult(state: GameState, raceId?: string) {
  const results = raceId ? state.completedRaceResults[raceId] : undefined;
  return results
    ?.filter((result) => result.teamId === state.selectedTeamId)
    .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))[0];
}

function questionsFor(
  state: GameState,
  type: MediaSessionType,
  id: string,
  raceId?: string,
): MediaQuestion[] {
  const team = selectedTeam(state);
  const driver = primaryDriver(state);
  const expectation = state.teamExpectations?.[state.selectedTeamId];
  const reputation = state.teamReputations?.[state.selectedTeamId];
  const boardroom = state.boardroom;
  const result = lastPlayerResult(state, raceId);
  const qualifying = raceId
    ? state.qualifyingResults[raceId]
      ?.filter((entry) => entry.teamId === state.selectedTeamId)
      .sort((a, b) => a.position - b.position)[0]
    : undefined;
  const resultDriver = result ? state.drivers.find((entry) => entry.id === result.driverId) : driver;
  const breachedSponsor = state.commercial?.sponsors.find((sponsor) => sponsor.relationshipStatus === 'Breach');

  if (type === 'Preseason') {
    return [
      question(
        id, 1, 'Expectations',
        `What should supporters expect from ${team?.name ?? 'the team'} this season?`,
        boardroom?.mandate
          ? `The board agreed a ${boardroom.mandate.toLowerCase()} mandate.`
          : expectation?.primaryObjective ?? 'The board has set its season expectations.',
        undefined, state.selectedTeamId,
      ),
      question(
        id, 2, breachedSponsor ? 'Sponsors' : 'DriverSupport',
        breachedSponsor
          ? `Can ${breachedSponsor.name} still trust the team to deliver?`
          : `How much faith do you have in the current driver lineup?`,
        breachedSponsor
          ? 'A commercial partner has formally raised its concern.'
          : `${activeDriversForTeam(state, state.selectedTeamId).length} race drivers are contracted.`,
        driver?.id, state.selectedTeamId,
      ),
    ];
  }

  if (type === 'PreRace') {
    const priorRace = state.calendar.filter((race) => race.completed).at(-1);
    const priorResult = priorRace ? lastPlayerResult(state, priorRace.id) : undefined;
    return [
      question(
        id, 1, priorResult?.status === 'DNF' ? 'Reliability' : 'Performance',
        priorResult?.status === 'DNF'
          ? 'Has the team solved the problem that stopped the car last time out?'
          : `What result would represent a successful weekend for ${team?.name ?? 'the team'}?`,
        priorResult
          ? `The best team result last round was ${priorResult.position ? `P${priorResult.position}` : priorResult.status}.`
          : 'This is the first race weekend of the season.',
        driver?.id, state.selectedTeamId,
      ),
      question(
        id, 2, boardroom?.ultimatum ? 'BoardPressure' : 'Rivalry',
        boardroom?.ultimatum
          ? 'Can you deliver with your job now under direct board scrutiny?'
          : 'Which rival do you expect to set the benchmark this weekend?',
        boardroom?.ultimatum?.requirement
          ?? `Ownership is ${reputation && reputation.ownerPatience < 35 ? 'showing visible concern' : reputation && reputation.ownerPatience >= 70 ? 'firmly supportive' : 'watching the team’s direction'}.`,
        undefined, state.selectedTeamId,
      ),
    ];
  }

  if (type === 'PostQualifying') {
    return [
      question(
        id, 1, 'Performance',
        qualifying
          ? `Your best car qualified P${qualifying.position}. Is that where the team belongs?`
          : 'Why was the team unable to establish a representative qualifying position?',
        qualifying?.notes.join(' · ') || 'Qualifying evidence is limited.',
        qualifying?.driverId ?? driver?.id, state.selectedTeamId,
      ),
      question(
        id, 2, qualifying?.incident ? 'Reliability' : 'DriverSupport',
        qualifying?.incident
          ? 'Who takes responsibility for the qualifying incident?'
          : `How confident are you that ${resultDriver?.name ?? 'your drivers'} can convert this grid position?`,
        qualifying?.incident
          ? `${qualifying.incident.type} · ${qualifying.incident.severity}${qualifying.incident.raceImpact ? ` · ${qualifying.incident.raceImpact}` : ''}`
          : 'The race remains to be run.',
        qualifying?.driverId ?? driver?.id, state.selectedTeamId,
      ),
    ];
  }

  if (type === 'PostRace') {
    const orders = (state.teamOrderHistory ?? []).filter((order) => order.raceId === raceId);
    return [
      question(
        id, 1, result?.status !== 'Finished' ? 'Reliability' : 'Performance',
        result?.status !== 'Finished'
          ? `What do you say to ${resultDriver?.name ?? 'the driver'} after another race ended early?`
          : `How do you assess ${resultDriver?.name ?? 'the team'} finishing P${result?.position ?? '—'}?`,
        result?.incidents.join(' · ') || `The best team car scored ${result?.points ?? 0} points.`,
        result?.driverId ?? driver?.id, state.selectedTeamId,
      ),
      question(
        id, 2, orders.length > 0 ? 'TeamOrders' : 'Expectations',
        orders.length > 0
          ? 'Were the team orders fair to both drivers?'
          : 'Does this result change what the team can achieve this season?',
        orders.length > 0
          ? `${orders.length} team-order call${orders.length === 1 ? ' was' : 's were'} recorded.`
          : expectation?.primaryObjective ?? 'The championship picture has changed.',
        orders[0]?.disadvantagedDriverId, state.selectedTeamId,
      ),
    ];
  }

  return [
    question(
      id, 1, breachedSponsor ? 'Sponsors' : boardroom?.ultimatum ? 'BoardPressure' : 'Reliability',
      breachedSponsor
        ? `Has the relationship with ${breachedSponsor.name} broken down?`
        : boardroom?.ultimatum
          ? 'Why should the owner continue to trust your leadership?'
          : 'Why is pressure building around the team?',
      breachedSponsor?.relationshipStatus
        ?? boardroom?.ultimatum?.requirement
        ?? 'A high-priority team issue is driving the news cycle.',
      driver?.id, state.selectedTeamId,
    ),
    question(
      id, 2, 'DriverSupport',
      'Is the team united behind your response to this situation?',
      'Drivers, staff, sponsors, rivals, and ownership are watching the response.',
      driver?.id, state.selectedTeamId,
    ),
  ];
}

function titleFor(type: MediaSessionType, teamName: string): string {
  switch (type) {
    case 'Preseason': return `${teamName} preseason media day`;
    case 'PreRace': return 'Pre-race press conference';
    case 'PostQualifying': return 'Post-qualifying media pen';
    case 'PostRace': return 'Post-race press conference';
    case 'Crisis': return `${teamName} crisis briefing`;
  }
}

export function createMediaSession(
  state: GameState,
  type: MediaSessionType,
  round: number,
  raceId?: string,
  trigger?: string,
): GameState {
  const current = mediaState(state);
  const id = sessionId(state, type, round, raceId);
  if (current.sessions.some((session) => session.id === id)) return state;
  const teamName = selectedTeam(state)?.name ?? 'Team';
  const session: MediaSession = {
    id,
    type,
    seasonYear: state.seasonYear,
    round,
    raceId,
    title: titleFor(type, teamName),
    trigger: trigger ?? `${type} media obligations`,
    status: 'Pending',
    questions: questionsFor(state, type, id, raceId),
    answers: [],
  };
  return { ...state, media: { ...current, sessions: [session, ...current.sessions].slice(0, 80) } };
}

export function pendingMediaSessions(state: GameState): MediaSession[] {
  return mediaState(state).sessions.filter((session) => session.status === 'Pending');
}

function styleResponse(style: MediaResponseStyle, topic: MediaQuestionTopic): string {
  const topicText: Record<MediaQuestionTopic, string> = {
    Expectations: 'the team will be judged by its work rather than a headline',
    Performance: 'the result must be understood in the context of the whole weekend',
    Reliability: 'the team will investigate the evidence and protect its people',
    TeamOrders: 'the call was made for the team and will be reviewed internally',
    Contracts: 'private negotiations will remain private until there is something concrete',
    Sponsors: 'commercial partners deserve delivery and direct communication',
    BoardPressure: 'pressure is part of leading a racing team',
    DriverSupport: 'the drivers have the team’s full support',
    Rivalry: 'respect is earned on track rather than in the press room',
  };
  const lead: Record<MediaResponseStyle, string> = {
    Diplomatic: 'Measured response:',
    Protective: 'Protective response:',
    Demanding: 'Demanding response:',
    Confrontational: 'Confrontational response:',
    Evasive: 'Evasive response:',
  };
  return `${lead[style]} ${topicText[topic]}.`;
}

function reactionFor(style: MediaResponseStyle, topic: MediaQuestionTopic): string {
  if (style === 'Protective') return topic === 'DriverSupport' || topic === 'Reliability'
    ? 'The drivers and garage appreciate that blame was kept away from individuals.'
    : 'The team welcomes the public backing, while the press notes the guarded tone.';
  if (style === 'Diplomatic') return 'Ownership and sponsors welcome the control, though the answer creates few headlines.';
  if (style === 'Demanding') return 'The owner sees urgency, but the drivers and staff feel the standards were made public.';
  if (style === 'Confrontational') return 'The answer dominates the news cycle, exciting some observers while unsettling commercial partners and rivals.';
  return 'The immediate confrontation is avoided, but journalists, sponsors, and ownership notice the lack of a direct answer.';
}

function mediaPersonalityBonus(state: GameState, style: MediaResponseStyle): number {
  const personality = state.teamPrincipal?.mediaPersonality;
  if (
    (personality === 'diplomatic' && style === 'Diplomatic')
    || (personality === 'reserved' && style === 'Evasive')
    || (personality === 'charismatic' && (style === 'Diplomatic' || style === 'Protective'))
    || (personality === 'outspoken' && (style === 'Demanding' || style === 'Confrontational'))
    || (personality === 'controversial' && style === 'Confrontational')
  ) return 1;
  return 0;
}

function applyStakeholderEffects(
  state: GameState,
  question: MediaQuestion,
  style: MediaResponseStyle,
): { state: GameState; summary: string } {
  const owner = state.teamReputations?.[state.selectedTeamId];
  const ownerPersonality = owner?.ownerPersonality;
  const personalityBonus = mediaPersonalityBonus(state, style);
  let mediaImage = style === 'Confrontational' ? 2 : style === 'Evasive' ? -2 : 1;
  let ownerDelta = style === 'Diplomatic' ? 1 : style === 'Evasive' ? -1 : 0;
  let sponsorDelta = style === 'Diplomatic' ? 1 : style === 'Confrontational' ? -2 : style === 'Evasive' ? -1 : 0;
  let driverDelta = style === 'Protective' ? 3 : style === 'Demanding' ? -2 : 0;
  const cultureDelta = style === 'Protective' || style === 'Diplomatic' ? 1 : style === 'Confrontational' ? -2 : style === 'Demanding' ? -1 : 0;
  const rivalDelta = style === 'Confrontational' ? -3 : style === 'Diplomatic' ? 1 : 0;

  if (style === 'Demanding' && (ownerPersonality === 'WinNowTycoon' || ownerPersonality === 'Showman')) ownerDelta += 2;
  if (style === 'Confrontational' && ownerPersonality === 'Showman') ownerDelta += 2;
  if (style === 'Protective' && ownerPersonality === 'RacingPurist') ownerDelta += 1;
  if (question.topic === 'Reliability' && style === 'Protective') driverDelta += 1;
  if (question.topic === 'TeamOrders' && style === 'Evasive') driverDelta -= 2;
  if (question.topic === 'Sponsors' && style === 'Confrontational') sponsorDelta -= 1;
  mediaImage += personalityBonus;
  if (personalityBonus > 0 && style !== 'Evasive') sponsorDelta += 1;

  const principal = state.principal ? {
    ...state.principal,
    attributes: {
      ...state.principal.attributes,
      mediaImage: clamp(state.principal.attributes.mediaImage + mediaImage),
    },
  } : state.principal;

  const teamReputations = owner ? {
    ...state.teamReputations,
    [state.selectedTeamId]: {
      ...owner,
      ownerPatience: clamp(owner.ownerPatience + ownerDelta),
      sponsorConfidence: clamp(owner.sponsorConfidence + sponsorDelta),
    },
  } : state.teamReputations;

  const affectedDriverIds = question.driverId
    ? [question.driverId]
    : activeDriversForTeam(state, state.selectedTeamId).map((driver) => driver.id);
  const driverRelationships = state.driverRelationships
    ? Object.fromEntries(Object.entries(state.driverRelationships).map(([id, relationship]) => [
      id,
      affectedDriverIds.includes(id)
        ? { ...relationship, trustInPrincipal: clamp(relationship.trustInPrincipal + driverDelta) }
        : relationship,
    ]))
    : state.driverRelationships;

  const commercial = state.commercial ? {
    ...state.commercial,
    sponsors: state.commercial.sponsors.map((sponsor) => ({
      ...sponsor,
      confidence: clamp(sponsor.confidence + sponsorDelta),
    })),
  } : state.commercial;

  const culture = state.phase18?.teamCultures?.[state.selectedTeamId];
  const rivalRelationships = state.phase18?.rivalRelationships;
  const phase18 = state.phase18 ? {
    ...state.phase18,
    teamCultures: culture ? {
      ...state.phase18.teamCultures,
      [state.selectedTeamId]: {
        ...culture,
        cohesion: clamp(culture.cohesion + cultureDelta),
        stability: clamp(culture.stability + cultureDelta),
      },
    } : state.phase18.teamCultures,
    rivalRelationships: rivalRelationships
      ? Object.fromEntries(Object.entries(rivalRelationships).map(([id, relationship]) => [
        id,
        relationship.teamAId === state.selectedTeamId || relationship.teamBId === state.selectedTeamId
          ? {
              ...relationship,
              score: clamp(relationship.score + rivalDelta),
              sportingRespect: clamp(relationship.sportingRespect + rivalDelta),
            }
          : relationship,
      ]))
      : state.phase18.rivalRelationships,
  } : state.phase18;

  const consequences = [
    mediaImage > 0 ? 'public profile strengthened' : mediaImage < 0 ? 'public profile weakened' : '',
    driverDelta > 0 ? 'driver backing improved' : driverDelta < 0 ? 'driver trust reduced' : '',
    sponsorDelta > 0 ? 'sponsor confidence improved' : sponsorDelta < 0 ? 'sponsor confidence reduced' : '',
    ownerDelta > 0 ? 'owner response positive' : ownerDelta < 0 ? 'owner patience reduced' : '',
  ].filter(Boolean);

  return {
    state: { ...state, principal, teamReputations, driverRelationships, commercial, phase18 },
    summary: consequences.join(' · ') || 'The answer was noted without a material stakeholder shift.',
  };
}

function responseNews(
  state: GameState,
  session: MediaSession,
  question: MediaQuestion,
  answer: MediaAnswer,
): NewsItem {
  const team = selectedTeam(state);
  return {
    id: `news-${answer.questionId}-${answer.style.toLowerCase()}`,
    round: session.round,
    headline: `${team?.name ?? 'Team'} principal takes a ${answer.style.toLowerCase()} line`,
    body: `${answer.response} ${answer.reaction}`,
    timestamp: new Date().toISOString(),
    category: 'paddock',
    priority: answer.style === 'Confrontational' ? 'high' : 'normal',
    careerPhase: state.careerPhase?.currentPhase,
    teamId: state.selectedTeamId,
    driverId: question.driverId,
  };
}

export function answerMediaQuestion(
  state: GameState,
  sessionIdValue: string,
  questionId: string,
  style: MediaResponseStyle,
): GameState {
  const current = mediaState(state);
  const session = current.sessions.find((entry) => entry.id === sessionIdValue);
  const questionEntry = session?.questions.find((entry) => entry.id === questionId);
  if (!session || session.status !== 'Pending' || !questionEntry) return state;
  if (session.answers.some((answer) => answer.questionId === questionId)) return state;

  const answer: MediaAnswer = {
    questionId,
    style,
    response: styleResponse(style, questionEntry.topic),
    reaction: reactionFor(style, questionEntry.topic),
  };
  const effects = applyStakeholderEffects(state, questionEntry, style);
  const answers = [...session.answers, answer];
  const completed = answers.length >= session.questions.length;
  const nextSession: MediaSession = {
    ...session,
    answers,
    status: completed ? 'Completed' : 'Pending',
    consequenceSummary: completed
      ? answers.map((entry) => entry.reaction).join(' ')
      : effects.summary,
  };
  const nextMedia = {
    ...current,
    sessions: current.sessions.map((entry) => entry.id === session.id ? nextSession : entry),
  };
  const news = responseNews(effects.state, session, questionEntry, answer);
  const nextState: GameState = {
    ...effects.state,
    media: nextMedia,
    news: [news, ...effects.state.news.filter((item) => item.id !== news.id)].slice(0, 80),
  };
  const publicDelta = style === 'Protective'
    ? 2
    : style === 'Diplomatic'
      ? 1
      : style === 'Evasive'
        ? -3
        : style === 'Confrontational'
          ? 1
          : 0;
  return applyPublicReaction(nextState, {
    trigger: style === 'Confrontational' ? 'Controversy' : 'MediaResponse',
    delta: publicDelta,
    sentiment: style === 'Confrontational' || style === 'Demanding' ? 'Mixed' : undefined,
    headline: style === 'Evasive'
      ? 'Supporters frustrated by evasive media response'
      : style === 'Protective'
        ? 'Public backing for the team earns supporter approval'
        : `${style} answer shapes the public mood`,
    detail: answer.reaction,
    round: session.round,
    idSuffix: `${questionId}-${style}`,
  });
}

export function declineMediaSession(state: GameState, sessionIdValue: string): GameState {
  const current = mediaState(state);
  const session = current.sessions.find((entry) => entry.id === sessionIdValue);
  if (!session || session.status !== 'Pending') return state;
  const reputation = state.teamReputations?.[state.selectedTeamId];
  const principal = state.principal ? {
    ...state.principal,
    attributes: {
      ...state.principal.attributes,
      mediaImage: clamp(state.principal.attributes.mediaImage - (session.type === 'Crisis' ? 4 : 2)),
    },
  } : state.principal;
  const teamReputations = reputation ? {
    ...state.teamReputations,
    [state.selectedTeamId]: {
      ...reputation,
      ownerPatience: clamp(reputation.ownerPatience - (session.type === 'Crisis' ? 2 : 1)),
      sponsorConfidence: clamp(reputation.sponsorConfidence - 1),
    },
  } : state.teamReputations;
  const commercial = state.commercial ? {
    ...state.commercial,
    sponsors: state.commercial.sponsors.map((sponsor) => ({
      ...sponsor,
      confidence: clamp(sponsor.confidence - 1),
    })),
  } : state.commercial;
  const nextSession: MediaSession = {
    ...session,
    status: 'Declined',
    consequenceSummary: 'The team avoided the interview, but ownership, sponsors, and the press noticed the absence.',
  };
  const teamName = selectedTeam(state)?.name ?? 'Team';
  const news: NewsItem = {
    id: `news-${session.id}-declined`,
    round: session.round,
    headline: `${teamName} declines ${session.type.toLowerCase()} media duties`,
    body: nextSession.consequenceSummary,
    timestamp: new Date().toISOString(),
    category: 'paddock',
    priority: session.type === 'Crisis' ? 'high' : 'normal',
    careerPhase: state.careerPhase?.currentPhase,
    teamId: state.selectedTeamId,
  };
  return applyPublicReaction({
    ...state,
    principal,
    teamReputations,
    commercial,
    media: {
      declinedDuties: current.declinedDuties + 1,
      sessions: current.sessions.map((entry) => entry.id === session.id ? nextSession : entry),
    },
    news: [news, ...state.news.filter((item) => item.id !== news.id)].slice(0, 80),
  }, {
    trigger: 'MediaResponse',
    delta: session.type === 'Crisis' ? -5 : -2,
    headline: 'Media absence weakens public confidence',
    detail: session.type === 'Crisis'
      ? 'Supporters expected leadership during a crisis and interpret the absence as a lack of accountability.'
      : 'Missing an optional media duty creates some distance between the team and its supporters.',
    round: session.round,
    idSuffix: `${session.id}-declined`,
  });
}

export function shouldCreateCrisisSession(state: GameState): boolean {
  return Boolean(
    state.boardroom?.ultimatum
    || state.commercial?.sponsors.some((sponsor) => sponsor.relationshipStatus === 'Breach')
    || (state.teamReputations?.[state.selectedTeamId]?.ownerPatience ?? 100) <= 20,
  );
}
