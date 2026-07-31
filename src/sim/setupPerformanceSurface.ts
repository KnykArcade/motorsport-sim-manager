// Hidden setup-performance surface.
//
// A setup does not add performance to the car. It determines how much of the
// car's underlying potential is inaccessible in each operating envelope. The
// model therefore returns only positive lap-time losses and non-positive pace
// deltas. It evaluates car behaviors and coupled setup interactions rather than
// ten independent distances from a single ideal slider combination.

import { SETUP_COMPONENTS } from '../data/setup/setupComponents';
import type { Car, Track } from '../types/gameTypes';
import type {
  CarSetup,
  ComponentFit,
  SetupBehaviorAxis,
  SetupInteractionKey,
  SetupPerformanceSnapshot,
  SetupSessionEnvelope,
  SetupSessionKey,
} from '../types/setupTypes';
import { assertRating100 } from './ratingScale';
import { sanitizeSetupProfile } from './setupSanitize';
import { effectiveCarRatings } from './trackFitEngine';

type AxisRecord = Record<SetupBehaviorAxis, number>;
type InteractionRecord = Record<SetupInteractionKey, number>;

const BEHAVIOR_AXES: SetupBehaviorAxis[] = [
  'lowSpeedCornering',
  'mediumSpeedCornering',
  'highSpeedCornering',
  'brakingEntryStability',
  'midCornerBalance',
  'traction',
  'straightLineEfficiency',
  'aeroPlatformStability',
  'bumpKerbCompliance',
  'tyreWarmup',
  'tyreControl',
  'coolingCapacity',
  'trafficStability',
  'fuelLoadStability',
];

const SESSION_WEIGHTS: Record<SetupSessionKey, Partial<AxisRecord>> = {
  qualifying: {
    lowSpeedCornering: 0.65,
    mediumSpeedCornering: 0.9,
    highSpeedCornering: 1,
    brakingEntryStability: 0.8,
    midCornerBalance: 0.75,
    traction: 0.7,
    straightLineEfficiency: 1,
    aeroPlatformStability: 0.75,
    bumpKerbCompliance: 0.4,
    tyreWarmup: 1,
    fuelLoadStability: 0.15,
  },
  raceStart: {
    lowSpeedCornering: 0.7,
    mediumSpeedCornering: 0.65,
    highSpeedCornering: 0.55,
    brakingEntryStability: 0.9,
    midCornerBalance: 0.8,
    traction: 1,
    straightLineEfficiency: 0.55,
    aeroPlatformStability: 0.75,
    bumpKerbCompliance: 0.55,
    tyreWarmup: 0.8,
    tyreControl: 0.45,
    coolingCapacity: 0.25,
    fuelLoadStability: 1,
  },
  raceStint: {
    lowSpeedCornering: 0.55,
    mediumSpeedCornering: 0.7,
    highSpeedCornering: 0.65,
    brakingEntryStability: 0.65,
    midCornerBalance: 0.8,
    traction: 0.9,
    straightLineEfficiency: 0.65,
    aeroPlatformStability: 0.7,
    bumpKerbCompliance: 0.55,
    tyreControl: 1,
    coolingCapacity: 0.85,
    trafficStability: 0.45,
    fuelLoadStability: 0.7,
  },
  lateStint: {
    lowSpeedCornering: 0.5,
    mediumSpeedCornering: 0.7,
    highSpeedCornering: 0.7,
    brakingEntryStability: 0.7,
    midCornerBalance: 0.95,
    traction: 0.85,
    straightLineEfficiency: 0.7,
    aeroPlatformStability: 0.65,
    bumpKerbCompliance: 0.45,
    tyreControl: 1,
    coolingCapacity: 0.65,
    fuelLoadStability: 0.9,
  },
  traffic: {
    lowSpeedCornering: 0.5,
    mediumSpeedCornering: 0.65,
    highSpeedCornering: 0.8,
    brakingEntryStability: 0.75,
    midCornerBalance: 0.7,
    traction: 0.7,
    straightLineEfficiency: 0.45,
    aeroPlatformStability: 0.8,
    tyreControl: 0.6,
    coolingCapacity: 1,
    trafficStability: 1,
    fuelLoadStability: 0.45,
  },
  wet: {
    lowSpeedCornering: 0.75,
    mediumSpeedCornering: 0.65,
    highSpeedCornering: 0.4,
    brakingEntryStability: 1,
    midCornerBalance: 0.9,
    traction: 1,
    straightLineEfficiency: 0.25,
    aeroPlatformStability: 0.55,
    bumpKerbCompliance: 0.85,
    tyreWarmup: 0.7,
    tyreControl: 0.9,
    coolingCapacity: 0.2,
    fuelLoadStability: 0.6,
  },
};

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, places = 3): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function normalizedSetupValue(value: number): number {
  return clamp((value - 1) / 9);
}

