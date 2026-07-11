import type { RaceRuleProfile } from '../types/raceRulesTypes';
import type { LiveRaceControlMode, LiveRaceControlState } from '../types/raceControlTypes';
import type { SafetyCarState } from '../types/liveTypes';
import type { LiveCarState } from '../types/liveTypes';
import type { CircuitSegmentSet } from '../types/circuitTypes';
import { classifyCarsByDistance, repositionCarAtRaceDistance } from './segmentRaceEngine';

export type SafetyCarTransition = {
  safetyCar: SafetyCarState;
  justDeployed: boolean;
  justEnded: boolean;
};

export function initialRaceControlState(ruleProfile?: RaceRuleProfile): LiveRaceControlState {
  return {
    mode: 'Green', previousMode: null, deployedOnLap: null, reason: null,
    restartProcedure: ruleProfile?.raceControl.restartProcedure ?? 'SeriesDefault', deployments: 0, queueFormed: false,
    pitLaneOpen: true, pitLaneClosedOnLap: null,
    freePassApplied: false, freePassDriverId: null,
  };
}

export function stepRaceControlState(
  previous: LiveRaceControlState,
  transition: SafetyCarTransition,
  ruleProfile: RaceRuleProfile | undefined,
  lap: number,
  raceFinished = false,
): LiveRaceControlState {
  if (raceFinished) return { ...previous, previousMode: previous.mode, mode: 'Finished' };
  if (transition.justDeployed) {
    const mode = fullCourseMode(ruleProfile);
    return {
      mode,
      previousMode: previous.mode,
      deployedOnLap: lap,
      reason: transition.safetyCar.reason,
      restartProcedure: ruleProfile?.raceControl.restartProcedure ?? previous.restartProcedure,
      deployments: transition.safetyCar.deployments,
      queueFormed: false,
      pitLaneOpen: !ruleProfile?.pitLane.closesUnderFullCourseCaution,
      pitLaneClosedOnLap: ruleProfile?.pitLane.closesUnderFullCourseCaution ? lap : null,
      freePassApplied: false,
      freePassDriverId: null,
    };
  }
  if (transition.justEnded) {
    return { ...previous, previousMode: previous.mode, mode: 'GreenFlagRestart', pitLaneOpen: true };
  }
  if (transition.safetyCar.active) return previous;
  if (previous.mode === 'GreenFlagRestart' || previous.mode === 'RestartFormation') {
    return { ...previous, previousMode: previous.mode, mode: 'Green', reason: null, queueFormed: false, pitLaneOpen: true };
  }
  return previous.mode === 'Finished' ? previous : { ...previous, mode: 'Green', queueFormed: false, pitLaneOpen: true };
}

export function openPitLaneWhenQueueFormed(state: LiveRaceControlState): LiveRaceControlState {
  if (!state.queueFormed || state.pitLaneOpen) return state;
  return { ...state, pitLaneOpen: true };
}

export function applyRaceControlFreePass(
  cars: readonly LiveCarState[],
  circuit: CircuitSegmentSet,
  state: LiveRaceControlState,
  ruleProfile?: RaceRuleProfile,
): { cars: LiveCarState[]; state: LiveRaceControlState; driverId: string | null } {
  if (!state.queueFormed || state.freePassApplied || !ruleProfile?.pitLane.luckyDog) {
    return { cars: [...cars], state, driverId: null };
  }
  const ordered = classifyCarsByDistance(cars);
  const leader = ordered.find((car) => car.running && car.positionState && !car.pit.inPitThisLap);
  const candidate = leader?.positionState
    ? ordered.find((car) => car.running && car.positionState && !car.pit.inPitThisLap
      && car.positionState.completedLaps < leader.positionState!.completedLaps)
    : undefined;
  if (!leader?.positionState || !candidate?.positionState) {
    return { cars: ordered, state: { ...state, freePassApplied: true }, driverId: null };
  }
  const maximumRestoredDistance = candidate.positionState.totalRaceDistanceMeters + circuit.lapLengthMeters;
  const restoredLap = Math.floor(maximumRestoredDistance / circuit.lapLengthMeters);
  const tailOfRestoredLap = ordered
    .filter((car) => car.driverId !== candidate.driverId && car.running && car.positionState
      && car.positionState.completedLaps === restoredLap)
    .reduce((tail, car) => Math.min(tail, car.positionState!.totalRaceDistanceMeters), Number.POSITIVE_INFINITY);
  const restoredDistance = Number.isFinite(tailOfRestoredLap)
    ? Math.min(maximumRestoredDistance, tailOfRestoredLap - 12)
    : maximumRestoredDistance;
  const updated = ordered.map((car) => car.driverId === candidate.driverId
    ? { ...car, positionState: repositionCarAtRaceDistance(car.positionState!, Math.max(0, restoredDistance), circuit) }
    : car);
  return {
    cars: classifyCarsByDistance(updated),
    state: { ...state, freePassApplied: true, freePassDriverId: candidate.driverId },
    driverId: candidate.driverId,
  };
}

