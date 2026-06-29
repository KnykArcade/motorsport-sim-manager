import type { DriverInstruction } from '../../types/gameTypes';

// Race driver instructions. Independent from qualifying run plans.
export const driverInstructions: DriverInstruction[] = [
  {
    id: 'Conservative',
    name: 'Conservative',
    description: 'Drive within limits, minimise mistakes and wear.',
    paceModifier: -0.4, mistakeModifier: -0.5, overtakeModifier: -0.3,
    tireWearModifier: -0.4, reliabilityStressModifier: -0.4,
  },
  {
    id: 'Balanced',
    name: 'Balanced',
    description: 'A measured race pace. The default approach.',
    paceModifier: 0, mistakeModifier: 0, overtakeModifier: 0,
    tireWearModifier: 0, reliabilityStressModifier: 0,
  },
  {
    id: 'Aggressive',
    name: 'Aggressive',
    description: 'Push the pace and look for passes. More wear and risk.',
    paceModifier: 0.5, mistakeModifier: 0.3, overtakeModifier: 0.4,
    tireWearModifier: 0.4, reliabilityStressModifier: 0.3,
  },
  {
    id: 'MaximumAttack',
    name: 'Maximum Attack',
    description: 'Flat out. Maximum pace, maximum risk to car and driver.',
    paceModifier: 0.9, mistakeModifier: 0.7, overtakeModifier: 0.7,
    tireWearModifier: 0.7, reliabilityStressModifier: 0.6,
  },
  {
    id: 'ProtectCar',
    name: 'Protect Car',
    description: 'Nurse the car home. Reliability first.',
    paceModifier: -0.6, mistakeModifier: -0.6, overtakeModifier: -0.4,
    tireWearModifier: -0.6, reliabilityStressModifier: -0.7,
  },
  {
    id: 'PrioritizePoints',
    name: 'Prioritize Points',
    description: 'Balance pace and safety to bank a points finish.',
    paceModifier: -0.1, mistakeModifier: -0.3, overtakeModifier: 0,
    tireWearModifier: -0.2, reliabilityStressModifier: -0.2,
  },
  {
    id: 'HoldPosition',
    name: 'Hold Position',
    description: 'Maintain current track position; avoid unnecessary fights.',
    paceModifier: -0.2, mistakeModifier: -0.3, overtakeModifier: -0.5,
    tireWearModifier: -0.3, reliabilityStressModifier: -0.2,
  },
  {
    id: 'SupportTeammate',
    name: 'Support Teammate',
    description: 'Cede position to and assist the lead teammate.',
    paceModifier: -0.2, mistakeModifier: -0.2, overtakeModifier: -0.2,
    tireWearModifier: -0.1, reliabilityStressModifier: -0.1,
  },
  {
    id: 'AttackTeammate',
    name: 'Attack Teammate',
    description: 'Race the teammate hard. Risk of intra-team incidents.',
    paceModifier: 0.4, mistakeModifier: 0.4, overtakeModifier: 0.4,
    tireWearModifier: 0.3, reliabilityStressModifier: 0.2,
  },
  {
    id: 'DefendTrackPosition',
    name: 'Defend Track Position',
    description: 'Focus on defending against cars behind.',
    paceModifier: 0, mistakeModifier: -0.1, overtakeModifier: -0.2,
    tireWearModifier: 0.1, reliabilityStressModifier: 0,
  },
];

export const driverInstructionsById: Record<string, DriverInstruction> =
  Object.fromEntries(driverInstructions.map((i) => [i.id, i]));