function trackUsesLegacyScale(track: Track): boolean {
  const { attributes: a, setupProfile: p } = track;
  return [
    ...Object.values(a),
    p.topSpeedEmphasis,
    p.mechanicalGripEmphasis,
    p.brakeDemand,
    p.reliabilityRiskFocus,
    p.aeroDemand,
    p.powerDemand,
    p.mechanicalDemand,
    p.riskDemand,
  ].every((value) => Number.isFinite(value) && value <= 10);
}

function trackDemand(track: Track, value: number): number {
  const scale = trackUsesLegacyScale(track) ? 10 : 100;
  return clamp(value / scale);
}

function setupWindowSharpness(car?: Pick<Car, 'setupWindow'>): number {
  const setupWindow = assertRating100(
    car?.setupWindow ?? 50,
    'Car setup-window rating',
  );
  return 1.38 - ((setupWindow - 1) / 99) * 0.58;
}

function carWeakness(car: Car | undefined, key: 'enginePower' | 'reliability'): number {
  if (!car) return 0.5;
  const rating = assertRating100(effectiveCarRatings(car)[key], `Effective car ${key}`);
  return 1 - (rating - 1) / 99;
}

function requiredCapability(demand: number): number {
  // Track demands describe importance, not a literal slider target. Compressing
  // them into a capability band lets the aggregate trade-off choose the setup.
  return 0.24 + demand * 0.52;
}

function progressiveBehaviorLoss(
  capability: number,
  demand: number,
  importance: number,
  sharpness: number,
): number {
  const required = requiredCapability(demand);
  const miss = required - capability;
  // A shortage is expensive. Surplus capability still carries a small cost,
  // representing performance spent in an area the circuit values less; its
  // larger drag/thermal/tyre trade-off is captured by another behavior axis.
  const signedCost = miss >= 0
    ? Math.pow(miss, 1.65)
    : Math.pow(Math.abs(miss), 1.8) * 0.14;
  return round(signedCost * (0.35 + importance * 0.85) * sharpness * 2.55);
}

function behaviorCapabilities(setupInput: CarSetup): AxisRecord {
  const setup = sanitizeSetupProfile(setupInput);
  const frontWing = normalizedSetupValue(setup.frontWing);
  const rearWing = normalizedSetupValue(setup.rearWing);
  const wing = (frontWing + rearWing) / 2;
  const stiffness = normalizedSetupValue(setup.suspensionStiffness);
  const rideHeight = normalizedSetupValue(setup.rideHeight);
  const gearing = normalizedSetupValue(setup.gearing);
  const brakeCooling = normalizedSetupValue(setup.brakeCooling);
  const brakeBalance = clamp(1 - Math.abs(setup.brakeBias - 5.5) / 4.5);
  const differential = normalizedSetupValue(setup.differential);
  const engineCooling = normalizedSetupValue(setup.engineCooling);
  const tyreUsage = normalizedSetupValue(setup.tyreUsage);
  const rearStability = clamp(rearWing * 0.6 + (1 - differential) * 0.4);
  const compliant = clamp((1 - stiffness) * 0.62 + rideHeight * 0.38);
  const platform = clamp(stiffness * 0.48 + (1 - rideHeight) * 0.34 + rearWing * 0.18);

  return {
    lowSpeedCornering: clamp(frontWing * 0.24 + rearWing * 0.12 + compliant * 0.29 + differential * 0.35),
    mediumSpeedCornering: clamp(frontWing * 0.25 + rearWing * 0.22 + platform * 0.28 + differential * 0.25),
    highSpeedCornering: clamp(frontWing * 0.23 + rearWing * 0.37 + platform * 0.4),
    brakingEntryStability: clamp(brakeBalance * 0.62 + rearStability * 0.23 + brakeCooling * 0.15),
    midCornerBalance: clamp((1 - Math.abs(frontWing - rearWing) * 0.8) * 0.5 + platform * 0.27 + differential * 0.23),
    traction: clamp(rearStability * 0.38 + compliant * 0.32 + (1 - stiffness * differential) * 0.3),
    straightLineEfficiency: clamp((1 - wing) * 0.58 + gearing * 0.31 + (1 - engineCooling) * 0.07 + (1 - brakeCooling) * 0.04),
    aeroPlatformStability: platform,
    bumpKerbCompliance: compliant,
    tyreWarmup: clamp(tyreUsage * 0.6 + stiffness * 0.2 + differential * 0.2),
    tyreControl: clamp((1 - tyreUsage) * 0.5 + compliant * 0.24 + rearStability * 0.26),
    coolingCapacity: clamp(engineCooling * 0.7 + brakeCooling * 0.3),
    trafficStability: clamp(engineCooling * 0.35 + rearStability * 0.4 + platform * 0.25),
    fuelLoadStability: clamp(rideHeight * 0.34 + rearStability * 0.4 + (1 - stiffness) * 0.26),
  };
}

