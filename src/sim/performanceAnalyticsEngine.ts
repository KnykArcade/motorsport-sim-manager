import { getTrackById } from '../data';
import type { GameState } from '../game/careerState';
import type { Race, RaceResult, QualifyingResult } from '../types/gameTypes';
import type { ScoreBreakdown } from '../types/simTypes';
import type {
  LiveRaceAnalyticsInput,
  PerformanceAnalyticsState,
  RaceAnalyticsSnapshot,
  RaceDriverAnalytics,
  RaceTeamAnalytics,
} from '../types/performanceAnalyticsTypes';
import { classifyDnfCause } from './dnfModel';

const round1 = (value: number) => Math.round(value * 10) / 10;
const average = (values: number[]) => values.length > 0
  ? values.reduce((sum, value) => sum + value, 0) / values.length
  : undefined;

function setupQuality(breakdown?: ScoreBreakdown): number | undefined {
  if (!breakdown) return undefined;
  return Math.max(0, Math.min(100, Math.round(50 + breakdown.setupFit * 12.5)));
}

function dnfCause(result: RaceResult): RaceDriverAnalytics['dnfCause'] {
  if (result.status !== 'DNF') return undefined;
  return classifyDnfCause(result.incidents[0]);
}

export function buildRaceAnalyticsSnapshot(input: {
  state: GameState;
  race: Race;
  results: RaceResult[];
  qualifying: QualifyingResult[];
  breakdowns?: Record<string, ScoreBreakdown>;
  live?: LiveRaceAnalyticsInput;
  source?: RaceAnalyticsSnapshot['source'];
}): RaceAnalyticsSnapshot {
  const track = getTrackById(input.race.trackId);
  const qualifyingByDriver = new Map(input.qualifying.map((result) => [result.driverId, result]));
  const drivers: RaceDriverAnalytics[] = input.results.map((result) => {
    const live = input.live?.drivers[result.driverId];
    const qualifying = qualifyingByDriver.get(result.driverId);
    return {
      driverId: result.driverId,
      teamId: result.teamId,
      qualifyingPosition: qualifying?.position,
      gridPosition: result.gridPosition,
      finishPosition: result.position,
      positionsGained: result.position === null ? 0 : result.gridPosition - result.position,
      status: result.status,
      points: result.points,
      performanceRating: result.rating,
      dnfCause: dnfCause(result),
      pitStops: live?.pitStops,
      representativePitStopSeconds: live?.representativePitStopSeconds,
      finalTireWear: live?.finalTireWear,
      tireDegRate: live?.tireDegRate,
      setupQuality: setupQuality(input.breakdowns?.[result.driverId]),
    };
  });
  const teams: RaceTeamAnalytics[] = input.state.teams.map((team) => {
    const entries = drivers.filter((driver) => driver.teamId === team.id && driver.status !== 'DNS');
    const finishes = entries.flatMap((driver) => driver.finishPosition === null ? [] : [driver.finishPosition]);
    const grids = entries.map((driver) => driver.gridPosition);
    const pitTimes = entries.flatMap((driver) => driver.representativePitStopSeconds == null ? [] : [driver.representativePitStopSeconds]);
    const tireRates = entries.flatMap((driver) => driver.tireDegRate == null ? [] : [driver.tireDegRate]);
    const setupScores = entries.flatMap((driver) => driver.setupQuality == null ? [] : [driver.setupQuality]);
    return {
      teamId: team.id,
      bestGrid: grids.length > 0 ? Math.min(...grids) : undefined,
      bestFinish: finishes.length > 0 ? Math.min(...finishes) : undefined,
      points: entries.reduce((sum, driver) => sum + driver.points, 0),
      netPositions: entries.reduce((sum, driver) => sum + driver.positionsGained, 0),
      classifiedCars: finishes.length,
      starters: entries.length,
      averagePitStopSeconds: average(pitTimes) == null ? undefined : round1(average(pitTimes)!),
      averageTireDegRate: average(tireRates) == null ? undefined : round1(average(tireRates)!),
      averageSetupQuality: average(setupScores) == null ? undefined : round1(average(setupScores)!),
    };
  }).filter((team) => team.starters > 0);

  return {
    raceId: input.race.id,
    season: input.state.seasonYear,
    round: input.race.round,
    trackId: input.race.trackId,
    trackName: input.race.trackName,
    trackArchetype: track?.archetype ?? 'Unknown circuit type',
    source: input.source ?? (input.live ? 'Live telemetry' : 'Quick simulation'),
    drivers,
    teams,
  };
}

export function recordRaceAnalytics(
  current: PerformanceAnalyticsState | undefined,
  snapshot: RaceAnalyticsSnapshot,
): PerformanceAnalyticsState {
  const snapshots = (current?.snapshots ?? []).filter((entry) => entry.raceId !== snapshot.raceId);
  return { snapshots: [...snapshots, snapshot] };
}

export function analyticsSnapshotsForState(state: GameState): RaceAnalyticsSnapshot[] {
  const stored = new Map((state.performanceAnalytics?.snapshots ?? []).map((entry) => [entry.raceId, entry]));
  for (const race of state.calendar) {
    if (stored.has(race.id)) continue;
    const results = state.completedRaceResults[race.id];
    if (!results) continue;
    stored.set(race.id, buildRaceAnalyticsSnapshot({
      state,
      race,
      results,
      qualifying: state.qualifyingResults[race.id] ?? [],
      source: 'Historical results',
    }));
  }
  return [...stored.values()].sort((a, b) => a.season - b.season || a.round - b.round);
}
