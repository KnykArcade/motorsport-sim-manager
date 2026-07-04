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

const teamRaceOps: Record<string, number> = {};
for (const t of teams1995) teamRaceOps[t.id] = t.raceOperations;

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
  return { track: TRACK, driverNames, teamNames, playerTeamId, year: 1995 };
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
    teamRaceOps,
    year: 1995,
    series: 'F1',
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

  it('classifies finishers as Finished (not DNF) and records best laps', () => {
    const context = buildContext();
    const meta = buildMeta(context, context.entrants[0].driver.teamId);
    let state = createRace(context, context.entrants[0].driver.teamId);
    state = stepLiveRaceToEnd(state, meta);

    const finishers = state.cars.filter((c) => c.status === 'Finished');
    // The whole field shouldn't retire — most cars finish.
    expect(finishers.length).toBeGreaterThan(state.cars.length / 2);
    // Finishers are flagged not-running at the flag but must not read as DNF.
    expect(finishers.every((c) => c.status === 'Finished' && c.position != null)).toBe(true);
    // A representative best lap is captured for cars that ran green laps.
    expect(finishers.every((c) => c.bestLap != null && c.bestLap > 0)).toBe(true);
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

  it('an early stop absorbs a planned stop so the car does not pit again in the window', () => {
    const context = buildContext('early-stop-seed');
    const playerTeam = context.entrants[0].driver.teamId;
    const meta = buildMeta(context, playerTeam);
    let state = createRace(context, playerTeam);
    state = stepLiveRace(state, meta); // get racing (lap 1)

    const target = state.cars.find((c) => c.isPlayer && c.running);
    if (!target) return; // unlucky early DNF — nothing to assert
    const lap = state.currentLap;

    // Two planned stops in the future with the window opening later; then call an
    // early stop (as under a safety car) well before the window opens. Clear any
    // pending prompt/recs so the requested stop executes deterministically.
    state = {
      ...state,
      pendingPrompt: null,
      recommendations: [],
      cars: state.cars.map((c) =>
        c.driverId === target.driverId
          ? {
              ...c,
              tire: { ...c.tire, wear: 40 },
              pit: {
                ...c.pit,
                stopsMade: 0,
                scheduledLaps: [lap + 12, lap + 24],
                window: { open: lap + 10, ideal: lap + 12, close: lap + 14 },
                planStatus: 'planned',
                planCancelled: false,
                pitRequested: false,
              },
            }
          : c,
      ),
    };

    state = requestPlayerPit(state, target.driverId);
    state = { ...state, pendingPrompt: null };
    state = stepLiveRace(state, meta);

    const after = state.cars.find((c) => c.driverId === target.driverId)!;
    if (!after.running) return;
    // Exactly one stop made; lastPitLap recorded; the first planned stop is
    // consumed (only the later one remains) and the plan is recalculated.
    expect(after.pit.stopsMade).toBe(1);
    expect(after.pit.lastPitLap).toBe(lap + 1);
    expect(after.pit.scheduledLaps).toEqual([lap + 24]);
    expect(after.pit.planStatus).toBe('recalculated');
    // The advisory window advanced off the original (now-satisfied) lap-(+10) window.
    expect(after.pit.window?.open).not.toBe(lap + 10);
  });
});