function behaviorDemands(track: Track): AxisRecord {
  const a = track.attributes;
  const p = track.setupProfile;
  const d = (value: number) => trackDemand(track, value);
  const cornerDemand = d(a.corners);
  const technical = d(a.technical);
  const aero = d(p.aeroDemand);
  const mechanical = d(p.mechanicalDemand);
  const braking = Math.max(d(a.braking), d(p.brakeDemand));
  const straight = Math.max(d(a.straights), d(p.powerDemand));
  const traction = d(a.tractionAcceleration);
  const bumps = d(a.surfaceGripBumpiness);
  const endurance = d(a.enduranceConsistency);
  const risk = Math.max(d(a.riskWallProximity), d(p.riskDemand));
  const reliability = d(p.reliabilityRiskFocus);

  return {
    lowSpeedCornering: clamp(mechanical * 0.42 + traction * 0.33 + technical * 0.25),
    mediumSpeedCornering: clamp(cornerDemand * 0.35 + technical * 0.35 + aero * 0.3),
    highSpeedCornering: clamp(aero * 0.55 + cornerDemand * 0.3 + d(a.elevationBlindCorners) * 0.15),
    brakingEntryStability: braking,
    midCornerBalance: clamp(technical * 0.45 + cornerDemand * 0.3 + risk * 0.25),
    traction,
    straightLineEfficiency: straight,
    aeroPlatformStability: clamp(aero * 0.55 + cornerDemand * 0.25 + (1 - bumps) * 0.2),
    bumpKerbCompliance: bumps,
    tyreWarmup: clamp(0.35 + technical * 0.2 + braking * 0.2 + risk * 0.15),
    tyreControl: endurance,
    coolingCapacity: clamp(reliability * 0.55 + straight * 0.25 + braking * 0.2),
    trafficStability: clamp(risk * 0.35 + aero * 0.35 + reliability * 0.3),
    fuelLoadStability: clamp(endurance * 0.45 + bumps * 0.25 + traction * 0.3),
  };
}

function behaviorLosses(
  behaviors: AxisRecord,
  demands: AxisRecord,
  sharpness: number,
): AxisRecord {
  const out = {} as AxisRecord;
  for (const axis of BEHAVIOR_AXES) {
    out[axis] = progressiveBehaviorLoss(behaviors[axis], demands[axis], demands[axis], sharpness);
  }
  return out;
}

