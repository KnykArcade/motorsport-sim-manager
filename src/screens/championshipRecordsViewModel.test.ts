import { describe, expect, it } from 'vitest';
import type { StandingsEntry } from '../types/gameTypes';
import type {
  DriverCareerStats,
  SeasonHistoryRecord,
  TeamCareerStats,
  UniverseDriverMovement,
} from '../types/universeTypes';
import {
  driverRecordRanking,
  selectedRecord,
  sortedCareerSeasons,
  sortedMovements,
  standingsDossier,
  teamRecordRanking,
} from './championshipRecordsViewModel';

const standings: StandingsEntry[] = [
  { entityId: 'a', points: 100, wins: 3, podiums: 5, dnfs: 0 },
  { entityId: 'b', points: 84, wins: 2, podiums: 4, dnfs: 1 },
  { entityId: 'c', points: 70, wins: 1, podiums: 3, dnfs: 2 },
];

describe('championship and records view model', () => {
  it('falls back to the first available selected record', () => {
    expect(selectedRecord(standings, 'missing', (entry) => entry.entityId)?.entityId).toBe('a');
    expect(selectedRecord([], 'missing', () => 'id')).toBeUndefined();
  });

  it('builds championship gap context around the selected entry', () => {
    expect(standingsDossier(standings, 'b')).toEqual({
      entry: standings[1],
      position: 2,
      gapToLeader: 16,
      gapToAhead: 16,
      gapToBehind: 14,
    });
    expect(standingsDossier([], null)).toBeUndefined();
  });

  it('ranks drivers by the selected record category with stable tie breakers', () => {
    const drivers: DriverCareerStats[] = [
      { driverId: 'a', name: 'Alpha', starts: 20, wins: 3, podiums: 5, poles: 1, fastestLaps: 2, points: 100, driverTitles: 0, seasonsContested: [2026] },
      { driverId: 'b', name: 'Beta', starts: 20, wins: 2, podiums: 6, poles: 3, fastestLaps: 1, points: 90, driverTitles: 1, seasonsContested: [2026] },
    ];
    expect(driverRecordRanking(drivers, 'driverTitles').map((entry) => entry.driverId)).toEqual(['b', 'a']);
    expect(driverRecordRanking(drivers, 'wins').map((entry) => entry.driverId)).toEqual(['a', 'b']);
  });

  it('ranks teams by the selected record category', () => {
    const teams: TeamCareerStats[] = [
      { teamId: 'a', name: 'Alpha', entries: 20, wins: 2, podiums: 4, poles: 1, points: 80, constructorTitles: 1, seasonsContested: [2026] },
      { teamId: 'b', name: 'Beta', entries: 20, wins: 4, podiums: 5, poles: 2, points: 100, constructorTitles: 0, seasonsContested: [2026] },
    ];
    expect(teamRecordRanking(teams, 'constructorTitles').map((entry) => entry.teamId)).toEqual(['a', 'b']);
    expect(teamRecordRanking(teams, 'points').map((entry) => entry.teamId)).toEqual(['b', 'a']);
  });

  it('sorts season archives newest first and series alphabetically', () => {
    const season = (seasonYear: number, series: string): SeasonHistoryRecord => ({
      seasonYear, series, raceResults: [], finalDriverStandings: [],
      finalConstructorStandings: [], regulationChanges: [], majorStorylines: [],
    });
    expect(sortedCareerSeasons([season(2025, 'NASCAR'), season(2026, 'F1'), season(2026, 'CART')])
      .map((entry) => `${entry.seasonYear}-${entry.series}`))
      .toEqual(['2026-CART', '2026-F1', '2025-NASCAR']);
  });

  it('sorts and limits the driver-movement ledger', () => {
    const movement = (id: string, effectiveYear: number): UniverseDriverMovement => ({
      id, effectiveYear, series: 'F1', kind: 'signing', driverId: id, driverName: id,
    });
    expect(sortedMovements([movement('b', 2026), movement('a', 2027), movement('c', 2026)], 2)
      .map((entry) => entry.id)).toEqual(['a', 'b']);
  });
});
