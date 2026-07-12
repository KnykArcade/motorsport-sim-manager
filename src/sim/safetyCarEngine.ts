// Safety car engine for the live race.
//
// A safety car can be triggered by a crash/stopped car (passed in by the tick
// engine), heavy rain, or a small per-lap random chance (debris). While active
// it bunches the field (gaps compress) and makes pit stops cheap — the core of
// the "pit now or hold track position" decision.

import type { Track } from '../types/gameTypes';
import type { SafetyCarState, WeatherState } from '../types/liveTypes';
import type { RaceRuleProfile } from '../types/raceRulesTypes';
import { createSeededRandom, deriveSeed } from './random';

export function initialSafetyCar(): SafetyCarState {
  return { active: false, lapsRemaining: 0, deployedOnLap: null, reason: null, deployments: 0, lastEndedOnLap: null };
}

export const MIN_GREEN_LAPS_BETWEEN_SAFETY_CARS = 5;

// Time penalty (s/lap) applied to every running car while the SC is out — the
// whole field is slowed to neutralise the race.
export const SAFETY_CAR_LAP_PENALTY = 18;

// Pit-stop time saved while the SC is out (the field is slow, so the stop costs
// far less track position).
export const SAFETY_CAR_PIT_SAVING = 12;

export type SafetyCarTrigger = {
  // A crash/breakdown happened this lap that may bring out the SC.
  incidentThisLap: boolean;
  incidentSeverity: number; // 0..1
};

// Decide whether to deploy / continue / withdraw the safety car for the lap.
// Pure: derives its own RNG from seed + lap.
export function stepSafetyCar(
  sc: SafetyCarState,
  track: Track,
  weather: WeatherState,
  trigger: SafetyCarTrigger,
  seed: string,
  lap: number,
  totalLaps: number,
  ruleProfile?: RaceRuleProfile,
): { safetyCar: SafetyCarState; justDeployed: boolean; justEnded: boolean } {
  const rng = createSeededRandom(deriveSeed(seed, 'safetycar', track.id, lap));

  if (sc.active) {
    const lapsRemaining = sc.lapsRemaining - 1;
    if (lapsRemaining <= 0) {
      return {
        safetyCar: { ...sc, active: false, lapsRemaining: 0, lastEndedOnLap: lap },
        justDeployed: false,
        justEnded: true,
      };
    }
    return { safetyCar: { ...sc, lapsRemaining }, justDeployed: false, justEnded: false };
  }

  // Not currently active: profile rules decide whether a late-race or
  // full-course neutralisation is available. Legacy saves keep the old
  // final-two-laps fallback when no profile has been stored yet.
  if (!ruleProfile?.raceControl.lateRaceCautionsAllowed && lap >= totalLaps - 2) {
    return { safetyCar: sc, justDeployed: false, justEnded: false };
  }

  const supportedModes = ruleProfile?.raceControl.supportedModes;
  if (supportedModes && !supportedModes.includes('SafetyCar') && !supportedModes.includes('PaceCar') && !supportedModes.includes('FullCourseYellow')) {
    return { safetyCar: sc, justDeployed: false, justEnded: false };
  }

  const minimumGreenLaps = ruleProfile?.raceControl.minimumGreenLapsBetweenCautions
    ?? MIN_GREEN_LAPS_BETWEEN_SAFETY_CARS;
  const greenLaps = sc.lastEndedOnLap == null ? Number.POSITIVE_INFINITY : lap - sc.lastEndedOnLap;
  if (greenLaps < minimumGreenLaps && (!trigger.incidentThisLap || trigger.incidentSeverity < 0.9)) {
    return { safetyCar: sc, justDeployed: false, justEnded: false };
  }

  const wallFactor = track.attributes.riskWallProximity / 10; // street circuits riskier
  let deployChance: number;
  let reason: string;

  if (trigger.incidentThisLap) {
    deployChance = 0.08 + trigger.incidentSeverity * 0.28 + wallFactor * 0.05;
    reason = 'Debris from an incident';
  } else if (weather.condition === 'HeavyRain') {
    deployChance = 0.08;
    reason = 'Heavy rain — conditions too dangerous';
  } else {
    deployChance = 0.003 + wallFactor * 0.006;
    reason = 'Stopped car / debris on track';
  }

  const frequencyMultiplier = ruleProfile?.raceControl.cautionFrequencyMultiplier ?? 1;
  if (rng.chance(Math.min(1, deployChance * frequencyMultiplier))) {
    const duration = rng.int(2, 4);
    return {
      safetyCar: {
        active: true,
        lapsRemaining: duration,
        deployedOnLap: lap,
        reason,
        deployments: sc.deployments + 1,
      },
      justDeployed: true,
      justEnded: false,
    };
  }

  return { safetyCar: sc, justDeployed: false, justEnded: false };
}
