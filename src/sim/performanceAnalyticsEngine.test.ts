import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import type { GameState } from '../game/careerState';
import type { RaceResult } from '../types/gameTypes';
import { analyticsSnapshotsForState, buildRaceAnalyticsSnapshot, recordRaceAnalytics } from './performanceAnalyticsEngine';

function state(): GameState {
  return createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'analytics-test' });
}

function result(driverId: string, teamId: string, grid: number, finish: number | null): RaceResult {
  return {
    driverId,
    teamId,
    gridPosition: grid,
    position: finish,
    status: finish == null ? 'DNF' : 'Finished',
    lapsCompleted: finish == null ? 20 : 60,
    points: finish === 1 ? 10 : 0,
    raceScore: 80,
    gapText: '',
    incidents: finish == null ? ['Engine failure'] : [],
    rating: finish == null ? 4 : 8,
  };
}

describe('performanceAnalyticsEngine', () => {
  it('records exact classification plus optional live telemetry without inventing absent fields', () => {
    const base = state();
    const drivers = base.drivers.filter((driver) => driver.teamId === base.selectedTeamId).slice(0, 2);
    const race = base.calendar[0];
    const results = [result(drivers[0].id, base.selectedTeamId, 5, 2), result(drivers[1].id, base.selectedTeamId, 7, null)];
    const snapshot = buildRaceAnalyticsSnapshot({
      state: base,
      race,
      results,
      qualifying: [],
      breakdowns: { [drivers[0].id]: { driverId: drivers[0].id, driverBase: 8, carBase: 8, trackFit: 0, setupFit: 1, reliabilityRisk: 0, mistakeRisk: 0, variance: 0, finalScore: 8 } },
      live: { drivers: { [drivers[0].id]: { pitStops: 1, representativePitStopSeconds: 3.2, finalTireWear: 66, tireDegRate: 1.4 } } },
    });

    expect(snapshot.source).toBe('Live telemetry');
    expect(snapshot.drivers[0]).toMatchObject({ positionsGained: 3, pitStops: 1, setupQuality: 63 });
    expect(snapshot.drivers[1]).toMatchObject({ dnfCause: 'Mechanical' });
    expect(snapshot.drivers[1].pitStops).toBeUndefined();
    expect(snapshot.teams.find((team) => team.teamId === base.selectedTeamId)).toMatchObject({ points: 0, netPositions: 3, classifiedCars: 1 });
  });

  it('derives an older-save baseline from stored results and replaces a race snapshot instead of duplicating it', () => {
    const base = state();
    const driver = base.drivers.find((entry) => entry.teamId === base.selectedTeamId)!;
    const race = base.calendar[0];
    const results = [result(driver.id, base.selectedTeamId, 8, 4)];
    const legacy = { ...base, completedRaceResults: { [race.id]: results } };
    const derived = analyticsSnapshotsForState(legacy);

    expect(derived).toHaveLength(1);
    expect(derived[0].source).toBe('Historical results');
    expect(derived[0].drivers[0].tireDegRate).toBeUndefined();
    expect(recordRaceAnalytics({ snapshots: [derived[0]] }, { ...derived[0], source: 'Quick simulation' }).snapshots).toHaveLength(1);
  });
});
