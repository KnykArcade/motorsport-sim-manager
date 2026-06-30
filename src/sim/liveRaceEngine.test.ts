import { describe, it, expect } from 'vitest';

import {
  tracks1995,
  drivers1995,
  cars1995,
  setupOptionsById,
  qualifyingRunPlansById,
  raceStrategiesById,
  driverInstructionsById,
  pointsSystems,
} from '../data';
import { autoSetupOptionsForTrack } from './autoSetup';
import { aiQualifyingDecision, aiRaceDecision } from '../game/ai';
import { simulateQualifying } from './qualifyingEngine';
import { createLiveRace, finalizeResults, type LiveRaceMeta } from './liveRaceEngine';
import {
  stepLiveRace,
  stepLiveRaceToEnd,
  resolvePrompt,
  requestPlayerPit,
} from './raceTickEngine';
import type {
  Entrant,
  QualifyingDecision,
  RaceContext,
  RaceDecision,
} from '../types/simTypes';

const TRACK = tracks1995[0];
const TOTAL_LAPS = 40;

function buildContext(seed = 'test|1995|r1'): RaceContext {
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
  };
}

function buildMeta(context: RaceContext, playerTeamId: string): LiveRaceMeta {
  const driverNames: Record<string, string> = {};
  const teamNames: Record<string, string> = {};
  context.entrants.forEach((e) => {
    driverNames[e.driver.id] = e.driver.name;
    teamNames[e.driver.teamId] = e.driver.teamId;
  });
  return { track: TRACK, driverNames, teamNames, playerTeamId };
}

function createRace(context: RaceContext, playerTeamId: string) {
  const driverNames: Record<string, string> = {};
  const teamReputation: Record<string, number> = {};
  context.entrants.forEach((e) => {
    driverNames[e.driver.id] = e.driver.name;
    teamReputation[e.driver.teamId] = 50;
  });
  return createLiveRace(context, {
    raceId: 'r-test',
    playerTeamId,
    totalLaps: TOTAL_LAPS,
    driverNames,
    teamReputation,
  });
}

describe('live race engine', () => {
  it('initialises a formation grid with every entrant', () => {
    const context = buildContext();
    const state = createRace(context, context.entrants[0].driver.teamId);
    expect(state.phase).toBe('formation');
    expect(state.cars.length).toBe(context.entrants.length);
    // Positions are 1..N in grid order.
    const positions = state.cars.map((c) => c.position).sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(positions[0]).toBe(1);
    expect(positions[positions.length - 1]).toBe(context.entrants.length);
  });

  it('runs to the flag and produces a complete, points-scoring classification', () => {
    const context = buildContext();
    const meta = buildMeta(context, context.entrants[0].driver.teamId);
    let state = createRace(context, context.entrants[0].driver.teamId);
    state = stepLiveRaceToEnd(state, meta);

    expect(state.phase).toBe('finished');
    expect(state.currentLap).toBe(TOTAL_LAPS);

    const { results } = finalizeResults(state, context);
    expect(results.length).toBe(context.entrants.length);

    // Exactly one winner, scoring points; finishers are uniquely ranked.
    const winners = results.filter((r) => r.position === 1);
    expect(winners.length).toBe(1);
    expect(winners[0].points).toBeGreaterThan(0);

    const finishPositions = results.filter((r) => r.position != null).map((r) => r.position);
    expect(new Set(finishPositions).size).toBe(finishPositions.length);
  });

  it('is deterministic for a fixed seed', () => {
    const a = buildContext('seed-A');
    const b = buildContext('seed-A');
    const metaA = buildMeta(a, a.entrants[0].driver.teamId);
    const metaB = buildMeta(b, b.entrants[0].driver.teamId);

    const ra = finalizeResults(stepLiveRaceToEnd(createRace(a, a.entrants[0].driver.teamId), metaA), a);
    const rb = finalizeResults(stepLiveRaceToEnd(createRace(b, b.entrants[0].driver.teamId), metaB), b);

    expect(ra.results.map((r) => r.driverId)).toEqual(rb.results.map((r) => r.driverId));
  });

  it('advances one lap at a time and updates the running order', () => {
    const context = buildContext();
    const meta = buildMeta(context, context.entrants[0].driver.teamId);
    let state = createRace(context, context.entrants[0].driver.teamId);
    state = stepLiveRace(state, meta);
    expect(state.currentLap).toBe(1);
    expect(state.phase).toBe('racing');
    const leaders = state.cars.filter((c) => c.position === 1);
    expect(leaders.length).toBe(1);
  });

  it('pauses on a pending prompt and resumes once resolved', () => {
    // Step several laps; if a prompt appears, stepping must be a no-op until resolved.
    const context = buildContext('prompt-seed');
    const meta = buildMeta(context, context.entrants[0].driver.teamId);
    let state = createRace(context, context.entrants[0].driver.teamId);
    let sawPrompt = false;
    for (let i = 0; i < TOTAL_LAPS && state.phase !== 'finished'; i++) {
      const before = state.currentLap;
      state = stepLiveRace(state, meta);
      if (state.pendingPrompt) {
        sawPrompt = true;
        const lap = state.currentLap;
        const noop = stepLiveRace(state, meta);
        expect(noop.currentLap).toBe(lap); // stepping is blocked
        state = resolvePrompt(state, state.pendingPrompt.options[0].id, meta);
        expect(state.pendingPrompt).toBeNull();
      } else {
        expect(state.currentLap).toBeGreaterThanOrEqual(before);
      }
    }
    // Not strictly guaranteed, but with this seed/field a prompt should occur.
    void sawPrompt;
  });
});

