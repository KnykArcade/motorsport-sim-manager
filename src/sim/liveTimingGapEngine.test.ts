import { describe, expect, it } from 'vitest';
import type { CircuitSegmentSet } from '../types/circuitTypes';
import type { LiveCarState } from '../types/liveTypes';
import { createInitialCarPositionState } from './segmentRaceEngine';
import { formatLiveTimingDelta, updateLiveTimingGaps } from './liveTimingGapEngine';

const circuit = { lapLengthMeters: 5000, baselineLapTimeSeconds: 100 } as CircuitSegmentSet;

function car(driverId: string, distance: number, speed: number, completedLaps = 2): LiveCarState {
  return {
    driverId, running: true, position: driverId === 'leader' ? 1 : 2,
    gapToLeader: 0, interval: 0, lapsCompleted: completedLaps,
    positionState: {
      ...createInitialCarPositionState(), completedLaps,
      totalRaceDistanceMeters: distance, currentSpeedMetersPerSecond: speed,
    },
  } as LiveCarState;
}

describe('authoritative live timing gaps', () => {
  it('does not change a distance gap when the trailing car brakes or accelerates', () => {
    const leader = car('leader', 10_000, 70);
    const slowAtCorner = updateLiveTimingGaps([leader, car('trailing', 9_900, 20)], circuit)[1]!;
    const fastOnStraight = updateLiveTimingGaps([leader, car('trailing', 9_900, 80)], circuit)[1]!;
    expect(slowAtCorner.gapToLeader).toBe(2);
    expect(fastOnStraight.gapToLeader).toBe(2);
    expect(slowAtCorner.interval).toBe(fastOnStraight.interval);
  });

  it('prefers matching timing-line crossing timestamps over interpolation', () => {
    const leader = car('leader', 10_000, 70);
    const trailing = car('trailing', 9_900, 20);
    leader.positionState!.timing.lineCrossings = { Sector2: { lap: 2, time: 100 } };
    trailing.positionState!.timing.lineCrossings = { Sector2: { lap: 2, time: 103.4 } };
    const updated = updateLiveTimingGaps([leader, trailing], circuit)[1]!;
    expect(updated.gapToLeader).toBe(3.4);
    expect(updated.interval).toBe(3.4);
  });

  it('tracks and formats lap deficits separately from seconds', () => {
    const leader = car('leader', 25_000, 70, 5);
    const lapped = updateLiveTimingGaps([leader, car('trailing', 20_500, 70, 4)], circuit)[1]!;
    expect(lapped.lapsBehindLeader).toBe(1);
    expect(lapped.lapsBehindCarAhead).toBe(1);
    expect(formatLiveTimingDelta(lapped.gapToLeader, lapped.lapsBehindLeader)).toBe('+1L');
  });

  it('keeps leader gaps monotonic and intervals reconciled to adjacent gaps', () => {
    const leader = car('leader', 10_000, 70);
    const second = car('second', 9_900, 70);
    const third = car('third', 9_800, 70);
    leader.positionState!.timing.lineCrossings = { Sector1: { lap: 2, time: 100 } };
    second.positionState!.timing.lineCrossings = { Sector1: { lap: 2, time: 104 } };
    third.positionState!.timing.lineCrossings = { Sector1: { lap: 2, time: 103 } };
    const updated = updateLiveTimingGaps([leader, second, third], circuit);
    expect(updated.map((entry) => entry.gapToLeader)).toEqual([0, 4, 4]);
    expect(updated.map((entry) => entry.interval)).toEqual([0, 4, 0]);
    expect(updated[2]!.gapToLeader).toBe(updated[1]!.gapToLeader + updated[2]!.interval);
  });
});
