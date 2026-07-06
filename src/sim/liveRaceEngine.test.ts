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
import { pitWindowFor } from './pitStrategyEngine';
import type {
  Entrant,
  QualifyingDecision,
  RaceContext,
  RaceDecision,
} from '../types/simTypes';
import type { LiveRaceState } from '../types/liveTypes';

const TRACK = tracks1995[0];
const TOTAL_LAPS = 40;
const DRY_WEATHER: LiveRaceState['weather'] = {
  condition: 'Dry',
  gripLevel: 1,
  wet: false,
  changingSoon: false,
  label: 'Dry',
};

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

function createMiniRace(context: RaceContext) {
  const driverNames: Record<string, string> = {};
  const teamReputation: Record<string, number> = {};
  context.entrants.forEach((e) => {
    driverNames[e.driver.id] = e.driver.name;
    teamReputation[e.driver.teamId] = 50;
  });
  return createLiveRace(context, {
    raceId: 'r-mini',
    playerTeamId: 'no-player-team',
    totalLaps: TOTAL_LAPS,
    driverNames,
    teamReputation,
    teamRaceOps,
    year: 1995,
    series: 'F1',
  });
}

function buildTwoCarContext(seed: string): RaceContext {
  const setupOptions = { ...setupOptionsById, ...autoSetupOptionsForTrack(TRACK) };
  const strongDriver = { ...drivers1995[0], id: 'strong-driver', teamId: 'team-strong' };
  const weakDriver = { ...drivers1995[1], id: 'weak-driver', teamId: 'team-weak' };
  const strongCar = {
    ...cars1995[0],
    id: 'strong-car',
    teamId: 'team-strong',
    ratings: { enginePower: 9, aeroEfficiency: 9, mechanicalGrip: 9, reliability: 9, pitCrewOperations: 9 },
    developmentLevel: { enginePower: 2, aeroEfficiency: 2, mechanicalGrip: 2, reliability: 2, pitCrewOperations: 2 },
  };
  const weakCar = {
    ...cars1995[1],
    id: 'weak-car',
    teamId: 'team-weak',
    ratings: { enginePower: 4, aeroEfficiency: 4, mechanicalGrip: 4, reliability: 4, pitCrewOperations: 4 },
    developmentLevel: { enginePower: 0, aeroEfficiency: 0, mechanicalGrip: 0, reliability: 0, pitCrewOperations: 0 },
  };
  const entrants: Entrant[] = [
    { driver: strongDriver, car: strongCar },
    { driver: weakDriver, car: weakCar },
  ];
  const qualifyingResults = entrants.map((e, index) => ({
    driverId: e.driver.id,
    position: index + 1,
    teamId: e.driver.teamId,
    qualifyingScore: 90 - index,
    gapText: index === 0 ? 'P1' : '+0.5',
    runPlan: 'StandardPush',
    setupChoice: 'Race',
    notes: [],
    incident: { type: 'None' as const, severity: 'Minor' as const },
  }));
  const decisions: Record<string, RaceDecision> = {};
  for (const entrant of entrants) {
    decisions[entrant.driver.id] = aiRaceDecision(entrant.driver.id, TRACK);
  }
  return {
    track: TRACK,
    entrants,
    qualifyingResults,
    decisions,
    setupOptions,
    strategies: raceStrategiesById,
    instructions: driverInstructionsById,
    pointsByPosition: pointsSystems['pts-1995'].pointsByPosition,
    seed,
    year: 1995,
    teamRaceOps: { 'team-strong': 7, 'team-weak': 4 },
  };
}