export type QueueCatchUpOptions = { targetGapMeters?: number; catchUpSpeedMetersPerSecond?: number };

export function applyRaceControlQueueCatchUp(
  cars: readonly LiveCarState[],
  circuit: CircuitSegmentSet,
  mode: LiveRaceControlMode,
  elapsedSeconds: number,
  options: QueueCatchUpOptions = {},
): { cars: LiveCarState[]; queueFormed: boolean } {
  const neutralized = mode === 'SafetyCar' || mode === 'PaceCar' || mode === 'FullCourseYellow' || mode === 'Caution';
  if (!neutralized || elapsedSeconds <= 0) return { cars: [...cars], queueFormed: false };
  const targetGap = options.targetGapMeters ?? 12;
  const maximumCatchUp = (options.catchUpSpeedMetersPerSecond ?? 8) * elapsedSeconds;
  const ordered = classifyCarsByDistance(cars);
  const updated: LiveCarState[] = [];
  let queueFormed = true;
  for (const car of ordered) {
    if (!car.running || !car.positionState || car.pit.inPitThisLap) {
      updated.push(car);
      continue;
    }
    const nextLapBoundary = (car.positionState.completedLaps + 1) * circuit.lapLengthMeters;
    const ahead = [...updated].reverse().find((candidate) => {
      if (!candidate.running || !candidate.positionState || candidate.pit.inPitThisLap) return false;
      if (candidate.positionState.completedLaps === car.positionState!.completedLaps) return true;
      const proposedDistance = Math.min(
        candidate.positionState.totalRaceDistanceMeters - targetGap,
        car.positionState!.totalRaceDistanceMeters + maximumCatchUp,
      );
      return proposedDistance < nextLapBoundary;
    });
    if (!ahead?.positionState) {
      updated.push(car);
      continue;
    }
    const currentDistance = car.positionState.totalRaceDistanceMeters;
    const gap = ahead.positionState.totalRaceDistanceMeters - currentDistance;
    const closedDistance = Math.min(Math.max(0, gap - targetGap), maximumCatchUp);
    const nextDistance = Math.min(ahead.positionState.totalRaceDistanceMeters - targetGap, currentDistance + closedDistance);
    if (ahead.positionState.totalRaceDistanceMeters - nextDistance > targetGap + 0.5) queueFormed = false;
    updated.push({
      ...car,
      positionState: repositionCarAtRaceDistance(car.positionState, Math.max(0, nextDistance), circuit),
    });
  }
  return { cars: classifyCarsByDistance(updated), queueFormed };
}

function fullCourseMode(profile?: RaceRuleProfile): LiveRaceControlMode {
  const modes = profile?.raceControl.supportedModes ?? [];
  if (modes.includes('PaceCar')) return 'PaceCar';
  if (modes.includes('SafetyCar')) return 'SafetyCar';
  if (modes.includes('VirtualSafetyCar')) return 'VirtualSafetyCar';
  return 'FullCourseYellow';
}
