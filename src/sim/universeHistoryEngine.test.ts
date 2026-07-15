import { describe, it, expect } from 'vitest';
import type { RaceResult, StandingsEntry } from '../types/gameTypes';
import type { RaceArchiveEntry } from '../types/historyTypes';
import {
  buildRaceHistoryRecords,
  computeUniverseRecords,
  createInitialUniverseHistory,
  finalizeSeasonHistory,
  type FinalizeSeasonInput,
} from './universeHistoryEngine';

function result(driverId: string, teamId: string, position: number | null, points: number): RaceResult {
  return {
    position,
    driverId,
    teamId,
    gridPosition: position ?? 20,
    status: position == null ? 'DNF' : 'Finished',
    lapsCompleted: 50,
    points,
    raceScore: 0,
    gapText: '',
    incidents: [],
  };
}

function archive(round: number, winner: string, pole: string, podium: string[], fl?: string): RaceArchiveEntry {
  return {
    raceId: `r-${round}`,
    season: 1995,
    round,
    gpName: `Round ${round} GP`,
    trackName: 'Track',
    poleDriverId: pole,
    winnerDriverId: winner,
    podium,
    fastestLap: fl ? { driverId: fl, timeSec: 80 } : undefined,
    laps: [],
  };
}

const NAMES: Record<string, string> = { a: 'Driver A', b: 'Driver B', ta: 'Team A', tb: 'Team B' };

const input = (overrides?: Partial<FinalizeSeasonInput>): FinalizeSeasonInput => ({
  seasonYear: 1995,
  series: 'F1',
  driverChampionId: 'a',
  constructorChampionId: 'ta',
  finalDriverStandings: [] as StandingsEntry[],
  finalConstructorStandings: [] as StandingsEntry[],
  raceArchive: [
    archive(1, 'a', 'a', ['a', 'b'], 'a'),
    archive(2, 'b', 'a', ['b', 'a'], 'b'),
  ],
  completedRaceResults: {
    'r-1': [result('a', 'ta', 1, 10), result('b', 'tb', 2, 6)],
    'r-2': [result('b', 'tb', 1, 10), result('a', 'ta', 2, 6)],
  },
  regulationChanges: ['Safety rule passed.'],
  nameOfDriver: (id) => NAMES[id] ?? id,
  nameOfTeam: (id) => NAMES[id] ?? id,
  ...overrides,
});

describe('universeHistoryEngine — race records', () => {
  it('maps archive entries to records with the winner team derived from results', () => {
    const recs = buildRaceHistoryRecords(input().raceArchive, input().completedRaceResults);
    expect(recs).toHaveLength(2);
    expect(recs[0].winnerDriverId).toBe('a');
    expect(recs[0].winnerTeamId).toBe('ta');
    expect(recs[0].fastestLapDriverId).toBe('a');
  });
});

describe('universeHistoryEngine — finalize', () => {
  it('archives the season and accumulates career stats', () => {
    const h = finalizeSeasonHistory(createInitialUniverseHistory(), input());
    expect(h.seasons).toHaveLength(1);

    const a = h.driverCareerStats['a'];
    expect(a.starts).toBe(2);
    expect(a.wins).toBe(1);
    expect(a.podiums).toBe(2);
    expect(a.poles).toBe(2);
    expect(a.fastestLaps).toBe(1);
    expect(a.points).toBe(16);
    expect(a.driverTitles).toBe(1);
    expect(a.seasonsContested).toEqual([1995]);

    const ta = h.teamCareerStats['ta'];
    expect(ta.wins).toBe(1);
    expect(ta.constructorTitles).toBe(1);
  });

  it('accumulates across seasons without double-counting a year', () => {
    const h1 = finalizeSeasonHistory(createInitialUniverseHistory(), input());
    const h2 = finalizeSeasonHistory(
      h1,
      input({
        seasonYear: 1996,
        driverChampionId: 'a',
        raceArchive: [archive(1, 'a', 'a', ['a', 'b'], 'a')],
        completedRaceResults: { 'r-1': [result('a', 'ta', 1, 10), result('b', 'tb', 2, 6)] },
      }),
    );
    expect(h2.seasons).toHaveLength(2);
    expect(h2.driverCareerStats['a'].driverTitles).toBe(2);
    expect(h2.driverCareerStats['a'].wins).toBe(2);
    expect(h2.driverCareerStats['a'].seasonsContested).toEqual([1995, 1996]);
    expect(h2.records.mostWinsDriverId).toBe('a');
    expect(h2.records.mostTitlesDriverId).toBe('a');
    expect(h2.records.mostPodiumsDriverId).toBe('a');
    expect(h2.records.mostFastestLapsDriverId).toBe('a');
    expect(h2.records.mostPointsDriverId).toBe('a');
    expect(h2.records.mostPodiumsTeamId).toBe('ta');
    expect(h2.records.mostPointsTeamId).toBe('ta');
  });

  it('generates champion storylines', () => {
    const h = finalizeSeasonHistory(createInitialUniverseHistory(), input());
    expect(h.seasons[0].majorStorylines.some((s) => s.includes('Driver A'))).toBe(true);
  });
});

describe('universeHistoryEngine — records', () => {
  it('ignores zero-value holders', () => {
    const records = computeUniverseRecords(
      { a: { driverId: 'a', name: 'A', starts: 5, wins: 0, podiums: 0, poles: 0, fastestLaps: 0, points: 3, driverTitles: 0, seasonsContested: [1995] } },
      {},
    );
    expect(records.mostWinsDriverId).toBeUndefined();
    expect(records.mostWinsTeamId).toBeUndefined();
  });
});
