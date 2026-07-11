import type { CircuitSegmentSet } from '../types/circuitTypes';
import type { LiveCarState, LiveRaceState } from '../types/liveTypes';
import type { CarPositionState, TrackLane, TrafficPhase } from '../types/positionTypes';
import { applyFinishLineCrossing, applySectorCrossing, createInitialTimingState, type TimingCrossingEvent } from './timingLineEngine';
import { updateTrafficStatesForCars } from './trafficStateEngine';

export const DEFAULT_FIXED_STEP_SECONDS = 1;
export type SegmentAdvanceResult = {
  position: CarPositionState;
  events: TimingCrossingEvent[];
};

export function createInitialCarPositionState(options: {
  raceTimeSeconds?: number;
  lane?: TrackLane;
  trafficPhase?: TrafficPhase;
} = {}): CarPositionState {
  const raceTimeSeconds = options.raceTimeSeconds ?? 0;
  return {
    completedLaps: 0,
    currentSegmentIndex: 0,
    progressWithinSegment: 0,
    totalRaceDistanceMeters: 0,
    normalizedLapProgress: 0,
    authoritativeRaceTime: raceTimeSeconds,
    currentSpeedMetersPerSecond: 0,
    lane: options.lane ?? 'RacingLine',
    trafficPhase: options.trafficPhase ?? 'ClearAir',
    distanceToCarAheadMeters: null,
    distanceToCarBehindMeters: null,
    timing: createInitialTimingState(raceTimeSeconds),
  };
}

export function advanceCarPositionThroughSegments(
  position: CarPositionState,
  circuit: CircuitSegmentSet,
  elapsedSeconds: number,
  traversalPaceMultiplier = 1,
): SegmentAdvanceResult {
  if (elapsedSeconds <= 0 || circuit.segments.length === 0) {
    return { position, events: [] };
  }

  let next = { ...position, timing: { ...position.timing } };
  let remainingSeconds = elapsedSeconds;
  const events: TimingCrossingEvent[] = [];
  let lastSpeed = next.currentSpeedMetersPerSecond;

  while (remainingSeconds > 1e-9) {
    const segment = circuit.segments[next.currentSegmentIndex] ?? circuit.segments[0];
    const segmentTime = Math.max(0.001, segment.representativeTimeSeconds / Math.max(0.05, traversalPaceMultiplier));
    const remainingProgress = Math.max(0, 1 - next.progressWithinSegment);
    const timeToBoundary = remainingProgress * segmentTime;

    if (remainingSeconds + 1e-9 < timeToBoundary) {
      const progressDelta = remainingSeconds / segmentTime;
      const distanceDelta = segment.lengthMeters * progressDelta;
      lastSpeed = distanceDelta / remainingSeconds;
      next = updatePositionWithinSegment(next, circuit, progressDelta, distanceDelta, remainingSeconds, lastSpeed);
      break;
    }

    const consumed = Math.max(0, timeToBoundary);
    const distanceDelta = segment.lengthMeters * remainingProgress;
    lastSpeed = consumed > 0 ? distanceDelta / consumed : segment.lengthMeters / segmentTime;
    const crossingTime = next.authoritativeRaceTime + consumed;
    next = updatePositionWithinSegment(next, circuit, remainingProgress, distanceDelta, consumed, lastSpeed);

    if (segment.timingLine === 'Sector1' || segment.timingLine === 'Sector2') {
      const sector = segment.timingLine === 'Sector1' ? 1 : 2;
      const result = applySectorCrossing(next.timing, sector, crossingTime);
      next = { ...next, timing: result.timing };
      events.push(result.event);
    }

    const nextSegmentIndex = next.currentSegmentIndex + 1;
    if (nextSegmentIndex >= circuit.segments.length) {
      const completedLap = next.completedLaps + 1;
      const result = applyFinishLineCrossing(next.timing, completedLap, crossingTime);
      next = {
        ...next,
        completedLaps: completedLap,
        currentSegmentIndex: 0,
        progressWithinSegment: 0,
        normalizedLapProgress: 0,
        timing: result.timing,
      };
      events.push(result.event);
    } else {
      next = { ...next, currentSegmentIndex: nextSegmentIndex, progressWithinSegment: 0 };
    }

    remainingSeconds -= consumed;
    if (consumed === 0) break;
  }

  return { position: { ...next, currentSpeedMetersPerSecond: round3(lastSpeed) }, events };
}

export function advanceLiveRaceSegmentClock(state: LiveRaceState, elapsedSeconds: number, circuit = state.circuit): LiveRaceState {
  if (!circuit || elapsedSeconds <= 0) return state;
  const simulationClockSeconds = round3((state.simulationClockSeconds ?? 0) + elapsedSeconds);
  const cars = state.cars.map((car) => {
    if (!car.running) return car;
    const result = advanceCarPositionThroughSegments(
      car.positionState ?? createInitialCarPositionState({ raceTimeSeconds: state.simulationClockSeconds ?? 0 }),
      circuit,
      elapsedSeconds,
    );
    return applyPositionToLegacyCarFields(car, result.position, result.events);
  });

  const ordered = updateTrafficStatesForCars(classifyCarsByDistance(cars), circuit);
  ordered.forEach((car, index) => {
    if (car.running) car.position = index + 1;
  });

  return {
    ...state,
    simulationClockSeconds,
    currentLap: Math.max(state.currentLap, Math.max(0, ...ordered.map((car) => car.positionState?.completedLaps ?? car.lapsCompleted))),
    cars: ordered,
  };
}

