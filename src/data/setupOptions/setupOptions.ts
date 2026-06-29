import type { SetupOption } from '../../types/gameTypes';

// Setup packages applied to a car for a session. The qualifying phase and the
// race phase each pick their own setup, so the player can run an aggressive
// qualifying trim and a conservative race trim (or vice versa).
export const setupOptions: SetupOption[] = [
  {
    id: 'setup-balanced',
    name: 'Balanced',
    description: 'A safe all-round compromise with no major weakness.',
    downforce: 5, topSpeed: 5, mechanicalGrip: 5, brakingStability: 5,
    tirePreservation: 5, reliabilityProtection: 5, qualifyingBoost: 0,
    racePaceBoost: 0, riskModifier: 0,
  },
  {
    id: 'setup-low-df',
    name: 'Low Downforce / Top Speed',
    description: 'Trimmed wings for straight-line speed. Strong at power tracks.',
    downforce: 2, topSpeed: 9, mechanicalGrip: 4, brakingStability: 4,
    tirePreservation: 5, reliabilityProtection: 5, qualifyingBoost: 1,
    racePaceBoost: 0, riskModifier: 1,
  },
  {
    id: 'setup-medium-df',
    name: 'Medium Downforce',
    description: 'Slightly more wing than balanced for flowing circuits.',
    downforce: 6, topSpeed: 5, mechanicalGrip: 6, brakingStability: 5,
    tirePreservation: 5, reliabilityProtection: 5, qualifyingBoost: 0,
    racePaceBoost: 1, riskModifier: 0,
  },
  {
    id: 'setup-high-df',
    name: 'High Downforce / Cornering',
    description: 'High wing for technical, cornering-heavy tracks.',
    downforce: 8, topSpeed: 3, mechanicalGrip: 7, brakingStability: 6,
    tirePreservation: 4, reliabilityProtection: 5, qualifyingBoost: 1,
    racePaceBoost: 1, riskModifier: 0,
  },
  {
    id: 'setup-max-df',
    name: 'Maximum Downforce',
    description: 'Everything bolted on. Best for Monaco-style street tracks.',
    downforce: 10, topSpeed: 1, mechanicalGrip: 8, brakingStability: 7,
    tirePreservation: 4, reliabilityProtection: 5, qualifyingBoost: 2,
    racePaceBoost: 1, riskModifier: 0,
  },
  {
    id: 'setup-mech-grip',
    name: 'Mechanical Grip Focus',
    description: 'Suspension biased for bumpy, slow-speed, traction tracks.',
    downforce: 6, topSpeed: 4, mechanicalGrip: 9, brakingStability: 6,
    tirePreservation: 6, reliabilityProtection: 5, qualifyingBoost: 0,
    racePaceBoost: 1, riskModifier: -1,
  },
  {
    id: 'setup-reliability',
    name: 'Reliability Focus',
    description: 'Conservative settings to protect the car at punishing tracks.',
    downforce: 5, topSpeed: 4, mechanicalGrip: 5, brakingStability: 6,
    tirePreservation: 7, reliabilityProtection: 9, qualifyingBoost: -1,
    racePaceBoost: 0, riskModifier: -2,
  },
  {
    id: 'setup-quali-trim',
    name: 'Aggressive Qualifying Trim',
    description: 'Maximum one-lap pace at the cost of race-day reliability.',
    downforce: 6, topSpeed: 6, mechanicalGrip: 6, brakingStability: 5,
    tirePreservation: 3, reliabilityProtection: 2, qualifyingBoost: 3,
    racePaceBoost: -1, riskModifier: 2,
  },
  {
    id: 'setup-race-trim',
    name: 'Race Pace Trim',
    description: 'Tuned for long-run consistency rather than one-lap pace.',
    downforce: 6, topSpeed: 5, mechanicalGrip: 6, brakingStability: 6,
    tirePreservation: 8, reliabilityProtection: 6, qualifyingBoost: -1,
    racePaceBoost: 2, riskModifier: -1,
  },
];

export const setupOptionsById: Record<string, SetupOption> = Object.fromEntries(
  setupOptions.map((s) => [s.id, s]),
);
