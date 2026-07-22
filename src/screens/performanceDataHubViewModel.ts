import type { GameState } from '../game/careerState';
import { analyticsSnapshotsForState } from '../sim/performanceAnalyticsEngine';
import type { AnalyticsEvidenceLevel, RaceAnalyticsSnapshot, RaceDriverAnalytics } from '../types/performanceAnalyticsTypes';

export type DataHubTrend = 'Improving' | 'Stable' | 'Worsening' | 'Building baseline';

export type DataHubMetric = {
  id: string;
  label: string;
  value: string;
  detail: string;
  confidence: AnalyticsEvidenceLevel;
  trend: DataHubTrend;
};

export type DataHubFinding = {
  id: string;
  title: string;
  conclusion: string;
  evidence: string[];
  confidence: AnalyticsEvidenceLevel;
  trend: DataHubTrend;
  actionLabel: string;
  actionRoute: string;
};

export type DataHubDriverRow = {
  driverId: string;
  races: number;
  averageGrid?: number;
  averageFinish?: number;
  averagePositionsGained: number;
  finishRate: number;
  consistency?: number;
};

export type DataHubTrackRow = {
  archetype: string;
  races: number;
  averageGrid?: number;
  averageFinish?: number;
  averagePositionsGained: number;
  points: number;
  finishRate: number;
  averageSetupQuality?: number;
  averageTireDegRate?: number;
};

export type DataHubRivalComparison = {
  teamId: string;
  racesCompared: number;
  playerPoints: number;
  rivalPoints: number;
  playerAverageFinish?: number;
  rivalAverageFinish?: number;
  playerNetPositions: number;
  rivalNetPositions: number;
  confidence: AnalyticsEvidenceLevel;
};

export type PerformanceDataHub = {
  raceCount: number;
  telemetryRaceCount: number;
  metrics: DataHubMetric[];
  findings: DataHubFinding[];
  drivers: DataHubDriverRow[];
  tracks: DataHubTrackRow[];
  rival?: DataHubRivalComparison;
  latestRaceId?: string;
};

const avg = (values: number[]): number | undefined => values.length
  ? values.reduce((sum, value) => sum + value, 0) / values.length
  : undefined;
const rounded = (value: number) => Math.round(value * 10) / 10;
const formatPosition = (value?: number) => value == null ? 'Unavailable' : `P${rounded(value)}`;
const formatSigned = (value: number) => `${value > 0 ? '+' : ''}${rounded(value)}`;

function teamDrivers(snapshots: RaceAnalyticsSnapshot[], teamId: string): RaceDriverAnalytics[] {
  return snapshots.flatMap((snapshot) => snapshot.drivers.filter((driver) => driver.teamId === teamId && driver.status !== 'DNS'));
}

function standardDeviation(values: number[]): number | undefined {
  const mean = avg(values);
  if (mean == null || values.length < 2) return undefined;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}

function directionTrend(values: number[], lowerIsBetter = false): DataHubTrend {
  if (values.length < 4) return 'Building baseline';
  const split = Math.max(2, Math.floor(values.length / 2));
  const prior = avg(values.slice(0, values.length - split));
  const recent = avg(values.slice(-split));
  if (prior == null || recent == null) return 'Building baseline';
  const delta = (recent - prior) * (lowerIsBetter ? -1 : 1);
  if (delta > 0.35) return 'Improving';
  if (delta < -0.35) return 'Worsening';
  return 'Stable';
}

function confidenceForCount(count: number, unavailable = false): AnalyticsEvidenceLevel {
  if (unavailable || count === 0) return 'Unavailable';
  if (count >= 5) return 'High';
  if (count >= 2) return 'Medium';
  return 'Low';
}

function driverRows(snapshots: RaceAnalyticsSnapshot[], teamId: string): DataHubDriverRow[] {
  const ids = [...new Set(teamDrivers(snapshots, teamId).map((entry) => entry.driverId))];
  return ids.map((driverId) => {
    const entries = teamDrivers(snapshots, teamId).filter((entry) => entry.driverId === driverId);
    const finishes = entries.flatMap((entry) => entry.finishPosition == null ? [] : [entry.finishPosition]);
    return {
      driverId,
      races: entries.length,
      averageGrid: avg(entries.map((entry) => entry.gridPosition)),
      averageFinish: avg(finishes),
      averagePositionsGained: avg(entries.map((entry) => entry.positionsGained)) ?? 0,
      finishRate: finishes.length / Math.max(1, entries.length),
      consistency: standardDeviation(entries.map((entry) => entry.positionsGained)),
    };
  });
}

