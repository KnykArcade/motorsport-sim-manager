// Setup fit engine.
//
// Scores how well a tuned CarSetup matches a track's demands (and the driver's
// preferences), producing per-component fit, an overall setup quality, a driver
// confidence value, and the qualitative effects shown in the workshop. Practice
// feedback is generated from the signed gaps between the setup and the ideal,
// so it hints at a direction without revealing the perfect setup.

import type { Car, Driver, Track } from '../types/gameTypes';
import type {
  CarSetup,
  ComponentFit,
  ObjectiveSetupEffects,
  ObjectiveSetupQuality,
  SetupComponentKey,
  SetupEffects,
  SetupFeedback,
  SetupFitResult,
} from '../types/setupTypes';
import { BALANCED_SETUP, SETUP_COMPONENTS } from '../data/setup/setupComponents';
import { effectiveCarRatings } from './trackFitEngine';
import { toLegacyRating } from './ratingScale';

function clamp(v: number, lo = 1, hi = 10): number {
  return Math.max(lo, Math.min(hi, v));
}

// The engineer's initial baseline setup at the start of a weekend: a coarse,
// track/car-appropriate starting point (half-way between neutral and the ideal),
// not a solved setup. Practice is run on this baseline family, and the player
// refines it in the workshop afterwards.
export function initialBaselineSetup(track: Track, car?: Car): CarSetup {
  const ideal = idealSetup(track, undefined, car);
  const out = {} as CarSetup;
  for (const key of Object.keys(BALANCED_SETUP) as (keyof CarSetup)[]) {
    out[key] = clamp(Math.round((BALANCED_SETUP[key] + ideal[key]) / 2));
  }
  return out;
}

// The track-and-driver-specific ideal value for every tunable parameter, also
// shaped by the CURRENT CAR package when one is supplied: a strong aero car can
// run slightly less wing and keep its grip; a low-power car needs less drag on
// power circuits; a weak mechanical-grip car wants softer suspension and a safer
// diff; a fragile car needs more cooling and more conservative tyre usage.
export function idealSetup(track: Track, driver?: Driver, car?: Car): CarSetup {
  const a = track.attributes;
  const p = track.setupProfile;

  // Driver preference shifts (small). Ratings are on a 1-100 scale, pivot at 50.
  const aggro = driver ? (toLegacyRating(driver.ratings.aggression) - 5) / 5 : 0;
  const lowComposure = driver ? Math.max(0, (5 - toLegacyRating(driver.ratings.composure)) / 5) : 0;

  const base: CarSetup = {
    frontWing: clamp(toLegacyRating(p.aeroDemand)),
    rearWing: clamp(toLegacyRating(p.aeroDemand) - (toLegacyRating(a.straights) >= 8 ? 1 : 0)),
    suspensionStiffness: clamp(11 - toLegacyRating(a.surfaceGripBumpiness) + aggro * 0.8),
    rideHeight: clamp(2 + toLegacyRating(a.surfaceGripBumpiness) * 0.6),
    gearing: clamp((toLegacyRating(p.powerDemand) + toLegacyRating(a.straights)) / 2),
    brakeBias: 5,
    brakeCooling: clamp(toLegacyRating(p.brakeDemand)),
    differential: clamp((toLegacyRating(a.tractionAcceleration) + toLegacyRating(a.technical)) / 2 + aggro * 1.2 - lowComposure),
    engineCooling: clamp((toLegacyRating(p.reliabilityRiskFocus) + toLegacyRating(p.powerDemand)) / 2),
    tyreUsage: clamp(11 - toLegacyRating(a.enduranceConsistency) + aggro * 0.6),
  };
  if (!car) return base;
  return applyCarShaping(base, track, car);
}

