// Driver aging & development curves (Living Universe Phase 1 — types only).
//
// Drivers improve toward a peak, plateau, then decline. The curve plus situational
// inputs (experience, testing, morale, injuries, academy, team quality,
// mentorship, traits) drives per-offseason rating changes over a long career.

export type DriverDevelopmentCurve = {
  driverId: string;
  peakAgeStart: number;
  peakAgeEnd: number;
  developmentRate: number; // 0-1 growth speed before peak
  declineRate: number; // 0-1 regression speed after peak
  consistencyGrowth: number; // how fast consistency/composure matures
  aggressionChange: number; // signed drift in aggression with age
  potentialCeiling: number; // max overall the driver can reach (0-100 scale)
};

// A snapshot of inputs that modulate a development step, kept for transparency.
export type DevelopmentInputs = {
  age: number;
  raceExperience: number; // accumulated starts
  testingTime: number; // 0-1 relative
  morale: number; // 0-100
  injuredWeeks: number;
  academyInvestment: number; // 0-1
  teamQuality: number; // 0-100
  mentorship: number; // 0-1
};

// The result of one development progression step (applied at offseason).
export type DevelopmentStepResult = {
  driverId: string;
  seasonYear: number;
  overallBefore: number;
  overallAfter: number;
  phase: 'Developing' | 'Peak' | 'Declining';
  notes: string[];
};
