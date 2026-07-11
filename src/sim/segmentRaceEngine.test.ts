import { describe, expect, it } from 'vitest';
import type { CircuitSegmentSet } from '../types/circuitTypes';
import type { LiveCarState } from '../types/liveTypes';
import { advanceCarPositionThroughSegments, applyDistanceBasedTrafficState, classifyCarsByDistance, createInitialCarPositionState } from './segmentRaceEngine';

const circuit: CircuitSegmentSet = {
  id: 'tiny',
  trackId: 'tiny',
  trackName: 'Tiny Test Circuit',
  lapLengthMeters: 1000,
  baselineLapTimeSeconds: 100,
  sectors: 3,
  inferred: false,
  source: 'authored',
  segments: [
    segment(0, 0, 0.25, 250, 25, 'StartFinish'),
    segment(1, 0.25, 0.5, 250, 25, 'Straight', 'Sector1'),
    segment(2, 0.5, 0.75, 250, 25, 'Straight', 'Sector2'),
    segment(3, 0.75, 1, 250, 25, 'Straight'),
  ],
};

describe('segment race engine', () => {
  it('advances authoritative distance without requiring a completed lap', () => {
    const result = advanceCarPositionThroughSegments(createInitialCarPositionState(), circuit, 10);
    expect(result.position.completedLaps).toBe(0);
    expect(result.position.currentSegmentIndex).toBe(0);
    expect(result.position.progressWithinSegment).toBeCloseTo(0.4);
    expect(result.position.totalRaceDistanceMeters).toBeCloseTo(100);
    expect(result.position.normalizedLapProgress).toBeCloseTo(0.1);
    expect(result.events).toHaveLength(0);
  });

  it('records sector and finish-line crossings from segment traversal', () => {
    const result = advanceCarPositionThroughSegments(createInitialCarPositionState(), circuit, 100);
    expect(result.position.completedLaps).toBe(1);
    expect(result.position.currentSegmentIndex).toBe(0);
    expect(result.events.map((event) => event.type)).toEqual(['Sector', 'Sector', 'Lap']);
    expect(result.events.at(-1)).toMatchObject({ type: 'Lap', lap: 1, lapTime: 100 });
  });

  it('classifies running cars by authoritative distance before total time', () => {
    const leader = car('leader', 90, 900);
    const chaser = car('chaser', 80, 950);
    expect(classifyCarsByDistance([leader, chaser]).map((c) => c.driverId)).toEqual(['chaser', 'leader']);
  });

  it('detects traffic from authoritative distance rather than timing interval', () => {
    const leader = car('leader', 90, 1000);
    const chaser = car('chaser', 200, 940);
    chaser.interval = 12;

    const updated = applyDistanceBasedTrafficState([leader, chaser]);
    expect(updated[0]?.positionState).toMatchObject({
      distanceToCarAheadMeters: null,
      distanceToCarBehindMeters: 60,
      trafficPhase: 'ClearAir',
    });
    expect(updated[1]?.positionState).toMatchObject({
      distanceToCarAheadMeters: 60,
      distanceToCarBehindMeters: null,
      trafficPhase: 'InDirtyAir',
    });
  });

  it('marks attack and defence phases from distance-based pressure', () => {
    const leader = car('leader', 90, 1000);
    leader.paceMode = 'Defend';
    const chaser = car('chaser', 91, 950);
    chaser.paceMode = 'Attack';

    const updated = applyDistanceBasedTrafficState([leader, chaser]);
    expect(updated[0]?.positionState?.trafficPhase).toBe('Defending');
    expect(updated[1]?.positionState?.trafficPhase).toBe('Attacking');
  });
});

function segment(
  index: number,
  startProgress: number,
  endProgress: number,
  lengthMeters: number,
  representativeTimeSeconds: number,
  type: CircuitSegmentSet['segments'][number]['type'],
  timingLine?: CircuitSegmentSet['segments'][number]['timingLine'],
): CircuitSegmentSet['segments'][number] {
  return {
    id: `seg-${index}`,
    index,
    name: `Segment ${index}`,
    startProgress,
    endProgress,
    lengthMeters,
    type,
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
    sector: 1,
    timingLine,
  };
}

function car(driverId: string, totalTime: number, totalRaceDistanceMeters: number): LiveCarState {
  return {
    driverId,
    teamId: 'team',
    isPlayer: false,
    grid: 1,
    position: 1,
    totalTime,
    gapToLeader: 0,
    interval: 0,
    lastLapTime: 0,
    bestLap: null,
    lapsCompleted: 0,
    running: true,
    status: 'Finished',
    retiredOnLap: null,
    paceRating: 0,
    baseRacePace: 0,
    baseFailureRisk: 0,
    baseCrashRisk: 0,
    baseMistakeRisk: 0,
    tireDegRate: 0,
    pitLossBase: 0,
    opsForm: 0,
    personality: 'Balanced',
    strategyId: 's',
    instructionId: 'i',
    paceMode: 'Balanced',
    strategyStint: { mode: 'Balanced', previousMode: null, startedLap: 0, consecutiveLaps: 1, source: 'initial', lastChangedLap: 0, warned: false },
    liveRacePace: 0,
    tire: { compound: 'Dry', age: 0, wear: 0, stintTarget: 10 },
    pit: { plannedStops: 0, stopsMade: 0, scheduledLaps: [], lastPitLap: null, inPitThisLap: false, window: null, pitRequested: false, planStatus: 'completed', planCancelled: false, lastWindowPromptLap: null },
    reliabilityIssue: null,
    reliabilityRisk: 0,
    crashRisk: 0,
    damaged: false,
    fuel: 100,
    engineHealth: 100,
    gearboxHealth: 100,
    brakeHealth: 100,
    lastSectors: null,
    bestSectors: null,
    reliabilityRiskLevel: 'Low',
    crashRiskLevel: 'Low',
    trafficStatus: 'Clear',
    statusMessage: '',
    positionState: { ...createInitialCarPositionState(), totalRaceDistanceMeters },
  };
}
