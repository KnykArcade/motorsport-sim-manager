// Career phase engine: phase transitions, paddock week event generation,
// and deduplication logic for the between-race management flow.

import type { GameState } from './careerState';
import { activeDriversForTeam, carForTeam } from './careerState';
import { getTrackById } from '../data';
import { effectiveCarRatings } from '../sim/trackFitEngine';
import { developmentSlots } from '../sim/facilityEngine';
import type {
  CareerPhase,
  CareerPhaseState,
  PaddockEvent,
  PaddockEventCategory,
  PaddockEventOption,
} from '../types/careerPhaseTypes';
import type { RaceResult } from '../types/gameTypes';

export function defaultCareerPhaseState(): CareerPhaseState {
  return {
    currentPhase: 'pre_season_setup',
    currentRound: 0,
    requiredDecisionsComplete: false,
    generatedEventsForCurrentWeek: false,
    generatedNewsForCurrentWeek: false,
    aiActionsProcessedForCurrentWeek: false,
    developmentUpdatesProcessedForCurrentWeek: false,
    preseasonSetupComplete: false,
    preseasonDecisionsComplete: false,
    preseasonEventsGenerated: false,
    preseasonEffectsApplied: false,
    paddockEvents: [],
  };
}

export function getCareerPhase(state: GameState): CareerPhase {
  return state.careerPhase?.currentPhase ?? 'pre_season_setup';
}

export function getOrCreatePhaseState(state: GameState): CareerPhaseState {
  return state.careerPhase ?? defaultCareerPhaseState();
}

// --- Phase transitions -------------------------------------------------------

export function transitionToPhase(
  state: GameState,
  phase: CareerPhase,
): GameState {
  const phaseState = getOrCreatePhaseState(state);
  return {
    ...state,
    careerPhase: { ...phaseState, currentPhase: phase },
  };
}

// Called when a race is completed (COMMIT_LIVE_RACE or RUN_RACE).
// Sets phase to post_race_review and records the completed race.
export function enterPostRaceReview(
  state: GameState,
  completedRaceId: string,
): GameState {
  const phaseState = getOrCreatePhaseState(state);
  const race = state.calendar.find((r) => r.id === completedRaceId);
  const round = race?.round ?? phaseState.currentRound;
  const nextRace = state.calendar.find((r) => r.round === round + 1);
  return {
    ...state,
    careerPhase: {
      ...phaseState,
      currentPhase: 'post_race_review',
      currentRound: round,
      lastCompletedRaceId: completedRaceId,
      nextRaceId: nextRace?.id,
      // Reset paddock week flags for the new week.
      generatedEventsForCurrentWeek: false,
      generatedNewsForCurrentWeek: false,
      aiActionsProcessedForCurrentWeek: false,
      developmentUpdatesProcessedForCurrentWeek: false,
      requiredDecisionsComplete: false,
      paddockEvents: [],
    },
  };
}

// Called when the player clicks "Continue to Paddock Week" from Post-Race Review.
export function enterPaddockWeek(state: GameState): GameState {
  const phaseState = getOrCreatePhaseState(state);
  const round = phaseState.currentRound;
  const weekId = `pw-${state.seasonYear}-${round}`;
  return {
    ...state,
    careerPhase: {
      ...phaseState,
      currentPhase: 'paddock_week',
      paddockWeekId: weekId,
      generatedEventsForCurrentWeek: false,
      generatedNewsForCurrentWeek: false,
      aiActionsProcessedForCurrentWeek: false,
      developmentUpdatesProcessedForCurrentWeek: false,
      requiredDecisionsComplete: false,
      paddockEvents: [],
    },
  };
}

// Called when the player resolves all required decisions and clicks "Advance".
export function enterPreRaceBriefing(state: GameState): GameState {
  return transitionToPhase(state, 'pre_race_briefing');
}

// Called when the player clicks "Enter Race Weekend" from Pre-Race Briefing.
export function enterRaceWeekend(state: GameState): GameState {
  return transitionToPhase(state, 'race_weekend');
}

