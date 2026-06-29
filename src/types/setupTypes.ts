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
