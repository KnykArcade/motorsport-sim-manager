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
    };
  }
  if (transition.justEnded) {
    return { ...previous, previousMode: previous.mode, mode: 'GreenFlagRestart' };
  }
  if (transition.safetyCar.active) return previous;
  if (previous.mode === 'GreenFlagRestart' || previous.mode === 'RestartFormation') {
    return { ...previous, previousMode: previous.mode, mode: 'Green', reason: null, queueFormed: false };
  }
  return previous.mode === 'Finished' ? previous : { ...previous, mode: 'Green', queueFormed: false };
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
    const ahead = [...updated].reverse().find((candidate) => candidate.running && candidate.positionState && !candidate.pit.inPitThisLap);
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