// Called when a new game is created — starts in pre_season_setup.
export function enterPreSeasonSetup(state: GameState): GameState {
  const phaseState = defaultCareerPhaseState();
  return { ...state, careerPhase: phaseState };
}

// Called when the player completes pre-season setup and advances to Race 1.
export function enterPreRaceBriefingFromPreseason(state: GameState): GameState {
  const phaseState = getOrCreatePhaseState(state);
  return {
    ...state,
    careerPhase: {
      ...phaseState,
      currentPhase: 'pre_race_briefing',
      preseasonSetupComplete: true,
      preseasonDecisionsComplete: true,
    },
  };
}

// --- Required decisions ------------------------------------------------------

export function hasUnresolvedRequiredDecisions(state: GameState): boolean {
  const phaseState = getOrCreatePhaseState(state);
  return phaseState.paddockEvents.some(
    (e) => e.isRequiredDecision && !e.resolvedOptionId,
  );
}

export function resolvePaddockEvent(
  state: GameState,
  eventId: string,
  optionId: string,
): GameState {
  const phaseState = getOrCreatePhaseState(state);
  const event = phaseState.paddockEvents.find((e) => e.id === eventId);
  if (!event) return state;

  const updatedEvents = phaseState.paddockEvents.map((e) =>
    e.id === eventId ? { ...e, resolvedOptionId: optionId } : e,
  );

  const allResolved = !updatedEvents.some(
    (e) => e.isRequiredDecision && !e.resolvedOptionId,
  );

  return {
    ...state,
    careerPhase: {
      ...phaseState,
      paddockEvents: updatedEvents,
      requiredDecisionsComplete: allResolved,
    },
  };
}

// --- Paddock week event generation -------------------------------------------

function makeEventId(weekId: string, category: string, idx: number): string {
  return `pe-${weekId}-${category}-${idx}`;
}

function makeEvent(
  weekId: string,
  season: number,
  series: string,
  round: number,
  category: PaddockEventCategory,
  title: string,
  description: string,
  severity: PaddockEvent['severity'] = 'info',
  isRequiredDecision = false,
  options?: PaddockEventOption[],
): PaddockEvent {
  return {
    id: makeEventId(weekId, category, 0),
    weekId,
    season,
    series,
    round,
    category,
    title,
    description,
    severity,
    isRequiredDecision,
    options,
    effectsApplied: false,
    createdAt: new Date().toISOString(),
  };
}