// Shift a track's ideal setup to suit the current car package. Deltas are on the
// 1-10 parameter scale, normalised around a mid car (rating 5).
function applyCarShaping(base: CarSetup, track: Track, car: Car): CarSetup {
  const c = effectiveCarRatings(car);
  const aero = (toLegacyRating(c.aeroEfficiency) - 5) / 5; // -1..1
  const power = (toLegacyRating(c.enginePower) - 5) / 5;
  const mech = (toLegacyRating(c.mechanicalGrip) - 5) / 5;
  const reli = (toLegacyRating(c.reliability) - 5) / 5;
  const powerCircuit = track.attributes.straights >= 70 || track.setupProfile.powerDemand >= 70;
  // A low-power car on a power circuit especially wants to shed drag.
  const lowPowerTrim = powerCircuit ? Math.max(0, -power) : 0;

  return {
    ...base,
    // High aero efficiency => less wing needed; strong engine => tolerate more
    // wing (recover on the straights); low power on a power track => trim wing.
    frontWing: clamp(base.frontWing - aero * 0.8 + power * 0.4 - lowPowerTrim * 0.8),
    rearWing: clamp(base.rearWing - aero * 0.9 + power * 0.5 - lowPowerTrim * 1.0),
    gearing: clamp(base.gearing + power * 0.4 + lowPowerTrim * 0.4),
    // Weak mechanical grip => softer suspension and a safer differential.
    suspensionStiffness: clamp(base.suspensionStiffness + mech * 0.8),
    differential: clamp(base.differential + mech * 0.6),
    // Fragile car => more cooling and more conservative tyre usage.
    engineCooling: clamp(base.engineCooling - reli * 1.2),
    tyreUsage: clamp(base.tyreUsage + reli * 0.5),
  };
}

// More adaptable drivers tolerate a wider setup window before losing confidence.
function tolerance(driver?: Driver): number {
  const adapt = driver ? (toLegacyRating(driver.ratings.adaptability) - 5) / 5 : 0;
  return 1.45 + adapt * 0.65;
}

function paramFit(value: number, ideal: number, tol: number): number {
  const gap = Math.abs(value - ideal);
  const penalty = Math.pow(gap / tol, 1.25) * 44;
  return Math.max(0, Math.min(100, 100 - penalty));
}

function componentFit(
  component: SetupComponentKey,
  setup: CarSetup,
  ideal: CarSetup,
  tol: number,
): number {
  const meta = SETUP_COMPONENTS.find((c) => c.key === component);
  if (!meta) return 0;
  const fits = meta.params.map((k) => paramFit(setup[k], ideal[k], tol));
  return fits.reduce((s, v) => s + v, 0) / fits.length;
}

export function calculateAeroSetupFit(setup: CarSetup, track: Track, driver?: Driver): number {
  return componentFit('aero', setup, idealSetup(track, driver), tolerance(driver));
}
export function calculateMechanicalSetupFit(setup: CarSetup, track: Track, driver?: Driver): number {
  return componentFit('mechanical', setup, idealSetup(track, driver), tolerance(driver));
}
export function calculateGearSetupFit(setup: CarSetup, track: Track, driver?: Driver): number {
  return componentFit('gearing', setup, idealSetup(track, driver), tolerance(driver));
}
export function calculateBrakeSetupFit(setup: CarSetup, track: Track, driver?: Driver): number {
  return componentFit('brakes', setup, idealSetup(track, driver), tolerance(driver));
}
export function calculateCoolingSetupFit(setup: CarSetup, track: Track, driver?: Driver): number {
  return componentFit('cooling', setup, idealSetup(track, driver), tolerance(driver));
}
export function calculateTireSetupFit(setup: CarSetup, track: Track, driver?: Driver): number {
  return componentFit('tyres', setup, idealSetup(track, driver), tolerance(driver));
}

// Track-influenced weighting: components the circuit cares about count more.
function componentWeights(track: Track): Record<SetupComponentKey, number> {
  const a = track.attributes;
  const p = track.setupProfile;
  return {
    aero: 1.0,
    mechanical: 0.6 + toLegacyRating(a.surfaceGripBumpiness) / 2 + toLegacyRating(a.corners) / 2,
    gearing: 0.4 + toLegacyRating(p.powerDemand) / 1.5,
    brakes: 0.4 + toLegacyRating(p.brakeDemand) / 1.5,
    differential: 0.4 + toLegacyRating(a.tractionAcceleration) / 2,
    cooling: 0.4 + toLegacyRating(p.reliabilityRiskFocus) / 1.5,
    tyres: 0.5 + toLegacyRating(a.enduranceConsistency) / 2,
  };
}

export function calculateComponentFits(setup: CarSetup, track: Track, driver?: Driver): ComponentFit[] {
  const ideal = idealSetup(track, driver);
  const tol = tolerance(driver);
  return SETUP_COMPONENTS.map((c) => ({
    component: c.key,
    fit: Math.round(componentFit(c.key, setup, ideal, tol)),
  }));
}

