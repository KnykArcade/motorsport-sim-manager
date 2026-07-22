// Driver aging & development curves (Living Universe Phase 1 — types only).
//
// Drivers improve toward a peak, plateau, then decline. The curve plus situational
// inputs (experience, testing, morale, injuries, academy, team quality,
// mentorship, traits) drives per-offseason rating changes over a long career.

// Youth development traits: each prospect carries 0-2 traits that modify their
// development curve, giving youngsters personality beyond just raw numbers.
export type YouthTrait =
  | 'LateBloomer'    // slow start, higher ceiling, peaks later
  | 'Prodigy'        // fast start, lower ceiling, peaks earlier
  | 'Consistent'     // steady growth, low variance
  | 'Erratic'        // high variance — big jumps or slumps
  | 'Resilient'      // bounces back from setbacks faster
  | 'Fragile'        // higher injury risk, slower recovery
  | 'Workhorse'      // extra academy boost from hard work
  | 'NaturalTalent'; // raw talent, needs less academy investment

export const YOUTH_TRAIT_LABELS: Record<YouthTrait, string> = {
  LateBloomer: 'Late Bloomer',
  Prodigy: 'Prodigy',
  Consistent: 'Consistent',
  Erratic: 'Erratic',
  Resilient: 'Resilient',
  Fragile: 'Fragile',
  Workhorse: 'Workhorse',
  NaturalTalent: 'Natural Talent',
};

export const YOUTH_TRAIT_DESCRIPTIONS: Record<YouthTrait, string> = {
  LateBloomer: 'Slow to develop but reaches a higher ceiling. Peaks later than average.',
  Prodigy: 'Fast early development but lower ceiling. Peaks earlier than average.',
  Consistent: 'Steady, predictable growth with minimal variance season to season.',
  Erratic: 'Wild development swings — can jump or slump dramatically between seasons.',
  Resilient: 'Recovers quickly from setbacks and injuries. Morale has a bigger effect.',
  Fragile: 'Higher injury risk and slower recovery. Development can stall.',
  Workhorse: 'Responds especially well to academy investment and facilities.',
  NaturalTalent: 'Raw ability — needs less academy support to reach potential.',
};

export type DriverDevelopmentCurve = {
  driverId: string;
  peakAgeStart: number;
  peakAgeEnd: number;
  developmentRate: number; // 0-1 growth speed before peak
  declineRate: number; // 0-1 regression speed after peak
  consistencyGrowth: number; // how fast consistency/composure matures
  aggressionChange: number; // signed drift in aggression with age
  potentialCeiling: number; // max overall the driver can reach (0-100 scale)
  traits?: YouthTrait[]; // optional youth traits that modify development
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

export type DriverDevelopmentFocus =
  | 'Balanced'
  | 'QualifyingPace'
  | 'Racecraft'
  | 'Consistency'
  | 'TechnicalFeedback'
  | 'WetWeather'
  | 'MentalResilience';

export type DriverDevelopmentStatus = 'Progressing' | 'Steady' | 'Stalled' | 'Frustrated';

export type DriverDevelopmentHistoryEntry = {
  seasonYear: number;
  focus: DriverDevelopmentFocus;
  status: DriverDevelopmentStatus;
  summary: string;
  overallBefore?: number;
  overallAfter?: number;
};

// Player-directed development is optional for backwards-compatible saves. A
// plan can target a contracted driver or an academy member using the same id.
export type DriverDevelopmentPlan = {
  driverId: string;
  focus: DriverDevelopmentFocus;
  testingAllocation: number; // 0-100 share of the team's finite testing pool
  mentorId?: string;
  progress: number; // 0-100 descriptive season progress
  satisfaction: number; // 0-100, surfaced as a qualitative readout
  status: DriverDevelopmentStatus;
  assignedSeason: number;
  assignedRound: number;
  history: DriverDevelopmentHistoryEntry[];
};

export const DRIVER_DEVELOPMENT_FOCUS_LABELS: Record<DriverDevelopmentFocus, string> = {
  Balanced: 'Balanced development',
  QualifyingPace: 'Qualifying pace',
  Racecraft: 'Racecraft',
  Consistency: 'Consistency',
  TechnicalFeedback: 'Technical feedback',
  WetWeather: 'Wet-weather ability',
  MentalResilience: 'Mental resilience',
};

export const DRIVER_DEVELOPMENT_FOCUS_DESCRIPTIONS: Record<DriverDevelopmentFocus, string> = {
  Balanced: 'Spreads work across the complete skill set.',
  QualifyingPace: 'Prioritizes one-lap execution, braking, and corner entry.',
  Racecraft: 'Prioritizes race pace, overtaking judgment, and acceleration.',
  Consistency: 'Prioritizes repeatability, endurance, and risk management.',
  TechnicalFeedback: 'Prioritizes useful setup and engineering feedback.',
  WetWeather: 'Prioritizes adaptability and low-grip car control.',
  MentalResilience: 'Prioritizes composure and recovery after setbacks.',
};
