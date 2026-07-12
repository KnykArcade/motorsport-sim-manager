import { describe, expect, it } from 'vitest';
import { aggregateLiveRaceCalibration, type LiveRaceCalibrationRun } from './liveRaceCalibration';

describe('live race calibration aggregation', () => {
  it('averages race metrics and detects pit-call reconciliation failures', () => {
    const base = {
      carsStarted: 20, playerCars: 2,
      carsWithThreePlusStops: 0, recommendationAppearances: 4, modeChanges: 20,
      safetyCarDeployments: 1, retirements: 2, totalEvents: 40,
      eventsByCategory: { incident: 5, strategy: 8, status: 10, battle: 9, weather: 2, 'race-control': 6 },
      stopDistribution: { '0': 2, '1': 16, '2': 2 },
    } satisfies Omit<LiveRaceCalibrationRun, 'seed' | 'pitStops' | 'committedPitCalls'>;
    const report = aggregateLiveRaceCalibration([
      { ...base, seed: 'a', pitStops: 20, committedPitCalls: 18 },
      { ...base, seed: 'b', pitStops: 18, committedPitCalls: 19 },
    ], 2);
    expect(report.runs).toBe(2);
    expect(report.averages.pitStops).toBe(19);
    expect(report.pitCallReconciliationFailures).toBe(1);
    expect(report.eventsByCategory.incident).toBe(5);
    expect(report.rates.pitStopsPerCar).toBe(0.95);
    expect(report.rates.recommendationsPerPlayerCar).toBe(2);
    expect(report.stopDistribution['1']).toBe(16);
  });
});
