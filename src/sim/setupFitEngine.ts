// Setup fit engine.
//
// Scores how well a tuned CarSetup matches a track's demands (and the driver's
// preferences), producing per-component fit, an overall setup quality, a driver
// confidence value, and the qualitative effects shown in the workshop. Practice
// feedback is generated from the signed gaps between the setup and the ideal,
// so it hints at a direction without revealing the perfect setup.

import type { Driver, Track } from '../types/gameTypes';
import type {
  CarSetup,
  ComponentFit,
  SetupComponentKey,
  SetupEffects,
  SetupFeedback,
  SetupFitResult,
} from '../types/setupTypes';
import { SETUP_COMPONENTS } from '../data/setup/setupComponents';

function clamp(v: number, lo = 1, hi = 10): number {
  return Math.max(lo, Math.min(hi, v));
}

// The track-and-driver-specific ideal value for every tunable parameter.
export function idealSetup(track: Track, driver?: Driver): CarSetup {
  const a = track.attributes;
  const p = track.setupProfile;

  // Driver preference shifts (small). Ratings are on a 1-10 scale, pivot at 5.
  const aggro = driver ? (driver.ratings.aggression - 5) / 5 : 0;
  const lowComposure = driver ? Math.max(0, (5 - driver.ratings.composure) / 5) : 0;

  return {
    frontWing: clamp(p.aeroDemand),
    rearWing: clamp(p.aeroDemand - (a.straights >= 8 ? 1 : 0)),
    suspensionStiffness: clamp(11 - a.surfaceGripBumpiness + aggro * 0.8),
    rideHeight: clamp(2 + a.surfaceGripBumpiness * 0.6),
    gearing: clamp((p.powerDemand + a.straights) / 2),
    brakeBias: 5,
    brakeCooling: clamp(p.brakeDemand),
    differential: clamp((a.tractionAcceleration + a.technical) / 2 + aggro * 1.2 - lowComposure),
    engineCooling: clamp((p.reliabilityRiskFocus + p.powerDemand) / 2),
    tyreUsage: clamp(11 - a.enduranceConsistency + aggro * 0.6),
  };
}

// More adaptable drivers tolerate a wider setup window before losing confidence.
function tolerance(driver?: Driver): number {
  const adapt = driver ? (driver.ratings.adaptability - 5) / 5 : 0;
  return 2.0 + adapt * 1.0;
}

function paramFit(value: number, ideal: number, tol: number): number {
  const gap = Math.abs(value - ideal);
  return Math.max(0, Math.min(100, 100 - (gap / tol) * 35));
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
    mechanical: 0.6 + a.surfaceGripBumpiness / 20 + a.corners / 20,
    gearing: 0.4 + p.powerDemand / 15,
    brakes: 0.4 + p.brakeDemand / 15,
    differential: 0.4 + a.tractionAcceleration / 20,
    cooling: 0.4 + p.reliabilityRiskFocus / 15,
    tyres: 0.5 + a.enduranceConsistency / 20,
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
  const adapt = driver ? (driver.ratings.adaptability - 6) * 2 : 0;
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
  if (setup.rideHeight <= 2 && track.attributes.surfaceGripBumpiness >= 7) {
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

// Practice feedback: directional hints from the signed gap to the ideal. Never
// reveals the exact ideal — only nudges the player toward a better window.
export function generateSetupFeedback(setup: CarSetup, track: Track, driver?: Driver): SetupFeedback {
  const ideal = idealSetup(track, driver);
  const a = track.attributes;
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

  if (a.surfaceGripBumpiness >= 6 && (setup.suspensionStiffness > ideal.suspensionStiffness + 1.5 || setup.rideHeight < ideal.rideHeight - 1.5)) {
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
