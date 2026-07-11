import { describe, expect, it } from 'vitest';
import type { CircuitSegmentSet } from '../types/circuitTypes';
import { estimateLapTimeFromLivePace, splitLapIntoCircuitSectorTimes } from './segmentPaceEngine';

describe('segment pace engine', () => {
  it('preserves the existing live pace to lap-time relationship', () => {
    expect(estimateLapTimeFromLivePace(90, 5)).toBe(81);
  });

  it('splits lap time by circuit sector baselines while preserving total time', () => {
    const circuit: CircuitSegmentSet = {
      id: 'weighted',
      trackId: 'weighted',
      trackName: 'Weighted Circuit',
      lapLengthMeters: 3000,
      baselineLapTimeSeconds: 90,
      sectors: 3,
      inferred: false,
      source: 'authored',
      segments: [
        segment(0, 1, 20),
        segment(1, 2, 30),
        segment(2, 3, 40),
      ],
    };

    const sectors = splitLapIntoCircuitSectorTimes(90, circuit);
    expect(sectors).toEqual([20, 30, 40]);
    expect(sectors.reduce((sum, seconds) => sum + seconds, 0)).toBe(90);
  });
});

function segment(index: number, sector: 1 | 2 | 3, representativeTimeSeconds: number): CircuitSegmentSet['segments'][number] {
  return {
    id: `seg-${index}`,
    index,
    name: `Segment ${index}`,
    startProgress: index / 3,
    endProgress: (index + 1) / 3,
    lengthMeters: 1000,
    type: index === 0 ? 'StartFinish' : 'Straight',
    representativeTimeSeconds,
    powerSensitivity: 0,
    aeroSensitivity: 0,
    mechanicalGripSensitivity: 0,
    brakingSensitivity: 0,
    driverSkillSensitivity: 0,
    tyreStress: 0,
    brakeStress: 0,
    fuelDemand: 0,
    overtakingEligible: false,
    overtakingDifficulty: 1,
    sideBySideCapacity: 1,
    dirtyAirSeverity: 0,
    draftStrength: 0,
    wallProximity: 0,
    incidentRisk: 0,
    wetWeatherSensitivity: 0,
    localYellowApplies: true,
    sector,
  };
}
