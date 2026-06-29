// Qualifying engine — deliberately SEPARATE from the race engine so the player
// can choose an aggressive qualifying approach and a cautious race approach.

import type {
  Car,
  Driver,
  QualifyingResult,
  QualifyingRunPlan,
  SetupOption,
  Track,
} from '../types/gameTypes';
import type { QualifyingContext, ScoreBreakdown } from '../types/simTypes';
import { createSeededRandom, deriveSeed, type Rng } from './random';
import { calculateTrackFit } from './trackFitEngine';
import { calculateSetupFit } from './setupEngine';
import { calculateCrashRisk, calculateMistakeRisk } from './mistakeEngine';

export function calculateQualifyingSetupFit(
  _driver: Driver,
  _car: Car,
  track: Track,
  qualifyingSetup: SetupOption,
): number {
  // Setup fit plus the setup's own qualifying boost.
  return calculateSetupFit(qualifyingSetup, track) + qualifyingSetup.qualifyingBoost;
}

export function calculateQualifyingRisk(
  driver: Driver,
  _car: Car,
  track: Track,
  runPlan: QualifyingRunPlan,
): { crash: number; mistake: number } {
  const aggression = runPlan.crashModifier; // run plan aggressiveness
  return {
    crash: calculateCrashRisk(driver, track, aggression),
    mistake: calculateMistakeRisk(driver, track, runPlan.mistakeModifier, 0.5),
  };
}

export function calculateQualifyingPace(
  driver: Driver,
  car: Car,
  track: Track,
  setup: SetupOption,
  runPlan: QualifyingRunPlan,
): { score: number; breakdown: ScoreBreakdown } {
  const driverBase = (driver.ratings.qualifying + driver.ratings.overall) / 2; // ~1-10
  const trackFit = calculateTrackFit(driver, car, track);
  const setupFit = calculateQualifyingSetupFit(driver, car, track, setup);

  // Confidence nudges peak performance.
  const confidenceFactor = (driver.confidence - 65) / 100; // ~[-0.65, 0.35]

  const score =
    driverBase * 1.0 +
    trackFit * 1.2 +
    setupFit * 0.8 +
    runPlan.paceModifier +
    confidenceFactor;

  const breakdown: ScoreBreakdown = {
    driverId: driver.id,
    driverBase,
    carBase: 0,
    trackFit,
    setupFit,
    reliabilityRisk: 0,
    mistakeRisk: 0,
    variance: 0,
    finalScore: score,
  };

  return { score, breakdown };
}

const INCIDENT_NOTES = {
  positive: [
    'Excellent lap',
    'Perfect setup window',
    'Found time in the final sector',
  ],
  neutral: ['Clean lap', 'Tidy effort', 'Solid banker lap'],
  small: ['Small driver mistake', 'Brake lockup', 'Slightly off the ideal line'],
  traffic: ['Traffic in final sector', 'Compromised by a slow car'],
  poor: ['Poor balance', 'Engine hesitation', 'Could not string it together'],
};

export function simulateQualifying(context: QualifyingContext): {
  results: QualifyingResult[];
  breakdowns: Record<string, ScoreBreakdown>;
} {
  const rng = createSeededRandom(deriveSeed(context.seed, 'quali', context.track.id));
  const breakdowns: Record<string, ScoreBreakdown> = {};

  type Row = {
    driver: Driver;
    car: Car;
    score: number;
    notes: string[];
    incident?: QualifyingResult['incident'];
  };

  const rows: Row[] = context.entrants.map((e) => {
    const decision = context.decisions[e.driver.id];
    const setup = context.setupOptions[decision.setupId];
    const runPlan = context.runPlans[decision.runPlanId];

    const { score, breakdown } = calculateQualifyingPace(
      e.driver,
      e.car,
      context.track,
      setup,
      runPlan,
    );

    const risk = calculateQualifyingRisk(e.driver, e.car, context.track, runPlan);
    const variance = rng.variance(1.4);
    let finalScore = score + variance;
    const notes: string[] = [];
    let incident: QualifyingResult['incident'];

    // Resolve incidents from most to least severe.
    if (rng.chance(risk.crash)) {
      finalScore -= 6;
      incident = {
        type: 'Crash',
        severity: 'Major',
        raceImpact: 'Car damaged; reliability risk and repair cost in the race.',
      };
      notes.push('Crashed in qualifying!');
    } else if (rng.chance(risk.mistake)) {
      finalScore -= 2.5;
      incident = { type: 'Spin', severity: 'Minor' };
      notes.push(rng.pick(INCIDENT_NOTES.small));
    } else if (rng.chance(clampProb(runPlan.trafficModifier * 0.25))) {
      finalScore -= 1.5;
      incident = { type: 'Traffic', severity: 'Minor' };
      notes.push(rng.pick(INCIDENT_NOTES.traffic));
    } else if (variance > 0.9) {
      notes.push(rng.pick(INCIDENT_NOTES.positive));
    } else if (variance < -0.9) {
      notes.push(rng.pick(INCIDENT_NOTES.poor));
    } else {
      notes.push(rng.pick(INCIDENT_NOTES.neutral));
    }

    breakdown.variance = variance;
    breakdown.mistakeRisk = risk.mistake;
    breakdown.finalScore = finalScore;
    breakdowns[e.driver.id] = breakdown;

    return { driver: e.driver, car: e.car, score: finalScore, notes, incident };
  });

  rows.sort((a, b) => b.score - a.score);

  const cap = context.maxQualifiers;
  const pole = rows[0]?.score ?? 0;
  const results: QualifyingResult[] = rows.map((row, i) => {
    const dnq = cap !== undefined && i + 1 > cap;
    const notes = dnq
      ? [...row.notes, `Did not qualify — outside the ${cap}-car cap`]
      : row.notes;
    return {
      position: i + 1,
      driverId: row.driver.id,
      teamId: row.driver.teamId,
      qualifyingScore: round2(row.score),
      gapText: i === 0 ? 'POLE' : `+${round2((pole - row.score) * 0.18)}s`,
      runPlan: context.runPlans[context.decisions[row.driver.id].runPlanId].name,
      setupChoice: context.setupOptions[context.decisions[row.driver.id].setupId].name,
      notes,
      incident: row.incident,
      dnq: dnq || undefined,
    };
  });

  return { results, breakdowns };
}

function clampProb(p: number): number {
  return Math.max(0, Math.min(1, p));
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type { Rng };
