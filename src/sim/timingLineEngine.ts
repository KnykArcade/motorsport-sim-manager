import type { TimingCrossingState } from '../types/positionTypes';

export type TimingCrossingEvent =
  | { type: 'Sector'; sector: 1 | 2; crossingTime: number; sectorTime: number }
  | { type: 'Lap'; lap: number; crossingTime: number; lapTime: number; sectorTime: number };

export function createInitialTimingState(startTime = 0): TimingCrossingState {
  return {
    lastSectorCrossed: null,
    lastSectorCrossingTime: null,
    lastFinishLineCrossingTime: null,
    currentLapStartTime: startTime,
    currentSectorStartTime: startTime,
  };
}

export function applySectorCrossing(
  timing: TimingCrossingState,
  sector: 1 | 2,
  crossingTime: number,
  currentLap = 0,
): { timing: TimingCrossingState; event: TimingCrossingEvent } {
  const sectorTime = round3(crossingTime - timing.currentSectorStartTime);
  return {
    timing: {
      ...timing,
      lastSectorCrossed: sector,
      lastSectorCrossingTime: crossingTime,
      currentSectorStartTime: crossingTime,
      lineCrossings: {
        ...timing.lineCrossings,
        [sector === 1 ? 'Sector1' : 'Sector2']: { lap: currentLap, time: crossingTime },
      },
    },
    event: { type: 'Sector', sector, crossingTime, sectorTime },
  };
}

export function applyFinishLineCrossing(
  timing: TimingCrossingState,
  completedLap: number,
  crossingTime: number,
): { timing: TimingCrossingState; event: TimingCrossingEvent } {
  const sectorTime = round3(crossingTime - timing.currentSectorStartTime);
  const lapTime = round3(crossingTime - timing.currentLapStartTime);
  return {
    timing: {
      ...timing,
      lastSectorCrossed: 3,
      lastSectorCrossingTime: crossingTime,
      lastFinishLineCrossingTime: crossingTime,
      currentLapStartTime: crossingTime,
      currentSectorStartTime: crossingTime,
      lineCrossings: {
        ...timing.lineCrossings,
        Finish: { lap: completedLap, time: crossingTime },
      },
    },
    event: { type: 'Lap', lap: completedLap, crossingTime, lapTime, sectorTime },
  };
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
