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
  PaddockEventOptionEffect,
  PreseasonApprovals,
  PreseasonChecklistItem,
} from '../types/careerPhaseTypes';
import type { RaceResult } from '../types/gameTypes';
import type { FinanceTransaction } from '../types/financeTypes';
import type { RacePrepFocusEffect } from '../types/simTypes';
import { createSeededRandom, deriveSeed } from '../sim/random';

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
    announcedCompletedProjectIds: [],
    racePrepFocusApplied: false,
    preseasonChecklist: defaultPreseasonChecklist(),
    preseasonApprovals: defaultPreseasonApprovals(),
  };
}

function defaultPreseasonApprovals(): PreseasonApprovals {
  return {
    teamOverview: false,
    budget: false,
    driverLineup: false,
    carDevelopment: false,
    sponsorsEngine: false,
    seasonObjectives: false,
    roundOnePreview: false,
  };
}

function defaultPreseasonChecklist() {
  return [
    { id: 'team_overview', label: 'Review team overview', completed: false },
    { id: 'budget', label: 'Review budget', completed: false },
    { id: 'driver_lineup', label: 'Review driver lineup', completed: false },
    { id: 'development_focus', label: 'Confirm development focus', completed: false },
    { id: 'season_objective', label: 'Confirm season objective', completed: false },
  ];
}