// Generate paddock week events based on current game state.
// This is the core event generation — it reads team state, driver morale,
// finances, development, AI teams, and the next race to produce a set of
// events for the current paddock week. Deduplication is handled by checking
// the generatedEventsForCurrentWeek flag before calling this.
export function generatePaddockWeekEvents(state: GameState): PaddockEvent[] {
  const phaseState = getOrCreatePhaseState(state);
  const round = phaseState.currentRound;
  const season = state.seasonYear;
  const series = state.series;
  const weekId = phaseState.paddockWeekId ?? `pw-${season}-${round}`;

  const events: PaddockEvent[] = [];
  const team = state.teams.find((t) => t.id === state.selectedTeamId);
  if (!team) return events;

  const car = carForTeam(state, state.selectedTeamId);
  const activeDrivers = activeDriversForTeam(state, state.selectedTeamId);
  const carRatings = car ? effectiveCarRatings(car) : null;

  // --- Next Race Briefing ---
  const nextRace = state.calendar.find((r) => r.round === round + 1);
  if (nextRace) {
    const track = getTrackById(nextRace.trackId);
    const trackDesc = track
      ? `${track.name}: ${track.archetype}. Demands ${topDemand(track)}.`
      : nextRace.trackName;
    events.push(
      makeEvent(
        weekId,
        season,
        series,
        round,
        'next_race',
        `Next Race: ${nextRace.gpName}`,
        `Round ${nextRace.round} at ${trackDesc}. ${car ? `Car condition: ${Math.round(car.condition)}%.` : ''}`,
        'info',
      ),
    );
  }

  // --- Development / Factory ---
  const slots = developmentSlots(state.facilities);
  const activeProjects = state.activeDevelopmentProjects;
  if (activeProjects.length > 0) {
    const projectNames = activeProjects.map((p) => p.name).join(', ');
    events.push(
      makeEvent(
        weekId,
        season,
        series,
        round,
        'development',
        `${activeProjects.length}/${slots} development slots in use`,
        `Active projects: ${projectNames}. ${activeProjects.length < slots ? `${slots - activeProjects.length} slot(s) available.` : 'All slots occupied.'}`,
        'info',
      ),
    );
  } else if (slots > 0) {
    events.push(
      makeEvent(
        weekId,
        season,
        series,
        round,
        'development',
        'Factory available',
        `No active development projects. ${slots} slot(s) available for new upgrades.`,
        'info',
      ),
    );
  }

  // Completed projects since last race.
  const recentCompleted = state.completedDevelopmentProjects.filter(
    (p) => !events.some((e) => e.title.includes(p.name)),
  );
  for (const proj of recentCompleted.slice(-2)) {
    events.push(
      makeEvent(
        weekId,
        season,
        series,
        round,
        'development',
        `Upgrade completed: ${proj.name}`,
        `${proj.name} has been completed and applied to the car.`,
        'minor',
      ),
    );
  }

  // --- Driver & Morale ---
  for (const driver of activeDrivers) {
    if (driver.morale < 40) {
      events.push(
        makeEvent(
          weekId,
          season,
          series,
          round,
          'driver_morale',
          `${driver.name} is frustrated`,
          `Morale is at ${Math.round(driver.morale)}%. The driver is unhappy with recent results or team dynamics.`,
          'minor',
        ),
      );
    } else if (driver.morale > 80) {
      events.push(
        makeEvent(
          weekId,
          season,
          series,
          round,
          'driver_morale',
          `${driver.name} is highly motivated`,
          `Morale is at ${Math.round(driver.morale)}%. The driver is confident and pushing hard.`,
          'info',
        ),
      );
    }
  }

  // Check last race results for DNF/points impact.
  const lastRaceId = phaseState.lastCompletedRaceId;
  if (lastRaceId) {
    const results = state.completedRaceResults[lastRaceId] ?? [];
    const playerResults = results.filter((r) => r.teamId === state.selectedTeamId);
    for (const r of playerResults) {
      const driver = state.drivers.find((d) => d.id === r.driverId);
      if (!driver) continue;
      if (r.status === 'DNF' || r.status === 'DSQ') {
        events.push(
          makeEvent(
            weekId,
            season,
            series,
            round,
            'driver_morale',
            `${driver.name} disappointed after DNF`,
            `Retirement in the last race has affected ${driver.name}'s confidence.`,
            'minor',
          ),
        );
      } else if (r.position !== null && r.position <= 3) {
        events.push(
          makeEvent(
            weekId,
            season,
            series,
            round,
            'driver_morale',
            `${driver.name} boosted by podium`,
            `P${r.position} finish has lifted ${driver.name}'s spirits.`,
            'info',
          ),
        );
      }
    }
  }

  // --- Sponsor / Finance ---
  if (team.budget < 5_000_000) {
    events.push(
      makeEvent(
        weekId,
        season,
        series,
        round,
        'finance',
        'Budget warning',
        `Team budget is critically low at ${formatBudget(team.budget)}. Careful spending is required.`,
        'major',
      ),
    );
  }

  // Sponsor objectives (if commercial state exists).
  if (state.commercial) {
    const sponsors = state.commercial.sponsors;
    for (const s of sponsors) {
      if (s.confidence < 30) {
        events.push(
          makeEvent(
            weekId,
            season,
            series,
            round,
            'sponsor',
            `${s.name} is dissatisfied`,
            `Sponsor confidence is at ${Math.round(s.confidence)}%. Results need to improve to maintain the relationship.`,
            'minor',
          ),
        );
      }
    }
  }

  // --- Engine ---
  if (state.engine && carRatings) {
    if (carRatings.reliability < 5) {
      events.push(
        makeEvent(
          weekId,
          season,
          series,
          round,
          'engine',
          'Reliability concern',
          `Car reliability is rated ${carRatings.reliability.toFixed(1)}/10. The factory should prioritize reliability work.`,
          'minor',
        ),
      );
    }
  }

  // --- Staff / Facilities ---
  if (state.facilities) {
    const facLevels = state.facilities.facilities.map((f) => f.level);
    const avgLevel = facLevels.reduce((a, b) => a + b, 0) / Math.max(1, facLevels.length);
    if (avgLevel < 2) {
      events.push(
        makeEvent(
          weekId,
          season,
          series,
          round,
          'facility',
          'Facility limitations',
          `Average facility level is ${avgLevel.toFixed(1)}. Development capacity is restricted.`,
          'info',
        ),
      );
    }
  }

  // --- AI Team News ---
  const aiStates = state.aiTeamStates ?? {};
  const aiTeams = state.teams.filter((t) => t.id !== state.selectedTeamId);
  // Pick 1-2 AI teams to generate news for.
  const newsTeams = aiTeams.slice(0, Math.min(2, aiTeams.length));
  for (const aiTeam of newsTeams) {
    const aiState = aiStates[aiTeam.id];
    const aiCar = carForTeam(state, aiTeam.id);
    const aiRatings = aiCar ? effectiveCarRatings(aiCar) : null;
    if (aiRatings && aiRatings.reliability < 4) {
      events.push(
        makeEvent(
          weekId,
          season,
          series,
          round,
          'ai_team',
          `${aiTeam.name} struggling with reliability`,
          `${aiTeam.name} has been dealing with reliability issues in recent rounds.`,
          'info',
        ),
      );
    } else if (aiState?.archetype === 'AggressiveSpender' || aiState?.archetype === 'DevelopmentFocused') {
      events.push(
        makeEvent(
          weekId,
          season,
          series,
          round,
          'ai_team',
          `${aiTeam.name} pushing development hard`,
          `${aiTeam.name} is known for aggressive development and may bring upgrades soon.`,
          'info',
        ),
      );
    }
  }

  // --- Regulation ---
  if (round === 0 && state.regulationProposals && state.regulationProposals.length > 0) {
    events.push(
      makeEvent(
        weekId,
        season,
        series,
        round,
        'regulation',
        'Regulation proposals pending',
        `${state.regulationProposals.length} regulation proposals are up for vote this season.`,
        'info',
      ),
    );
  }

  // --- Scouting (Career Mode only) ---
  if (state.gameMode === 'Career' && state.scouting) {
    events.push(
      makeEvent(
        weekId,
        season,
        series,
        round,
        'scouting',
        'Scouting report available',
        'The scouting department is monitoring young talent across the feeder series.',
        'info',
      ),
    );
  }

  // --- Required Decision: Race Preparation Focus ---
  if (nextRace) {
    const track = getTrackById(nextRace.trackId);
    const focusOptions: PaddockEventOption[] = [
      {
        id: 'balanced',
        label: 'Balanced Setup',
        description: 'A balanced approach with no particular emphasis.',
      },
      {
        id: 'qualifying',
        label: 'Qualifying Focus',
        description: 'Prioritize one-lap pace. May sacrifice race pace slightly.',
        moraleChange: 2,
      },
      {
        id: 'race',
        label: 'Race Pace Focus',
        description: 'Prioritize long-run pace and tire management.',
        reliabilityChange: 1,
      },
    ];
    if (track && track.setupProfile.powerDemand > 6) {
      focusOptions.push({
        id: 'power',
        label: 'Engine Power Focus',
        description: ` ${track.name} demands power. Focus on straight-line speed.`,
        risk: 1,
      });
    }
    events.push(
      makeEvent(
        weekId,
        season,
        series,
        round,
        'general_team',
        'Select race preparation focus',
        `Choose the team's preparation focus for ${nextRace.gpName}.`,
        'minor',
        true,
        focusOptions,
      ),
    );
  }

  return events;
}

