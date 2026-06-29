// Pure reducer wiring the simulation engines into state transitions.
// Keeping this outside React keeps the simulation testable and deterministic.

import { getTrackById } from '../data';
import { getPointsSystem } from '../data/pointsSystems/pointsSystems';
import { setupOptionsById } from '../data/setupOptions/setupOptions';
import { autoSetupOptionsForTrack } from '../sim/autoSetup';
import { qualifyingRunPlansById } from '../data/decisions/qualifyingRunPlans';
import { raceStrategiesById } from '../data/decisions/raceStrategies';
import { driverInstructionsById } from '../data/decisions/driverInstructions';
import { developmentProjectsById } from '../data/development/developmentProjects';
import { simulateQualifying } from '../sim/qualifyingEngine';
import { simulateRace } from '../sim/raceEngine';
import { buildConstructorStandings, buildDriverStandings } from '../sim/standingsEngine';
import { applyDevelopmentProgress } from '../sim/developmentEngine';
import { updateMorale } from '../sim/moraleEngine';
import { generateRaceNews } from '../sim/newsEngine';
import { aiQualifyingDecision, aiRaceDecision } from './ai';
import { carForTeam, currentRace, type GameState } from './careerState';
import { createNewGame, type NewGameOptions } from './initialCareer';
import type {
  DevelopmentProject,
  QualifyingResult,
} from '../types/gameTypes';
import type {
  Entrant,
  QualifyingDecision,
  RaceDecision,
  ScoreBreakdown,
} from '../types/simTypes';

export type GameAction =
  | { type: 'NEW_GAME'; options: NewGameOptions }
  | { type: 'LOAD_GAME'; state: GameState }
  | { type: 'RUN_QUALIFYING'; decisions: QualifyingDecision[] }
  | { type: 'RUN_RACE'; decisions: RaceDecision[] }
  | { type: 'START_DEVELOPMENT'; projectId: string }
  | { type: 'ADVANCE_RACE' };

function buildEntrants(state: GameState): Entrant[] {
  const entrants: Entrant[] = [];
  for (const driver of state.drivers) {
    const car = carForTeam(state, driver.teamId);
    if (car) entrants.push({ driver, car });
  }
  return entrants;
}

// Track the last debug breakdowns so the UI can show them (kept outside state
// to avoid bloating the save file).
export const lastBreakdowns: {
  qualifying: Record<string, ScoreBreakdown>;
  race: Record<string, ScoreBreakdown>;
} = { qualifying: {}, race: {} };

export function gameReducer(state: GameState | null, action: GameAction): GameState | null {
  switch (action.type) {
    case 'NEW_GAME':
      return createNewGame(action.options);

    case 'LOAD_GAME':
      return action.state;

    case 'RUN_QUALIFYING': {
      if (!state) return state;
      return runQualifying(state, action.decisions);
    }

    case 'RUN_RACE': {
      if (!state) return state;
      return runRace(state, action.decisions);
    }

    case 'START_DEVELOPMENT': {
      if (!state) return state;
      return startDevelopment(state, action.projectId);
    }

    case 'ADVANCE_RACE': {
      if (!state) return state;
      return state;
    }

    default:
      return state;
  }
}

function runQualifying(state: GameState, playerDecisions: QualifyingDecision[]): GameState {
  const race = currentRace(state);
  if (!race) return state;
  const track = getTrackById(race.trackId);
  if (!track) return state;

  const entrants = buildEntrants(state);
  const decisions: Record<string, QualifyingDecision> = {};
  const playerById = new Map(playerDecisions.map((d) => [d.driverId, d]));
  for (const e of entrants) {
    decisions[e.driver.id] =
      playerById.get(e.driver.id) ?? aiQualifyingDecision(e.driver.id, track);
  }

  const { results, breakdowns } = simulateQualifying({
    track,
    entrants,
    decisions,
    setupOptions: { ...setupOptionsById, ...autoSetupOptionsForTrack(track) },
    runPlans: qualifyingRunPlansById,
    seed: `${state.randomSeed}-r${race.round}`,
  });

  lastBreakdowns.qualifying = breakdowns;

  // Apply quali crash damage to car condition (carryover into the race).
  const cars = state.cars.map((c) => ({ ...c }));
  for (const r of results) {
    if (r.incident?.type === 'Crash') {
      const car = cars.find((c) => c.teamId === r.teamId);
      if (car) car.condition = Math.max(40, car.condition - 25);
    }
  }

  return {
    ...state,
    cars,
    qualifyingResults: { ...state.qualifyingResults, [race.id]: results },
  };
}