// Migrate old checklist to new tab-based approvals for backward compatibility.
function migratePreseasonChecklistToApprovals(
  checklist: PreseasonChecklistItem[],
): PreseasonApprovals {
  const approvals = defaultPreseasonApprovals();
  for (const item of checklist) {
    if (item.completed) {
      if (item.id === 'team_overview') approvals.teamOverview = true;
      if (item.id === 'budget') approvals.budget = true;
      if (item.id === 'driver_lineup') approvals.driverLineup = true;
      if (item.id === 'development_focus') approvals.carDevelopment = true;
      if (item.id === 'season_objective') approvals.seasonObjectives = true;
    }
  }
  return approvals;
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
      // Consume the race prep focus effect after the race is completed.
      racePrepFocusApplied: true,
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
      // Reset race prep focus for the new paddock week — a new focus will be
      // chosen from the paddock events and applied to the next race.
      racePrepFocusApplied: false,
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

// --- Preseason checklist -----------------------------------------------------

export function togglePreseasonChecklistItem(
  state: GameState,
  itemId: string,
): GameState {
  const phaseState = getOrCreatePhaseState(state);
  const checklist = (phaseState.preseasonChecklist ?? []).map((item) =>
    item.id === itemId ? { ...item, completed: !item.completed } : item,
  );
  return {
    ...state,
    careerPhase: { ...phaseState, preseasonChecklist: checklist },
  };
}

// Get normalized preseason approvals, migrating old checklist if needed.
export function getPreseasonApprovals(state: GameState): PreseasonApprovals {
  const phaseState = getOrCreatePhaseState(state);
  // If approvals exist, use them.
  if (phaseState.preseasonApprovals) {
    return phaseState.preseasonApprovals;
  }
  // Otherwise, migrate from old checklist for backward compatibility.
  const checklist = phaseState.preseasonChecklist ?? [];
  return migratePreseasonChecklistToApprovals(checklist);
}

// Approve a single preseason tab.
export function approvePreseasonTab(
  state: GameState,
  tabId: 'teamOverview' | 'budget' | 'driverLineup' | 'carDevelopment' | 'sponsorsEngine' | 'seasonObjectives' | 'roundOnePreview',
): GameState {
  const phaseState = getOrCreatePhaseState(state);
  const approvals = getPreseasonApprovals(state);
  return {
    ...state,
    careerPhase: {
      ...phaseState,
      preseasonApprovals: { ...approvals, [tabId]: true },
    },
  };
}

// Check if all required preseason tabs are approved.
export function isPreseasonChecklistComplete(state: GameState): boolean {
  const approvals = getPreseasonApprovals(state);
  return (
    approvals.teamOverview &&
    approvals.budget &&
    approvals.driverLineup &&
    approvals.carDevelopment &&
    approvals.sponsorsEngine &&
    approvals.seasonObjectives &&
    approvals.roundOnePreview
  );
}

// --- Race prep focus effect --------------------------------------------------

export function computeRacePrepFocusEffect(focus: string): RacePrepFocusEffect {
  switch (focus) {
    case 'qualifying':
      return { paceModifier: -0.1, reliabilityModifier: 0, qualifyingModifier: 0.3, mistakeRiskMultiplier: 1.0 };
    case 'race':
      return { paceModifier: 0.2, reliabilityModifier: 0.05, qualifyingModifier: -0.1, mistakeRiskMultiplier: 0.95 };
    case 'reliability':
      return { paceModifier: -0.15, reliabilityModifier: 0.15, qualifyingModifier: -0.05, mistakeRiskMultiplier: 0.9 };
    case 'power':
      return { paceModifier: 0.15, reliabilityModifier: -0.1, qualifyingModifier: 0.1, mistakeRiskMultiplier: 1.1 };
    case 'balanced':
    default:
      return { paceModifier: 0.05, reliabilityModifier: 0.02, qualifyingModifier: 0, mistakeRiskMultiplier: 0.98 };
  }
}

// --- AI team activity (real between-race processing) -------------------------

export function processAITeamActivity(state: GameState): GameState {
  const phaseState = getOrCreatePhaseState(state);
  if (phaseState.aiActionsProcessedForCurrentWeek) return state;

  const aiStates = state.aiTeamStates ?? {};
  const aiTeams = state.teams.filter((t) => t.id !== state.selectedTeamId);
  const aiNews: typeof state.news = [];
  let cars = [...state.cars];

  // Seeded RNG based on save seed, season year, round, and paddock week ID.
  // This makes AI activity deterministic for the same save/week — reproducible
  // and fair across sessions.
  const weekId = phaseState.paddockWeekId ?? `pw-${phaseState.currentRound}`;
  const rng = createSeededRandom(
    deriveSeed(state.randomSeed ?? 'ai', state.seasonYear, phaseState.currentRound, weekId),
  );

  // Select a rotating subset of AI teams each paddock week.
  // Use the round number as a rotation offset so different teams are processed
  // each week. Select 2-4 teams.
  const numToProcess = rng.int(2, Math.min(4, aiTeams.length));
  const startIndex = phaseState.currentRound % aiTeams.length;
  const teamsToProcess: typeof aiTeams = [];
  for (let i = 0; i < numToProcess; i++) {
    const idx = (startIndex + i) % aiTeams.length;
    teamsToProcess.push(aiTeams[idx]);
  }

  for (const aiTeam of teamsToProcess) {
    const aiState = aiStates[aiTeam.id];
    const aiCar = cars.find((c) => c.teamId === aiTeam.id);
    if (!aiCar) continue;

    const ratings = effectiveCarRatings(aiCar);
    const archetype = aiState?.archetype ?? 'Balanced';

    // Determine action based on archetype and current state.
    let newsHeadline = '';
    let newsBody = '';
    let isRealChange = false;

    if (archetype === 'AggressiveSpender' || archetype === 'DevelopmentFocused') {
      // Aggressive teams push development: small car stat improvement.
      const improvement = rng.range(0.1, 0.4);
      const stat = rng.chance(0.5) ? 'enginePower' : 'aeroEfficiency';
      cars = cars.map((c) =>
        c.teamId === aiTeam.id
          ? {
              ...c,
              developmentLevel: {
                ...c.developmentLevel,
                [stat]: clamp10((c.developmentLevel as Record<string, number>)[stat] + improvement),
              },
            }
          : c,
      );
      isRealChange = true;
      newsHeadline = `${aiTeam.name} brings upgrade to next race`;
      newsBody = `${aiTeam.name} has completed a development push. ${stat === 'enginePower' ? 'Engine power' : 'Aero efficiency'} improved by ${improvement.toFixed(2)}.`;
    } else if (ratings.reliability < 5 && rng.chance(0.4)) {
      // Struggling teams fix reliability: small reliability improvement.
      const improvement = rng.range(0.1, 0.4);
      cars = cars.map((c) =>
        c.teamId === aiTeam.id
          ? {
              ...c,
              developmentLevel: {
                ...c.developmentLevel,
                reliability: clamp10(c.developmentLevel.reliability + improvement),
              },
            }
          : c,
      );
      isRealChange = true;
      newsHeadline = `${aiTeam.name} addresses reliability concerns`;
      newsBody = `${aiTeam.name} has worked on reliability. Rating improved by ${improvement.toFixed(2)} to ${(ratings.reliability + improvement).toFixed(1)}.`;
    } else if (rng.chance(0.15)) {
      // Rare reliability setback.
      const setback = rng.range(0.1, 0.3);
      cars = cars.map((c) =>
        c.teamId === aiTeam.id
          ? {
              ...c,
              developmentLevel: {
                ...c.developmentLevel,
                reliability: clamp10(c.developmentLevel.reliability - setback),
              },
            }
          : c,
      );
      isRealChange = true;
      newsHeadline = `${aiTeam.name} suffers setback in testing`;
      newsBody = `${aiTeam.name} encountered reliability issues. Rating dropped by ${setback.toFixed(2)} to ${(ratings.reliability - setback).toFixed(1)}.`;
    } else if (rng.chance(0.2)) {
      // Minor form observation — no state change, just flavor news.
      const performance = (ratings.enginePower + ratings.aeroEfficiency + ratings.mechanicalGrip) / 3;
      if (performance > 7) {
        newsHeadline = `${aiTeam.name} looking competitive`;
        newsBody = `${aiTeam.name}'s car is performing well with an average rating of ${performance.toFixed(1)}/10.`;
      } else if (performance < 4.5) {
        newsHeadline = `${aiTeam.name} off the pace`;
        newsBody = `${aiTeam.name}'s car is struggling with an average rating of ${performance.toFixed(1)}/10.`;
      } else {
        newsHeadline = `${aiTeam.name} steady in testing`;
        newsBody = `${aiTeam.name} completed a productive test session. Average rating: ${performance.toFixed(1)}/10.`;
      }
    } else if (aiState && (aiState.financialHealth === 'Critical' || aiState.financialHealth === 'AtRisk') && rng.chance(0.3)) {
      // Financial trouble — no car change, but news.
      newsHeadline = `${aiTeam.name} facing financial difficulties`;
      newsBody = `${aiTeam.name} is in ${aiState.financialHealth} financial health. Budget cuts may affect their development program.`;
    }

    if (newsHeadline) {
      aiNews.push({
        id: `news-ai-${weekId}-${aiTeam.id}`,
        headline: newsHeadline,
        body: isRealChange ? `[Confirmed] ${newsBody}` : newsBody,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return {
    ...state,
    cars,
    news: [...aiNews, ...state.news].slice(0, 50),
    careerPhase: {
      ...phaseState,
      aiActionsProcessedForCurrentWeek: true,
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

  // Guard: if effects already applied, just update the resolved option (no re-apply).
  const alreadyApplied = event.effectsApplied;

  const option = event.options?.find((o) => o.id === optionId);
  if (!option && event.options && event.options.length > 0) return state;

  // Mark event as resolved and effects applied.
  const updatedEvents = phaseState.paddockEvents.map((e) =>
    e.id === eventId
      ? { ...e, resolvedOptionId: optionId, effectsApplied: true }
      : e,
  );

  const allResolved = !updatedEvents.some(
    (e) => e.isRequiredDecision && !e.resolvedOptionId,
  );

  let updatedState: GameState = {
    ...state,
    careerPhase: {
      ...phaseState,
      paddockEvents: updatedEvents,
      requiredDecisionsComplete: allResolved,
    },
  };

  // Apply effects only once.
  if (alreadyApplied || !option) return updatedState;

  // --- Apply budgetChange ---
  if (option.budgetChange) {
    const teams = updatedState.teams.map((t) =>
      t.id === updatedState.selectedTeamId
        ? { ...t, budget: t.budget + option.budgetChange! }
        : t,
    );
    const txn: FinanceTransaction = {
      id: `fin-paddock-${eventId}-${optionId}`,
      season: state.seasonYear,
      round: phaseState.currentRound,
      category: 'Operations',
      label: `${event.title}: ${option.label}`,
      amount: option.budgetChange,
    };
    updatedState = {
      ...updatedState,
      teams,
      finance: [...(updatedState.finance ?? []), txn],
    };
  }

  // --- Apply moraleChange to all active drivers and team ---
  // Skip permanent effects for race prep focus events — those are temporary only.
  const isRacePrepFocusEvent =
    event.category === 'general_team' && event.title.startsWith('Select race preparation focus');
  if (option.moraleChange && !isRacePrepFocusEvent) {
    const activeDriverIds = new Set(
      activeDriversForTeam(state, state.selectedTeamId).map((d) => d.id),
    );
    const drivers = updatedState.drivers.map((d) =>
      activeDriverIds.has(d.id)
        ? { ...d, morale: Math.max(0, Math.min(100, d.morale + option.moraleChange!)) }
        : d,
    );
    const teams = updatedState.teams.map((t) =>
      t.id === updatedState.selectedTeamId
        ? { ...t, morale: Math.max(0, Math.min(100, t.morale + option.moraleChange!)) }
        : t,
    );
    updatedState = { ...updatedState, drivers, teams };
  }

  // --- Apply reliabilityChange to player car ---
  if (option.reliabilityChange && !isRacePrepFocusEvent) {
    const cars = updatedState.cars.map((c) =>
      c.teamId === updatedState.selectedTeamId
        ? {
            ...c,
            developmentLevel: {
              ...c.developmentLevel,
              reliability: Math.max(1, Math.min(10, c.developmentLevel.reliability + option.reliabilityChange!)),
            },
          }
        : c,
    );
    updatedState = { ...updatedState, cars };
  }

  // --- Apply carStatChange to player car ---
  if (option.carStatChange && !isRacePrepFocusEvent) {
    const cars = updatedState.cars.map((c) =>
      c.teamId === updatedState.selectedTeamId
        ? {
            ...c,
            developmentLevel: {
              enginePower: clamp10(c.developmentLevel.enginePower + (option.carStatChange!.enginePower ?? 0)),
              aeroEfficiency: clamp10(c.developmentLevel.aeroEfficiency + (option.carStatChange!.aeroEfficiency ?? 0)),
              mechanicalGrip: clamp10(c.developmentLevel.mechanicalGrip + (option.carStatChange!.mechanicalGrip ?? 0)),
              reliability: clamp10(c.developmentLevel.reliability + (option.carStatChange!.reliability ?? 0)),
              pitCrewOperations: clamp10(c.developmentLevel.pitCrewOperations + (option.carStatChange!.pitCrewOperations ?? 0)),
            },
          }
        : c,
    );
    updatedState = { ...updatedState, cars };
  }

  // --- Apply structured effects ---
  if (option.effects) {
    for (const eff of option.effects) {
      updatedState = applyStructuredEffect(updatedState, eff, eventId);
    }
  }

  // --- Store race prep focus if this was the race prep decision ---
  if (event.category === 'general_team' && event.title.startsWith('Select race preparation focus')) {
    updatedState = {
      ...updatedState,
      careerPhase: {
        ...updatedState.careerPhase!,
        racePrepFocus: optionId,
      },
    };
  }

  return updatedState;
}

function clamp10(n: number): number {
  return Math.max(1, Math.min(10, n));
}

function applyStructuredEffect(
  state: GameState,
  eff: PaddockEventOptionEffect,
  eventId: string,
): GameState {
  switch (eff.type) {
    case 'budget': {
      const teams = state.teams.map((t) =>
        t.id === state.selectedTeamId ? { ...t, budget: t.budget + eff.value } : t,
      );
      const txn: FinanceTransaction = {
        id: `fin-paddock-${eventId}-eff-${eff.type}`,
        season: state.seasonYear,
        category: 'Operations',
        label: eff.label ?? 'Paddock event',
        amount: eff.value,
      };
      return { ...state, teams, finance: [...(state.finance ?? []), txn] };
    }
    case 'morale': {
      const teams = state.teams.map((t) =>
        t.id === state.selectedTeamId
          ? { ...t, morale: Math.max(0, Math.min(100, t.morale + eff.value)) }
          : t,
      );
      return { ...state, teams };
    }
    case 'reliability': {
      const cars = state.cars.map((c) =>
        c.teamId === state.selectedTeamId
          ? {
              ...c,
              developmentLevel: {
                ...c.developmentLevel,
                reliability: clamp10(c.developmentLevel.reliability + eff.value),
              },
            }
          : c,
      );
      return { ...state, cars };
    }
    case 'carStat': {
      if (!eff.target) return state;
      const cars = state.cars.map((c) =>
        c.teamId === state.selectedTeamId
          ? {
              ...c,
              developmentLevel: {
                ...c.developmentLevel,
                [eff.target!]: clamp10((c.developmentLevel as Record<string, number>)[eff.target!] + eff.value),
              },
            }
          : c,
      );
      return { ...state, cars };
    }
    case 'sponsorConfidence': {
      if (!state.commercial) return state;
      const sponsors = state.commercial.sponsors.map((s) =>
        eff.target && s.id === eff.target
          ? { ...s, confidence: Math.max(0, Math.min(100, s.confidence + eff.value)) }
          : !eff.target
            ? { ...s, confidence: Math.max(0, Math.min(100, s.confidence + eff.value)) }
            : s,
      );
      return { ...state, commercial: { ...state.commercial, sponsors } };
    }
    case 'news': {
      const newsItem = {
        id: `news-paddock-${eventId}-${eff.type}`,
        headline: eff.label ?? 'Paddock event',
        body: eff.label ?? 'Paddock event resolved.',
        timestamp: new Date().toISOString(),
      };
      return { ...state, news: [newsItem, ...state.news].slice(0, 50) };
    }
    default:
      return state;
  }
}

// --- Paddock week event generation -------------------------------------------

function makeEventId(weekId: string, category: string, idx: number): string {
  return `pe-${weekId}-${category}-${idx}`;
}

// Builder that tracks per-category indices to guarantee unique IDs.
class EventBuilder {
  private counters: Record<string, number> = {};

  make(
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
    const idx = this.counters[category] ?? 0;
    this.counters[category] = idx + 1;
    return {
      id: makeEventId(weekId, category, idx),
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
  const builder = new EventBuilder();

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
      builder.make(
        weekId, season, series, round,
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
      builder.make(
        weekId, season, series, round,
        'development',
        `${activeProjects.length}/${slots} development slots in use`,
        `Active projects: ${projectNames}. ${activeProjects.length < slots ? `${slots - activeProjects.length} slot(s) available.` : 'All slots occupied.'}`,
        'info',
      ),
    );
  } else if (slots > 0) {
    events.push(
      builder.make(
        weekId, season, series, round,
        'development',
        'Factory available',
        `No active development projects. ${slots} slot(s) available for new upgrades.`,
        'info',
      ),
    );
  }

  // Completed projects — only announce those not yet announced.
  const announced = new Set(phaseState.announcedCompletedProjectIds);
  const recentCompleted = state.completedDevelopmentProjects.filter(
    (p) => !announced.has(p.id),
  );
  for (const proj of recentCompleted.slice(-2)) {
    events.push(
      builder.make(
        weekId, season, series, round,
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
        builder.make(
          weekId, season, series, round,
          'driver_morale',
          `${driver.name} is frustrated`,
          `Morale is at ${Math.round(driver.morale)}%. The driver is unhappy with recent results or team dynamics.`,
          'minor',
        ),
      );
    } else if (driver.morale > 80) {
      events.push(
        builder.make(
          weekId, season, series, round,
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
          builder.make(
            weekId, season, series, round,
            'driver_morale',
            `${driver.name} disappointed after DNF`,
            `Retirement in the last race has affected ${driver.name}'s confidence.`,
            'minor',
          ),
        );
      } else if (r.position !== null && r.position <= 3) {
        events.push(
          builder.make(
            weekId, season, series, round,
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
      builder.make(
        weekId, season, series, round,
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
          builder.make(
            weekId, season, series, round,
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
        builder.make(
          weekId, season, series, round,
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
        builder.make(
          weekId, season, series, round,
          'facility',
          'Facility limitations',
          `Average facility level is ${avgLevel.toFixed(1)}. Development capacity is restricted.`,
          'info',
        ),
      );
    }
  }

  // --- AI Team News (real activity) ---
  const aiNews = generateAITeamActivity(state, weekId, season, series, round, builder);
  events.push(...aiNews);

  // --- Regulation ---
  if (round === 0 && state.regulationProposals && state.regulationProposals.length > 0) {
    events.push(
      builder.make(
        weekId, season, series, round,
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
      builder.make(
        weekId, season, series, round,
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
        label: 'Balanced Preparation',
        description: 'A balanced approach with slight consistency and mistake-reduction bonus.',
      },
      {
        id: 'qualifying',
        label: 'Qualifying Focus',
        description: 'Prioritize one-lap pace. May sacrifice race pace slightly.',
      },
      {
        id: 'race',
        label: 'Race Pace Focus',
        description: 'Prioritize long-run pace and tire management.',
      },
      {
        id: 'reliability',
        label: 'Reliability Focus',
        description: 'Focus on mechanical reliability. Lower DNF risk with a small pace tradeoff.',
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
      builder.make(
        weekId, season, series, round,
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

  // Track newly announced completed projects.
  const announced = new Set(phaseState.announcedCompletedProjectIds);
  for (const e of events) {
    if (e.category === 'development' && e.title.startsWith('Upgrade completed: ')) {
      const projName = e.title.replace('Upgrade completed: ', '');
      const proj = state.completedDevelopmentProjects.find((p) => p.name === projName);
      if (proj) announced.add(proj.id);
    }
  }

  return {
    ...state,
    careerPhase: {
      ...phaseState,
      paddockEvents: events,
      generatedEventsForCurrentWeek: true,
      requiredDecisionsComplete: !events.some((e) => e.isRequiredDecision),
      announcedCompletedProjectIds: [...announced],
    },
  };
}

// --- AI team activity (real between-race processing) ------------------------

// Generate AI team news based on actual car/team state. This reads real data
// (car ratings, AI archetypes, development state) and produces news items that
// reflect actual conditions rather than fabricated stories.
function generateAITeamActivity(
  state: GameState,
  weekId: string,
  season: number,
  series: string,
  round: number,
  builder: EventBuilder,
): PaddockEvent[] {
  const events: PaddockEvent[] = [];
  const aiStates = state.aiTeamStates ?? {};
  const aiTeams = state.teams.filter((t) => t.id !== state.selectedTeamId);

  // Pick 2-3 AI teams to generate news for, prioritizing those with notable state.
  const newsTeams = aiTeams.slice(0, Math.min(3, aiTeams.length));

  for (const aiTeam of newsTeams) {
    const aiState = aiStates[aiTeam.id];
    const aiCar = carForTeam(state, aiTeam.id);
    const aiRatings = aiCar ? effectiveCarRatings(aiCar) : null;
    if (!aiRatings) continue;

    // Real reliability issue — only report if reliability is actually low.
    if (aiRatings.reliability < 4) {
      events.push(
        builder.make(
          weekId, season, series, round,
          'ai_team',
          `${aiTeam.name} struggling with reliability`,
          `${aiTeam.name}'s car reliability is rated ${aiRatings.reliability.toFixed(1)}/10. The team is dealing with recurring issues.`,
          'minor',
        ),
      );
    }

    // Real development push — only for aggressive archetypes with budget.
    if (
      aiState &&
      (aiState.archetype === 'AggressiveSpender' || aiState.archetype === 'DevelopmentFocused') &&
      aiTeam.budget > 10_000_000
    ) {
      events.push(
        builder.make(
          weekId, season, series, round,
          'ai_team',
          `${aiTeam.name} pushing development hard`,
          `${aiTeam.name} is investing heavily in development. Budget: ${formatBudget(aiTeam.budget)}. An upgrade may arrive soon.`,
          'info',
        ),
      );
    }

    // Real form change — compare car performance to average.
    const aiPerformance = (aiRatings.enginePower + aiRatings.aeroEfficiency + aiRatings.mechanicalGrip) / 3;
    if (aiPerformance > 7.5) {
      events.push(
        builder.make(
          weekId, season, series, round,
          'ai_team',
          `${aiTeam.name} looking strong`,
          `${aiTeam.name}'s car is performing well with an average rating of ${aiPerformance.toFixed(1)}/10 across power, aero, and grip.`,
          'info',
        ),
      );
    } else if (aiPerformance < 4.5) {
      events.push(
        builder.make(
          weekId, season, series, round,
          'ai_team',
          `${aiTeam.name} off the pace`,
          `${aiTeam.name}'s car is struggling with an average rating of ${aiPerformance.toFixed(1)}/10. The team needs to find performance.`,
          'minor',
        ),
      );
    }

    // Financial trouble — only if AI state indicates it.
    if (aiState && (aiState.financialHealth === 'Critical' || aiState.financialHealth === 'AtRisk')) {
      events.push(
        builder.make(
          weekId, season, series, round,
          'ai_team',
          `${aiTeam.name} facing financial difficulties`,
          `${aiTeam.name} is in ${aiState.financialHealth} financial health. Budget cuts may affect their development program.`,
          'major',
        ),
      );
    }
  }

  return events;
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