function interactionLosses(
  setupInput: CarSetup,
  track: Track,
  car: Car | undefined,
  sharpness: number,
): InteractionRecord {
  const setup = sanitizeSetupProfile(setupInput);
  const frontWing = normalizedSetupValue(setup.frontWing);
  const rearWing = normalizedSetupValue(setup.rearWing);
  const wing = (frontWing + rearWing) / 2;
  const stiffness = normalizedSetupValue(setup.suspensionStiffness);
  const lowRide = 1 - normalizedSetupValue(setup.rideHeight);
  const gearing = normalizedSetupValue(setup.gearing);
  const brakeCooling = normalizedSetupValue(setup.brakeCooling);
  const differential = normalizedSetupValue(setup.differential);
  const engineCooling = normalizedSetupValue(setup.engineCooling);
  const tyreUsage = normalizedSetupValue(setup.tyreUsage);
  const a = track.attributes;
  const p = track.setupProfile;
  const d = (value: number) => trackDemand(track, value);
  const bumps = d(a.surfaceGripBumpiness);
  const straight = Math.max(d(a.straights), d(p.powerDemand));
  const traction = d(a.tractionAcceleration);
  const braking = Math.max(d(a.braking), d(p.brakeDemand));
  const endurance = d(a.enduranceConsistency);
  const reliability = d(p.reliabilityRiskFocus);
  const risk = Math.max(d(a.riskWallProximity), d(p.riskDemand));
  const engineWeakness = carWeakness(car, 'enginePower');
  const reliabilityWeakness = carWeakness(car, 'reliability');
  const scale = (value: number) => round(value * sharpness);

  const aeroImbalance = Math.max(0, Math.abs(frontWing - rearWing) - 0.18);
  const bottoming = Math.max(0, lowRide * (0.45 + bumps * 0.55) + stiffness * bumps * 0.25 - 0.58);
  const limiter = Math.max(0, straight * (1 - gearing) - 0.22);
  const dragLoad = wing * straight * (0.45 + engineWeakness * 0.55);
  const rearLoading = differential * stiffness * traction;
  const biasExtremity = Math.abs(setup.brakeBias - 5.5) / 4.5;
  const brakeThermal = (1 - brakeCooling) * braking;
  const tyreLoad = tyreUsage * (0.35 + stiffness * 0.3 + differential * 0.35) * endurance;
  const thermal = (1 - engineCooling) * (0.45 + straight * 0.3 + reliability * 0.25)
    * (0.55 + reliabilityWeakness * 0.45);
  const fuelPlatform = lowRide * stiffness * endurance;
  const rearMigration = Math.max(0, frontWing - rearWing) * risk;

  return {
    aeroBalance: scale(Math.pow(aeroImbalance, 1.6) * (0.35 + risk) * 1.2),
    platformCompliance: scale(Math.pow(bottoming, 1.55) * 1.85),
    gearingDragPower: scale(
      Math.pow(limiter, 1.6) * 1.55
      + Math.pow(dragLoad, 1.5) * 0.24,
    ),
    differentialRearStiffness: scale(Math.pow(rearLoading, 1.65) * 0.75),
    brakeBalanceCooling: scale(
      Math.pow(biasExtremity * braking, 1.6) * 0.7
      + Math.pow(brakeThermal, 1.7) * 0.72,
    ),
    tyreMechanicalLoading: scale(Math.pow(tyreLoad, 1.55) * 0.72),
    coolingPowerTraffic: scale(Math.pow(thermal, 1.6) * 0.92),
    fuelBalanceMigration: scale(
      Math.pow(fuelPlatform, 1.6) * 0.42
      + Math.pow(rearMigration, 1.55) * 0.75,
    ),
  };
}

function weightedBehaviorLoss(losses: AxisRecord, weights: Partial<AxisRecord>): number {
  let weighted = 0;
  let total = 0;
  for (const axis of BEHAVIOR_AXES) {
    const weight = weights[axis] ?? 0;
    weighted += losses[axis] * weight;
    total += weight;
  }
  return total > 0 ? weighted / total : 0;
}