function runRace(state: GameState, playerDecisions: RaceDecision[]): GameState {
  const race = currentRace(state);
  if (!race) return state;
  const track = getTrackById(race.trackId);
  if (!track) return state;

  const qualifying = state.qualifyingResults[race.id];
  if (!qualifying) return state;

  const entrants = buildEntrants(state);
  const decisions: Record<string, RaceDecision> = {};
  const playerById = new Map(playerDecisions.map((d) => [d.driverId, d]));
  for (const e of entrants) {
    decisions[e.driver.id] = playerById.get(e.driver.id) ?? aiRaceDecision(e.driver.id, track);
  }

  const pointsSystem = getPointsSystem(state.pointsSystemId);

  const { results, events, breakdowns } = simulateRace({
    track,
    entrants,
    qualifyingResults: qualifying,
    decisions,
    setupOptions: { ...setupOptionsById, ...autoSetupOptionsForTrack(track) },
    strategies: raceStrategiesById,
    instructions: driverInstructionsById,
    pointsByPosition: pointsSystem.pointsByPosition,
    seed: `${state.randomSeed}-r${race.round}`,
  });

  lastBreakdowns.race = breakdowns;

  // Persist results and recompute standings.
  const completedRaceResults = { ...state.completedRaceResults, [race.id]: results };
  const allResults = Object.values(completedRaceResults);
  const driverStandings = buildDriverStandings(allResults);
  const constructorStandings = buildConstructorStandings(allResults);

  // Morale & confidence.
  const driverTeam: Record<string, string> = {};
  state.drivers.forEach((d) => (driverTeam[d.id] = d.teamId));
  const prevDriverConf: Record<string, number> = {};
  const prevDriverMorale: Record<string, number> = {};
  state.drivers.forEach((d) => {
    prevDriverConf[d.id] = d.confidence;
    prevDriverMorale[d.id] = d.morale;
  });
  const prevTeamMorale: Record<string, number> = {};
  state.teams.forEach((t) => (prevTeamMorale[t.id] = t.morale));

  const morale = updateMorale(
    qualifying,
    results,
    prevDriverConf,
    prevDriverMorale,
    prevTeamMorale,
    driverTeam,
  );

  const drivers = state.drivers.map((d) => ({
    ...d,
    confidence: morale.driverConfidence[d.id] ?? d.confidence,
    morale: morale.driverMorale[d.id] ?? d.morale,
  }));

  // Budget: prize money for points + repair costs for DNFs/crashes.
  const teams = state.teams.map((t) => ({ ...t, morale: morale.teamMorale[t.id] ?? t.morale }));
  let cars = state.cars.map((c) => ({ ...c }));
  for (const r of results) {
    const team = teams.find((t) => t.id === r.teamId);
    if (!team) continue;
    team.budget += r.points * 250_000; // prize money per point
    if (r.status === 'DNF' && r.incidents.some((i) => /crash|collision|spun/i.test(i))) {
      team.budget -= 500_000; // crash repair
    }
  }
  // Reset car condition for next round.
  cars = cars.map((c) => ({ ...c, condition: Math.min(100, c.condition + 20) }));

  // Development progress (player team only, for MVP).
  const playerCar = carForTeam(state, state.selectedTeamId);
  let activeDevelopmentProjects = state.activeDevelopmentProjects;
  let completedDevelopmentProjects = state.completedDevelopmentProjects;
  const devMessages: string[] = [];
  if (playerCar && activeDevelopmentProjects.length > 0) {
    const tick = applyDevelopmentProgress(
      activeDevelopmentProjects,
      playerCar,
      state.randomSeed,
      race.round,
    );
    activeDevelopmentProjects = tick.active;
    completedDevelopmentProjects = [...completedDevelopmentProjects, ...tick.completed];
    devMessages.push(...tick.messages);
    // Apply rating deltas to the player car.
    cars = cars.map((c) => {
      if (c.id !== playerCar.id) return c;
      const dl = { ...c.developmentLevel };
      for (const [k, v] of Object.entries(tick.carRatingDeltas)) {
        const key = k as keyof typeof dl;
        dl[key] = (dl[key] ?? 0) + (v ?? 0);
      }
      return { ...c, developmentLevel: dl };
    });
  }

  // News.
  const driverNames: Record<string, string> = {};
  state.drivers.forEach((d) => (driverNames[d.id] = d.name));
  const teamNames: Record<string, string> = {};
  state.teams.forEach((t) => (teamNames[t.id] = t.name));
  const news = generateRaceNews(
    race.round,
    race.gpName,
    qualifying,
    results,
    driverNames,
    teamNames,
    state.randomSeed,
  );
  for (const m of devMessages) {
    news.unshift({ id: `news-dev-${race.round}-${m.slice(0, 8)}`, round: race.round, headline: m, timestamp: new Date().toISOString() });
  }

  // Advance the calendar.
  const calendar = state.calendar.map((r) => (r.id === race.id ? { ...r, completed: true } : r));
  const nextIndex = state.currentRaceIndex + 1;
  const seasonComplete = nextIndex >= calendar.length;

  return {
    ...state,
    calendar,
    drivers,
    teams,
    cars,
    completedRaceResults,
    raceEvents: { ...state.raceEvents, [race.id]: events },
    driverStandings,
    constructorStandings,
    activeDevelopmentProjects,
    completedDevelopmentProjects,
    news: [...news, ...state.news].slice(0, 50),
    currentRaceIndex: seasonComplete ? state.currentRaceIndex : nextIndex,
    seasonComplete,
  };
}

function startDevelopment(state: GameState, projectId: string): GameState {
  const template = developmentProjectsById[projectId];
  if (!template) return state;
  const team = state.teams.find((t) => t.id === state.selectedTeamId);
  if (!team || team.budget < template.cost) return state;

  const instance: DevelopmentProject = {
    ...template,
    id: `${template.id}-${Date.now()}`,
    progressRaces: 0,
  };

  const teams = state.teams.map((t) =>
    t.id === team.id ? { ...t, budget: t.budget - template.cost } : t,
  );

  return {
    ...state,
    teams,
    activeDevelopmentProjects: [...state.activeDevelopmentProjects, instance],
  };
}

export type { QualifyingResult };
