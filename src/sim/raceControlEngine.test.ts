import { describe, expect, it } from 'vitest';
import { selectRaceRuleProfile } from '../data/rules/raceRuleProfiles';
import { applyRaceControlQueueCatchUp, initialRaceControlState, stepRaceControlState } from './raceControlEngine';
import type { CircuitSegmentSet } from '../types/circuitTypes';
import type { LiveCarState } from '../types/liveTypes';
import { createInitialCarPositionState } from './segmentRaceEngine';

describe('race control state engine', () => {
  it('uses SafetyCar for F1 and PaceCar for NASCAR', () => {
    const transition = { safetyCar: { active: true, lapsRemaining: 3, deployedOnLap: 5, reason: 'Incident', deployments: 1 }, justDeployed: true, justEnded: false };
    const f1 = selectRaceRuleProfile('F1', 1995);
    const nascar = selectRaceRuleProfile('NASCAR', 2026);
    expect(stepRaceControlState(initialRaceControlState(f1), transition, f1, 5).mode).toBe('SafetyCar');
    expect(stepRaceControlState(initialRaceControlState(nascar), transition, nascar, 5).mode).toBe('PaceCar');
  });

  it('moves through a restart state before returning green', () => {
    const profile = selectRaceRuleProfile('F1', 1995);
    const active = { ...initialRaceControlState(profile), mode: 'SafetyCar' as const };
    const ended = stepRaceControlState(active, { safetyCar: { active: false, lapsRemaining: 0, deployedOnLap: 4, reason: 'Incident', deployments: 1 }, justDeployed: false, justEnded: true }, profile, 7);
    expect(ended.mode).toBe('GreenFlagRestart');
    expect(stepRaceControlState(ended, { safetyCar: { active: false, lapsRemaining: 0, deployedOnLap: 4, reason: 'Incident', deployments: 1 }, justDeployed: false, justEnded: false }, profile, 8).mode).toBe('Green');
  });

  it('finishes explicitly', () => {
    const initial = initialRaceControlState();
    const transition = { safetyCar: { active: false, lapsRemaining: 0, deployedOnLap: null, reason: null, deployments: 0 }, justDeployed: false, justEnded: false };
    expect(stepRaceControlState(initial, transition, undefined, 10, true).mode).toBe('Finished');
  });

  it('closes the field progressively without overtaking or teleporting', () => {
    const cars = [car('leader', 1000), car('second', 900), car('third', 700)];
    const first = applyRaceControlQueueCatchUp(cars, circuit, 'SafetyCar', 1, { targetGapMeters: 12, catchUpSpeedMetersPerSecond: 8 });
    expect(first.cars.map((candidate) => candidate.driverId)).toEqual(['leader', 'second', 'third']);
    expect(first.cars[1]!.positionState!.totalRaceDistanceMeters).toBe(908);
    expect(first.cars[2]!.positionState!.totalRaceDistanceMeters).toBe(708);
    expect(first.queueFormed).toBe(false);
  });

  it('forms a queue over repeated elapsed steps and stops under green', () => {
    let cars = [car('leader', 1000), car('second', 900)];
    let formed = false;
    for (let tick = 0; tick < 20 && !formed; tick++) {
      const result = applyRaceControlQueueCatchUp(cars, circuit, 'PaceCar', 1);
      cars = result.cars;
      formed = result.queueFormed;
    }
    expect(formed).toBe(true);
    expect(cars[0]!.positionState!.totalRaceDistanceMeters - cars[1]!.positionState!.totalRaceDistanceMeters).toBeCloseTo(12);
    expect(applyRaceControlQueueCatchUp(cars, circuit, 'Green', 10).cars).toEqual(cars);
  });
});

const circuit: CircuitSegmentSet = {
  id: 'queue', trackId: 'queue', trackName: 'Queue', lapLengthMeters: 1000,
  baselineLapTimeSeconds: 100, sectors: 3, inferred: false, source: 'authored',
  segments: [{ id: 's', index: 0, name: 'Track', startProgress: 0, endProgress: 1, lengthMeters: 1000, type: 'Straight', representativeTimeSeconds: 100, powerSensitivity: 0, aeroSensitivity: 0, mechanicalGripSensitivity: 0, brakingSensitivity: 0, driverSkillSensitivity: 0, tyreStress: 0, brakeStress: 0, fuelDemand: 0, overtakingEligible: true, overtakingDifficulty: 0, sideBySideCapacity: 2, dirtyAirSeverity: 0, draftStrength: 0, wallProximity: 0, incidentRisk: 0, wetWeatherSensitivity: 0, localYellowApplies: true, sector: 1 }],
};

function car(driverId: string, distance: number): LiveCarState {
  return {
    driverId, running: true, totalTime: 0,
    pit: { inPitThisLap: false },
    positionState: { ...createInitialCarPositionState(), totalRaceDistanceMeters: distance },
  } as LiveCarState;
}
