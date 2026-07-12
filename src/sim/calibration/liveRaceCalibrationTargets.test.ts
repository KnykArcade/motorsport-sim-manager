import { describe, expect, it } from 'vitest';
import { aggregateLiveRaceCalibration, type LiveRaceCalibrationRun } from './liveRaceCalibration';
import { assessLiveRaceCalibration, selectLiveRaceCalibrationTargets } from './liveRaceCalibrationTargets';

const run: LiveRaceCalibrationRun = {
  seed: 'target-test', carsStarted: 20, playerCars: 2, pitStops: 24, carsWithThreePlusStops: 0,
  committedPitCalls: 20, recommendationAppearances: 12, modeChanges: 80,
  safetyCarDeployments: 2, retirements: 3, totalEvents: 80,
  eventsByCategory: { incident: 4, strategy: 30, status: 20, battle: 18, weather: 2, 'race-control': 6 },
  stopDistribution: { '0': 2, '1': 12, '2': 6 },
};

describe('live race calibration targets', () => {
  it('selects distinct historical and modern F1 profiles', () => {
    expect(selectLiveRaceCalibrationTargets('F1', 1995).id).toBe('f1-historical');
    expect(selectLiveRaceCalibrationTargets('F1', 2026).id).toBe('f1-modern');
  });

  it('uses series-appropriate pit-stop bands', () => {
    expect(selectLiveRaceCalibrationTargets('NASCAR', 2026).bands.pitStopsPerCar.max)
      .toBeGreaterThan(selectLiveRaceCalibrationTargets('F1', 2026).bands.pitStopsPerCar.max);
  });

  it('reports every metric and an overall assessment', () => {
    const report = aggregateLiveRaceCalibration([run], 2);
    const assessment = assessLiveRaceCalibration(report, selectLiveRaceCalibrationTargets('F1', 1995));
    expect(assessment.withinTargets).toBe(true);
    expect(assessment.metrics.pitStopsPerCar).toMatchObject({ actual: 1.2, within: true });
    expect(Object.keys(assessment.metrics)).toHaveLength(5);
  });
});
