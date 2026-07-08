import {
  describe,
  it,
  expect } from 'vitest';

import {
  setupOptionsById,
  qualifyingRunPlansById,
  raceStrategiesById,
  driverInstructionsById,
  pointsSystems,
} from '../data';
import { tracks1995 } from '../data/tracks/tracks1995';
import { drivers1995 } from '../data/drivers/drivers1995';
import { cars1995 } from '../data/cars/cars1995';
import { teams1995 } from '../data/teams/teams1995';
import { autoSetupOptionsForTrack } from './autoSetup';
import { aiQualifyingDecision, aiRaceDecision } from '../game/ai';
import { simulateQualifying } from './qualifyingEngine';
import { createLiveRace, type LiveRaceMeta } from './liveRaceEngine';
import { stepLiveRace, setPlayerPaceMode } from './raceTickEngine';
import { initialStint, startStint, advanceStint, longStintNote } from './strategyStint';
import type {
  Entrant,
  QualifyingDecision,
  RaceContext,
  RaceDecision,
} from '../types/simTypes';
import type { LiveRaceState } from '../types/liveTypes';

// ---------------------------------------------------------------------------
// Pure helper behaviour
// ---------------------------------------------------------------------------

describe('strategy stint helpers', () => {
  it('starts a stint at 1 lap', () => {
    const s = initialStint('Conservative');
    expect(s.mode).toBe('Conservative');
    expect(s.consecutiveLaps).toBe(1);
    expect(s.previousMode).toBeNull();
  });

  it('increments once per completed lap in the same mode (not a race total)', () => {
    let s = initialStint('Conservative', 0);
    for (let lap = 1; lap <= 13; lap += 1) s = advanceStint(s, 'Conservative', lap);
    // Started at 1 on lap 0, then 13 same-mode advances => 14 consecutive laps.
    expect(s.consecutiveLaps).toBe(14);
    expect(s.mode).toBe('Conservative');
  });

  it('resets to 1 when the mode changes, remembering the previous mode', () => {
    let s = initialStint('Conservative', 0);
    s = advanceStint(s, 'Conservative', 1);
    s = advanceStint(s, 'Conservative', 2); // 3 laps of Conserve
    expect(s.consecutiveLaps).toBe(3);
    s = advanceStint(s, 'Attack', 3); // switched to Attack this lap
    expect(s.mode).toBe('Attack');
    expect(s.consecutiveLaps).toBe(1);
    expect(s.previousMode).toBe('Conservative');
  });

  it('does not carry historical laps when returning to a prior mode', () => {
    let s = initialStint('Conservative', 0); // Conserve x1
    s = advanceStint(s, 'Conservative', 1); // Conserve x2
    s = advanceStint(s, 'Attack', 2); // Attack x1
    s = advanceStint(s, 'Conservative', 3); // back to Conserve => x1, not x3
    expect(s.mode).toBe('Conservative');
    expect(s.consecutiveLaps).toBe(1);
  });

  it('startStint always begins at 1 regardless of source', () => {
    const s = startStint('Attack', 'Balanced', 20, 'manual');
    expect(s).toMatchObject({ mode: 'Attack', previousMode: 'Balanced', startedLap: 20, consecutiveLaps: 1, source: 'manual' });
  });

  it('emits a long-stint note only past the mode threshold', () => {
    expect(longStintNote('Attack', 4, 'Capelli')).toBeNull();
    expect(longStintNote('Attack', 5, 'Capelli')).toMatch(/attacking for 5 laps/);
    expect(longStintNote('Push', 6, 'Schumacher')).toMatch(/pushing for 6 laps/);
    expect(longStintNote('Balanced', 40, 'Capelli')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Engine integration
// ---------------------------------------------------------------------------

const TRACK = tracks1995[0];
const TOTAL_LAPS = 40;
const teamRaceOps: Record<string, number> = {};
for (const t of teams1995) teamRaceOps[t.id] = t.raceOperations;

function buildContext(seed = 'stint|1995|r1'): RaceContext {
  const carByTeam = new Map(cars1995.map((c) => [c.teamId, c]));
  const entrants: Entrant[] = drivers1995.map((d) => {
    const car = carByTeam.get(d.teamId);
    if (!car) throw new Error(`no car for team ${d.teamId}`);
    return { driver: d, car };
  });
  const setupOptions = { ...setupOptionsById, ...autoSetupOptionsForTrack(TRACK) };
  const qDecisions: Record<string, QualifyingDecision> = {};
  entrants.forEach((e) => (qDecisions[e.driver.id] = aiQualifyingDecision(e.driver.id, TRACK)));
  const { results: qualifyingResults } = simulateQualifying({
    track: TRACK,
    entrants,
    decisions: qDecisions,
    setupOptions,
    runPlans: qualifyingRunPlansById,
    seed,
    teamRaceOps,
  });
  const rDecisions: Record<string, RaceDecision> = {};
  entrants.forEach((e) => (rDecisions[e.driver.id] = aiRaceDecision(e.driver.id, TRACK)));
  return {
    track: TRACK,
    entrants,
    qualifyingResults,
    decisions: rDecisions,
    setupOptions,
    strategies: raceStrategiesById,
    instructions: driverInstructionsById,
    pointsByPosition: pointsSystems['pts-1995'].pointsByPosition,
    seed,
    year: 1995,
    teamRaceOps,
  };
}

function buildMeta(context: RaceContext, playerTeamId: string): LiveRaceMeta {
  const driverNames: Record<string, string> = {};
  const teamNames: Record<string, string> = {};
  context.entrants.forEach((e) => {
    driverNames[e.driver.id] = e.driver.name;
    teamNames[e.driver.teamId] = e.driver.teamId;
  });
  return { track: TRACK, driverNames, teamNames, playerTeamId, year: 1995, series: 'F1' };
}

function createRace(context: RaceContext, playerTeamId: string): LiveRaceState {
  const driverNames: Record<string, string> = {};
  const teamReputation: Record<string, number> = {};
  context.entrants.forEach((e) => {
    driverNames[e.driver.id] = e.driver.name;
    teamReputation[e.driver.teamId] = 50;
  });
  return createLiveRace(context, {
    raceId: 'r-stint',
    playerTeamId,
    totalLaps: TOTAL_LAPS,
    driverNames,
    teamReputation,
    teamRaceOps,
    year: 1995,
    series: 'F1',
  });
}

// A player driver that is still running after `laps` steps, or null.
function firstRunningPlayer(state: LiveRaceState) {
  return state.cars.find((c) => c.isPlayer && c.running) ?? null;
}

describe('strategy stint counter — live race', () => {
  const playerTeamId = teams1995[0].id;

  it('initialises every car with a valid stint at 1 lap', () => {
    const state = createRace(buildContext(), playerTeamId);
    expect(state.cars.length).toBeGreaterThan(0);
    for (const c of state.cars) {
      expect(c.strategyStint.consecutiveLaps).toBe(1);
      expect(c.strategyStint.mode).toBe(c.paceMode);
    }
  });

  it('increments the counter each lap a driver stays in the same mode', () => {
    const context = buildContext();
    const meta = buildMeta(context, playerTeamId);
    let state = createRace(context, playerTeamId);
    const id = firstRunningPlayer(state)!.driverId;
    // Pin the mode so the counter has a stable stint to grow.
    state = setPlayerPaceMode(state, id, 'Conservative');
    const before = state.cars.find((c) => c.driverId === id)!.strategyStint.consecutiveLaps;
    expect(before).toBe(1);
    state = stepLiveRace(state, meta);
    const car = state.cars.find((c) => c.driverId === id)!;
    if (car.running && car.paceMode === 'Conservative') {
      expect(car.strategyStint.consecutiveLaps).toBe(2);
    }
  });

  it('resets the counter to 1 on a manual mode change', () => {
    const context = buildContext();
    const meta = buildMeta(context, playerTeamId);
    let state = createRace(context, playerTeamId);
    const id = firstRunningPlayer(state)!.driverId;
    state = setPlayerPaceMode(state, id, 'Conservative');
    state = stepLiveRace(state, meta);
    state = stepLiveRace(state, meta);
    const grown = state.cars.find((c) => c.driverId === id)!;
    if (grown.running) {
      // Switch to a different mode: counter must snap back to 1 immediately.
      state = setPlayerPaceMode(state, id, 'Attack');
      const car = state.cars.find((c) => c.driverId === id)!;
      expect(car.paceMode).toBe('Attack');
      expect(car.strategyStint.consecutiveLaps).toBe(1);
      expect(car.strategyStint.previousMode).toBe('Conservative');
      expect(car.strategyStint.source).toBe('manual');
    }
  });

  it('does not advance the counter while a decision prompt is pending (paused)', () => {
    const context = buildContext();
    const meta = buildMeta(context, playerTeamId);
    let state = createRace(context, playerTeamId);
    const id = firstRunningPlayer(state)!.driverId;
    state = setPlayerPaceMode(state, id, 'Conservative');
    const lapsBefore = state.cars.find((c) => c.driverId === id)!.strategyStint.consecutiveLaps;
    // Force a paused state; stepLiveRace must be a no-op.
    const paused: LiveRaceState = {
      ...state,
      pendingPrompt: {
        id: 'p1',
        driverId: id,
        category: 'Pit',
        lap: state.currentLap,
        title: 'x',
        description: 'x',
        options: [],
      },
    };
    const after = stepLiveRace(paused, meta);
    expect(after.currentLap).toBe(paused.currentLap);
    expect(after.cars.find((c) => c.driverId === id)!.strategyStint.consecutiveLaps).toBe(lapsBefore);
  });

  it('does not spam the event log with per-lap counter updates', () => {
    const context = buildContext();
    const meta = buildMeta(context, playerTeamId);
    let state = createRace(context, playerTeamId);
    const id = firstRunningPlayer(state)!.driverId;
    const name = meta.driverNames[id];
    state = setPlayerPaceMode(state, id, 'Conservative');
    for (let i = 0; i < 20; i += 1) state = stepLiveRace(state, meta);
    // The only stint-driven log for a Conserve run is the single long-stint note.
    const conserveNotes = state.events.filter((e) => e.text.includes(`${name} has been conserving`));
    expect(conserveNotes.length).toBeLessThanOrEqual(1);
    // And there is never a plain "N laps" counter line spammed each lap.
    const counterSpam = state.events.filter((e) => /Conserve \d+ laps?\.?$/.test(e.text));
    expect(counterSpam.length).toBe(0);
  });
});
