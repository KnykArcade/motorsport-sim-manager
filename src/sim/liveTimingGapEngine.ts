import type { CircuitSegmentSet } from '../types/circuitTypes';
import type { LiveCarState } from '../types/liveTypes';
import type { TimingCrossingState } from '../types/positionTypes';

const LINE_KEYS = ['Sector1', 'Sector2', 'Finish'] as const;

export function updateLiveTimingGaps(
  orderedCars: readonly LiveCarState[],
  circuit?: CircuitSegmentSet,
): LiveCarState[] {
  const running = orderedCars.filter((car) => car.running);
  const leader = running[0];
  if (!leader) return [...orderedCars];
  const referenceSpeed = circuit
    ? Math.max(1, circuit.lapLengthMeters / Math.max(1, circuit.baselineLapTimeSeconds))
    : null;

  const updated = new Map<string, LiveCarState>();
  let previousUpdated: LiveCarState | null = null;
  running.forEach((car, index) => {
    const ahead = index > 0 ? running[index - 1]! : null;
    const lapsBehindLeader = lapDeficit(leader, car);
    const lapsBehindCarAhead = ahead ? lapDeficit(ahead, car) : 0;
    const rawLeaderGap = index === 0 ? 0 : timingGapSeconds(car, leader, referenceSpeed, car.gapToLeader);
    const gapToLeader = previousUpdated && lapsBehindLeader === (previousUpdated.lapsBehindLeader ?? 0)
      ? Math.max(previousUpdated.gapToLeader, rawLeaderGap)
      : rawLeaderGap;
    const interval = index === 0 || !previousUpdated
      ? 0
      : lapsBehindCarAhead > 0
        ? timingGapSeconds(car, ahead!, referenceSpeed, car.interval)
        : Math.max(0, round1(gapToLeader - previousUpdated.gapToLeader));
    const next = {
      ...car,
      position: index + 1,
      gapToLeader,
      interval,
      lapsBehindLeader,
      lapsBehindCarAhead,
    };
    updated.set(car.driverId, next);
    previousUpdated = next;
  });
  return orderedCars.map((car) => updated.get(car.driverId) ?? car);
}

export function formatLiveTimingDelta(seconds: number, lapsBehind = 0): string {
  if (lapsBehind > 0) return `+${lapsBehind}L`;
  return `+${Math.max(0, seconds).toFixed(1)}`;
}

function timingGapSeconds(
  trailing: LiveCarState,
  ahead: LiveCarState,
  referenceSpeed: number | null,
  previousGap: number,
): number {
  const crossingGap = latestSharedCrossingGap(trailing.positionState?.timing, ahead.positionState?.timing);
  if (crossingGap != null) return round1(crossingGap);
  const trailingDistance = trailing.positionState?.totalRaceDistanceMeters;
  const aheadDistance = ahead.positionState?.totalRaceDistanceMeters;
  if (referenceSpeed != null && trailingDistance != null && aheadDistance != null) {
    return round1(Math.max(0, aheadDistance - trailingDistance) / referenceSpeed);
  }
  return round1(Math.max(0, previousGap));
}

function latestSharedCrossingGap(
  trailing?: TimingCrossingState,
  ahead?: TimingCrossingState,
): number | null {
  if (!trailing?.lineCrossings || !ahead?.lineCrossings) return null;
  let latestTrailingTime = Number.NEGATIVE_INFINITY;
  let gap: number | null = null;
  for (const key of LINE_KEYS) {
    const trailingCrossing = trailing.lineCrossings[key];
    const aheadCrossing = ahead.lineCrossings[key];
    if (!trailingCrossing || !aheadCrossing || trailingCrossing.lap !== aheadCrossing.lap) continue;
    const candidate = trailingCrossing.time - aheadCrossing.time;
    if (candidate >= 0 && trailingCrossing.time > latestTrailingTime) {
      latestTrailingTime = trailingCrossing.time;
      gap = candidate;
    }
  }
  return gap;
}

function lapDeficit(ahead: LiveCarState, trailing: LiveCarState): number {
  const aheadLaps = ahead.positionState?.completedLaps ?? ahead.lapsCompleted;
  const trailingLaps = trailing.positionState?.completedLaps ?? trailing.lapsCompleted;
  return Math.max(0, aheadLaps - trailingLaps);
}

function round1(value: number): number { return Math.round(value * 10) / 10; }
