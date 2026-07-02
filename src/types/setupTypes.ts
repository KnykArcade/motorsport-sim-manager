// Car Setup Workshop types.
//
// The player no longer picks a single setup "package". Instead they tune the
// engineering setup of the car across several components, each with tradeoffs.
// Cars still automatically run a qualifying trim on Saturday and a race trim on
// Sunday (professional preparation) — those trims are DERIVED from this tuned
// base setup (see sim/setupDerive.ts). Setup is separate from the qualifying run
// plan and the race strategy.

// Every tunable parameter is on a 1-10 scale. The "low"/"high" meaning of each
// is documented in data/setup/setupComponents.ts.
export type CarSetup = {
  // Aerodynamics
  frontWing: number;
  rearWing: number;
  // Suspension / mechanical grip
  suspensionStiffness: number;
  rideHeight: number;
  // Gear ratios / top speed (1 = short/low, 10 = long/high)
  gearing: number;
  // Brakes
  brakeBias: number; // 1 = rearward, 10 = forward, 5 = balanced
  brakeCooling: number;
  // Differential / traction (1 = stable, 10 = aggressive rotation)
  differential: number;
  // Cooling / reliability (1 = tight, 10 = open)
  engineCooling: number;
  // Tyre usage (1 = preserve, 10 = aggressive)
  tyreUsage: number;
};

export type SetupParamKey = keyof CarSetup;

export type SetupComponentKey =
  | 'aero'
  | 'mechanical'
  | 'gearing'
  | 'brakes'
  | 'differential'
  | 'cooling'
  | 'tyres';

export type SetupParamMeta = {
  key: SetupParamKey;
  component: SetupComponentKey;
  label: string;
  lowLabel: string;
  highLabel: string;
  description: string;
};

export type SetupComponentMeta = {
  key: SetupComponentKey;
  name: string;
  description: string;
  params: SetupParamKey[];
};

// Per-component fit score (0-100) plus the ideal target used to compute it.
export type ComponentFit = {
  component: SetupComponentKey;
  fit: number; // 0-100
};

// The qualitative effects a setup has, surfaced in the workshop UI and used to
// derive the session SetupOption the simulation consumes.
export type SetupEffects = {
  topSpeed: number; // 1-10
  cornering: number; // 1-10
  qualifyingPace: number; // delta, ~[-5, 3]
  racePace: number; // delta, ~[-5, 3]
  tyreWear: number; // delta, positive = more wear
  reliabilityRisk: number; // delta, positive = more risk
  mistakeRisk: number; // delta, positive = more risk
};

export type SetupFitResult = {
  overall: number; // 0-100 overall setup quality vs track
  confidence: number; // 0-100 driver confidence in the setup
  components: ComponentFit[];
  effects: SetupEffects;
  warnings: string[];
};

export type SetupFeedback = {
  driverFeedback: string[];
  engineerFeedback: string[];
  warnings: string[];
};

export type SetupPreset = {
  id: string;
  name: string;
  description: string;
  setup: CarSetup;
};

// ---------------------------------------------------------------------------
// Objective Setup Quality vs Driver Setup Comfort
//
// Two separate answers about a setup that interact but are not the same:
//   * Objective Setup Quality — the engineering answer: how well the setup
//     suits the track, weather, tyres and the CURRENT CAR package. Driver
//     independent.
//   * Driver Setup Comfort — the driver-feel answer: how comfortable this
//     specific driver is with this setup, driven by practice familiarity,
//     adaptability and setup-style preference. Per driver.
// ---------------------------------------------------------------------------

// What Objective Setup Quality drives in the sim.
export type ObjectiveSetupEffects = {
  qualifyingPaceCeiling: number; // delta, higher = more one-lap pace on tap
  racePaceCeiling: number; // delta, higher = more race pace on tap
  tyreWear: number; // positive = more wear
  reliabilityRisk: number; // positive = more risk
  overheatingRisk: number; // positive = more brake/engine overheating risk
};

export type ObjectiveSetupQuality = {
  quality: number; // 0-100 engineering fit vs track + car
  components: ComponentFit[];
  effects: ObjectiveSetupEffects;
  warnings: string[];
};

export type ComfortLabel = 'Unknown' | 'Uneasy' | 'Workable' | 'Comfortable' | 'Gelled';

// What Driver Setup Comfort drives in the sim.
export type DriverComfortEffects = {
  execution: number; // one-lap (qualifying) execution, +/- delta
  consistency: number; // race-stint consistency, +/- delta
  mistakeRisk: number; // positive = more mistakes
  lockupSpinRisk: number; // positive = more lockups/spins
  tyreManagement: number; // +/- delta, positive = manages tyres better
};

export type DriverComfort = {
  comfort: number; // 0-100
  label: ComfortLabel;
  familiarity: number; // 0-1 practice running banked on this setup family
  relevance: number; // 0-1 how relevant the practised data is to this setup
  changeDelta: number; // 0-1 normalised distance from the practised setup
  stale: boolean; // practised feedback no longer reflects the current setup
  effects: DriverComfortEffects;
  notes: string[];
};

// A knowledge-gated estimate: practice narrows the shown range and only reveals
// an exact value once knowledge is high enough.
export type Estimate = { low: number; high: number; exact?: number };

// Inferred (or, in future, explicit) driver setup-feel preferences. Each is a
// signed lean on a -1..1 scale (positive = wants that trait); adaptabilityWindow
// scales the comfort tolerance band.
export type SetupPreferences = {
  prefersStableRear: number;
  prefersSharpFrontEnd: number;
  prefersAggressiveDiff: number;
  prefersSoftSuspension: number;
  prefersLowDrag: number;
  prefersTyrePreservation: number;
  adaptabilityWindow: number; // ~0.4 (narrow) .. ~1.6 (wide)
};
