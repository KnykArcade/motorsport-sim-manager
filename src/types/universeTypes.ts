// Universe records / history database (Living Universe Phase 1 — types only).
//
// The long-term encyclopedia: champions, race winners, poles, fastest laps and
// cumulative career stats for drivers, teams and the player principal — so a
// long save reads like an alternate-history racing record book.

import type { StandingsEntry } from './gameTypes';

export type RaceHistoryRecord = {
  raceId: string;
  round: number;
  gpName: string;
  trackName: string;
  winnerDriverId?: string;
  winnerTeamId?: string;
  poleDriverId?: string;
  fastestLapDriverId?: string;
  podium: string[]; // top-3 driverIds
};

export type SeasonHistoryRecord = {
  seasonYear: number;
  series: string;
  driverChampionId?: string;
  constructorChampionId?: string;
  raceResults: RaceHistoryRecord[];
  finalDriverStandings: StandingsEntry[];
  finalConstructorStandings: StandingsEntry[];
  regulationChanges: string[];
  majorStorylines: string[];
};

export type DriverCareerStats = {
  driverId: string;
  name: string;
  starts: number;
  wins: number;
  podiums: number;
  poles: number;
  fastestLaps: number;
  points: number;
  driverTitles: number;
  seasonsContested: number[];
};

export type TeamCareerStats = {
  teamId: string;
  name: string;
  entries: number;
  wins: number;
  podiums: number;
  poles: number;
  points: number;
  constructorTitles: number;
  seasonsContested: number[];
};

// All-time leaderboards / single-record holders.
export type UniverseRecords = {
  mostWinsDriverId?: string;
  mostTitlesDriverId?: string;
  mostPolesDriverId?: string;
  mostWinsTeamId?: string;
  mostTitlesTeamId?: string;
};

export type UniverseHistory = {
  seasons: SeasonHistoryRecord[];
  driverCareerStats: Record<string, DriverCareerStats>;
  teamCareerStats: Record<string, TeamCareerStats>;
  records: UniverseRecords;
};
