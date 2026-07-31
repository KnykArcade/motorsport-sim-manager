import type { CircuitSegmentSet } from '../types/circuitTypes';
import type { Car, SetupOption, Track } from '../types/gameTypes';
import type {
  CarSetup,
  DriverComfort,
  SetupPerformanceSnapshot,
  SetupSessionEnvelope,
  SetupSessionKey,
  SetupSimulationEnvelope,
  SetupSimulationProfile,
} from '../types/setupTypes';
import { calculateSetupPerformanceSnapshot } from './setupPerformanceSurface';

type ProfileOptions = {
  snapshot?: SetupPerformanceSnapshot;
  comfort?: DriverComfort;
  confidenceBonus?: number;
};

// The Phase 2 envelope delta is a compatibility-scale expression of percentage
// lap-time loss. Simulation scores historically apply setup inside only a small
// "other" bucket, so this factor preserves the intended major consequence of
// extreme setup misses without permitting a positive result.
export const SETUP_SIMULATION_PACE_SCALE = 2.45;

export function simulationSetupPaceDelta(envelope: SetupSimulationEnvelope): number {
  return clamp(envelope.paceDelta * SETUP_SIMULATION_PACE_SCALE, -12, 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, places = 3): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function tunedEnvelope(
  envelope: SetupSessionEnvelope,
  session: SetupSessionKey,
  comfort?: DriverComfort,
  confidenceBonus = 0,
): SetupSimulationEnvelope {
  const confidence = clamp(confidenceBonus / 20, -1, 1);
  const execution = comfort?.effects.execution ?? 0;
  const consistency = comfort?.effects.consistency ?? 0;
  const rawExtraction = session === 'qualifying'
    ? execution * 0.45 + confidence * 0.25
    : consistency * 0.8 + confidence * 0.2;
  // Comfort and knowledge can remove an extraction deficit, but never reduce
  // the physical loss or become a setup-created pace bonus.
  const driverExtractionDelta = Math.min(0, rawExtraction);
  const comfortMistake = Math.max(0, comfort?.effects.mistakeRisk ?? 0);
  const comfortConsistency = Math.max(0, -(comfort?.effects.consistency ?? 0));
  const tyreManagement = comfort?.effects.tyreManagement ?? 0;

  return {
    ...envelope,
    physicalPaceDelta: envelope.paceDelta,
    driverExtractionDelta: round(driverExtractionDelta),
    paceDelta: round(Math.min(0, envelope.paceDelta + driverExtractionDelta)),
    tyreWearDelta: round(clamp(envelope.tyreWearDelta - tyreManagement * 0.35, -1, 3)),
    mistakePressure: round(clamp(envelope.mistakePressure + comfortMistake * 0.45, 0, 3)),
    consistencyLoss: round(clamp(envelope.consistencyLoss + comfortConsistency * 0.4, 0, 3)),
  };
}

export function buildTunedSetupSimulationProfile(
  setup: CarSetup,
  track: Track,
  car: Car,
  options: ProfileOptions = {},
): SetupSimulationProfile {
  const snapshot = options.snapshot ?? calculateSetupPerformanceSnapshot(setup, track, car);
  const sessions = {} as Record<SetupSessionKey, SetupSimulationEnvelope>;
  for (const key of Object.keys(snapshot.sessions) as SetupSessionKey[]) {
    sessions[key] = tunedEnvelope(
      snapshot.sessions[key],
      key,
      options.comfort,
      options.confidenceBonus,
    );
  }
  return { source: 'tuned', snapshot, sessions };
}

// Older SetupOption records do not contain the ten physical setup controls.
// Convert their real handling/cooling/tyre traits into a conservative CarSetup
// approximation. Positive qualifying/race trim boosts are intentionally not
// represented: the Phase 2 surface is authoritative for physical performance.
export function legacySetupToCarSetup(option: SetupOption): CarSetup {
  const risk = clamp(option.riskModifier, -4, 7);
  const wing = clamp(option.downforce, 1, 10);
  const mechanical = clamp(option.mechanicalGrip, 1, 10);
  return {
    frontWing: wing,
    rearWing: clamp(wing - risk * 0.08, 1, 10),
    suspensionStiffness: clamp(11 - mechanical + Math.max(0, risk) * 0.15, 1, 10),
    rideHeight: clamp(6 - (mechanical - 5) * 0.25, 1, 10),
    gearing: clamp(option.topSpeed, 1, 10),
    brakeBias: clamp(5.5 + risk * 0.18, 1, 10),
    brakeCooling: clamp(option.brakingStability, 1, 10),
    differential: clamp(mechanical + risk * 0.25, 1, 10),
    engineCooling: clamp(option.reliabilityProtection, 1, 10),
    tyreUsage: clamp(11 - option.tirePreservation + Math.max(0, risk) * 0.2, 1, 10),
  };
}

export function resolveLegacySetupSimulationProfile(
  option: SetupOption,
  track: Track,
  car: Car,
): SetupSimulationProfile {
  const snapshot = calculateSetupPerformanceSnapshot(legacySetupToCarSetup(option), track, car);
  const sessions = {} as Record<SetupSessionKey, SetupSimulationEnvelope>;
  for (const key of Object.keys(snapshot.sessions) as SetupSessionKey[]) {
    sessions[key] = tunedEnvelope(snapshot.sessions[key], key);
  }
  return { source: 'legacy', snapshot, sessions };
}

export function resolveSetupSimulationProfile(
  existing: SetupSimulationProfile | undefined,
  option: SetupOption,
  track: Track,
  car: Car,
): SetupSimulationProfile {
  return existing ?? resolveLegacySetupSimulationProfile(option, track, car);
}

export function blendSetupEnvelopes(
  first: SetupSimulationEnvelope,
  second: SetupSimulationEnvelope,
  secondWeight: number,
): SetupSimulationEnvelope {
  const weight = clamp(secondWeight, 0, 1);
  const mix = (a: number, b: number) => round(a * (1 - weight) + b * weight);
  return {
    lapTimeLossPct: mix(first.lapTimeLossPct, second.lapTimeLossPct),
    physicalPaceDelta: mix(first.physicalPaceDelta, second.physicalPaceDelta),
    driverExtractionDelta: mix(first.driverExtractionDelta, second.driverExtractionDelta),
    paceDelta: Math.min(0, mix(first.paceDelta, second.paceDelta)),
    tyreWearDelta: mix(first.tyreWearDelta, second.tyreWearDelta),
    reliabilityRisk: mix(first.reliabilityRisk, second.reliabilityRisk),
    overheatingRisk: mix(first.overheatingRisk, second.overheatingRisk),
    mistakePressure: mix(first.mistakePressure, second.mistakePressure),
    consistencyLoss: mix(first.consistencyLoss, second.consistencyLoss),
    balanceMigration: mix(first.balanceMigration, second.balanceMigration),
  };
}

function weightedEnvelope(
  entries: Array<[SetupSimulationEnvelope, number]>,
): SetupSimulationEnvelope {
  let result = entries[0][0];
  let accumulated = entries[0][1];
  for (let index = 1; index < entries.length; index += 1) {
    const [envelope, weight] = entries[index];
    result = blendSetupEnvelopes(result, envelope, weight / (accumulated + weight));
    accumulated += weight;
  }
  return result;
}

export function quickRaceSetupEnvelope(profile: SetupSimulationProfile): SetupSimulationEnvelope {
  return weightedEnvelope([
    [profile.sessions.raceStart, 0.18],
    [profile.sessions.raceStint, 0.48],
    [profile.sessions.lateStint, 0.22],
    [profile.sessions.traffic, 0.12],
  ]);
}

export function qualifyingSetupEnvelope(
  profile: SetupSimulationProfile,
  wetness: number,
): SetupSimulationEnvelope {
  return blendSetupEnvelopes(profile.sessions.qualifying, profile.sessions.wet, wetness);
}

export function liveSetupEnvelope(
  profile: SetupSimulationProfile,
  input: { lap: number; totalLaps: number; wetness: number; inTraffic: boolean },
): SetupSimulationEnvelope {
  const fraction = input.lap / Math.max(1, input.totalLaps);
  let envelope = fraction <= 0.12
    ? profile.sessions.raceStart
    : fraction >= 0.72
      ? profile.sessions.lateStint
      : profile.sessions.raceStint;
  if (input.inTraffic) envelope = blendSetupEnvelopes(envelope, profile.sessions.traffic, 0.65);
  if (input.wetness > 0) envelope = blendSetupEnvelopes(envelope, profile.sessions.wet, input.wetness);
  return envelope;
}

export function setupSectorLossWeights(
  profile: SetupSimulationProfile,
  circuit: CircuitSegmentSet,
  wetness = 0,
): [number, number, number] {
  const losses = profile.snapshot.behaviorLosses;
  const interactions = profile.snapshot.interactionLosses;
  const sectorLoss: [number, number, number] = [0, 0, 0];
  for (const segment of circuit.segments) {
    const power = losses.straightLineEfficiency + interactions.gearingDragPower;
    const aero = losses.highSpeedCornering + losses.aeroPlatformStability + interactions.aeroBalance;
    const mechanical = losses.lowSpeedCornering + losses.traction + losses.bumpKerbCompliance
      + interactions.platformCompliance + interactions.differentialRearStiffness;
    const braking = losses.brakingEntryStability + interactions.brakeBalanceCooling;
    const tyre = losses.tyreControl + interactions.tyreMechanicalLoading;
    const wet = wetness * (
      losses.brakingEntryStability + losses.traction + losses.bumpKerbCompliance
    ) * segment.wetWeatherSensitivity;
    const contribution = segment.representativeTimeSeconds * (
      power * segment.powerSensitivity
      + aero * segment.aeroSensitivity
      + mechanical * segment.mechanicalGripSensitivity
      + braking * segment.brakingSensitivity
      + tyre * segment.tyreStress
      + wet
    );
    sectorLoss[segment.sector - 1] += Math.max(0, contribution);
  }
  const total = sectorLoss.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return [1 / 3, 1 / 3, 1 / 3];
  return sectorLoss.map((value) => value / total) as [number, number, number];
}
