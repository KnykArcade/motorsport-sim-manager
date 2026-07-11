import type { CircuitSegmentSet } from '../types/circuitTypes';
import { LIVE_PACE_K } from './liveRacePace';

export function estimateLapTimeFromLivePace(referenceLapSeconds: number, liveRacePace: number): number {
  return referenceLapSeconds - liveRacePace * LIVE_PACE_K;
}

export function splitLapIntoCircuitSectorTimes(lapTimeSeconds: number, circuit: CircuitSegmentSet): [number, number, number] {
  const sectorBaselines: [number, number, number] = [0, 0, 0];
  for (const segment of circuit.segments) {
    sectorBaselines[segment.sector - 1] += segment.representativeTimeSeconds;
  }
  const totalBaseline = sectorBaselines.reduce((sum, seconds) => sum + seconds, 0);
  if (totalBaseline <= 0) return splitEvenly(lapTimeSeconds);

  const s1 = round3(lapTimeSeconds * (sectorBaselines[0] / totalBaseline));
  const s2 = round3(lapTimeSeconds * (sectorBaselines[1] / totalBaseline));
  const s3 = round3(lapTimeSeconds - s1 - s2);
  return [s1, s2, s3];
}

function splitEvenly(lapTimeSeconds: number): [number, number, number] {
  const s1 = round3(lapTimeSeconds / 3);
  const s2 = round3(lapTimeSeconds / 3);
  return [s1, s2, round3(lapTimeSeconds - s1 - s2)];
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
