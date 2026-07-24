import { describe, expect, it } from 'vitest';
import type { GameState } from '../game/careerState';
import type { RaceResult } from '../types/gameTypes';
import {
  answerMediaQuestion,
  createMediaSession,
  declineMediaSession,
} from './mediaSessionEngine';
import {
  ensureMediaPressureState,
  makePublicMediaPromise,
  mediaPressureAfterTeamMove,
  mediaPressureState,
  processMediaPressureAfterRace,
  resolveMediaCrisis,
} from './mediaPressureEngine';

function career(seed = 'media-pressure', gameMode: GameState['gameMode'] = 'Career'): GameState {
  void seed;
  return {
    id: 'media-pressure-save',
    createdAt: '1995-01-01T00:00:00.000Z',
    updatedAt: '1995-01-01T00:00:00.000Z',
    gameMode,
    seasonYear: 1995,
    series: 'F1',
    selectedTeamId: 'player-team',
    currentRaceIndex: 0,
    calendar: Array.from({ length: 8 }, (_, index) => ({
      id: `race-${index + 1}`,
      round: index + 1,
      gpName: `Race ${index + 1}`,
      trackId: `track-${index + 1}`,
      completed: false,
    })),
    teams: [
      { id: 'player-team', name: 'Player Team', driverIds: ['driver-1', 'driver-2'], reputation: 60, expectedStanding: 4, budget: 50_000_000, morale: 60 },
      { id: 'rival-team', name: 'Rival Team', driverIds: ['rival-1', 'rival-2'], reputation: 55, expectedStanding: 5, budget: 40_000_000, morale: 60 },
    ],
    drivers: [
      { id: 'driver-1', name: 'Driver One', teamId: 'player-team', morale: 60 },
      { id: 'driver-2', name: 'Driver Two', teamId: 'player-team', morale: 60 },
      { id: 'rival-1', name: 'Rival One', teamId: 'rival-team', morale: 60 },
      { id: 'rival-2', name: 'Rival Two', teamId: 'rival-team', morale: 60 },
    ],
    completedRaceResults: {},
    qualifyingResults: {},
    raceEvents: {},
    driverStandings: [],
    constructorStandings: [],
    news: [],
    regulationHistory: [],
    offseasonHistory: [],
    randomSeed: seed,
    seasonComplete: false,
    commercial: {
      sponsors: [{
        id: 'sponsor-1',
        name: 'Sponsor One',
        type: 'Title',
        annualValue: 10_000_000,
        contractYearsRemaining: 2,
        confidence: 60,
        relationshipStatus: 'Healthy',
        objectives: [],
      }],
      offers: [],
      negotiations: [],
      commercialReputation: 60,
      lastOfferRotationRound: 0,
    },
    principal: {
      id: 'principal',
      name: 'Principal',
      reputation: 55,
      currentTeamId: 'player-team',
      contractYearsRemaining: 2,
      jobSecurity: 60,
      attributes: { mediaImage: 55, boardConfidence: 55, financialDiscipline: 55, driverManagement: 55, development: 55, strategy: 55 },
      careerStats: { seasonsCompleted: 1, raceWins: 0, podiums: 0, driverTitles: 0, constructorTitles: 0, teamsManaged: ['player-team'] },
      xp: 0,
      level: 1,
      skillPoints: 0,
      spentSkillPoints: {},
    },
    teamPrincipal: {
      id: 'principal-template',
      name: 'Principal',
      background: 'Racer',
      managementStyle: 'Balanced',
      primaryStrength: 'Leadership',
      secondaryStrength: 'Media',
      weakness: 'Finance',
      mediaPersonality: 'diplomatic',
      driverManagementStyle: 'Supportive',
      developmentPhilosophy: 'Balanced',
      raceStrategyPhilosophy: 'Balanced',
      riskTolerance: 50,
      driverManagement: 55,
      developmentFocus: 55,
      raceStrategy: 55,
      commercialSkill: 55,
      politicalSkill: 55,
      reputation: 55,
    },
    teamReputations: {
      'player-team': {
        teamId: 'player-team',
        reputation: 60,
        financialStability: 60,
        ownerPatience: 60,
        ownerPersonality: 'PatientBuilder',
        fanExpectation: 55,
        sponsorConfidence: 60,
        historicalPrestige: 55,
        currentCompetitiveness: 55,
      },
    },
    teamExpectations: {
      'player-team': {
        teamId: 'player-team',
        seasonYear: 1995,
        primaryObjective: 'Score points regularly',
        secondaryObjectives: [],
        minimumConstructorPosition: 4,
        ownerPatience: 60,
      },
    },
    publicReputation: {
      identity: 'Established',
      teamStanding: 60,
      principalStanding: 55,
      fanConfidence: 55,
      fanExpectation: 55,
      momentum: 0,
      recentReactions: [],
      lastUpdatedRound: 0,
    },
    driverRelationships: {
      'driver-1': { driverId: 'driver-1', teamId: 'player-team', trustInPrincipal: 60, trustInTeam: 60, morale: 60, frustration: 20 },
      'driver-2': { driverId: 'driver-2', teamId: 'player-team', trustInPrincipal: 60, trustInTeam: 60, morale: 60, frustration: 20 },
    },
    teamOrderHistory: [],
    careerMobilityMode: 'StandardCareer',
  } as unknown as GameState;
}

