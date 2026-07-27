import { describe, expect, it } from 'vitest';
import '../testDataSetup';
import { createNewGame } from '../game/initialCareer';
import type { RaceResult } from '../types/gameTypes';
import { managerHomeSnapshot } from './managerHomeViewModel';

describe('managerHomeViewModel', () => {
  it('summarizes the latest completed race and short form from persisted results', () => {
    const state = createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'manager-home-results' });
    const race = state.calendar[0];
    const drivers = state.drivers.filter((driver) => driver.teamId === state.selectedTeamId);
    const results: RaceResult[] = drivers.map((driver, index) => ({
      position: index + 2,
      driverId: driver.id,
      teamId: state.selectedTeamId,
      gridPosition: index + 3,
      status: 'Finished',
      lapsCompleted: race.laps,
      points: index === 0 ? 6 : 3,
      raceScore: 80 - index,
      gapText: index === 0 ? '+5.0' : '+10.0',
      incidents: [],
    }));
    const model = managerHomeSnapshot({
      ...state,
      completedRaceResults: { [race.id]: results },
    });
    expect(model.previousRace).toMatchObject({
      raceId: race.id,
      raceName: race.gpName,
      points: 9,
      route: `/results/${race.id}`,
    });
    expect(model.previousRace?.headline).toContain('P2');
    expect(model.recentTeamForm).toBe('P2');
    expect(model.driverHighlights[0].recentForm).toBe('P2');
  });

  it('falls back cleanly before the first completed race', () => {
    const state = createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'manager-home-opening' });
    const model = managerHomeSnapshot(state);
    expect(model.previousRace).toBeUndefined();
    expect(model.recentTeamForm).toBe('No completed races');
    expect(model.driverHighlights.every((driver) => driver.recentForm === 'No completed races')).toBe(true);
  });
});
