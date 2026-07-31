import type { CircuitSegmentSet } from '../types/circuitTypes';
import { LIVE_PACE_K } from './liveRacePace';

export function estimateLapTimeFromLivePace(referenceLapSeconds: number, liveRacePace: number): number {
  return referenceLapSeconds - liveRacePace * LIVE_PACE_K;
}

export function splitLapIntoCircuitSectorTimes(
  lapTimeSeconds: number,
  circuit: CircuitSegmentSet,
  setupLossWeights?: [number, number, number],
): [number, number, number] {
  const sectorBaselines: [number, number, number] = [0, 0, 0];
  for (const segment of circuit.segments) {
    sectorBaselines[segment.sector - 1] += segment.representativeTimeSeconds;
  }
  const totalBaseline = sectorBaselines.reduce((sum, seconds) => sum + seconds, 0);
  if (totalBaseline <= 0) return splitEvenly(lapTimeSeconds);

  const baselineWeights = sectorBaselines.map((seconds) => seconds / totalBaseline) as [number, number, number];
  const weights = setupLossWeights
    ? normalizeWeights(baselineWeights.map((weight, index) => (
      weight * 0.82 + setupLossWeights[index] * 0.18
    )) as [number, number, number])
    : baselineWeights;
  const s1 = round3(lapTimeSeconds * weights[0]);
  const s2 = round3(lapTimeSeconds * weights[1]);
  const s3 = round3(lapTimeSeconds - s1 - s2);
  return [s1, s2, s3];
}

function normalizeWeights(weights: [number, number, number]): [number, number, number] {
  const total = weights.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (total <= 0) return [1 / 3, 1 / 3, 1 / 3];
  return weights.map((value) => Math.max(0, value) / total) as [number, number, number];
}

function splitEvenly(lapTimeSeconds: number): [number, number, number] {
  const s1 = round3(lapTimeSeconds / 3);
  const s2 = round3(lapTimeSeconds / 3);
  return [s1, s2, round3(lapTimeSeconds - s1 - s2)];
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
