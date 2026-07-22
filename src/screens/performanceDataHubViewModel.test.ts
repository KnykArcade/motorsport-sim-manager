import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import type { RaceResult } from '../types/gameTypes';
import { buildRaceAnalyticsSnapshot } from '../sim/performanceAnalyticsEngine';
import { buildPerformanceDataHub } from './performanceDataHubViewModel';

describe('performanceDataHubViewModel', () => {
  it('turns stored races into driver, circuit, rival, confidence, and actionable findings', () => {
    const base = createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'hub-test' });
    const playerDrivers = base.drivers.filter((driver) => driver.teamId === base.selectedTeamId).slice(0, 2);
    const rivalTeam = base.teams.find((team) => team.id !== base.selectedTeamId)!;
    const rivalDriver = base.drivers.find((driver) => driver.teamId === rivalTeam.id)!;
    const snapshots = base.calendar.slice(0, 3).map((race, index) => {
      const make = (driverId: string, teamId: string, grid: number, finish: number): RaceResult => ({
        driverId, teamId, gridPosition: grid, position: finish, status: 'Finished', lapsCompleted: race.laps,
        points: finish <= 6 ? 10 - finish : 0, raceScore: 80, gapText: '', incidents: [], rating: 7,
      });
      const results = [
        make(playerDrivers[0].id, base.selectedTeamId, 10 - index, 5 - index),
        make(playerDrivers[1].id, base.selectedTeamId, 12 - index, 7 - index),
        make(rivalDriver.id, rivalTeam.id, 4, 4),
      ];
      return buildRaceAnalyticsSnapshot({ state: base, race, results, qualifying: [], source: 'Historical results' });
    });
    const state = { ...base, performanceAnalytics: { snapshots } };
    const hub = buildPerformanceDataHub(state, rivalTeam.id);

    expect(hub.raceCount).toBe(3);
    expect(hub.drivers).toHaveLength(2);
    expect(hub.tracks.length).toBeGreaterThan(0);
    expect(hub.rival).toMatchObject({ teamId: rivalTeam.id, racesCompared: 3 });
    expect(hub.findings[0]).toMatchObject({ id: 'qualifying-gap', actionRoute: '/briefing?tab=preparation' });
    expect(hub.metrics.find((metric) => metric.id === 'pit')).toMatchObject({ value: 'Unavailable', confidence: 'Unavailable' });
  });
});
