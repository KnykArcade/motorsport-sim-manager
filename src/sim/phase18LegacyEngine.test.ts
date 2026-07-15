import { describe, expect, it } from 'vitest';
import type { GameState } from '../game/careerState';
import { createNewGame } from '../game/initialCareer';
import type { RaceResult } from '../types/gameTypes';
import type { UniverseHistory } from '../types/universeTypes';
import { inductLegacyHallOfFame, recordRaceLegacy, recordSeasonOutcomeLegacy } from './phase18LegacyEngine';

function freshState(seed = 'phase18-legacy'): GameState {
  return createNewGame({ gameMode: 'Career', seasonYear: 1998, series: 'F1', teamId: 't-ferrari', seed });
}

function result(teamId: string, driverId: string, position: number): RaceResult {
  return { teamId, driverId, position, gridPosition: position, status: 'Finished', lapsCompleted: 60, points: 0, raceScore: 80, gapText: '', incidents: [] };
}

describe('Phase 18 legacy engine', () => {
  it('awards race, pole, and fastest-lap legacy without duplicating events', () => {
    const state = freshState();
    const driver = state.drivers.find((entry) => entry.teamId === state.selectedTeamId)!;
    const prepared: GameState = {
      ...state,
      raceArchive: [{ raceId: 'race-1', season: state.seasonYear, round: 1, gpName: 'Test GP', trackName: 'Test', poleDriverId: driver.id, winnerDriverId: driver.id, podium: [driver.id], fastestLap: { driverId: driver.id, timeSec: 80 }, laps: [] }],
    };
    const once = recordRaceLegacy(prepared, 'race-1', 1, [result(state.selectedTeamId, driver.id, 1)]);
    const twice = recordRaceLegacy(once, 'race-1', 1, [result(state.selectedTeamId, driver.id, 1)]);

    expect(once.phase18?.legacy.score).toBe(15);
    expect(once.phase18?.legacy.milestones.map((entry) => entry.category)).toEqual(['RaceWin', 'Pole', 'FastestLap']);
    expect(twice.phase18?.legacy).toEqual(once.phase18?.legacy);
  });

  it('records championships, a turnaround, and alternate-history outcomes at season completion', () => {
    const state = freshState('legacy-season');
    const driver = state.drivers.find((entry) => entry.teamId === state.selectedTeamId)!;
    const rival = state.teams.find((entry) => entry.id !== state.selectedTeamId)!;
    const prepared: GameState = {
      ...state,
      seasonComplete: true,
      teams: state.teams.map((team) => team.id === state.selectedTeamId ? { ...team, expectedStanding: 5 } : team),
      driverStandings: [{ entityId: driver.id, points: 100, wins: 3, podiums: 6, dnfs: 0 }],
      constructorStandings: [
        { entityId: state.selectedTeamId, points: 150, wins: 4, podiums: 8, dnfs: 0 },
        { entityId: rival.id, points: 100, wins: 2, podiums: 5, dnfs: 0 },
      ],
    };
    const updated = recordSeasonOutcomeLegacy(prepared);

    expect(updated.phase18?.legacy.score).toBe(113);
    expect(updated.phase18?.legacy.milestones.map((entry) => entry.category)).toEqual(['DriverTitle', 'ConstructorTitle', 'TeamTurnaround']);
    expect(updated.phase18?.legacy.alternateHistory).toHaveLength(3);
    expect(updated.phase18?.legacy.alternateHistory.some((entry) => entry.category === 'Unexpected Team Rise')).toBe(true);
  });

  it('inducts qualifying drivers, teams, and the player principal once', () => {
    const state = freshState('legacy-hall');
    const driver = state.drivers[0];
    const team = state.teams[0];
    const history: UniverseHistory = {
      seasons: [],
      records: {},
      driverCareerStats: { [driver.id]: { driverId: driver.id, name: driver.name, starts: 40, wins: 10, podiums: 20, poles: 8, fastestLaps: 6, points: 300, driverTitles: 1, seasonsContested: [1998, 1999] } },
      teamCareerStats: { [team.id]: { teamId: team.id, name: team.name, entries: 80, wins: 15, podiums: 30, poles: 12, points: 600, constructorTitles: 1, seasonsContested: [1998, 1999] } },
    };
    const principal = state.principal!;
    const prepared = { ...state, principal: { ...principal, careerStats: { ...principal.careerStats, raceWins: 15 } } };
    const once = inductLegacyHallOfFame(prepared, history, 1999);
    const twice = inductLegacyHallOfFame(once, history, 2000);

    expect(once.phase18?.legacy.hallOfFame.map((entry) => entry.subjectType).sort()).toEqual(['Driver', 'Team', 'TeamPrincipal']);
    expect(twice.phase18?.legacy.hallOfFame).toEqual(once.phase18?.legacy.hallOfFame);
  });
});