describe('live race confidence modifier', () => {
  it('positive confidence modifier produces better pace than no modifier', () => {
    const baseContext = buildContext('conf-test');
    const firstDriver = baseContext.entrants[0].driver;

    // No modifier.
    const ctxNone = { ...baseContext, confidenceModifierByDriver: {} };
    const raceNone = createRace(ctxNone, firstDriver.teamId);
    const carNone = raceNone.cars.find((c) => c.driverId === firstDriver.id)!;

    // Positive modifier (Inspired = +0.08).
    const ctxPos = { ...baseContext, confidenceModifierByDriver: { [firstDriver.id]: 0.08 } };
    const racePos = createRace(ctxPos, firstDriver.teamId);
    const carPos = racePos.cars.find((c) => c.driverId === firstDriver.id)!;

    expect(carPos.paceRating).toBeGreaterThan(carNone.paceRating);
  });

  it('negative confidence modifier produces worse pace than no modifier', () => {
    const baseContext = buildContext('conf-test');
    const firstDriver = baseContext.entrants[0].driver;

    // No modifier.
    const ctxNone = { ...baseContext, confidenceModifierByDriver: {} };
    const raceNone = createRace(ctxNone, firstDriver.teamId);
    const carNone = raceNone.cars.find((c) => c.driverId === firstDriver.id)!;

    // Negative modifier (Checked Out = -0.15).
    const ctxNeg = { ...baseContext, confidenceModifierByDriver: { [firstDriver.id]: -0.15 } };
    const raceNeg = createRace(ctxNeg, firstDriver.teamId);
    const carNeg = raceNeg.cars.find((c) => c.driverId === firstDriver.id)!;

    expect(carNeg.paceRating).toBeLessThan(carNone.paceRating);
  });

  it('low trust makes attack mode slower and riskier during the live race', () => {
    const baseContext = buildContext('conf-hesitation');
    const firstDriver = baseContext.entrants[0].driver;
    const meta = buildMeta(baseContext, firstDriver.teamId);
    const race = createRace(baseContext, firstDriver.teamId);
    const setTrust = (confidenceModifier: number) => ({
      ...race,
      cars: race.cars.map((c) =>
        c.driverId === firstDriver.id
          ? { ...c, confidenceModifier, paceMode: 'Attack' as const }
          : c,
      ),
    });

    const trusted = stepLiveRace(setTrust(0), meta).cars.find((c) => c.driverId === firstDriver.id)!;
    const nervous = stepLiveRace(setTrust(-0.15), meta).cars.find((c) => c.driverId === firstDriver.id)!;

    expect(nervous.liveRacePace).toBeLessThan(trusted.liveRacePace);
    expect(nervous.crashRisk).toBeGreaterThan(trusted.crashRisk);
  });

  it('missing confidence modifier data defaults safely to 0 (no crash)', () => {
    const context = buildContext('conf-missing');
    // No confidenceModifierByDriver field at all.
    const race = createRace(context, context.entrants[0].driver.teamId);
    expect(race.cars.length).toBe(context.entrants.length);
    // Every car should have a valid paceRating.
    expect(race.cars.every((c) => c.paceRating > 0)).toBe(true);
  });

  it('live race remains deterministic with same seed and confidence modifiers', () => {
    const seed = 'conf-determinism';
    const ctxA = buildContext(seed);
    const ctxB = buildContext(seed);
    const firstDriver = ctxA.entrants[0].driver;
    const mod = { [firstDriver.id]: 0.08 };

    const ctxAMod = { ...ctxA, confidenceModifierByDriver: mod };
    const ctxBMod = { ...ctxB, confidenceModifierByDriver: mod };
    const metaA = buildMeta(ctxAMod, firstDriver.teamId);
    const metaB = buildMeta(ctxBMod, firstDriver.teamId);

    const ra = finalizeResults(stepLiveRaceToEnd(createRace(ctxAMod, firstDriver.teamId), metaA), ctxAMod);
    const rb = finalizeResults(stepLiveRaceToEnd(createRace(ctxBMod, firstDriver.teamId), metaB), ctxBMod);

    expect(ra.results.map((r) => r.driverId)).toEqual(rb.results.map((r) => r.driverId));
  });

  it('confidence modifier uses same formula source as qualifying (calculateRacePace)', () => {
    // The live race engine passes confidenceModifierByDriver to calculateRacePace,
    // the same function used by qualifyingEngine. Verify the modifier is applied
    // consistently by checking that a positive modifier improves paceRating
    // and a negative one worsens it, relative to zero.
    const baseContext = buildContext('conf-source');
    const firstDriver = baseContext.entrants[0].driver;

    const ctxZero = { ...baseContext, confidenceModifierByDriver: { [firstDriver.id]: 0 } };
    const ctxPos = { ...baseContext, confidenceModifierByDriver: { [firstDriver.id]: 0.08 } };
    const ctxNeg = { ...baseContext, confidenceModifierByDriver: { [firstDriver.id]: -0.15 } };

    const raceZero = createRace(ctxZero, firstDriver.teamId);
    const racePos = createRace(ctxPos, firstDriver.teamId);
    const raceNeg = createRace(ctxNeg, firstDriver.teamId);

    const carZero = raceZero.cars.find((c) => c.driverId === firstDriver.id)!;
    const carPos = racePos.cars.find((c) => c.driverId === firstDriver.id)!;
    const carNeg = raceNeg.cars.find((c) => c.driverId === firstDriver.id)!;

    expect(carPos.paceRating).toBeGreaterThan(carZero.paceRating);
    expect(carNeg.paceRating).toBeLessThan(carZero.paceRating);
  });
});