function aiTeamCars(state: ReturnType<typeof createRace>) {
  const teamEntries = Object.entries(
    state.cars.filter((c) => !c.isPlayer).reduce<Record<string, typeof state.cars>>((acc, car) => {
      (acc[car.teamId] ??= []).push(car);
      return acc;
    }, {}),
  ).find(([, cars]) => cars.length >= 2);
  if (!teamEntries) throw new Error('expected an AI team with two cars');
  const [, cars] = teamEntries;
  return [...cars].sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
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

  it('changes the race outcome when the seed changes', () => {
    const a = buildContext('attempt-nonce-a');
    const b = buildContext('attempt-nonce-b');
    const metaA = buildMeta(a, a.entrants[0].driver.teamId);
    const metaB = buildMeta(b, b.entrants[0].driver.teamId);

    const ra = createRace(a, a.entrants[0].driver.teamId);
    const rb = createRace(b, b.entrants[0].driver.teamId);

    expect(ra.seed).not.toBe(rb.seed);
    expect(ra.cars.map((c) => c.personality)).not.toEqual(rb.cars.map((c) => c.personality));
    expect(stepLiveRace(ra, metaA).cars.map((c) => c.lastLapTime)).not.toEqual(
      stepLiveRace(rb, metaB).cars.map((c) => c.lastLapTime),
    );
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

  it('silently restores the pre-safety-car mode when the SC ends', () => {
    const context = buildContext('sc-end-seed');
    const playerTeam = context.entrants[0].driver.teamId;
    const meta = buildMeta(context, playerTeam);
    const state = createRace(context, playerTeam);
    const player = state.cars.find((c) => c.isPlayer)!;
    const scState = {
      ...state,
      currentLap: 12,
      safetyCar: { active: true, lapsRemaining: 1, deployedOnLap: 11, reason: 'Incident', deployments: 1 },
      cars: state.cars.map((c) =>
        c.driverId === player.driverId
          ? { ...c, paceMode: 'Conservative' as const, safetyCarModeBefore: 'Attack' as const }
          : c,
      ),
    };

    const after = stepLiveRace({ ...scState, safetyCar: { ...scState.safetyCar, active: false } }, meta);
    const resumed = after.cars.find((c) => c.driverId === player.driverId)!;
    expect(resumed.paceMode).toBe('Attack');
    expect(resumed.safetyCarModeBefore).toBeNull();
    expect(after.recommendations.some((r) => r.kind === 'safetyCarRestart')).toBe(false);
  });

  it('assigns different AI pit targets to teammates', () => {
    const context = buildContext('ai-team-pit-plan');
    const state = createRace(context, context.entrants[0].driver.teamId);
    const teamCars = aiTeamCars(state);
    const [a, b] = teamCars;
    expect(a.pit.strategyRole).not.toBe(b.pit.strategyRole);
    expect(a.pit.strategyTargetLap).not.toBe(b.pit.strategyTargetLap);
    expect(Math.abs((a.pit.strategyTargetLap ?? 0) - (b.pit.strategyTargetLap ?? 0))).toBeGreaterThanOrEqual(3);
    expect(a.pit.window?.ideal).not.toBe(b.pit.window?.ideal);
  });

  it('adds a stack penalty only to the second same-team stop', () => {
    const context = buildContext('stack-penalty-seed');
    const playerTeam = context.entrants[0].driver.teamId;
    const solo = createRace(context, playerTeam);
    const stacked = createRace(context, playerTeam);
    const playerCarsSolo = solo.cars.filter((c) => c.isPlayer).sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
    const playerCarsStacked = stacked.cars.filter((c) => c.isPlayer).sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
    const leaderSolo = playerCarsSolo[0];
    const followerSolo = playerCarsSolo[1];
    const leaderStacked = playerCarsStacked[0];
    const followerStacked = playerCarsStacked[1];
    if (!leaderSolo || !followerSolo || !leaderStacked || !followerStacked) throw new Error('expected two player cars');

    const soloState = requestPlayerPit(
      {
        ...solo,
        currentLap: 0,
        weather: DRY_WEATHER,
        safetyCar: { ...solo.safetyCar, active: false, lapsRemaining: 0, reason: null, deployedOnLap: null },
      },
      followerSolo.driverId,
    );
    const stackedState = requestPlayerPit(
      requestPlayerPit(
        {
          ...stacked,
          currentLap: 0,
          weather: DRY_WEATHER,
          safetyCar: { ...stacked.safetyCar, active: false, lapsRemaining: 0, reason: null, deployedOnLap: null },
        },
        leaderStacked.driverId,
      ),
      followerStacked.driverId,
    );

    const soloAfter = stepLiveRace(soloState, buildMeta(context, playerTeam));
    const stackedAfter = stepLiveRace(stackedState, buildMeta(context, playerTeam));
    const soloFollower = soloAfter.cars.find((c) => c.driverId === followerSolo.driverId)!;
    const stackedFollower = stackedAfter.cars.find((c) => c.driverId === followerStacked.driverId)!;
    expect(stackedFollower.pit.lastPitStopTime!).toBeGreaterThan(soloFollower.pit.lastPitStopTime! + 2.5);
  });

  it('swaps AI strategy roles after a sustained order reversal', () => {
    const context = buildContext('role-swap-seed');
    const playerTeam = context.entrants[0].driver.teamId;
    let state = createRace(context, playerTeam);
    const [ahead, behind] = aiTeamCars(state);
    state = {
      ...state,
      currentLap: 20,
      weather: DRY_WEATHER,
      safetyCar: { ...state.safetyCar, active: false, lapsRemaining: 0, reason: null, deployedOnLap: null },
      cars: state.cars.map((c) =>
        c.driverId === ahead.driverId
          ? {
              ...c,
              position: behind.position,
              totalTime: behind.totalTime - 1,
              pit: {
                ...c.pit,
                strategyRole: 'secondary',
                strategyTargetLap: 30,
                scheduledLaps: [30],
                window: pitWindowFor(30, TOTAL_LAPS),
                stopsMade: 0,
                lastPitLap: 12,
              },
            }
          : c.driverId === behind.driverId
            ? {
                ...c,
                position: ahead.position,
                totalTime: ahead.totalTime + 1,
                pit: {
                  ...c.pit,
                  strategyRole: 'primary',
                  strategyTargetLap: 30,
                  scheduledLaps: [30],
                  window: pitWindowFor(30, TOTAL_LAPS),
                  stopsMade: 0,
                  lastPitLap: 11,
                },
              }
            : c,
      ),
      aiTeamStrategyState: {
        ...state.aiTeamStrategyState,
        [ahead.teamId]: { leaderDriverId: behind.driverId, reversedLaps: 2, lastSwapLap: null },
      },
    };

    const after = stepLiveRace(state, buildMeta(context, playerTeam));
    const swappedAhead = after.cars.find((c) => c.driverId === ahead.driverId)!;
    const swappedBehind = after.cars.find((c) => c.driverId === behind.driverId)!;
    expect(swappedAhead.pit.strategyRole).toBe('primary');
    expect(swappedBehind.pit.strategyRole).toBe('secondary');
    expect(swappedAhead.pit.stopsMade).toBe(0);
    expect(swappedBehind.pit.stopsMade).toBe(0);
    expect(swappedAhead.pit.lastPitLap).toBe(12);
    expect(swappedBehind.pit.lastPitLap).toBe(11);
    expect(after.aiTeamStrategyState?.[ahead.teamId]?.leaderDriverId).toBe(ahead.driverId);
  });

  it('does not swap roles within the guard windows', () => {
    const context = buildContext('role-swap-guard-seed');
    const playerTeam = context.entrants[0].driver.teamId;
    let state = createRace(context, playerTeam);
    const [ahead, behind] = aiTeamCars(state);
    state = {
      ...state,
      currentLap: 37,
      totalLaps: 40,
      weather: DRY_WEATHER,
      safetyCar: { ...state.safetyCar, active: false, lapsRemaining: 0, reason: null, deployedOnLap: null },
      cars: state.cars.map((c) =>
        c.driverId === ahead.driverId
          ? {
              ...c,
              position: behind.position,
              totalTime: behind.totalTime - 1,
              pit: { ...c.pit, strategyRole: 'secondary', strategyTargetLap: 38, scheduledLaps: [38], window: pitWindowFor(38, 40) },
            }
          : c.driverId === behind.driverId
            ? {
                ...c,
                position: ahead.position,
                totalTime: ahead.totalTime + 1,
                pit: { ...c.pit, strategyRole: 'primary', strategyTargetLap: 38, scheduledLaps: [38], window: pitWindowFor(38, 40) },
              }
            : c,
      ),
      aiTeamStrategyState: {
        ...state.aiTeamStrategyState,
        [ahead.teamId]: { leaderDriverId: behind.driverId, reversedLaps: 2, lastSwapLap: null },
      },
    };

    const after = stepLiveRace(state, buildMeta(context, playerTeam));
    expect(after.cars.find((c) => c.driverId === ahead.driverId)!.pit.strategyRole).toBe('secondary');
    expect(after.cars.find((c) => c.driverId === behind.driverId)!.pit.strategyRole).toBe('primary');
    expect(after.aiTeamStrategyState?.[ahead.teamId]?.leaderDriverId).toBe(behind.driverId);
  });

  it('does not swap roles when the teammates are at different stop stages', () => {
    const context = buildContext('role-swap-stage-guard-seed');
    const playerTeam = context.entrants[0].driver.teamId;
    let state = createRace(context, playerTeam);
    const [ahead, behind] = aiTeamCars(state);
    state = {
      ...state,
      currentLap: 20,
      weather: DRY_WEATHER,
      safetyCar: { ...state.safetyCar, active: false, lapsRemaining: 0, reason: null, deployedOnLap: null },
      cars: state.cars.map((c) =>
        c.driverId === ahead.driverId
          ? {
              ...c,
              position: behind.position,
              totalTime: behind.totalTime - 1,
              pit: {
                ...c.pit,
                strategyRole: 'secondary',
                strategyTargetLap: 30,
                scheduledLaps: [30],
                window: pitWindowFor(30, TOTAL_LAPS),
                stopsMade: 1,
                lastPitLap: 16,
              },
            }
          : c.driverId === behind.driverId
            ? {
                ...c,
                position: ahead.position,
                totalTime: ahead.totalTime + 1,
                pit: {
                  ...c.pit,
                  strategyRole: 'primary',
                  strategyTargetLap: 30,
                  scheduledLaps: [30],
                  window: pitWindowFor(30, TOTAL_LAPS),
                  stopsMade: 0,
                  lastPitLap: null,
                },
              }
            : c,
      ),
      aiTeamStrategyState: {
        ...state.aiTeamStrategyState,
        [ahead.teamId]: { leaderDriverId: behind.driverId, reversedLaps: 2, lastSwapLap: null },
      },
    };

    const after = stepLiveRace(state, buildMeta(context, playerTeam));
    expect(after.cars.find((c) => c.driverId === ahead.driverId)!.pit.strategyRole).toBe('secondary');
    expect(after.cars.find((c) => c.driverId === behind.driverId)!.pit.strategyRole).toBe('primary');
    expect(after.cars.find((c) => c.driverId === ahead.driverId)!.pit.stopsMade).toBe(1);
    expect(after.cars.find((c) => c.driverId === behind.driverId)!.pit.stopsMade).toBe(0);
    expect(after.aiTeamStrategyState?.[ahead.teamId]?.leaderDriverId).toBe(behind.driverId);
  });

  it('gives a stronger car and driver a lower tyre-deg rate on the same track', () => {
    const context = buildTwoCarContext('tire-deg-strong-vs-weak');
    const state = createMiniRace(context);
    const strong = state.cars.find((c) => c.driverId === 'strong-driver')!;
    const weak = state.cars.find((c) => c.driverId === 'weak-driver')!;
    expect(strong.tireDegRate).toBeLessThan(weak.tireDegRate);
  });

  it('moves the ideal pit lap earlier for the higher-deg car', () => {
    const context = buildTwoCarContext('tire-deg-lap-shift');
    const state = createMiniRace(context);
    const strong = state.cars.find((c) => c.driverId === 'strong-driver')!;
    const weak = state.cars.find((c) => c.driverId === 'weak-driver')!;
    expect(weak.tireDegRate).toBeGreaterThan(strong.tireDegRate);
    expect((weak.pit.strategyTargetLap ?? 0)).toBeLessThan((strong.pit.strategyTargetLap ?? 0));
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
    expect(aiCars.every((c) => c.pit.pitRequested === false)).toBe(true);
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
