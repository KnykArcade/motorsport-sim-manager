import type { CircuitSegment, CircuitSegmentSet } from '../types/circuitTypes';
import type { LiveCarState } from '../types/liveTypes';
import type { TrafficPhase } from '../types/positionTypes';

export type TrafficStateOptions = {
  followingRangeMeters?: number;
  dirtyAirRangeMeters?: number;
  draftingRangeMeters?: number;
  attackRangeMeters?: number;
};

export type DistanceGap = {
  distanceToCarAheadMeters: number | null;
  distanceToCarBehindMeters: number | null;
  carAheadId: string | null;
  carBehindId: string | null;
};

const DEFAULTS: Required<TrafficStateOptions> = {
  followingRangeMeters: 180,
  dirtyAirRangeMeters: 100,
  draftingRangeMeters: 120,
  attackRangeMeters: 35,
};

export function calculateDistanceGaps(cars: readonly LiveCarState[]): Map<string, DistanceGap> {
  const running = cars
    .filter((car) => car.running && car.positionState)
    .sort((a, b) => {
      const delta = b.positionState!.totalRaceDistanceMeters - a.positionState!.totalRaceDistanceMeters;
      return delta || a.driverId.localeCompare(b.driverId);
    });
  const result = new Map<string, DistanceGap>();
  running.forEach((car, index) => {
    const ahead = running[index - 1] ?? null;
    const behind = running[index + 1] ?? null;
    const distance = car.positionState!.totalRaceDistanceMeters;
    result.set(car.driverId, {
      distanceToCarAheadMeters: ahead ? Math.max(0, ahead.positionState!.totalRaceDistanceMeters - distance) : null,
      distanceToCarBehindMeters: behind ? Math.max(0, distance - behind.positionState!.totalRaceDistanceMeters) : null,
      carAheadId: ahead?.driverId ?? null,
      carBehindId: behind?.driverId ?? null,
    });
  });
  return result;
}

export function evaluateTrafficPhase(
  car: LiveCarState,
  segment: CircuitSegment,
  gapMeters: number | null,
  options: TrafficStateOptions = {},
): TrafficPhase {
  if (!car.running) return 'Retired';
  if (gapMeters == null) return 'ClearAir';
  const limits = { ...DEFAULTS, ...options };
  if (
    gapMeters <= limits.attackRangeMeters
    && segment.overtakingEligible
    && segment.sideBySideCapacity >= 2
  ) return 'Attacking';
  if (gapMeters <= limits.draftingRangeMeters && segment.draftStrength > 0.15) return 'Drafting';
  if (gapMeters <= limits.dirtyAirRangeMeters && segment.dirtyAirSeverity > 0.15) return 'InDirtyAir';
  if (gapMeters <= limits.followingRangeMeters) return 'Following';
  return 'ClearAir';
}

export function updateTrafficStatesForCars(
  cars: readonly LiveCarState[],
  circuit?: CircuitSegmentSet,
  options: TrafficStateOptions = {},
): LiveCarState[] {
  const gaps = calculateDistanceGaps(cars);
  const byId = new Map(cars.map((car) => [car.driverId, car]));
  return cars.map((car) => {
    if (!car.positionState) return car;
    if (!car.running) {
      return { ...car, positionState: { ...car.positionState, trafficPhase: 'Retired' } };
    }
    const gap = gaps.get(car.driverId);
    const segment = circuit?.segments[car.positionState.currentSegmentIndex];
    const phase = segment
      ? evaluateTrafficPhase(car, segment, gap?.distanceToCarAheadMeters ?? null, options)
      : fallbackTrafficPhase(car, gap?.distanceToCarAheadMeters ?? null, gap?.distanceToCarBehindMeters ?? null, options);
    const behind = gap?.carBehindId ? byId.get(gap.carBehindId) : null;
    const defending = phase === 'ClearAir'
      && car.paceMode === 'Defend'
      && behind?.running
      && (gap?.distanceToCarBehindMeters ?? Infinity) <= ({ ...DEFAULTS, ...options }).followingRangeMeters;
    return {
      ...car,
      positionState: {
        ...car.positionState,
        distanceToCarAheadMeters: gap?.distanceToCarAheadMeters ?? null,
        distanceToCarBehindMeters: gap?.distanceToCarBehindMeters ?? null,
        trafficPhase: defending ? 'Defending' : phase,
      },
    };
  });
}

function fallbackTrafficPhase(
  car: LiveCarState,
  ahead: number | null,
  behind: number | null,
  options: TrafficStateOptions,
): TrafficPhase {
  const limits = { ...DEFAULTS, ...options };
  if (ahead != null && ahead <= limits.attackRangeMeters && car.paceMode === 'Attack') return 'Attacking';
  if (ahead != null && ahead <= limits.dirtyAirRangeMeters) return 'InDirtyAir';
  if (behind != null && behind <= limits.followingRangeMeters && car.paceMode === 'Defend') return 'Defending';
  if (ahead != null && ahead <= limits.followingRangeMeters) return 'Following';
  return 'ClearAir';
}