function interactionContribution(
  interactions: InteractionRecord,
  session: SetupSessionKey,
): number {
  const i = interactions;
  switch (session) {
    case 'qualifying':
      return i.aeroBalance * 0.8 + i.platformCompliance * 0.65
        + i.gearingDragPower * 0.9 + i.brakeBalanceCooling * 0.45
        + i.differentialRearStiffness * 0.3;
    case 'raceStart':
      return i.aeroBalance * 0.45 + i.platformCompliance * 0.9
        + i.gearingDragPower * 0.45 + i.brakeBalanceCooling * 0.75
        + i.differentialRearStiffness * 0.75 + i.fuelBalanceMigration;
    case 'raceStint':
      return i.aeroBalance * 0.4 + i.platformCompliance * 0.65
        + i.gearingDragPower * 0.55 + i.brakeBalanceCooling * 0.7
        + i.differentialRearStiffness * 0.8 + i.tyreMechanicalLoading
        + i.coolingPowerTraffic * 0.75 + i.fuelBalanceMigration * 0.65;
    case 'lateStint':
      return i.aeroBalance * 0.55 + i.platformCompliance * 0.45
        + i.gearingDragPower * 0.6 + i.brakeBalanceCooling * 0.65
        + i.differentialRearStiffness * 0.75 + i.tyreMechanicalLoading * 1.15
        + i.coolingPowerTraffic * 0.55 + i.fuelBalanceMigration;
    case 'traffic':
      return i.aeroBalance * 0.7 + i.platformCompliance * 0.45
        + i.brakeBalanceCooling * 0.7 + i.differentialRearStiffness * 0.55
        + i.tyreMechanicalLoading * 0.7 + i.coolingPowerTraffic * 1.25
        + i.fuelBalanceMigration * 0.55;
    case 'wet':
      return i.aeroBalance * 0.75 + i.platformCompliance
        + i.brakeBalanceCooling * 1.1 + i.differentialRearStiffness
        + i.tyreMechanicalLoading * 0.8 + i.fuelBalanceMigration * 0.7;
  }
}

function sessionEnvelope(
  session: SetupSessionKey,
  behaviors: AxisRecord,
  losses: AxisRecord,
  interactions: InteractionRecord,
): SetupSessionEnvelope {
  const behaviorLoss = weightedBehaviorLoss(losses, SESSION_WEIGHTS[session]);
  const coupledLoss = interactionContribution(interactions, session);
  const irreducibleCompromise = session === 'qualifying' ? 0.025 : 0.04;
  const lapTimeLossPct = round(
    clamp(irreducibleCompromise + behaviorLoss + coupledLoss, 0, 6),
  );
  const tyreWearDelta = round(
    (1 - behaviors.tyreControl) * 1.15
    + interactions.tyreMechanicalLoading * 1.4
    + (session === 'lateStint' ? 0.2 : 0),
  );
  const overheatingRisk = round(
    (1 - behaviors.coolingCapacity) * 0.8
    + interactions.coolingPowerTraffic * 1.5
    + interactions.brakeBalanceCooling * 0.65
    + (session === 'traffic' ? 0.25 : 0),
  );
  const reliabilityRisk = round(
    interactions.coolingPowerTraffic * 1.1
    + interactions.platformCompliance * 0.35
    + interactions.gearingDragPower * 0.2,
  );
  const mistakePressure = round(
    (1 - behaviors.brakingEntryStability) * 0.5
    + (1 - behaviors.traction) * 0.45
    + interactions.aeroBalance * 0.8
    + interactions.differentialRearStiffness * 0.75,
  );
  const consistencyLoss = round(
    (1 - behaviors.midCornerBalance) * 0.45
    + (1 - behaviors.tyreControl) * 0.35
    + interactions.fuelBalanceMigration * 0.8,
  );
  const balanceMigration = round(
    interactions.fuelBalanceMigration
    + Math.abs(behaviors.fuelLoadStability - behaviors.midCornerBalance) * 0.45,
  );

  return {
    lapTimeLossPct,
    paceDelta: round(-lapTimeLossPct * 2.6, 1),
    tyreWearDelta: clamp(tyreWearDelta, -1, 3),
    reliabilityRisk: clamp(reliabilityRisk, 0, 3),
    overheatingRisk: clamp(overheatingRisk, 0, 3),
    mistakePressure: clamp(mistakePressure, 0, 3),
    consistencyLoss: clamp(consistencyLoss, 0, 3),
    balanceMigration: clamp(balanceMigration, 0, 3),
  };
}