function trackRows(snapshots: RaceAnalyticsSnapshot[], teamId: string): DataHubTrackRow[] {
  const archetypes = [...new Set(snapshots.map((snapshot) => snapshot.trackArchetype))];
  return archetypes.map((archetype) => {
    const races = snapshots.filter((snapshot) => snapshot.trackArchetype === archetype);
    const entries = teamDrivers(races, teamId);
    const finishes = entries.flatMap((entry) => entry.finishPosition == null ? [] : [entry.finishPosition]);
    const setupScores = entries.flatMap((entry) => entry.setupQuality == null ? [] : [entry.setupQuality]);
    const tireRates = entries.flatMap((entry) => entry.tireDegRate == null ? [] : [entry.tireDegRate]);
    return {
      archetype,
      races: races.length,
      averageGrid: avg(entries.map((entry) => entry.gridPosition)),
      averageFinish: avg(finishes),
      averagePositionsGained: avg(entries.map((entry) => entry.positionsGained)) ?? 0,
      points: entries.reduce((sum, entry) => sum + entry.points, 0),
      finishRate: finishes.length / Math.max(1, entries.length),
      averageSetupQuality: avg(setupScores),
      averageTireDegRate: avg(tireRates),
    };
  }).sort((a, b) => b.races - a.races || b.points - a.points);
}

function buildRival(snapshots: RaceAnalyticsSnapshot[], playerTeamId: string, rivalTeamId?: string): DataHubRivalComparison | undefined {
  if (!rivalTeamId || rivalTeamId === playerTeamId) return undefined;
  const player = teamDrivers(snapshots, playerTeamId);
  const rival = teamDrivers(snapshots, rivalTeamId);
  const playerFinishes = player.flatMap((entry) => entry.finishPosition == null ? [] : [entry.finishPosition]);
  const rivalFinishes = rival.flatMap((entry) => entry.finishPosition == null ? [] : [entry.finishPosition]);
  return {
    teamId: rivalTeamId,
    racesCompared: snapshots.filter((snapshot) => snapshot.teams.some((team) => team.teamId === rivalTeamId)).length,
    playerPoints: player.reduce((sum, entry) => sum + entry.points, 0),
    rivalPoints: rival.reduce((sum, entry) => sum + entry.points, 0),
    playerAverageFinish: avg(playerFinishes),
    rivalAverageFinish: avg(rivalFinishes),
    playerNetPositions: player.reduce((sum, entry) => sum + entry.positionsGained, 0),
    rivalNetPositions: rival.reduce((sum, entry) => sum + entry.positionsGained, 0),
    confidence: confidenceForCount(snapshots.length),
  };
}

