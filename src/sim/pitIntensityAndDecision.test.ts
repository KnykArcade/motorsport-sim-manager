import { describe, expect, it } from 'vitest';
import { setupOptionsById, qualifyingRunPlansById, raceStrategiesById, driverInstructionsById, pointsSystems } from '../data';
import { tracks1995 } from '../data/tracks/tracks1995';
import { drivers1995 } from '../data/drivers/drivers1995';
import { cars1995 } from '../data/cars/cars1995';
import { teams1995 } from '../data/teams/teams1995';
import { autoSetupOptionsForTrack } from './autoSetup';
import { aiQualifyingDecision, aiRaceDecision } from '../game/ai';
import { simulateQualifying } from './qualifyingEngine';
import { createLiveRace, type LiveRaceMeta } from './liveRaceEngine';
import { acceptRecommendation } from './raceTickEngine';
import { aiLapDecision } from './aiStrategyEngine';
import {
  PIT_INTENSITY_ORDER,
  pitIntensityBaseRisk,
  pitIntensityBotchRisk,
  pitIntensityPenaltySeconds,
  pitIntensitySpec,
} from './pitIntensityData';
import type { AnalyticsRecommendation, LiveRaceState, PitIntensity, PaceMode } from '../types/liveTypes';
import type { Entrant, QualifyingDecision, RaceContext, RaceDecision } from '../types/simTypes';
import type { Track } from '../types/gameTypes';
import { SELECTABLE_MODES } from './liveRacePace';

const TRACK = tracks1995[0];
const TOTAL_LAPS = 40;

const teamRaceOps: Record<string, number> = {};
for (const t of teams1995) teamRaceOps[t.id] = t.raceOperations;

function buildContext(seed = 'pit-intensity-test'): RaceContext {
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

function playerCar(state: LiveRaceState) {
  const car = state.cars.find((c) => c.isPlayer);
  if (!car) throw new Error('player car missing');
  return car;
}

function acceptPitDecision({
  seed,
  intensity,
  exitMode,
}: {
  seed: string;
  intensity: PitIntensity;
  exitMode: PaceMode;
}): LiveRaceState {
  const context = buildContext(seed);
  const playerTeamId = context.entrants[0].driver.teamId;
  let state = createRace(context, playerTeamId);
  const meta = buildMeta(context, playerTeamId);
  const car = playerCar(state);
  const rec: AnalyticsRecommendation = {
    id: `${car.driverId}:pit`,
    driverId: car.driverId,
    kind: 'pitWindow',
    priority: 'high',
    issue: 'Pit window open',
    recommendedAction: 'Pit now',
    expectedImpact: 'Pit stop required',
    confidence: 95,
    createdLap: 17,
    expiresLap: 21,
    action: { type: 'PitNow', label: 'Pit Now', pitNow: true },
    alternatives: [{ type: 'StayOut', label: 'Stay Out' }],
    status: 'pending',
  };
  state = {
    ...state,
    seed,
    phase: 'racing',
    currentLap: 17,
    recommendations: [rec],
  };
  state = acceptRecommendation(state, rec.id, meta, {
    type: 'PitNow',
    label: 'Pit Now',
    pitNow: true,
    pitIntensity: intensity,
    pitExitMode: exitMode,
  });
  return state;
}

describe('pit intensity and combined pit decision', () => {
  it('higher intensity lowers stationary loss but raises botch risk', () => {
    expect(pitIntensitySpec('AllOut').stationaryDelta).toBeLessThan(pitIntensitySpec('Standard').stationaryDelta);
    expect(pitIntensityBaseRisk('AllOut')).toBeGreaterThan(pitIntensityBaseRisk('Standard'));
    expect(pitIntensityPenaltySeconds('NASCAR')).toBeGreaterThan(pitIntensityPenaltySeconds('F1'));
  });

  it('a stronger crew and calmer driver botch less often on identical aggressive stops', () => {
    const lowRisk = pitIntensityBotchRisk('AllOut', 22, 24, 25, 0, false);
    const highRisk = pitIntensityBotchRisk('AllOut', 92, 92, 90, 0, false);

    expect(highRisk).toBeLessThan(lowRisk);
  });

  it('accepting a pit recommendation applies intensity and exit mode through the live race engine', () => {
    const accepted = acceptPitDecision({ seed: 'pit-decision', intensity: 'Aggressive', exitMode: 'Push' });
    const acceptedCar = playerCar(accepted);
    expect(acceptedCar.pit.intensity).toBe('Aggressive');
    expect(acceptedCar.pit.exitMode).toBe('Push');
    expect(acceptedCar.pit.pitRequested).toBe(true);
  });

  it('AI returns a valid pit intensity and exit mode when it chooses to pit', () => {
    const context = buildContext('pit-ai');
    const playerTeamId = context.entrants[0].driver.teamId;
    let state = createRace(context, playerTeamId);
    state = {
      ...state,
      seed: 'pit-ai',
      phase: 'racing',
      currentLap: 18,
      safetyCar: { ...state.safetyCar, active: true, lapsRemaining: 2 },
    };
    const car = playerCar(state);
    const action = aiLapDecision(
      {
        ...car,
        pit: { ...car.pit, scheduledLaps: [18], pitRequested: false },
        tire: { ...car.tire, wear: 82, age: 6 },
        personality: 'Opportunistic',
      },
      state,
      TRACK as Track,
      18,
    );

    expect(action.pitNow).toBe(true);
    expect(PIT_INTENSITY_ORDER).toContain(action.pitIntensity);
    expect(SELECTABLE_MODES).toContain(action.pitExitMode);
  });
});