function componentFits(
  losses: AxisRecord,
  interactions: InteractionRecord,
): ComponentFit[] {
  const maps: Record<ComponentFit['component'], number[]> = {
    aero: [
      losses.mediumSpeedCornering,
      losses.highSpeedCornering,
      losses.straightLineEfficiency,
      losses.aeroPlatformStability,
      interactions.aeroBalance,
    ],
    mechanical: [
      losses.lowSpeedCornering,
      losses.bumpKerbCompliance,
      losses.fuelLoadStability,
      interactions.platformCompliance,
    ],
    gearing: [losses.straightLineEfficiency, interactions.gearingDragPower],
    brakes: [
      losses.brakingEntryStability,
      interactions.brakeBalanceCooling,
    ],
    differential: [
      losses.midCornerBalance,
      losses.traction,
      interactions.differentialRearStiffness,
    ],
    cooling: [
      losses.coolingCapacity,
      losses.trafficStability,
      interactions.coolingPowerTraffic,
    ],
    tyres: [
      losses.tyreWarmup,
      losses.tyreControl,
      interactions.tyreMechanicalLoading,
    ],
  };

  return SETUP_COMPONENTS.map(({ key }) => {
    const values = maps[key];
    const averageLoss = values.reduce((sum, value) => sum + value, 0) / values.length;
    return { component: key, fit: Math.round(clamp(100 - averageLoss * 50, 0, 100)) };
  });
}

function warningsFor(
  behaviors: AxisRecord,
  interactions: InteractionRecord,
  sessions: Record<SetupSessionKey, SetupSessionEnvelope>,
): string[] {
  const warnings: string[] = [];
  if (interactions.aeroBalance >= 0.2) warnings.push('Aero balance is creating high-speed instability.');
  if (interactions.platformCompliance >= 0.2) warnings.push('The platform is vulnerable to bottoming or losing compliance over bumps.');
  if (interactions.gearingDragPower >= 0.25) warnings.push('Wing, gearing and engine strength are costing straight-line performance.');
  if (interactions.brakeBalanceCooling >= 0.2) warnings.push('Brake balance or cooling is creating lockup and temperature exposure.');
  if (interactions.tyreMechanicalLoading >= 0.2) warnings.push('Mechanical loading is increasing long-run tyre degradation.');
  if (interactions.coolingPowerTraffic >= 0.2) warnings.push('Cooling is too tight for sustained power demand or traffic.');
  if (sessions.raceStart.balanceMigration >= 0.35) warnings.push('Balance will move significantly between heavy and low fuel.');
  if (behaviors.traction < 0.35) warnings.push('Rear traction is outside a dependable operating window.');
  return warnings;
}

export function calculateSetupPerformanceSnapshot(
  setup: CarSetup,
  track: Track,
  car?: Car,
  sharpnessOverride?: number,
): SetupPerformanceSnapshot {
  const sanitized = sanitizeSetupProfile(setup);
  const sharpness = sharpnessOverride ?? setupWindowSharpness(car);
  const behaviors = behaviorCapabilities(sanitized);
  const demands = behaviorDemands(track);
  const losses = behaviorLosses(behaviors, demands, sharpness);
  const interactions = interactionLosses(sanitized, track, car, sharpness);
  const sessions = {} as Record<SetupSessionKey, SetupSessionEnvelope>;
  for (const session of Object.keys(SESSION_WEIGHTS) as SetupSessionKey[]) {
    sessions[session] = sessionEnvelope(session, behaviors, losses, interactions);
  }
  const aggregateLoss =
    sessions.qualifying.lapTimeLossPct * 0.25
    + sessions.raceStart.lapTimeLossPct * 0.2
    + sessions.raceStint.lapTimeLossPct * 0.35
    + sessions.lateStint.lapTimeLossPct * 0.2;
  const components = componentFits(losses, interactions);
  const warnings = warningsFor(behaviors, interactions, sessions);

  return {
    behaviors,
    behaviorLosses: losses,
    interactionLosses: interactions,
    sessions,
    qualifyingLapTimeLossPct: sessions.qualifying.lapTimeLossPct,
    raceStartLapTimeLossPct: sessions.raceStart.lapTimeLossPct,
    longRunLapTimeLossPct: sessions.raceStint.lapTimeLossPct,
    lateStintLapTimeLossPct: sessions.lateStint.lapTimeLossPct,
    trafficLapTimeLossPct: sessions.traffic.lapTimeLossPct,
    wetLapTimeLossPct: sessions.wet.lapTimeLossPct,
    objectiveQuality: Math.round(clamp(100 - aggregateLoss * 27, 0, 100)),
    components,
    warnings,
  };
}