// Mark events as generated and store them in state.
export function generateAndStorePaddockEvents(state: GameState): GameState {
  const phaseState = getOrCreatePhaseState(state);
  if (phaseState.generatedEventsForCurrentWeek) return state;

  const events = generatePaddockWeekEvents(state);
  return {
    ...state,
    careerPhase: {
      ...phaseState,
      paddockEvents: events,
      generatedEventsForCurrentWeek: true,
      requiredDecisionsComplete: !events.some((e) => e.isRequiredDecision),
    },
  };
}

// --- Helpers -----------------------------------------------------------------

function topDemand(track: NonNullable<ReturnType<typeof getTrackById>>): string {
  const demands: [string, number][] = [
    ['engine power', track.setupProfile.powerDemand],
    ['aero efficiency', track.setupProfile.aeroDemand],
    ['mechanical grip', track.setupProfile.mechanicalDemand],
  ];
  demands.sort((a, b) => b[1] - a[1]);
  return `${demands[0][0]} and ${demands[1][0]}`;
}

function formatBudget(amount: number): string {
  const millions = amount / 1_000_000;
  if (Math.abs(millions) >= 1) return `$${millions.toFixed(1)}M`;
  return `$${Math.round(amount / 1000)}K`;
}

// --- Post-race summary helpers ----------------------------------------------

