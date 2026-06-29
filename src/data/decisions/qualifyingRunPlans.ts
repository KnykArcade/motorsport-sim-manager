import type { QualifyingRunPlan } from '../../types/gameTypes';

// How a driver approaches the qualifying session. These are deliberately
// SEPARATE from race instructions so aggression can differ between phases.
export const qualifyingRunPlans: QualifyingRunPlan[] = [
  {
    id: 'BankerLapFirst',
    name: 'Banker Lap First',
    description: 'Set a safe time early, then improve. Lowers risk, modest pace.',
    paceModifier: -0.5, mistakeModifier: -0.4, crashModifier: -0.4,
    trafficModifier: 0, mechanicalStressModifier: 0, confidenceModifier: 0,
  },
  {
    id: 'StandardPush',
    name: 'Standard Push',
    description: 'A normal qualifying effort. Balanced risk and reward.',
    paceModifier: 0, mistakeModifier: 0, crashModifier: 0,
    trafficModifier: 0, mechanicalStressModifier: 0, confidenceModifier: 0,
  },
  {
    id: 'MaximumAttack',
    name: 'Maximum Attack',
    description: 'Everything on the line. Big pace, big crash & mistake risk.',
    paceModifier: 1.2, mistakeModifier: 0.8, crashModifier: 0.9,
    trafficModifier: 0, mechanicalStressModifier: 0.6, confidenceModifier: 0.3,
  },
  {
    id: 'ConservativeCleanLap',
    name: 'Conservative Clean Lap',
    description: 'Prioritise a clean, reliable grid slot over peak pace.',
    paceModifier: -0.8, mistakeModifier: -0.6, crashModifier: -0.7,
    trafficModifier: -0.2, mechanicalStressModifier: -0.4, confidenceModifier: 0,
  },
  {
    id: 'LateTrackEvolution',
    name: 'Late Track Evolution Gamble',
    description: 'Wait for the track to rubber in. Big upside, traffic/weather risk.',
    paceModifier: 0.8, mistakeModifier: 0.2, crashModifier: 0.2,
    trafficModifier: 0.8, mechanicalStressModifier: 0, confidenceModifier: 0,
  },
  {
    id: 'SaveTiresProtectCar',
    name: 'Save Tires / Protect Car',
    description: 'Hold back to protect tyres and machinery for the race.',
    paceModifier: -1, mistakeModifier: -0.5, crashModifier: -0.6,
    trafficModifier: 0, mechanicalStressModifier: -0.6, confidenceModifier: -0.1,
  },
];

export const qualifyingRunPlansById: Record<string, QualifyingRunPlan> =
  Object.fromEntries(qualifyingRunPlans.map((p) => [p.id, p]));
