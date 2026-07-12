import type { RaceEventCategory } from '../../types/simTypes';
import type { LiveRaceState } from '../../types/liveTypes';
import { categorizeRaceEvent } from '../raceEventJournal';

export type LiveRaceCalibrationRun = {
  seed: string;
  carsStarted: number;
  raceLaps: number;
  playerCars: number;
  pitStops: number;
  carsWithThreePlusStops: number;
  committedPitCalls: number;
  recommendationAppearances: number;
  modeChanges: number;
  safetyCarDeployments: number;
  retirements: number;
  totalEvents: number;
  pitEventEntries: number;
  eventsByCategory: Record<RaceEventCategory, number>;
  stopDistribution: Record<string, number>;
};

export type LiveRaceCalibrationReport = {
  runs: number;
  averages: Omit<LiveRaceCalibrationRun, 'seed' | 'eventsByCategory' | 'stopDistribution'>;
  eventsByCategory: Record<RaceEventCategory, number>;
  stopDistribution: Record<string, number>;
  rates: {
    pitStopsPerCar: number;
    threePlusStopRatePct: number;
    modeChangesPerCar: number;
    recommendationsPerPlayerCar: number;
    eventsPerLap: number;
    pitEventEntriesPerStop: number;
  };
  maxStopsByCar: number;
  pitCallReconciliationFailures: number;
};

const categories: RaceEventCategory[] = ['incident', 'strategy', 'status', 'battle', 'weather', 'race-control'];

export function measureLiveRaceCalibrationRun(
  seed: string,
  state: LiveRaceState,
  modeChanges: number,
  recommendationAppearances: number,
): LiveRaceCalibrationRun {
  const eventsByCategory = Object.fromEntries(categories.map((category) => [category, 0])) as Record<RaceEventCategory, number>;
  for (const event of state.events) eventsByCategory[categorizeRaceEvent(event)] += 1;
  const pitStops = state.cars.reduce((total, car) => total + car.pit.stopsMade, 0);
  const stopDistribution: Record<string, number> = {};
  for (const car of state.cars) stopDistribution[String(car.pit.stopsMade)] = (stopDistribution[String(car.pit.stopsMade)] ?? 0) + 1;
  const committedPitCalls = state.events.filter((event) =>
    /pit(?:s)? for (wet tyres|slicks)|takes the safety-car pit stop|makes a scheduled stop/i.test(event.text),
  ).length;
  const pitEventEntries = state.events.filter((event) =>
    /(pit stop|pits for|double-stack|forced to box|pit road)/i.test(event.text),
  ).length;
  return {
    seed,
    carsStarted: state.cars.length,
    raceLaps: state.totalLaps,
    playerCars: state.cars.filter((car) => car.isPlayer).length,
    pitStops,
    carsWithThreePlusStops: state.cars.filter((car) => car.pit.stopsMade >= 3).length,
    committedPitCalls,
    recommendationAppearances,
    modeChanges,
    safetyCarDeployments: state.safetyCar.deployments,
    retirements: state.cars.filter((car) => car.status !== 'Finished').length,
    totalEvents: state.events.length,
    pitEventEntries,
    eventsByCategory,
    stopDistribution,
  };
}

export function aggregateLiveRaceCalibration(
  runResults: readonly LiveRaceCalibrationRun[],
  maxStopsByCar: number,
): LiveRaceCalibrationReport {
  const divisor = Math.max(1, runResults.length);
  const numericKeys: Array<keyof Omit<LiveRaceCalibrationRun, 'seed' | 'eventsByCategory' | 'stopDistribution'>> = [
    'carsStarted', 'playerCars', 'pitStops', 'carsWithThreePlusStops', 'committedPitCalls', 'recommendationAppearances',
    'modeChanges', 'safetyCarDeployments', 'retirements', 'totalEvents', 'raceLaps', 'pitEventEntries',
  ];
  const averages = Object.fromEntries(numericKeys.map((key) => [
    key,
    Number((runResults.reduce((sum, run) => sum + run[key], 0) / divisor).toFixed(2)),
  ])) as LiveRaceCalibrationReport['averages'];
  const eventsByCategory = Object.fromEntries(categories.map((category) => [
    category,
    Number((runResults.reduce((sum, run) => sum + run.eventsByCategory[category], 0) / divisor).toFixed(2)),
  ])) as Record<RaceEventCategory, number>;
  const stopKeys = [...new Set(runResults.flatMap((run) => Object.keys(run.stopDistribution)))].sort((a, b) => Number(a) - Number(b));
  const stopDistribution = Object.fromEntries(stopKeys.map((key) => [
    key,
    Number((runResults.reduce((sum, run) => sum + (run.stopDistribution[key] ?? 0), 0) / divisor).toFixed(2)),
  ]));
  const totalCars = runResults.reduce((sum, run) => sum + run.carsStarted, 0);
  const totalPlayerCars = runResults.reduce((sum, run) => sum + run.playerCars, 0);
  const totalRaceLaps = runResults.reduce((sum, run) => sum + run.raceLaps, 0);
  const totalPitStops = runResults.reduce((sum, run) => sum + run.pitStops, 0);
  return {
    runs: runResults.length,
    averages,
    eventsByCategory,
    stopDistribution,
    rates: {
      pitStopsPerCar: Number((runResults.reduce((sum, run) => sum + run.pitStops, 0) / Math.max(1, totalCars)).toFixed(3)),
      threePlusStopRatePct: Number((runResults.reduce((sum, run) => sum + run.carsWithThreePlusStops, 0) / Math.max(1, totalCars) * 100).toFixed(2)),
      modeChangesPerCar: Number((runResults.reduce((sum, run) => sum + run.modeChanges, 0) / Math.max(1, totalCars)).toFixed(2)),
      recommendationsPerPlayerCar: Number((runResults.reduce((sum, run) => sum + run.recommendationAppearances, 0) / Math.max(1, totalPlayerCars)).toFixed(2)),
      eventsPerLap: Number((runResults.reduce((sum, run) => sum + run.totalEvents, 0) / Math.max(1, totalRaceLaps)).toFixed(3)),
      pitEventEntriesPerStop: Number((runResults.reduce((sum, run) => sum + run.pitEventEntries, 0) / Math.max(1, totalPitStops)).toFixed(3)),
    },
    maxStopsByCar,
    pitCallReconciliationFailures: runResults.filter((run) => run.committedPitCalls > run.pitStops).length,
  };
}
