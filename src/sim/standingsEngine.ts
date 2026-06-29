// Championship standings aggregation.

import type { RaceResult, StandingsEntry } from '../types/gameTypes';

function emptyEntry(entityId: string): StandingsEntry {
  return { entityId, points: 0, wins: 0, podiums: 0, dnfs: 0 };
}

function applyResults(
  table: Record<string, StandingsEntry>,
  results: RaceResult[],
  keyOf: (r: RaceResult) => string,
): void {
  for (const r of results) {
    const key = keyOf(r);
    const entry = (table[key] ??= emptyEntry(key));
    entry.points += r.points;
    if (r.position === 1) entry.wins += 1;
    if (r.position !== null && r.position <= 3) entry.podiums += 1;
    if (r.status === 'DNF') entry.dnfs += 1;
  }
}

function sortStandings(table: Record<string, StandingsEntry>): StandingsEntry[] {
  return Object.values(table).sort(
    (a, b) => b.points - a.points || b.wins - a.wins || b.podiums - a.podiums,
  );
}

// Rebuild driver standings from all completed race results.
export function buildDriverStandings(
  allResults: RaceResult[][],
): StandingsEntry[] {
  const table: Record<string, StandingsEntry> = {};
  for (const results of allResults) applyResults(table, results, (r) => r.driverId);
  return sortStandings(table);
}

// Constructor standings combine both drivers.
export function buildConstructorStandings(
  allResults: RaceResult[][],
): StandingsEntry[] {
  const table: Record<string, StandingsEntry> = {};
  for (const results of allResults) applyResults(table, results, (r) => r.teamId);
  // A team scoring a 1-2 should only count one win.
  const winTable: Record<string, StandingsEntry> = {};
  for (const results of allResults) {
    const winner = results.find((r) => r.position === 1);
    if (winner) {
      (winTable[winner.teamId] ??= emptyEntry(winner.teamId)).wins += 1;
    }
  }
  for (const key of Object.keys(table)) {
    table[key].wins = winTable[key]?.wins ?? 0;
  }
  return sortStandings(table);
}