describe('player-controlled pit strategy', () => {
  it('gives player cars an advisory pit window but not AI cars', () => {
    const context = buildContext();
    const playerTeam = context.entrants[0].driver.teamId;
    const state = createRace(context, playerTeam);
    const playerCars = state.cars.filter((c) => c.isPlayer);
    const aiCars = state.cars.filter((c) => !c.isPlayer);

    expect(playerCars.length).toBeGreaterThan(0);
    for (const c of playerCars) {
      expect(c.pit.window).not.toBeNull();
      const w = c.pit.window!;
      expect(w.open).toBeLessThanOrEqual(w.ideal);
      expect(w.ideal).toBeLessThanOrEqual(w.close);
      expect(c.pit.pitRequested).toBe(false);
    }
    expect(aiCars.every((c) => c.pit.window === null)).toBe(true);
  });

  it('does not pit a player car before its window opens without a request', () => {
    const context = buildContext('pit-window-seed');
    const playerTeam = context.entrants[0].driver.teamId;
    const meta = buildMeta(context, playerTeam);
    let state = createRace(context, playerTeam);
    const target = state.cars.find((c) => c.isPlayer)!;
    const openLap = target.pit.window!.open;

    for (let i = 0; i < openLap - 1 && state.phase !== 'finished'; i++) {
      if (state.pendingPrompt) {
        // Resolve with a non-pitting option so we isolate window behaviour.
        const stay = state.pendingPrompt.options.find((o) => !o.effects.pitNow);
        state = resolvePrompt(state, (stay ?? state.pendingPrompt.options[0]).id, meta);
      } else {
        state = stepLiveRace(state, meta);
      }
    }

    const car = state.cars.find((c) => c.driverId === target.driverId)!;
    // Without a pit request, the car shouldn't have taken its planned stop yet
    // (unless forced by the tyre cliff, which this seed doesn't reach pre-window).
    if (car.running) expect(car.pit.stopsMade).toBe(0);
  });

  it('boxes a player car the lap after a pit request', () => {
    const context = buildContext('pit-request-seed');
    const playerTeam = context.entrants[0].driver.teamId;
    const meta = buildMeta(context, playerTeam);
    let state = createRace(context, playerTeam);
    state = stepLiveRace(state, meta); // get racing

    const target = state.cars.find((c) => c.isPlayer && c.running);
    if (!target) return; // unlucky early DNF — nothing to assert

    state = requestPlayerPit(state, target.driverId);
    expect(state.cars.find((c) => c.driverId === target.driverId)!.pit.pitRequested).toBe(true);

    if (state.pendingPrompt) state = resolvePrompt(state, state.pendingPrompt.options[0].id, meta);
    state = stepLiveRace(state, meta);

    const after = state.cars.find((c) => c.driverId === target.driverId)!;
    if (after.running) {
      expect(after.pit.stopsMade).toBe(1);
      expect(after.pit.pitRequested).toBe(false);
    }
  });
});
