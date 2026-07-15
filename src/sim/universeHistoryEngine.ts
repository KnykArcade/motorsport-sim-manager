// Universe records / history database (Living Universe Phase 11).
//
// The long-term encyclopedia: each completed season is archived with its race
// results, champions and final standings; cumulative driver/team career stats
// accumulate across seasons; and all-time records (most wins/titles/poles) are
// recomputed. Built from data already captured during the season (the race
// archive + completed results + final standings). Pure and deterministic.

import type { RaceResult, StandingsEntry } from '../types/gameTypes';
import type { RaceArchiveEntry } from '../types/historyTypes';
import type {
  DriverCareerStats,
  RaceHistoryRecord,
  SeasonHistoryRecord,
  TeamCareerStats,
  UniverseHistory,
  UniverseRecords,
} from '../types/universeTypes';

export function createInitialUniverseHistory(): UniverseHistory {
  return { seasons: [], driverCareerStats: {}, teamCareerStats: {}, records: {} };
}

function emptyDriverStats(driverId: string, name: string): DriverCareerStats {
  return {
    driverId,
    name,
    starts: 0,
    wins: 0,
    podiums: 0,
    poles: 0,
    fastestLaps: 0,
    points: 0,
    driverTitles: 0,
    seasonsContested: [],
  };
}

function emptyTeamStats(teamId: string, name: string): TeamCareerStats {
  return {
    teamId,
    name,
    entries: 0,
    wins: 0,
    podiums: 0,
    poles: 0,
    points: 0,
    constructorTitles: 0,
    seasonsContested: [],
  };
}

function addSeason(list: number[], year: number): number[] {
  return list.includes(year) ? list : [...list, year];
}

export type FinalizeSeasonInput = {
  seasonYear: number;
  series: string;
  driverChampionId?: string;
  constructorChampionId?: string;
  finalDriverStandings: StandingsEntry[];
  finalConstructorStandings: StandingsEntry[];
  // Race archive entries belonging to the season being finalized.
  raceArchive: RaceArchiveEntry[];
  // Completed race results for the season, keyed by raceId.
  completedRaceResults: Record<string, RaceResult[]>;
  regulationChanges: string[];
  nameOfDriver: (id: string) => string;
  nameOfTeam: (id: string) => string;
};

// Build the per-race history records for a finished season from its archive.
export function buildRaceHistoryRecords(
  raceArchive: RaceArchiveEntry[],
  completedRaceResults: Record<string, RaceResult[]>,
): RaceHistoryRecord[] {
  return [...raceArchive]
    .sort((a, b) => a.round - b.round)
    .map((a) => {
      const results = completedRaceResults[a.raceId] ?? [];
      const winnerTeamId =
        results.find((r) => r.position === 1)?.teamId ??
        results.find((r) => r.driverId === a.winnerDriverId)?.teamId;
      return {
        raceId: a.raceId,
        round: a.round,
        gpName: a.gpName,
        trackName: a.trackName,
        winnerDriverId: a.winnerDriverId,
        winnerTeamId,
        poleDriverId: a.poleDriverId,
        fastestLapDriverId: a.fastestLap?.driverId,
        podium: a.podium,
      };
    });
}

function seasonStorylines(
  raceRecords: RaceHistoryRecord[],
  input: FinalizeSeasonInput,
): string[] {
  const lines: string[] = [];
  const { driverChampionId, constructorChampionId, nameOfDriver, nameOfTeam } = input;

  if (driverChampionId) {
    const wins = raceRecords.filter((r) => r.winnerDriverId === driverChampionId).length;
    lines.push(
      `${nameOfDriver(driverChampionId)} won the ${input.seasonYear} Drivers' Championship` +
        (wins > 0 ? ` with ${wins} win${wins === 1 ? '' : 's'}.` : '.'),
    );
  }
  if (constructorChampionId) {
    lines.push(`${nameOfTeam(constructorChampionId)} took the Constructors' title.`);
  }

  // Most race wins this season (if a non-champion or dominant run).
  const winTally = new Map<string, number>();
  for (const r of raceRecords) {
    if (r.winnerDriverId) winTally.set(r.winnerDriverId, (winTally.get(r.winnerDriverId) ?? 0) + 1);
  }
  const topWinner = [...winTally.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topWinner && topWinner[0] !== driverChampionId && topWinner[1] >= 2) {
    lines.push(`${nameOfDriver(topWinner[0])} led the win count with ${topWinner[1]}.`);
  }
  return lines;
}

