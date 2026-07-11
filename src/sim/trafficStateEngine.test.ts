import { describe, expect, it } from 'vitest';
import type { CircuitSegmentSet } from '../types/circuitTypes';
import type { LiveCarState } from '../types/liveTypes';
import { createInitialCarPositionState } from './segmentRaceEngine';
import { calculateDistanceGaps, updateTrafficStatesForCars } from './trafficStateEngine';

describe('traffic state engine', () => {
  it('calculates gaps from authoritative distance and ignores retired cars', () => {
    const gaps = calculateDistanceGaps([car('leader', 1000), car('retired', 980, false), car('chaser', 940)]);
    expect(gaps.get('leader')).toMatchObject({ distanceToCarBehindMeters: 60, carBehindId: 'chaser' });
    expect(gaps.get('chaser')).toMatchObject({ distanceToCarAheadMeters: 60, carAheadId: 'leader' });
    expect(gaps.has('retired')).toBe(false);
  });

  it.each([
    ['dirty air', segment({ dirtyAirSeverity: 0.8 }), 60, 'InDirtyAir'],
    ['drafting', segment({ draftStrength: 0.8, type: 'Straight' }), 60, 'Drafting'],
    ['attacking', segment({ overtakingEligible: true, sideBySideCapacity: 2, type: 'OvertakingZone' }), 25, 'Attacking'],
    ['following', segment({}), 60, 'Following'],
  ] as const)('classifies %s using current segment metadata', (_label, activeSegment, gap, expected) => {
    const circuit = circuitWith(activeSegment);
    const updated = updateTrafficStatesForCars([car('leader', 1000), car('chaser', 1000 - gap)], circuit);
    expect(updated[1]?.positionState?.trafficPhase).toBe(expected);
  });

  it('does not attack on a non-overtaking segment or before physical catch range', () => {
    const nonPassing = updateTrafficStatesForCars([car('leader', 1000), car('chaser', 975)], circuitWith(segment({})));
    const tooFar = updateTrafficStatesForCars([
      car('leader', 1000),
      car('chaser', 950),
    ], circuitWith(segment({ overtakingEligible: true, sideBySideCapacity: 2 })));
    expect(nonPassing[1]?.positionState?.trafficPhase).toBe('Following');
    expect(tooFar[1]?.positionState?.trafficPhase).toBe('Following');
  });

  it('is deterministic regardless of input order', () => {
    const circuit = circuitWith(segment({ draftStrength: 0.8 }));
    const a = updateTrafficStatesForCars([car('leader', 1000), car('chaser', 940)], circuit);
    const b = updateTrafficStatesForCars([car('chaser', 940), car('leader', 1000)], circuit);
    expect(Object.fromEntries(a.map((c) => [c.driverId, c.positionState]))).toEqual(
      Object.fromEntries(b.map((c) => [c.driverId, c.positionState])),
    );
  });
});

function circuitWith(activeSegment: CircuitSegmentSet['segments'][number]): CircuitSegmentSet {
  return { id: 'c', trackId: 'c', trackName: 'Circuit', lapLengthMeters: 1000, baselineLapTimeSeconds: 100, sectors: 3, inferred: false, source: 'authored', segments: [activeSegment] };
}

function segment(overrides: Partial<CircuitSegmentSet['segments'][number]>): CircuitSegmentSet['segments'][number] {
  return { id: 's', index: 0, name: 'Segment', startProgress: 0, endProgress: 1, lengthMeters: 1000, type: 'MediumCorner', representativeTimeSeconds: 100, powerSensitivity: 0, aeroSensitivity: 0, mechanicalGripSensitivity: 0, brakingSensitivity: 0, driverSkillSensitivity: 0, tyreStress: 0, brakeStress: 0, fuelDemand: 0, overtakingEligible: false, overtakingDifficulty: 1, sideBySideCapacity: 1, dirtyAirSeverity: 0, draftStrength: 0, wallProximity: 0, incidentRisk: 0, wetWeatherSensitivity: 0, localYellowApplies: true, sector: 1, ...overrides };
}

function car(driverId: string, distance: number, running = true): LiveCarState {
  return {
    driverId, teamId: 'team', isPlayer: false, grid: 1, position: 1, totalTime: 0, gapToLeader: 0, interval: 0,
    lastLapTime: 0, bestLap: null, lapsCompleted: 0, running, status: running ? 'Finished' : 'DNF', retiredOnLap: running ? null : 1,
    paceRating: 0, baseRacePace: 0, baseFailureRisk: 0, baseCrashRisk: 0, baseMistakeRisk: 0, tireDegRate: 0, pitLossBase: 0,
    opsForm: 0, personality: 'Balanced', strategyId: 's', instructionId: 'i', paceMode: 'Balanced',
    strategyStint: { mode: 'Balanced', previousMode: null, startedLap: 0, consecutiveLaps: 1, source: 'initial', lastChangedLap: 0, warned: false },
    liveRacePace: 0, tire: { compound: 'Dry', age: 0, wear: 0, stintTarget: 10 },
    pit: { plannedStops: 0, stopsMade: 0, scheduledLaps: [], lastPitLap: null, inPitThisLap: false, window: null, pitRequested: false, planStatus: 'completed', planCancelled: false, lastWindowPromptLap: null },
    reliabilityIssue: null, reliabilityRisk: 0, crashRisk: 0, damaged: false, fuel: 100, engineHealth: 100, gearboxHealth: 100, brakeHealth: 100,
    lastSectors: null, bestSectors: null, reliabilityRiskLevel: 'Low', crashRiskLevel: 'Low', trafficStatus: 'Clear', statusMessage: '',
    positionState: { ...createInitialCarPositionState(), totalRaceDistanceMeters: distance },
  };
}
