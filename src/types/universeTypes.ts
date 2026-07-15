// Universe records / history database (Living Universe Phase 1 — types only).
//
// The long-term encyclopedia: champions, race winners, poles, fastest laps and
// cumulative career stats for drivers, teams and the player principal — so a
// long save reads like an alternate-history racing record book.

import type { Series, StandingsEntry } from './gameTypes';

// The live multi-series world that surrounds the championship the player is
// managing. This is deliberately lean: it persists contracts and seats for
// every championship without duplicating each series' full race simulation.
export type UniverseDriverContract = {
  driverId: string;
  registryDriverId?: string;
  name: string;
  teamId: string;
  series: Series;
  contractYearsRemaining: number;
};

export type UniverseTeamRoster = {
  teamId: string;
  name: string;
  reputation: number;
  seatCount: number;
  driverIds: string[];
};

export type UniverseChampionshipSeason = {
  seasonYear: number;
  series: Series;
  completedRaces: number;
  driverChampionId?: string;
  driverChampionName?: string;
  teamChampionId?: string;
  teamChampionName?: string;
  driverNames: Record<string, string>;
  teamNames: Record<string, string>;
  driverStandings: StandingsEntry[];
  teamStandings: StandingsEntry[];
};

export type UniverseDriverMovement = {
  id: string;
  effectiveYear: number;
  series: Series;
  kind: 'signing' | 'transfer' | 'renewal' | 'release';
  driverId: string;
  driverName: string;
  fromTeamId?: string;
  fromTeamName?: string;
  toTeamId?: string;
  toTeamName?: string;
  contractYears?: number;
};

export type UniverseChampionshipState = {
  series: Series;
  seasonYear: number;
  teams: UniverseTeamRoster[];
  drivers: UniverseDriverContract[];
  // Optional for saves created before off-screen championship simulation.
  seasonHistory?: UniverseChampionshipSeason[];
  // Optional for saves created before world-grid movement tracking.
  movementHistory?: UniverseDriverMovement[];
};

export type MotorsportUniverseState = {
  version: 1;
  seasonYear: number;
  championships: Partial<Record<Series, UniverseChampionshipState>>;
};

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
  mostPodiumsDriverId?: string;
  mostFastestLapsDriverId?: string;
  mostPointsDriverId?: string;
  mostWinsTeamId?: string;
  mostTitlesTeamId?: string;
  mostPodiumsTeamId?: string;
  mostPolesTeamId?: string;
  mostPointsTeamId?: string;
};

export type UniverseHistory = {
  seasons: SeasonHistoryRecord[];
  driverCareerStats: Record<string, DriverCareerStats>;
  teamCareerStats: Record<string, TeamCareerStats>;
  records: UniverseRecords;
};