export function classifyCarsByDistance(cars: readonly LiveCarState[]): LiveCarState[] {
  return [...cars].sort((a, b) => {
    if (a.running !== b.running) return a.running ? -1 : 1;
    const distanceA = a.positionState?.totalRaceDistanceMeters ?? a.lapsCompleted;
    const distanceB = b.positionState?.totalRaceDistanceMeters ?? b.lapsCompleted;
    if (distanceA !== distanceB) return distanceB - distanceA;
    return a.totalTime - b.totalTime;
  });
}

export function applyPositionToLegacyCarFields(
  car: LiveCarState,
  positionState: CarPositionState,
  crossingEvents: readonly TimingCrossingEvent[],
): LiveCarState {
  const lapEvent = [...crossingEvents].reverse().find((event): event is Extract<TimingCrossingEvent, { type: 'Lap' }> => event.type === 'Lap');
  const sectorEvents = crossingEvents.filter((event): event is Extract<TimingCrossingEvent, { type: 'Sector' }> => event.type === 'Sector');
  const lastSectorTimes: [number, number, number] = car.lastSectors ? [...car.lastSectors] : [0, 0, 0];

  for (const event of sectorEvents) {
    lastSectorTimes[event.sector - 1] = event.sectorTime;
  }
  if (lapEvent) {
    lastSectorTimes[2] = lapEvent.sectorTime;
  }

  const completedLapSectors: [number, number, number] | null = lapEvent ? lastSectorTimes : car.lastSectors;
  return {
    ...car,
    positionState,
    lapsCompleted: positionState.completedLaps,
    currentSector: sectorFromProgress(positionState.normalizedLapProgress),
    sectorProgress: positionState.progressWithinSegment,
    totalTime: positionState.authoritativeRaceTime,
    lastLapTime: lapEvent?.lapTime ?? car.lastLapTime,
    bestLap: lapEvent ? (car.bestLap == null ? lapEvent.lapTime : Math.min(car.bestLap, lapEvent.lapTime)) : car.bestLap,
    lastSectors: completedLapSectors,
    bestSectors: lapEvent && (car.bestLap == null || lapEvent.lapTime <= car.bestLap) ? completedLapSectors : car.bestSectors,
  };
}

function updatePositionWithinSegment(
  position: CarPositionState,
  circuit: CircuitSegmentSet,
  progressDelta: number,
  distanceDelta: number,
  elapsedSeconds: number,
  speedMetersPerSecond: number,
): CarPositionState {
  const totalRaceDistanceMeters = round3(position.totalRaceDistanceMeters + distanceDelta);
  return {
    ...position,
    progressWithinSegment: Math.min(1, round6(position.progressWithinSegment + progressDelta)),
    totalRaceDistanceMeters,
    normalizedLapProgress: round6((totalRaceDistanceMeters % circuit.lapLengthMeters) / circuit.lapLengthMeters),
    authoritativeRaceTime: round3(position.authoritativeRaceTime + elapsedSeconds),
    currentSpeedMetersPerSecond: round3(speedMetersPerSecond),
  };
}

export function repositionCarAtRaceDistance(
  position: CarPositionState,
  totalRaceDistanceMeters: number,
  circuit: CircuitSegmentSet,
): CarPositionState {
  const completedLaps = Math.floor(totalRaceDistanceMeters / circuit.lapLengthMeters);
  const lapDistance = totalRaceDistanceMeters - completedLaps * circuit.lapLengthMeters;
  let accumulated = 0;
  let currentSegmentIndex = Math.max(0, circuit.segments.length - 1);
  let progressWithinSegment = 1;
  for (const segment of circuit.segments) {
    if (lapDistance <= accumulated + segment.lengthMeters) {
      currentSegmentIndex = segment.index;
      progressWithinSegment = segment.lengthMeters > 0 ? (lapDistance - accumulated) / segment.lengthMeters : 0;
      break;
    }
    accumulated += segment.lengthMeters;
  }
  return {
    ...position,
    completedLaps,
    currentSegmentIndex,
    progressWithinSegment: Math.max(0, Math.min(1, progressWithinSegment)),
    totalRaceDistanceMeters,
    normalizedLapProgress: circuit.lapLengthMeters > 0 ? lapDistance / circuit.lapLengthMeters : 0,
  };
}

function sectorFromProgress(progress: number): 0 | 1 | 2 | 3 {
  if (progress <= 0) return 0;
  if (progress < 1 / 3) return 1;
  if (progress < 2 / 3) return 2;
  return 3;
}

function round3(value: number): number { return Math.round(value * 1000) / 1000; }
function round6(value: number): number { return Math.round(value * 1000000) / 1000000; }

// Kept as a compatibility export while callers migrate to trafficStateEngine.
export { updateTrafficStatesForCars as applyDistanceBasedTrafficState } from './trafficStateEngine';