export function calculateOverallSetupConfidence(setup: CarSetup, track: Track, driver?: Driver): number {
  const weights = componentWeights(track);
  const fits = calculateComponentFits(setup, track, driver);
  let weighted = 0;
  let total = 0;
  for (const f of fits) {
    const w = weights[f.component];
    weighted += f.fit * w;
    total += w;
  }
  const overall = total > 0 ? weighted / total : 0;
  const adapt = driver ? (toLegacyRating(driver.ratings.adaptability) - 6) * 2 : 0;
  return Math.max(0, Math.min(100, Math.round(overall * 0.9 + adapt)));
}

function effects(setup: CarSetup, confidence: number): SetupEffects {
  const downforce = (setup.frontWing + setup.rearWing) / 2;
  const topSpeed = clamp(Math.round(((11 - downforce) + setup.gearing) / 2));
  const cornering = clamp(Math.round(downforce * 0.45 + (11 - setup.suspensionStiffness) * 0.2 + setup.differential * 0.15 + 1));
  return {
    topSpeed,
    cornering,
    qualifyingPace: round1((confidence - 62) / 12),
    racePace: round1((confidence - 62) / 14),
    tyreWear: round1((62 - confidence) / 40 + (setup.tyreUsage - 5) * 0.06),
    reliabilityRisk: round1((62 - confidence) / 55 + (5 - setup.engineCooling) * 0.04),
    mistakeRisk: round1((62 - confidence) / 50 + (setup.differential - 5) * 0.03 + Math.abs(setup.brakeBias - 5) * 0.02),
  };
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function buildWarnings(setup: CarSetup, track: Track, components: ComponentFit[]): string[] {
  const warnings: string[] = [];
  for (const c of components) {
    if (c.fit < 35) {
      const name = SETUP_COMPONENTS.find((m) => m.key === c.component)?.name ?? c.component;
      warnings.push(`${name} setup is well outside the ideal window for this circuit.`);
    }
  }
  if (setup.tyreUsage >= 8) warnings.push('Very aggressive tyre usage — expect high degradation and possible blistering.');
  if (setup.engineCooling <= 2) warnings.push('Tight cooling risks the engine overheating over a stint.');
  if (setup.rideHeight <= 2 && track.attributes.surfaceGripBumpiness >= 70) {
    warnings.push('Very low ride height on a bumpy track risks bottoming out.');
  }
  if (Math.abs(setup.brakeBias - 5) >= 4) warnings.push('Extreme brake bias risks locking a wheel under braking.');
  return warnings;
}

export function calculateSetupFit(setup: CarSetup, track: Track, driver?: Driver): SetupFitResult {
  const components = calculateComponentFits(setup, track, driver);
  const confidence = calculateOverallSetupConfidence(setup, track, driver);
  const weights = componentWeights(track);
  let weighted = 0;
  let total = 0;
  for (const f of components) {
    weighted += f.fit * weights[f.component];
    total += weights[f.component];
  }
  const overall = Math.round(total > 0 ? weighted / total : 0);
  return {
    overall,
    confidence,
    components,
    effects: effects(setup, confidence),
    warnings: buildWarnings(setup, track, components),
  };
}

// ---------------------------------------------------------------------------
// Objective Setup Quality — the engineering answer, car-aware and driver-free.
// This is what suits the track + weather + tyres + CURRENT CAR package, and it
// drives pace ceilings, tyre wear and reliability/overheating risk. The driver's
// feel for the setup is a separate axis (see driverComfortEngine).
// ---------------------------------------------------------------------------

// A fixed engineering tolerance: the objective quality does not widen with a
// driver's adaptability (that is a comfort concern), so use a neutral window.
const OBJECTIVE_TOLERANCE = 1.55;

// Compute an adjusted tolerance based on team capability, staff, and practice.
// Better teams/staff and more practice tighten the window (easier to nail the
// setup). Worse teams or no practice widen it (harder to get close to ideal).
export function adjustedSetupTolerance(
  baseTolerance: number,
  teamRaceOps: number,
  staffSetupBonus: number,
  practiceSetupKnowledge: number,
): number {
  // Wider tolerance means the team can land inside the useful setup window more
  // easily. Better race ops, better engineers, and more practice should help;
  // weak preparation should make the window unforgiving.
  const opsFactor = (teamRaceOps - 5) * 0.12;
  const staffFactor = staffSetupBonus * 0.035;
  const practiceFactor = (practiceSetupKnowledge - 0.5) * 0.9;
  return Math.max(0.95, Math.min(2.6, baseTolerance + opsFactor + staffFactor + practiceFactor));
}

export function objectiveSetupQuality(
  setup: CarSetup,
  track: Track,
  car?: Car,
  tolerance?: number,
): ObjectiveSetupQuality {
  const ideal = idealSetup(track, undefined, car);
  const tol = tolerance ?? OBJECTIVE_TOLERANCE;
  const weights = componentWeights(track);
  const components: ComponentFit[] = SETUP_COMPONENTS.map((c) => ({
    component: c.key,
    fit: Math.round(componentFit(c.key, setup, ideal, tol)),
  }));
  let weighted = 0;
  let total = 0;
  for (const f of components) {
    weighted += f.fit * weights[f.component];
    total += weights[f.component];
  }
  const quality = Math.round(total > 0 ? weighted / total : 0);
  return {
    quality,
    components,
    effects: objectiveEffects(setup, track, car, quality),
    warnings: buildWarnings(setup, track, components),
  };
}

function objectiveEffects(
  setup: CarSetup,
  track: Track,
  car: Car | undefined,
  quality: number,
): ObjectiveSetupEffects {
  // Reliability of the underlying car: a fragile car is punished far harder by
  // tight cooling than a bulletproof one.
  const reli = car ? (toLegacyRating(effectiveCarRatings(car).reliability) - 5) / 5 : 0; // -1..1
  const coolingShort = Math.max(0, 5 - setup.engineCooling); // how tight cooling is
  const brakeShort = Math.max(0, track.setupProfile.brakeDemand - setup.brakeCooling);
  return {
    qualifyingPaceCeiling: round1((quality - 62) / 12),
    racePaceCeiling: round1((quality - 62) / 14),
    tyreWear: round1((62 - quality) / 40 + (setup.tyreUsage - 5) * 0.06),
    reliabilityRisk: round1((62 - quality) / 55 + coolingShort * 0.06 * (1 - reli * 0.6)),
    overheatingRisk: round1(
      coolingShort * 0.07 * (1 - reli * 0.5) +
        brakeShort * 0.05 +
        (track.setupProfile.reliabilityRiskFocus - 5) * 0.03,
    ),
  };
}

// A compact read of the current car package's strengths and weaknesses, on the
// same effective-ratings basis Objective Setup Quality uses. Practice feedback
// consumes this so its hints reflect the actual car — a weak-mechanical-grip car
// talks about traction and rear grip, a fragile car about cooling, and so on —
// instead of a track/driver-only picture that can contradict the setup model.
export type CarSetupTraits = {
  weakAero: boolean;
  strongAero: boolean;
  weakMechGrip: boolean;
  weakReliability: boolean;
  strongEngine: boolean;
  weakEngine: boolean;
  // Low mechanical grip stresses the rear tyres — degradation is a live concern.
  tyreStress: boolean;
};

export function carSetupTraits(car?: Car): CarSetupTraits {
  if (!car) {
    return {
      weakAero: false,
      strongAero: false,
      weakMechGrip: false,
      weakReliability: false,
      strongEngine: false,
      weakEngine: false,
      tyreStress: false,
    };
  }
  const c = effectiveCarRatings(car);
  return {
    weakAero: toLegacyRating(c.aeroEfficiency) < 4.5,
    strongAero: toLegacyRating(c.aeroEfficiency) >= 7,
    weakMechGrip: toLegacyRating(c.mechanicalGrip) < 4.5,
    weakReliability: toLegacyRating(c.reliability) < 4.5,
    strongEngine: toLegacyRating(c.enginePower) >= 6.75,
    weakEngine: toLegacyRating(c.enginePower) < 4.5,
    tyreStress: toLegacyRating(c.mechanicalGrip) < 5,
  };
}

// The shared "core model" behind both the Car Setup Workshop's Objective Setup
// Quality read-out and the practice feedback: one evaluation of a setup against
// the track AND the current car package, plus the car's trait profile. Keeping
// both surfaces on this single function is what stops practice feedback from
// contradicting the objective setup evaluation.
export type SetupTrackCarEvaluation = {
  objective: ObjectiveSetupQuality;
  ideal: CarSetup;
  traits: CarSetupTraits;
};

export function evaluateSetupAgainstTrackAndCar(
  setup: CarSetup,
  track: Track,
  car?: Car,
  driver?: Driver,
): SetupTrackCarEvaluation {
  return {
    objective: objectiveSetupQuality(setup, track, car),
    ideal: idealSetup(track, driver, car),
    traits: carSetupTraits(car),
  };
}

// Practice feedback: directional hints from the signed gap to the ideal. Never
// reveals the exact ideal — only nudges the player toward a better window.
export function generateSetupFeedback(
  setup: CarSetup,
  track: Track,
  driver?: Driver,
  car?: Car,
): SetupFeedback {
  const ideal = idealSetup(track, driver, car);
  const a = track.attributes;
  const traits = carSetupTraits(car);
  const driverFeedback: string[] = [];
  const engineerFeedback: string[] = [];

  const wing = (setup.frontWing + setup.rearWing) / 2;
  const wingIdeal = (ideal.frontWing + ideal.rearWing) / 2;
  if (wing < wingIdeal - 1.5) {
    driverFeedback.push('The car feels nervous and lacks grip through the corners.');
    engineerFeedback.push('We could add wing — there is more cornering grip available.');
  } else if (wing > wingIdeal + 1.5) {
    driverFeedback.push('We are losing too much time on the straights.');
    engineerFeedback.push('There is too much drag; trimming wing would help top speed.');
  }

  if (setup.gearing < ideal.gearing - 1.5) {
    engineerFeedback.push('Hitting the rev limiter before braking — longer gears would help.');
  } else if (setup.gearing > ideal.gearing + 1.5) {
    driverFeedback.push('Bogging down on the exit of the slow corners.');
  }

  if (a.surfaceGripBumpiness >= 60 && (setup.suspensionStiffness > ideal.suspensionStiffness + 1.5 || setup.rideHeight < ideal.rideHeight - 1.5)) {
    driverFeedback.push('The car is bottoming out and skittish over the bumps.');
  }

  if (setup.brakeCooling < ideal.brakeCooling - 1.5) {
    engineerFeedback.push('Brake temperatures are climbing on the long runs.');
  }
  if (Math.abs(setup.brakeBias - 5) >= 3) {
    driverFeedback.push('Locking a wheel under heavy braking.');
  }

  if (setup.engineCooling < ideal.engineCooling - 1.5) {
    engineerFeedback.push('Engine temperatures are high — consider opening the cooling.');
  }

  if (setup.differential > ideal.differential + 2) {
    driverFeedback.push('Struggling for traction on corner exit.');
  }

  if (setup.tyreUsage > ideal.tyreUsage + 1.5) {
    driverFeedback.push('Rear tyres are overheating on the long runs.');
  }

  // Car-package weaknesses colour the engineer's read so it aligns with the
  // Objective Setup Quality model rather than the track/driver picture alone.
  if (traits.weakMechGrip) {
    driverFeedback.push('The car is short on mechanical grip — traction and rear stability out of the slow corners are the limit.');
  }
  if (traits.weakAero) {
    driverFeedback.push('It lacks aero load in the high-speed corners — hard to commit through the quick stuff.');
  }
  if (traits.weakReliability) {
    engineerFeedback.push('This package runs hot — keep cooling and tyre usage conservative to protect it.');
  }
  if (traits.tyreStress) {
    engineerFeedback.push('The car is hard on its rear tyres — degradation will drive the race strategy.');
  }

  const confidence = calculateOverallSetupConfidence(setup, track, driver);
  if (confidence >= 75) driverFeedback.push('Driver confidence is improving — the car is in a good window.');
  if (driverFeedback.length === 0) driverFeedback.push('The car feels balanced; only fine-tuning left.');
  if (engineerFeedback.length === 0) engineerFeedback.push('Setup looks well matched to the circuit demands.');

  return {
    driverFeedback,
    engineerFeedback,
    warnings: buildWarnings(setup, track, calculateComponentFits(setup, track, driver)),
  };
}