// Finalize one season into the universe history: archive the season, accumulate
// career stats and recompute the all-time records.
export function finalizeSeasonHistory(
  history: UniverseHistory | undefined,
  input: FinalizeSeasonInput,
): UniverseHistory {
  const base = history ?? createInitialUniverseHistory();
  const raceRecords = buildRaceHistoryRecords(input.raceArchive, input.completedRaceResults);

  const driverCareerStats: Record<string, DriverCareerStats> = {};
  for (const [id, s] of Object.entries(base.driverCareerStats)) driverCareerStats[id] = { ...s };
  const teamCareerStats: Record<string, TeamCareerStats> = {};
  for (const [id, s] of Object.entries(base.teamCareerStats)) teamCareerStats[id] = { ...s };

  const driver = (id: string): DriverCareerStats =>
    (driverCareerStats[id] ??= emptyDriverStats(id, input.nameOfDriver(id)));
  const team = (id: string): TeamCareerStats =>
    (teamCareerStats[id] ??= emptyTeamStats(id, input.nameOfTeam(id)));

  // Starts / points from the full results; keep the freshest known name.
  for (const results of Object.values(input.completedRaceResults)) {
    for (const r of results) {
      if (r.status === 'DNS') continue;
      const ds = driver(r.driverId);
      ds.name = input.nameOfDriver(r.driverId);
      ds.starts += 1;
      ds.points += r.points;
      ds.seasonsContested = addSeason(ds.seasonsContested, input.seasonYear);

      const ts = team(r.teamId);
      ts.name = input.nameOfTeam(r.teamId);
      ts.entries += 1;
      ts.points += r.points;
      ts.seasonsContested = addSeason(ts.seasonsContested, input.seasonYear);
    }
  }

  // Wins / podiums / poles / fastest laps from the race archive.
  for (const r of raceRecords) {
    if (r.winnerDriverId) {
      driver(r.winnerDriverId).wins += 1;
      if (r.winnerTeamId) team(r.winnerTeamId).wins += 1;
    }
    for (const id of r.podium) {
      driver(id).podiums += 1;
      const teamId = (input.completedRaceResults[r.raceId] ?? []).find((x) => x.driverId === id)?.teamId;
      if (teamId) team(teamId).podiums += 1;
    }
    if (r.poleDriverId) {
      driver(r.poleDriverId).poles += 1;
      const teamId = (input.completedRaceResults[r.raceId] ?? []).find((x) => x.driverId === r.poleDriverId)?.teamId;
      if (teamId) team(teamId).poles += 1;
    }
    if (r.fastestLapDriverId) driver(r.fastestLapDriverId).fastestLaps += 1;
  }

  // Titles.
  if (input.driverChampionId) driver(input.driverChampionId).driverTitles += 1;
  if (input.constructorChampionId) team(input.constructorChampionId).constructorTitles += 1;

  const seasonRecord: SeasonHistoryRecord = {
    seasonYear: input.seasonYear,
    series: input.series,
    driverChampionId: input.driverChampionId,
    constructorChampionId: input.constructorChampionId,
    raceResults: raceRecords,
    finalDriverStandings: input.finalDriverStandings,
    finalConstructorStandings: input.finalConstructorStandings,
    regulationChanges: input.regulationChanges,
    majorStorylines: seasonStorylines(raceRecords, input),
  };

  return {
    seasons: [...base.seasons, seasonRecord],
    driverCareerStats,
    teamCareerStats,
    records: computeUniverseRecords(driverCareerStats, teamCareerStats),
  };
}

function leader<T>(items: T[], value: (t: T) => number, id: (t: T) => string): string | undefined {
  let best: T | undefined;
  for (const it of items) {
    if (value(it) <= 0) continue;
    if (!best || value(it) > value(best)) best = it;
  }
  return best ? id(best) : undefined;
}

export function computeUniverseRecords(
  driverCareerStats: Record<string, DriverCareerStats>,
  teamCareerStats: Record<string, TeamCareerStats>,
): UniverseRecords {
  const drivers = Object.values(driverCareerStats);
  const teams = Object.values(teamCareerStats);
  return {
    mostWinsDriverId: leader(drivers, (d) => d.wins, (d) => d.driverId),
    mostTitlesDriverId: leader(drivers, (d) => d.driverTitles, (d) => d.driverId),
    mostPolesDriverId: leader(drivers, (d) => d.poles, (d) => d.driverId),
    mostPodiumsDriverId: leader(drivers, (d) => d.podiums, (d) => d.driverId),
    mostFastestLapsDriverId: leader(drivers, (d) => d.fastestLaps, (d) => d.driverId),
    mostPointsDriverId: leader(drivers, (d) => d.points, (d) => d.driverId),
    mostWinsTeamId: leader(teams, (t) => t.wins, (t) => t.teamId),
    mostTitlesTeamId: leader(teams, (t) => t.constructorTitles, (t) => t.teamId),
    mostPodiumsTeamId: leader(teams, (t) => t.podiums, (t) => t.teamId),
    mostPolesTeamId: leader(teams, (t) => t.poles, (t) => t.teamId),
    mostPointsTeamId: leader(teams, (t) => t.points, (t) => t.teamId),
  };
}
