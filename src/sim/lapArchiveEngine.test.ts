import { describe, expect, it } from 'vitest';
import { baseLapTimeSec, buildRaceArchiveEntry, formatLapTime } from './lapArchiveEngine';
import type { QualifyingResult, Race, RaceResult } from '../types/gameTypes';

const race: Race = {
  id: 'r1',
  round: 1,
  gpName: 'Test GP',
  trackId: 't1',
  trackName: 'Test Circuit',
  laps: 50,
  distanceKm: 300,
  completed: false,
};

function result(p: Partial<RaceResult> & Pick<RaceResult, 'driverId' | 'teamId'>): RaceResult {
  return {
    position: 1,
    gridPosition: 1,
    status: 'Finished',
    lapsCompleted: 50,
    points: 0,
    raceScore: 0,
    gapText: '',
    incidents: [],
    ...p,
  };
}

describe('baseLapTimeSec', () => {
  it('derives lap time from circuit length, with a fallback', () => {
    // 300km / 50 laps = 6km; 6 / 205 * 3600 ≈ 105.4s
    expect(baseLapTimeSec(race)).toBeCloseTo((6 / 205) * 3600, 3);
    expect(baseLapTimeSec({ ...race, distanceKm: undefined })).toBe(90);
  });
});

describe('formatLapTime', () => {
  it('formats m:ss.mmm', () => {
    expect(formatLapTime(105.432)).toBe('1:45.432');
    expect(formatLapTime(9.5)).toBe('0:09.500');
  });
});

describe('buildRaceArchiveEntry', () => {
  const results: RaceResult[] = [
    result({ driverId: 'd1', teamId: 'tA', position: 1, rating: 9 }),
    result({ driverId: 'd2', teamId: 'tA', position: 2, rating: 8 }),
    result({ driverId: 'd3', teamId: 'tB', position: 3, rating: 7 }),
    result({ driverId: 'd4', teamId: 'tB', position: null, status: 'DNF', lapsCompleted: 12, rating: 6 }),
  ];
  const quali: QualifyingResult[] = [
    { position: 1, driverId: 'd2', teamId: 'tA', qualifyingScore: 0, gapText: '', runPlan: '', setupChoice: '', notes: [] },
    { position: 2, driverId: 'd1', teamId: 'tA', qualifyingScore: 0, gapText: '', runPlan: '', setupChoice: '', notes: [] },
  ];
  const names = { d1: 'One', d2: 'Two', d3: 'Three', d4: 'Four' };
  const teams = { tA: 'Alpha', tB: 'Bravo' };

  it('captures pole/winner/podium and a deterministic lap archive', () => {
    const e1 = buildRaceArchiveEntry(race, 1995, results, quali, names, teams, 'seed');
    const e2 = buildRaceArchiveEntry(race, 1995, results, quali, names, teams, 'seed');
    expect(e1).toEqual(e2); // deterministic

    expect(e1.winnerDriverId).toBe('d1');
    expect(e1.poleDriverId).toBe('d2');
    expect(e1.podium).toEqual(['d1', 'd2', 'd3']);
    // DNS excluded, classified (incl. DNF with laps) included.
    expect(e1.laps).toHaveLength(4);
    // sorted fastest-first and fastest lap matches the first row.
    const sorted = [...e1.laps].sort((a, b) => a.bestLapSec - b.bestLapSec);
    expect(e1.laps).toEqual(sorted);
    expect(e1.fastestLap?.driverId).toBe(e1.laps[0].driverId);
    expect(e1.fastestLap?.timeSec).toBe(e1.laps[0].bestLapSec);
  });

  it('excludes DNS drivers from the lap archive', () => {
    const withDns = [...results, result({ driverId: 'd5', teamId: 'tB', position: null, status: 'DNS', lapsCompleted: 0 })];
    const e = buildRaceArchiveEntry(race, 1995, withDns, quali, names, teams, 'seed');
    expect(e.laps.some((l) => l.driverId === 'd5')).toBe(false);
  });
});
