import { describe, expect, it } from 'vitest';
import { setupOptionsById, qualifyingRunPlansById, raceStrategiesById, driverInstructionsById, pointsSystems } from '../data';
import { tracks1995 } from '../data/tracks/tracks1995';
import { drivers1995 } from '../data/drivers/drivers1995';
import { cars1995 } from '../data/cars/cars1995';
import { teams1995 } from '../data/teams/teams1995';
import { aiQualifyingDecision, aiRaceDecision } from '../game/ai';
import { simulateQualifying } from './qualifyingEngine';
import { autoSetupOptionsForTrack } from './autoSetup';
import { createLiveRace, type LiveRaceMeta } from './liveRaceEngine';
import { stepLiveSector } from './raceTickEngine';
import type { Entrant, QualifyingDecision, RaceContext, RaceDecision } from '../types/simTypes';

const TRACK = tracks1995[0];
const teamRaceOps: Record<string, number> = Object.fromEntries(teams1995.map((team) => [team.id, team.raceOperations]));

function buildContext(seed = 'segment-init|1995|r1'): RaceContext {
  const carByTeam = new Map(cars1995.map((car) => [car.teamId, car]));
  const entrants: Entrant[] = drivers1995.slice(0, 6).map((driver) => {
    const car = carByTeam.get(driver.teamId);
    if (!car) throw new Error(`no car for team ${driver.teamId}`);
    return { driver, car };
  });
  const setupOptions = { ...setupOptionsById, ...autoSetupOptionsForTrack(TRACK) };
  const qDecisions: Record<string, QualifyingDecision> = {};
  entrants.forEach((entrant) => { qDecisions[entrant.driver.id] = aiQualifyingDecision(entrant.driver.id, TRACK); });
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
  entrants.forEach((entrant) => { rDecisions[entrant.driver.id] = aiRaceDecision(entrant.driver.id, TRACK); });
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


function buildMeta(context: RaceContext): LiveRaceMeta {
  return {
    track: context.track,
    driverNames: Object.fromEntries(context.entrants.map((entrant) => [entrant.driver.id, entrant.driver.name])),
    teamNames: Object.fromEntries(context.entrants.map((entrant) => [entrant.driver.teamId, entrant.driver.teamId])),
    playerTeamId: context.entrants[0].driver.teamId,
    year: context.year,
    series: 'F1',
  };
}

describe('live race segment initialization', () => {
  it('initializes circuit metadata and authoritative car position state', () => {
    const context = buildContext();
    const state = createLiveRace(context, {
      raceId: 'race',
      playerTeamId: context.entrants[0].driver.teamId,
      totalLaps: 10,
      driverNames: Object.fromEntries(context.entrants.map((entrant) => [entrant.driver.id, entrant.driver.name])),
      teamReputation: Object.fromEntries(context.entrants.map((entrant) => [entrant.driver.teamId, 50])),
      teamRaceOps,
      year: context.year,
      series: 'F1',
    });

    expect(state.simVersion).toBe(2);
    expect(state.simulationClockSeconds).toBe(0);
    expect(state.circuit?.trackId).toBe(context.track.id);
    expect(state.circuit?.segments.length).toBeGreaterThan(0);
    expect(state.cars.every((car) => car.positionState?.completedLaps === 0)).toBe(true);
    expect(state.cars.every((car) => car.positionState?.normalizedLapProgress === 0)).toBe(true);
    expect(state.cars.every((car) => car.positionState?.authoritativeRaceTime === car.totalTime)).toBe(true);
  });

  it('advances authoritative position during a live sector tick', () => {
    const context = buildContext('segment-tick|1995|r1');
    const state = createLiveRace(context, {
      raceId: 'race',
      playerTeamId: context.entrants[0].driver.teamId,
      totalLaps: 10,
      driverNames: Object.fromEntries(context.entrants.map((entrant) => [entrant.driver.id, entrant.driver.name])),
      teamReputation: Object.fromEntries(context.entrants.map((entrant) => [entrant.driver.teamId, 50])),
      teamRaceOps,
      year: context.year,
      series: 'F1',
    });

    const stepped = stepLiveSector(state, buildMeta(context));
    const car = stepped.cars.find((candidate) => candidate.running)!;
    expect(stepped.sector).toBe(1);
    expect(car.positionState?.totalRaceDistanceMeters).toBeGreaterThan(0);
    expect(car.positionState?.normalizedLapProgress).toBeGreaterThan(0);
    expect(car.positionState?.completedLaps).toBe(0);
  });

});