function result(
  driverId: string,
  teamId: string,
  position: number | null,
  status: RaceResult['status'],
  incidents: string[] = [],
): RaceResult {
  return {
    position,
    driverId,
    teamId,
    gridPosition: 5,
    status,
    lapsCompleted: status === 'Finished' ? 60 : 20,
    points: position !== null && position <= 6 ? 10 : 0,
    raceScore: 70,
    gapText: status === 'Finished' ? '+10.000' : 'Retired',
    incidents,
  };
}

describe('persistent media pressure engine', () => {
  it('records journalist memory and creates a remembered follow-up in a later session', () => {
    let state = createMediaSession(career('media-memory'), 'Preseason', 0);
    const opening = state.media!.sessions[0];
    state = answerMediaQuestion(state, opening.id, opening.questions[0].id, 'Diplomatic');
    state = createMediaSession(state, 'PreRace', 1, state.calendar[0].id);

    const followUp = state.media!.sessions[0].questions.find((question) => question.challengeMemoryId);
    expect(state.media!.journalistMemory).toHaveLength(1);
    expect(followUp?.prompt).toContain('Earlier you took a diplomatic position');
  });

  it('turns a contradicted remembered answer into a persistent public story', () => {
    let state = createMediaSession(career('media-contradiction'), 'Preseason', 0);
    const opening = state.media!.sessions[0];
    state = answerMediaQuestion(state, opening.id, opening.questions[0].id, 'Diplomatic');
    state = createMediaSession(state, 'PreRace', 1, state.calendar[0].id);
    const later = state.media!.sessions[0];
    const followUp = later.questions.find((question) => question.challengeMemoryId)!;
    state = answerMediaQuestion(state, later.id, followUp.id, 'Confrontational');

    expect(state.media!.storyThreads?.[0]).toMatchObject({
      scope: 'Player',
      category: 'Contradiction',
      status: 'Active',
    });
    expect(state.publicReputation!.recentReactions[0].headline).toContain('Contradictory');
  });

  it('creates a binding public promise only after an answer and resolves it from race evidence', () => {
    let state = createMediaSession(career('media-promise'), 'Preseason', 0);
    const session = state.media!.sessions[0];
    const question = session.questions[0];
    expect(makePublicMediaPromise(state, session.id, question.id)).toBe(state);

    state = answerMediaQuestion(state, session.id, question.id, 'Demanding');
    state = makePublicMediaPromise(state, session.id, question.id);
    const promise = state.media!.publicPromises![0];
    expect(promise).toMatchObject({ type: 'Results', status: 'Active', deadlineRound: 3 });

    const driver = state.drivers.find((entry) => entry.teamId === state.selectedTeamId)!;
    const raceResult = result(driver.id, state.selectedTeamId, 4, 'Finished');
    state = processMediaPressureAfterRace(state, [raceResult], [raceResult], 1, state.calendar[0].id);
    expect(state.media!.publicPromises![0].status).toBe('Kept');
  });

  it('breaks an unmet public promise at its deadline and lowers media standing', () => {
    let state = createMediaSession(career('media-broken-promise'), 'Preseason', 0);
    const session = state.media!.sessions[0];
    const question = session.questions[0];
    state = makePublicMediaPromise(
      answerMediaQuestion(state, session.id, question.id, 'Demanding'),
      session.id,
      question.id,
    );
    const before = state.media!.managementStanding!;
    const driver = state.drivers.find((entry) => entry.teamId === state.selectedTeamId)!;
    const noPoints = result(driver.id, state.selectedTeamId, 12, 'Finished');
    state = processMediaPressureAfterRace(state, [noPoints], [noPoints], 3, state.calendar[2].id);

    expect(state.media!.publicPromises![0].status).toBe('Broken');
    expect(state.media!.managementStanding).toBeLessThan(before);
  });

  it('creates AI-team pressure stories from real double-retirement evidence', () => {
    const state = career('media-ai-story');
    const rival = state.teams.find((team) => team.id !== state.selectedTeamId)!;
    const rivalDrivers = state.drivers.filter((driver) => driver.teamId === rival.id).slice(0, 2);
    const results = rivalDrivers.map((driver) =>
      result(driver.id, rival.id, null, 'DNF', ['Engine failure']));
    const next = processMediaPressureAfterRace(state, [], results, 1, state.calendar[0].id);

    expect(next.media!.storyThreads?.some((story) =>
      story.scope === 'AI' && story.teamId === rival.id && story.category === 'Reliability')).toBe(true);
  });

  it('escalates repeated AI-team evidence and publishes a paddock reaction for each new race', () => {
    const initial = career('media-ai-escalation');
    const rival = initial.teams.find((team) => team.id !== initial.selectedTeamId)!;
    const rivalDrivers = initial.drivers.filter((driver) => driver.teamId === rival.id).slice(0, 2);
    const results = rivalDrivers.map((driver) =>
      result(driver.id, rival.id, null, 'DNF', ['Engine failure']));

    const first = processMediaPressureAfterRace(initial, [], results, 1, initial.calendar[0].id);
    const firstStory = first.media!.storyThreads!.find((story) => story.teamId === rival.id)!;
    const second = processMediaPressureAfterRace(first, [], results, 2, initial.calendar[1].id);
    const secondStory = second.media!.storyThreads!.find((story) => story.id === firstStory.id)!;
    const third = processMediaPressureAfterRace(second, [], results, 3, initial.calendar[2].id);
    const thirdStory = third.media!.storyThreads!.find((story) => story.id === firstStory.id)!;

    expect(secondStory.pressure).toBeGreaterThan(firstStory.pressure);
    expect(secondStory.sourceIds).toEqual([initial.calendar[0].id, initial.calendar[1].id]);
    expect(thirdStory.stage).toBe('Flashpoint');
    expect(third.news.some((item) =>
      item.id.includes(initial.calendar[2].id)
      && item.headline.includes('pressure escalates'))).toBe(true);
  });

  it('preserves promises, stories, crises, and journalist memory when media duties are declined', () => {
    let state = createMediaSession(career('media-decline-preservation'), 'PreRace', 1, 'race-1');
    const session = state.media!.sessions[0];
    state = {
      ...state,
      media: {
        ...mediaPressureState(state),
        journalistMemory: [{
          id: 'memory-existing',
          topic: 'Performance',
          style: 'Diplomatic',
          statement: 'An earlier statement.',
          seasonYear: state.seasonYear,
          round: 0,
          sessionId: 'earlier-session',
          questionId: 'earlier-question',
        }],
        publicPromises: [{
          id: 'promise-existing',
          type: 'Results',
          statement: 'Score points.',
          seasonYear: state.seasonYear,
          createdRound: 0,
          deadlineRound: 3,
          status: 'Active',
          sourceSessionId: 'earlier-session',
          sourceQuestionId: 'earlier-question',
        }],
        storyThreads: [{
          id: 'story-existing',
          scope: 'Player',
          teamId: state.selectedTeamId,
          category: 'Reliability',
          headline: 'Existing story',
          summary: 'Existing story summary.',
          stage: 'Escalating',
          pressure: 60,
          status: 'Active',
          createdSeasonYear: state.seasonYear,
          createdRound: 0,
          updatedSeasonYear: state.seasonYear,
          updatedRound: 0,
          sourceIds: ['existing-source'],
        }],
        crises: [{
          id: 'crisis-existing',
          kind: 'InternalLeak',
          headline: 'Existing crisis',
          detail: 'Existing crisis detail.',
          seasonYear: state.seasonYear,
          round: 0,
          status: 'Open',
        }],
      },
    };
    const before = mediaPressureState(state);
    const declined = declineMediaSession(state, session.id);

    expect(declined.media!.journalistMemory).toEqual(before.journalistMemory);
    expect(declined.media!.publicPromises).toEqual(before.publicPromises);
    expect(declined.media!.storyThreads).toEqual(before.storyThreads);
    expect(declined.media!.crises).toEqual(before.crises);
    expect(declined.media!.sessions[0].status).toBe('Declined');
  });

  it('closes former-team obligations on a job move while retaining history and AI stories', () => {
    const state = career('media-team-move');
    const rival = state.teams.find((team) => team.id !== state.selectedTeamId)!;
    const pressure = mediaPressureAfterTeamMove({
      ...state,
      media: {
        sessions: [],
        declinedDuties: 1,
        journalistMemory: [],
        managementStanding: 55,
        publicPromises: [{
          id: 'move-promise',
          type: 'Results',
          statement: 'Deliver points.',
          seasonYear: state.seasonYear,
          createdRound: 1,
          deadlineRound: 4,
          status: 'Active',
          sourceSessionId: 'move-session',
          sourceQuestionId: 'move-question',
        }],
        crises: [{
          id: 'move-crisis',
          kind: 'DriverConflict',
          headline: 'Old-team conflict',
          detail: 'The conflict belongs to the former team.',
          seasonYear: state.seasonYear,
          round: 2,
          status: 'Open',
        }],
        storyThreads: [{
          id: 'move-player-story',
          scope: 'Player',
          teamId: state.selectedTeamId,
          category: 'DriverConflict',
          headline: 'Old-team story',
          summary: 'The old team remains under pressure.',
          stage: 'Escalating',
          pressure: 65,
          status: 'Active',
          createdSeasonYear: state.seasonYear,
          createdRound: 1,
          updatedSeasonYear: state.seasonYear,
          updatedRound: 2,
          sourceIds: ['old-event'],
        }, {
          id: 'move-ai-story',
          scope: 'AI',
          teamId: rival.id,
          category: 'Reliability',
          headline: 'AI-team story',
          summary: 'A separate rival story remains active.',
          stage: 'Escalating',
          pressure: 60,
          status: 'Active',
          createdSeasonYear: state.seasonYear,
          createdRound: 1,
          updatedSeasonYear: state.seasonYear,
          updatedRound: 2,
          sourceIds: ['ai-event'],
        }],
      },
    }, state.selectedTeamId, rival.id);

    expect(pressure.publicPromises![0]).toMatchObject({ status: 'Expired' });
    expect(pressure.crises![0]).toMatchObject({ status: 'Resolved' });
    expect(pressure.storyThreads!.find((story) => story.id === 'move-player-story')).toMatchObject({
      status: 'Resolved',
      stage: 'Resolved',
      pressure: 0,
    });
    expect(pressure.storyThreads!.find((story) => story.id === 'move-ai-story')).toMatchObject({
      status: 'Active',
      scope: 'AI',
    });
  });

  it('creates and resolves sponsor and driver crises through explicit management decisions', () => {
    const base = career('media-crisis-decision');
    const sponsor = base.commercial!.sponsors[0];
    const pressured: GameState = {
      ...base,
      commercial: {
        ...base.commercial!,
        sponsors: base.commercial!.sponsors.map((entry) =>
          entry.id === sponsor.id ? { ...entry, relationshipStatus: 'Breach' as const } : entry),
      },
    };
    const withCrisis = processMediaPressureAfterRace(pressured, [], [], 2, pressured.calendar[1].id);
    const crisis = withCrisis.media!.crises![0];
    expect(crisis).toMatchObject({ kind: 'SponsorDispute', status: 'Open' });

    const resolved = resolveMediaCrisis(withCrisis, crisis.id, 'TransparentBriefing');
    expect(resolved.media!.crises![0]).toMatchObject({
      status: 'Resolved',
      resolution: 'TransparentBriefing',
    });
    expect(resolved.media!.storyThreads?.find((story) => story.sourceIds.includes(crisis.id))?.stage).toBe('Cooling');
  });

  it('keeps Single Season media pressure but does not turn it into career-market reputation', () => {
    let state = createMediaSession(career('media-single-season', 'SingleSeason'), 'Preseason', 0);
    const session = state.media!.sessions[0];
    const question = session.questions[0];
    state = makePublicMediaPromise(
      answerMediaQuestion(state, session.id, question.id, 'Demanding'),
      session.id,
      question.id,
    );
    const reputation = state.principal!.reputation;
    const driver = state.drivers.find((entry) => entry.teamId === state.selectedTeamId)!;
    const scored = result(driver.id, state.selectedTeamId, 4, 'Finished');
    state = processMediaPressureAfterRace(state, [scored], [scored], 1, state.calendar[0].id);

    expect(state.media!.publicPromises![0].status).toBe('Kept');
    expect(state.principal!.reputation).toBe(reputation);
  });

  it('fills optional pressure fields for older saves without losing sessions', () => {
    const state = createMediaSession(career('media-pressure-legacy'), 'PreRace', 1, 'race-1');
    const legacy: GameState = {
      ...state,
      media: { sessions: state.media!.sessions, declinedDuties: 2 },
    };
    const migrated = ensureMediaPressureState(legacy);
    expect(mediaPressureState(migrated)).toMatchObject({
      declinedDuties: 2,
      journalistMemory: [],
      publicPromises: [],
      storyThreads: [],
      crises: [],
      managementStanding: 50,
    });
    expect(migrated.media!.sessions).toHaveLength(1);
  });
});
