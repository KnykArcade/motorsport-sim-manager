// Static metadata describing the Car Setup Workshop components, the tunable
// parameters inside each, and a set of quick-start presets. The presets give a
// sensible starting point; the player can still adjust every parameter after
// applying one.

import type {
  CarSetup,
  SetupComponentMeta,
  SetupParamMeta,
  SetupPreset,
} from '../../types/setupTypes';

export const SETUP_COMPONENTS: SetupComponentMeta[] = [
  {
    key: 'aero',
    name: 'Aerodynamics',
    description: 'Wing levels set the downforce/drag compromise — grip in the corners versus speed on the straights.',
    params: ['frontWing', 'rearWing'],
  },
  {
    key: 'mechanical',
    name: 'Suspension / Mechanical Grip',
    description: 'Stiffness and ride height trade responsiveness against compliance over kerbs and bumps.',
    params: ['suspensionStiffness', 'rideHeight'],
  },
  {
    key: 'gearing',
    name: 'Gear Ratios / Top Speed',
    description: 'Short gearing helps acceleration out of slow corners; long gearing raises top speed.',
    params: ['gearing'],
  },
  {
    key: 'brakes',
    name: 'Brakes',
    description: 'Bias and cooling affect stability under braking and brake temperatures over a stint.',
    params: ['brakeBias', 'brakeCooling'],
  },
  {
    key: 'differential',
    name: 'Differential / Traction',
    description: 'A stable diff aids traction and consistency; an aggressive diff sharpens rotation but risks mistakes.',
    params: ['differential'],
  },
  {
    key: 'cooling',
    name: 'Cooling / Reliability',
    description: 'Tight cooling cuts drag but raises temperatures; open cooling protects the engine at a small speed cost.',
    params: ['engineCooling'],
  },
  {
    key: 'tyres',
    name: 'Tyre Usage',
    description: 'Preserving tyres extends stints; aggressive usage finds lap time but degrades the tyres faster.',
    params: ['tyreUsage'],
  },
];

export const SETUP_PARAMS: Record<keyof CarSetup, SetupParamMeta> = {
  frontWing: {
    key: 'frontWing', component: 'aero', label: 'Front Wing',
    lowLabel: 'Trimmed', highLabel: 'Loaded',
    description: 'More front wing adds front-end grip and turn-in, at the cost of straight-line drag.',
  },
  rearWing: {
    key: 'rearWing', component: 'aero', label: 'Rear Wing',
    lowLabel: 'Trimmed', highLabel: 'Loaded',
    description: 'More rear wing adds stability and cornering grip but reduces top speed.',
  },
  suspensionStiffness: {
    key: 'suspensionStiffness', component: 'mechanical', label: 'Suspension Stiffness',
    lowLabel: 'Soft', highLabel: 'Stiff',
    description: 'Stiff suits smooth circuits and quick direction changes; soft absorbs bumps and kerbs.',
  },
  rideHeight: {
    key: 'rideHeight', component: 'mechanical', label: 'Ride Height',
    lowLabel: 'Low', highLabel: 'High',
    description: 'Low maximises aero but risks bottoming out; high is safer on bumpy or kerb-heavy tracks.',
  },
  gearing: {
    key: 'gearing', component: 'gearing', label: 'Gear Ratios',
    lowLabel: 'Short', highLabel: 'Long',
    description: 'Short gearing accelerates harder out of slow corners; long gearing tops out faster on straights.',
  },
  brakeBias: {
    key: 'brakeBias', component: 'brakes', label: 'Brake Bias',
    lowLabel: 'Rearward', highLabel: 'Forward',
    description: 'A balanced bias is most stable; extreme bias risks locking a wheel under heavy braking.',
  },
  brakeCooling: {
    key: 'brakeCooling', component: 'brakes', label: 'Brake Cooling',
    lowLabel: 'Closed', highLabel: 'Open',
    description: 'More cooling controls brake temperatures on heavy-braking tracks; less reduces drag.',
  },
  differential: {
    key: 'differential', component: 'differential', label: 'Differential',
    lowLabel: 'Stable', highLabel: 'Aggressive',
    description: 'Stable aids traction and tyre life; aggressive sharpens corner exit but unsettles the car.',
  },
  engineCooling: {
    key: 'engineCooling', component: 'cooling', label: 'Engine Cooling',
    lowLabel: 'Tight', highLabel: 'Open',
    description: 'Open cooling protects reliability at punishing tracks; tight cooling trims drag for speed.',
  },
  tyreUsage: {
    key: 'tyreUsage', component: 'tyres', label: 'Tyre Usage',
    lowLabel: 'Preserve', highLabel: 'Aggressive',
    description: 'Preserve for long stints and consistency; aggressive for one-lap pace at the cost of degradation.',
  },
};

export const BALANCED_SETUP: CarSetup = {
  frontWing: 5,
  rearWing: 5,
  suspensionStiffness: 5,
  rideHeight: 5,
  gearing: 5,
  brakeBias: 5,
  brakeCooling: 5,
  differential: 5,
  engineCooling: 5,
  tyreUsage: 5,
};

export const SETUP_PRESETS: SetupPreset[] = [
  {
    id: 'preset-balanced',
    name: 'Balanced',
    description: 'A safe all-round compromise with no major weakness.',
    setup: { ...BALANCED_SETUP },
  },
  {
    id: 'preset-high-df',
    name: 'High Downforce',
    description: 'Maximum wing for technical, cornering-heavy circuits.',
    setup: { ...BALANCED_SETUP, frontWing: 8, rearWing: 8, gearing: 4, differential: 6 },
  },
  {
    id: 'preset-low-df',
    name: 'Low Downforce',
    description: 'Trimmed wings and long gears for power circuits.',
    setup: { ...BALANCED_SETUP, frontWing: 3, rearWing: 2, gearing: 8, engineCooling: 6 },
  },
  {
    id: 'preset-mech-grip',
    name: 'Mechanical Grip',
    description: 'Soft, higher suspension for bumpy, slow-speed tracks.',
    setup: { ...BALANCED_SETUP, suspensionStiffness: 3, rideHeight: 7, differential: 4, frontWing: 6, rearWing: 6 },
  },
  {
    id: 'preset-reliability',
    name: 'Reliability Focus',
    description: 'Open cooling and conservative settings to protect the car.',
    setup: { ...BALANCED_SETUP, engineCooling: 8, brakeCooling: 7, differential: 4, tyreUsage: 4 },
  },
  {
    id: 'preset-tyre-preservation',
    name: 'Tyre Preservation',
    description: 'Gentle on the tyres for long stints and consistency.',
    setup: { ...BALANCED_SETUP, tyreUsage: 2, differential: 4, suspensionStiffness: 4 },
  },
];

export const SETUP_PRESETS_BY_ID: Record<string, SetupPreset> = Object.fromEntries(
  SETUP_PRESETS.map((p) => [p.id, p]),
);
