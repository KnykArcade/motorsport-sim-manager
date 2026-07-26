import type { StandingsEntry } from '../types/gameTypes';
import type {
  DriverCareerStats,
  SeasonHistoryRecord,
  TeamCareerStats,
  UniverseChampionshipSeason,
  UniverseDriverMovement,
} from '../types/universeTypes';

export type RecordScope = 'drivers' | 'teams';
export type DriverRecordMetric = 'driverTitles' | 'wins' | 'podiums' | 'poles' | 'fastestLaps' | 'points';
export type TeamRecordMetric = 'constructorTitles' | 'wins' | 'podiums' | 'poles' | 'points';

export const DRIVER_RECORD_METRICS: ReadonlyArray<{ id: DriverRecordMetric; label: string }> = [
  { id: 'driverTitles', label: "Drivers' titles" },
  { id: 'wins', label: 'Race wins' },
  { id: 'podiums', label: 'Podiums' },
  { id: 'poles', label: 'Pole positions' },
  { id: 'fastestLaps', label: 'Fastest laps' },
  { id: 'points', label: 'Career points' },
];

export const TEAM_RECORD_METRICS: ReadonlyArray<{ id: TeamRecordMetric; label: string }> = [
  { id: 'constructorTitles', label: "Constructors' titles" },
  { id: 'wins', label: 'Race wins' },
  { id: 'podiums', label: 'Podiums' },
  { id: 'poles', label: 'Pole positions' },
  { id: 'points', label: 'Career points' },
];

export function selectedRecord<T>(
  entries: T[],
  requestedId: string | null,
  idOf: (entry: T) => string,
): T | undefined {
  return entries.find((entry) => idOf(entry) === requestedId) ?? entries[0];
}

export function standingsDossier(entries: StandingsEntry[], selectedId: string | null) {
  const selected = selectedRecord(entries, selectedId, (entry) => entry.entityId);
  if (!selected) return undefined;
  const position = entries.findIndex((entry) => entry.entityId === selected.entityId) + 1;
  const leader = entries[0];
  const ahead = entries[position - 2];
  const behind = entries[position];
  return {
    entry: selected,
    position,
    gapToLeader: leader ? leader.points - selected.points : 0,
    gapToAhead: ahead ? ahead.points - selected.points : 0,
    gapToBehind: behind ? selected.points - behind.points : 0,
  };
}

export function driverRecordRanking(entries: DriverCareerStats[], metric: DriverRecordMetric) {
  return [...entries].sort(
    (a, b) => b[metric] - a[metric] || b.wins - a.wins || a.name.localeCompare(b.name),
  );
}

export function teamRecordRanking(entries: TeamCareerStats[], metric: TeamRecordMetric) {
  return [...entries].sort(
    (a, b) => b[metric] - a[metric] || b.wins - a.wins || a.name.localeCompare(b.name),
  );
}

export function sortedCareerSeasons(entries: SeasonHistoryRecord[]) {
  return [...entries].sort(
    (a, b) => b.seasonYear - a.seasonYear || a.series.localeCompare(b.series),
  );
}

export function sortedWorldSeasons(entries: UniverseChampionshipSeason[]) {
  return [...entries].sort(
    (a, b) => b.seasonYear - a.seasonYear || a.series.localeCompare(b.series),
  );
}

export function sortedMovements(entries: UniverseDriverMovement[], limit = 30) {
  return [...entries]
    .sort(
      (a, b) =>
        b.effectiveYear - a.effectiveYear ||
        a.series.localeCompare(b.series) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, limit);
}
