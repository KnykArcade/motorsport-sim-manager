import type { RaceRuleProfile } from '../types/raceRulesTypes';
import type { LiveRaceControlMode, LiveRaceControlState } from '../types/raceControlTypes';
import type { SafetyCarState } from '../types/liveTypes';

export type SafetyCarTransition = {
  safetyCar: SafetyCarState;
  justDeployed: boolean;
  justEnded: boolean;
};

export function initialRaceControlState(ruleProfile?: RaceRuleProfile): LiveRaceControlState {
  return {
    mode: 'Green', previousMode: null, deployedOnLap: null, reason: null,
    restartProcedure: ruleProfile?.raceControl.restartProcedure ?? 'SeriesDefault', deployments: 0,
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
    };
  }
  if (transition.justEnded) {
    return { ...previous, previousMode: previous.mode, mode: 'GreenFlagRestart' };
  }
  if (transition.safetyCar.active) return previous;
  if (previous.mode === 'GreenFlagRestart' || previous.mode === 'RestartFormation') {
    return { ...previous, previousMode: previous.mode, mode: 'Green', reason: null };
  }
  return previous.mode === 'Finished' ? previous : { ...previous, mode: 'Green' };
}

function fullCourseMode(profile?: RaceRuleProfile): LiveRaceControlMode {
  const modes = profile?.raceControl.supportedModes ?? [];
  if (modes.includes('PaceCar')) return 'PaceCar';
  if (modes.includes('SafetyCar')) return 'SafetyCar';
  if (modes.includes('VirtualSafetyCar')) return 'VirtualSafetyCar';
  return 'FullCourseYellow';
}
