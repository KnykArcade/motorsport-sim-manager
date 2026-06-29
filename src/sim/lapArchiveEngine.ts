// Deterministic lap-time archive. The quick-race path doesn't track laps, so a
// representative best lap is synthesised from the race classification: a base
// lap time from the circuit length, scaled by each driver's pace, with a small
// seeded jitter so the fastest lap isn't always the winner. Same seed/results
// always produce the same archive.

import { createSeededRandom, deriveSeed } from './random';
import type { QualifyingResult, Race, RaceResult } from '../types/gameTypes';
import type { DriverLap, RaceArchiveEntry } from '../types/historyTypes';

const FALLBACK_LAP_SEC = 90;
const FASTEST_AVG_KMH = 205;

// Base (clean-air, peak) lap time for the circuit in seconds.
export function baseLapTimeSec(race: Race): number {
  if (race.distanceKm && race.laps > 0) {
    const lapKm = race.distanceKm / race.laps;
    return (lapKm / FASTEST_AVG_KMH) * 3600;
  }
  return FALLBACK_LAP_SEC;
}

// Format seconds as m:ss.mmm.
export function formatLapTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}

function paceProxy(result: RaceResult, fieldSize: number): number {
  // Prefer the performance rating (1-10); otherwise infer from finishing slot.
  if (typeof result.rating === 'number') return result.rating;
  const slot = result.position ?? fieldSize;
  return Math.max(1, 10 - ((slot - 1) / Math.max(1, fieldSize - 1)) * 7);
}

export function buildRaceArchiveEntry(
  race: Race,
  season: number,
  results: RaceResult[],
  qualifying: QualifyingResult[],
  driverNames: Record<string, string>,
  teamNames: Record<string, string>,
  seed: string,
): RaceArchiveEntry {
  const base = baseLapTimeSec(race);
  const classified = results.filter((r) => r.status !== 'DNS' && r.lapsCompleted > 0);

  const laps: DriverLap[] = classified.map((r) => {
    const rng = createSeededRandom(deriveSeed(seed, 'lap', race.round, r.driverId));
    const pace = paceProxy(r, results.length);
    const best = base * (1 + (8 - pace) * 0.006) + rng.range(0, 0.9);
    return {
      driverId: r.driverId,
      driverName: driverNames[r.driverId] ?? r.driverId,
      teamName: teamNames[r.teamId] ?? r.teamId,
      bestLapSec: Math.round(best * 1000) / 1000,
    };
  });
  laps.sort((a, b) => a.bestLapSec - b.bestLapSec);

  const finishers = [...results]
    .filter((r) => r.position != null)
    .sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
  const podium = finishers.slice(0, 3).map((r) => r.driverId);
  const pole = [...qualifying].sort((a, b) => a.position - b.position)[0];

  return {
    raceId: race.id,
    season,
    round: race.round,
    gpName: race.gpName,
    trackName: race.trackName,
    poleDriverId: pole?.driverId,
    winnerDriverId: finishers[0]?.driverId,
    podium,
    fastestLap: laps[0] ? { driverId: laps[0].driverId, timeSec: laps[0].bestLapSec } : undefined,
    laps,
  };
}