export function buildPerformanceDataHub(state: GameState, rivalTeamId?: string): PerformanceDataHub {
  const snapshots = analyticsSnapshotsForState(state).filter((snapshot) => snapshot.season === state.seasonYear);
  const entries = teamDrivers(snapshots, state.selectedTeamId);
  const finishes = entries.flatMap((entry) => entry.finishPosition == null ? [] : [entry.finishPosition]);
  const pitEntries = entries.filter((entry) => entry.representativePitStopSeconds != null);
  const tireEntries = entries.filter((entry) => entry.tireDegRate != null);
  const setupEntries = entries.filter((entry) => entry.setupQuality != null);
  const finishRate = finishes.length / Math.max(1, entries.length);
  const averageGain = avg(entries.map((entry) => entry.positionsGained)) ?? 0;
  const averagePit = avg(pitEntries.map((entry) => entry.representativePitStopSeconds!));
  const averageTire = avg(tireEntries.map((entry) => entry.tireDegRate!));
  const averageSetup = avg(setupEntries.map((entry) => entry.setupQuality!));
  const telemetryRaceCount = snapshots.filter((snapshot) => snapshot.source === 'Live telemetry').length;

  const metrics: DataHubMetric[] = [
    { id: 'qualifying', label: 'Qualifying', value: formatPosition(avg(entries.map((entry) => entry.gridPosition))), detail: 'Average starting position', confidence: confidenceForCount(snapshots.length), trend: directionTrend(entries.map((entry) => entry.gridPosition), true) },
    { id: 'race', label: 'Race result', value: formatPosition(avg(finishes)), detail: 'Average classified finish', confidence: confidenceForCount(snapshots.length), trend: directionTrend(finishes, true) },
    { id: 'positions', label: 'Race execution', value: formatSigned(averageGain), detail: 'Average positions gained per car', confidence: confidenceForCount(snapshots.length), trend: directionTrend(entries.map((entry) => entry.positionsGained)) },
    { id: 'reliability', label: 'Reliability', value: `${Math.round(finishRate * 100)}%`, detail: 'Cars reaching a classified finish', confidence: confidenceForCount(snapshots.length), trend: directionTrend(entries.map((entry) => entry.finishPosition == null ? 0 : 1)) },
    { id: 'pit', label: 'Pit execution', value: averagePit == null ? 'Unavailable' : `${rounded(averagePit)}s`, detail: 'Representative recorded stop', confidence: confidenceForCount(pitEntries.length, averagePit == null), trend: directionTrend(pitEntries.map((entry) => entry.representativePitStopSeconds!), true) },
    { id: 'tire', label: 'Tire behavior', value: averageTire == null ? 'Unavailable' : `${rounded(averageTire)} wear/lap`, detail: 'Recorded live degradation rate', confidence: confidenceForCount(tireEntries.length, averageTire == null), trend: directionTrend(tireEntries.map((entry) => entry.tireDegRate!), true) },
    { id: 'setup', label: 'Setup effectiveness', value: averageSetup == null ? 'Unavailable' : `${Math.round(averageSetup)}/100`, detail: 'Race setup-fit evidence', confidence: confidenceForCount(setupEntries.length, averageSetup == null), trend: directionTrend(setupEntries.map((entry) => entry.setupQuality!)) },
  ];

  const findings: DataHubFinding[] = [];
  const worstSwing = snapshots.map((snapshot) => ({ snapshot, net: snapshot.teams.find((team) => team.teamId === state.selectedTeamId)?.netPositions ?? 0 })).sort((a, b) => a.net - b.net)[0];
  if (averageGain >= 0.8) {
    findings.push({ id: 'qualifying-gap', title: 'Race pace is rescuing qualifying', conclusion: `The cars gain ${rounded(averageGain)} places on average, indicating that starting position is leaving race performance unused.`, evidence: [`Average grid ${formatPosition(avg(entries.map((entry) => entry.gridPosition)))} versus finish ${formatPosition(avg(finishes))}.`, worstSwing ? `${worstSwing.snapshot.trackName} is the clearest recorded race-position swing.` : 'More races are needed for circuit evidence.'], confidence: confidenceForCount(snapshots.length), trend: directionTrend(entries.map((entry) => entry.gridPosition), true), actionLabel: 'Prepare qualifying', actionRoute: '/briefing?tab=preparation' });
  } else if (averageGain <= -0.5) {
    findings.push({ id: 'race-execution', title: 'Grid position is being lost on race day', conclusion: `The team loses ${Math.abs(rounded(averageGain))} places per car from grid to finish.`, evidence: [worstSwing ? `${worstSwing.snapshot.trackName}: ${formatSigned(worstSwing.net)} net positions.` : 'Classification evidence is still limited.', 'The trend uses stored grid and finish positions, not inferred telemetry.'], confidence: confidenceForCount(snapshots.length), trend: directionTrend(entries.map((entry) => entry.positionsGained)), actionLabel: 'Review strategy', actionRoute: '/weekend' });
  }
  if (finishRate < 0.85 && entries.length > 1) {
    const dnfs = entries.filter((entry) => entry.finishPosition == null);
    const latest = snapshots.filter((snapshot) => snapshot.drivers.some((entry) => entry.teamId === state.selectedTeamId && entry.finishPosition == null)).at(-1);
    findings.push({ id: 'reliability', title: 'Reliability is suppressing the points return', conclusion: `${dnfs.length} of ${entries.length} recorded starts failed to reach a classified finish.`, evidence: [latest ? `${latest.trackName} is the latest race with a player-team non-finish.` : 'The current season contains a non-finish.', `${Math.round(finishRate * 100)}% classified-finish rate.`], confidence: confidenceForCount(snapshots.length), trend: directionTrend(entries.map((entry) => entry.finishPosition == null ? 0 : 1)), actionLabel: 'Open technical reliability', actionRoute: '/technical?section=parts' });
  }
  if (averageSetup != null && averageSetup < 55) {
    const weakest = snapshots.map((snapshot) => ({ snapshot, score: snapshot.teams.find((team) => team.teamId === state.selectedTeamId)?.averageSetupQuality })).filter((row) => row.score != null).sort((a, b) => a.score! - b.score!)[0];
    findings.push({ id: 'setup', title: 'Setup fit is below the useful baseline', conclusion: 'Stored setup breakdowns show that the cars are not consistently matching circuit demands.', evidence: [`Average setup effectiveness is ${Math.round(averageSetup)}/100.`, weakest ? `${weakest.snapshot.trackName} was the weakest recorded fit at ${Math.round(weakest.score!)}/100.` : 'More setup snapshots are required.'], confidence: confidenceForCount(setupEntries.length), trend: directionTrend(setupEntries.map((entry) => entry.setupQuality!)), actionLabel: 'Open car setup', actionRoute: '/weekend' });
  }
  if (findings.length === 0 && snapshots.length > 0) {
    const strongest = trackRows(snapshots, state.selectedTeamId).sort((a, b) => b.points - a.points)[0];
    findings.push({ id: 'baseline', title: 'No major weakness is proven yet', conclusion: 'Current evidence does not support a strong negative conclusion. Continue building the sample before making a large change.', evidence: [strongest ? `${strongest.archetype}: ${strongest.points} points across ${strongest.races} race${strongest.races === 1 ? '' : 's'}.` : 'Track-type evidence is still limited.', `${snapshots.length} race snapshot${snapshots.length === 1 ? '' : 's'} available.`], confidence: confidenceForCount(snapshots.length), trend: 'Building baseline', actionLabel: 'Review driver development', actionRoute: '/curves' });
  }

  return {
    raceCount: snapshots.length,
    telemetryRaceCount,
    metrics,
    findings,
    drivers: driverRows(snapshots, state.selectedTeamId),
    tracks: trackRows(snapshots, state.selectedTeamId),
    rival: buildRival(snapshots, state.selectedTeamId, rivalTeamId),
    latestRaceId: snapshots.at(-1)?.raceId,
  };
}