export type PostRaceSummary = {
  raceId: string;
  gpName: string;
  round: number;
  trackName: string;
  playerResults: RaceResult[];
  pointsGained: number;
  driverStandingsMovement: { driverId: string; position: number; points: number }[];
  constructorPosition: number;
  constructorPoints: number;
  carCondition: number;
  budgetImpact: number;
  damageNotes: string[];
  devMessages: string[];
};

export function buildPostRaceSummary(state: GameState): PostRaceSummary | null {
  const phaseState = getOrCreatePhaseState(state);
  const raceId = phaseState.lastCompletedRaceId;
  if (!raceId) return null;

  const race = state.calendar.find((r) => r.id === raceId);
  if (!race) return null;

  const results = state.completedRaceResults[raceId] ?? [];
  const playerResults = results.filter((r) => r.teamId === state.selectedTeamId);
  const pointsGained = playerResults.reduce((sum, r) => sum + r.points, 0);

  const constructorEntry = state.constructorStandings.find(
    (s) => s.entityId === state.selectedTeamId,
  );
  const constructorPosition =
    state.constructorStandings.findIndex((s) => s.entityId === state.selectedTeamId) + 1;

  const car = carForTeam(state, state.selectedTeamId);

  // Budget impact: look at finance transactions for this round.
  const roundTxns = (state.finance ?? []).filter(
    (t) => t.round === race.round && t.category !== 'Development',
  );
  const budgetImpact = roundTxns.reduce((sum, t) => sum + t.amount, 0);

  // Damage notes from news.
  const damageNotes = state.news
    .filter((n) => n.round === race.round && n.headline.includes('damage'))
    .map((n) => n.headline);

  // Dev messages from news.
  const devMessages = state.news
    .filter((n) => n.round === race.round && n.id.startsWith('news-dev-'))
    .map((n) => n.headline);

  const driverStandingsMovement = playerResults.map((r) => {
    const entry = state.driverStandings.find((s) => s.entityId === r.driverId);
    return {
      driverId: r.driverId,
      position: entry ? state.driverStandings.indexOf(entry) + 1 : 0,
      points: entry?.points ?? 0,
    };
  });

  return {
    raceId,
    gpName: race.gpName,
    round: race.round,
    trackName: race.trackName,
    playerResults,
    pointsGained,
    driverStandingsMovement,
    constructorPosition,
    constructorPoints: constructorEntry?.points ?? 0,
    carCondition: car?.condition ?? 100,
    budgetImpact,
    damageNotes,
    devMessages,
  };
}
