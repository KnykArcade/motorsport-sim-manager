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
} from '../../data';
import { autoSetupOptionsForTrack } from '../autoSetup';
import { aiQualifyingDecision, aiRaceDecision } from '../../game/ai';
import { simulateQualifying } from '../qualifyingEngine';
import { simulateRace } from '../raceEngine';
import {
  createLiveRace,
  runLiveRaceToEnd,
  stepLiveRace,
  stepLiveRaceToEnd,
} from './raceLoop';
import type {
  Entrant,
  QualifyingDecision,
  RaceContext,
  RaceDecision,
} from '../../types/simTypes';

// Build a realistic 1995 race context from the seed data (mirrors gameReducer).
function buildContext(seed = 'test|1995|r1'): RaceContext {
  const track = tracks1995[0];
  const carByTeam = new Map(cars1995.map((c) => [c.teamId, c]));
  const entrants: Entrant[] = drivers1995.map((d) => {
    const car = carByTeam.get(d.teamId);
    if (!car) throw new Error(`no car for team ${d.teamId}`);
    return { driver: d, car };
  });

  const setupOptions = { ...setupOptionsById, ...autoSetupOptionsForTrack(track) };

  const qDecisions: Record<string, QualifyingDecision> = {};
  entrants.forEach((e) => (qDecisions[e.driver.id] = aiQualifyingDecision(e.driver.id, track)));
  const { results: qualifyingResults } = simulateQualifying({
    track,
    entrants,
    decisions: qDecisions,
    setupOptions,
    runPlans: qualifyingRunPlansById,
    seed,
  });

  const rDecisions: Record<string, RaceDecision> = {};
  entrants.forEach((e) => (rDecisions[e.driver.id] = aiRaceDecision(e.driver.id, track)));

  return {
    track,
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

describe('live race engine', () => {
  it('converges to exactly the instant simulateRace outcome for a fixed seed', () => {
    const ctx = buildContext();
    const instant = simulateRace(ctx);
    const live = runLiveRaceToEnd(ctx);

    expect(live.results).toEqual(instant.results);
    expect(live.events).toEqual(instant.events);
    expect(live.breakdowns).toEqual(instant.breakdowns);
  });

  it('steps from a lap-0 formation to a finished classification matching the result', () => {
    const ctx = buildContext();
    const instant = simulateRace(ctx);

    const start = createLiveRace(ctx);
    expect(start.phase).toBe('formation');
    expect(start.currentLap).toBe(0);
    expect(start.cars).toHaveLength(ctx.entrants.length);
    // Formation order is grid order.
    expect(start.cars.map((c) => c.position)).toEqual(start.cars.map((c) => c.grid));

    const finished = stepLiveRaceToEnd(start);
    expect(finished.phase).toBe('finished');
    expect(finished.currentLap).toBe(finished.totalLaps);

    const liveClassification = finished.cars.map((c) => ({
      position: c.position,
      driverId: c.driverId,
      status: c.status,
      lapsCompleted: c.lapsCompleted,
    }));
    const instantClassification = instant.results.map((r) => ({
      position: r.position,
      driverId: r.driverId,
      status: r.status,
      lapsCompleted: r.lapsCompleted,
    }));
    expect(liveClassification).toEqual(instantClassification);
  });

  it('holds invariants on every lap: constant field, leader at 0, gaps ordered', () => {
    const ctx = buildContext();
    let s = createLiveRace(ctx);
    const total = s.totalLaps;

    for (let lap = 1; lap <= total; lap++) {
      s = stepLiveRace(s);
      expect(s.currentLap).toBe(lap);
      expect(s.cars).toHaveLength(ctx.entrants.length);

      const running = s.cars.filter((c) => c.running);
      const leader = running.find((c) => c.position === 1);
      if (leader) expect(leader.gapToLeader).toBe(0);

      const byPos = running
        .slice()
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      for (let i = 1; i < byPos.length; i++) {
        expect(byPos[i].gapToLeader).toBeGreaterThanOrEqual(byPos[i - 1].gapToLeader);
      }

      // Retired cars are frozen at or before the current lap.
      s.cars
        .filter((c) => !c.running && c.status === 'DNF')
        .forEach((c) => expect(c.lapsCompleted).toBeLessThanOrEqual(lap));
    }
    expect(s.phase).toBe('finished');
  });

  it('retires a DNF car exactly on its retirement lap and keeps it out', () => {
    const ctx = buildContext();
    const instant = simulateRace(ctx);
    const dnf = instant.results.find((r) => r.status === 'DNF');
    expect(dnf, 'fixture seed should produce at least one DNF').toBeDefined();
    if (!dnf) return;

    const retLap = dnf.lapsCompleted;
    let s = createLiveRace(ctx);
    for (let i = 0; i < retLap - 1; i++) s = stepLiveRace(s);

    const before = s.cars.find((c) => c.driverId === dnf.driverId);
    expect(before?.running).toBe(true);

    s = stepLiveRace(s); // reach the retirement lap
    const after = s.cars.find((c) => c.driverId === dnf.driverId);
    expect(after?.running).toBe(false);
    expect(after?.status).toBe('DNF');
    expect(after?.position).toBeNull();
  });
});
