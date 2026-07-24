import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import { gameReducer } from '../game/gameReducer';
import type { GameState } from '../game/careerState';
import {
  answerMediaQuestion,
  createMediaSession,
  declineMediaSession,
  pendingMediaSessions,
  shouldCreateCrisisSession,
} from './mediaSessionEngine';

function career(seed = 'media-sessions'): GameState {
  return createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed,
  });
}

describe('media session engine', () => {
  it('creates one persisted session per real trigger and does not duplicate it', () => {
    const initial = career();
    const created = createMediaSession(initial, 'Preseason', 0, undefined, 'Opening media day');
    const duplicate = createMediaSession(created, 'Preseason', 0, undefined, 'Opening media day');

    expect(created.media?.sessions).toHaveLength(1);
    expect(created.media?.sessions[0]).toMatchObject({
      type: 'Preseason',
      status: 'Pending',
      trigger: 'Opening media day',
    });
    expect(created.media?.sessions[0].questions).toHaveLength(2);
    expect(duplicate.media?.sessions).toHaveLength(1);
  });

  it('answers questions, changes existing stakeholder state, and completes the session', () => {
    const initial = createMediaSession(career('media-answer'), 'Preseason', 0);
    const session = initial.media!.sessions[0];
    const principalMedia = initial.principal!.attributes.mediaImage;
    const ownerPatience = initial.teamReputations![initial.selectedTeamId].ownerPatience;
    const firstDriver = initial.drivers.find((driver) => driver.teamId === initial.selectedTeamId)!;
    const driverTrust = initial.driverRelationships![firstDriver.id].trustInPrincipal;

    const diplomatic = answerMediaQuestion(initial, session.id, session.questions[0].id, 'Diplomatic');
    expect(diplomatic.principal!.attributes.mediaImage).toBeGreaterThan(principalMedia);
    expect(diplomatic.teamReputations![initial.selectedTeamId].ownerPatience).toBeGreaterThanOrEqual(ownerPatience);
    expect(diplomatic.media!.sessions[0].status).toBe('Pending');
    expect(diplomatic.publicReputation!.recentReactions[0].trigger).toBe('MediaResponse');

    const completed = answerMediaQuestion(diplomatic, session.id, session.questions[1].id, 'Protective');
    expect(completed.media!.sessions[0].status).toBe('Completed');
    expect(completed.driverRelationships![firstDriver.id].trustInPrincipal).toBeGreaterThan(driverTrust);
    expect(completed.news.some((item) => item.id.includes(session.questions[1].id))).toBe(true);
  });

  it('uses the principal media personality without exposing the hidden calculation', () => {
    const initial = career('media-personality');
    initial.teamPrincipal = { ...initial.teamPrincipal!, mediaPersonality: 'diplomatic' };
    const created = createMediaSession(initial, 'Preseason', 0);
    const session = created.media!.sessions[0];
    const before = created.principal!.attributes.mediaImage;
    const answered = answerMediaQuestion(created, session.id, session.questions[0].id, 'Diplomatic');

    expect(answered.principal!.attributes.mediaImage).toBeGreaterThan(before);
    expect(answered.media!.sessions[0].answers[0].reaction).not.toMatch(/[+-]\d|%/);
  });

  it('keeps rival relationship scores on their signed -100 to 100 scale', () => {
    const initial = createMediaSession(career('media-rival-range'), 'Preseason', 0);
    const rivalEntry = Object.entries(initial.phase18!.rivalRelationships).find(([, relationship]) =>
      relationship.teamAId === initial.selectedTeamId || relationship.teamBId === initial.selectedTeamId)!;
    const [rivalryId, rivalry] = rivalEntry;
    const pressured: GameState = {
      ...initial,
      phase18: {
        ...initial.phase18!,
        rivalRelationships: {
          ...initial.phase18!.rivalRelationships,
          [rivalryId]: { ...rivalry, score: -99, sportingRespect: 0 },
        },
      },
    };
    const session = pressured.media!.sessions[0];
    const answered = answerMediaQuestion(
      pressured,
      session.id,
      session.questions[0].id,
      'Confrontational',
    );

    expect(answered.phase18!.rivalRelationships[rivalryId].score).toBe(-100);
    expect(answered.phase18!.rivalRelationships[rivalryId].sportingRespect).toBe(0);
  });

  it('allows optional duties to be declined with real owner, sponsor, and media consequences', () => {
    const initial = createMediaSession(career('media-decline'), 'PreRace', 1, 'race-1');
    const session = initial.media!.sessions[0];
    const beforeMedia = initial.principal!.attributes.mediaImage;
    const beforeOwner = initial.teamReputations![initial.selectedTeamId].ownerPatience;
    const declined = declineMediaSession(initial, session.id);

    expect(declined.media!.sessions[0].status).toBe('Declined');
    expect(declined.media!.declinedDuties).toBe(1);
    expect(declined.principal!.attributes.mediaImage).toBeLessThan(beforeMedia);
    expect(declined.teamReputations![initial.selectedTeamId].ownerPatience).toBeLessThan(beforeOwner);
    expect(declined.news[0].headline).toContain('declines');
    expect(declined.publicReputation!.fanConfidence).toBeLessThan(initial.publicReputation!.fanConfidence);
  });

  it('does not permit a second answer or repeat decline to apply consequences twice', () => {
    const initial = createMediaSession(career('media-idempotent'), 'Preseason', 0);
    const session = initial.media!.sessions[0];
    const answered = answerMediaQuestion(initial, session.id, session.questions[0].id, 'Diplomatic');
    const repeated = answerMediaQuestion(answered, session.id, session.questions[0].id, 'Confrontational');
    expect(repeated).toBe(answered);

    const declined = declineMediaSession(initial, session.id);
    expect(declineMediaSession(declined, session.id)).toBe(declined);
  });

  it('creates crisis pressure only from actual board, sponsor, or owner state', () => {
    const stable = career('media-crisis');
    expect(shouldCreateCrisisSession(stable)).toBe(false);

    const owner = stable.teamReputations![stable.selectedTeamId];
    const pressured: GameState = {
      ...stable,
      teamReputations: {
        ...stable.teamReputations,
        [stable.selectedTeamId]: { ...owner, ownerPatience: 18 },
      },
    };
    expect(shouldCreateCrisisSession(pressured)).toBe(true);
  });

  it('keeps legacy careers valid when media state is absent', () => {
    const legacy = career('media-legacy');
    delete legacy.media;
    expect(pendingMediaSessions(legacy)).toEqual([]);
    expect(createMediaSession(legacy, 'PreRace', 1, legacy.calendar[0].id).media?.sessions).toHaveLength(1);
  });

  it('wires preseason and post-qualifying sessions into the existing reducer flow', () => {
    let state = gameReducer(null, {
      type: 'NEW_GAME',
      options: {
        gameMode: 'Career',
        seasonYear: 1995,
        series: 'F1',
        teamId: 't-benetton',
        seed: 'media-reducer-flow',
      },
    })!;
    state = gameReducer(state, { type: 'SELECT_BOARDROOM_MANDATE', mandate: 'Expected' })!;
    for (const tabId of ['teamOverview', 'budget', 'driverLineup', 'carDevelopment', 'sponsorsEngine', 'seasonObjectives', 'roundOnePreview'] as const) {
      state = gameReducer(state, { type: 'APPROVE_PRESEASON_TAB', tabId })!;
    }
    state = gameReducer(state, { type: 'COMPLETE_PRESEASON_SETUP' })!;
    expect(state.media?.sessions.some((session) => session.type === 'Preseason')).toBe(true);

    state = gameReducer(state, { type: 'ADVANCE_TO_RACE_WEEKEND' })!;
    state = gameReducer(state, { type: 'RUN_QUALIFYING', decisions: [] })!;
    expect(state.media?.sessions.some((session) => session.type === 'PostQualifying' && session.raceId === state.calendar[0].id)).toBe(true);
  });
});
