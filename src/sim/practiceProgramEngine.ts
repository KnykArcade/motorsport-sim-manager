// Practice program engine (Living Universe Phase 2).
//
// Turns practice into a real gameplay phase: the player assigns a program to
// each driver per session; running a session produces directional feedback
// (never the perfect setup) plus accumulated weekend "knowledge" (setup, tyre,
// reliability) and a driver-confidence nudge. Knowledge feeds setup confidence
// and qualifying/race pace via the existing setup-derivation path.

import type { Driver, Track } from '../types/gameTypes';
import type { CarSetup } from '../types/setupTypes';
import type { WeatherState } from '../types/liveTypes';
import type {
  FeedbackSentiment,
  FeedbackTopic,
  PracticeAssignment,
  PracticeFeedbackItem,
  PracticeProgram,
  PracticeRunResult,
  PracticeSession,
  PracticeSessionKind,
  WeekendKnowledge,
} from '../types/practiceTypes';
import { createSeededRandom, deriveSeed, type Rng } from './random';
import { calculateSetupFit, idealSetup } from './setupFitEngine';

// How much each program contributes to each knowledge axis / confidence per run.
type ProgramEmphasis = {
  setup: number;
  tire: number;
  reliability: number;
  confidence: number;
  // Feedback topics this program surfaces, most relevant first.
  topics: FeedbackTopic[];
  // Extra incident probability for aggressive programs.
  riskAdd: number;
  defaultLaps: number;
};

export const PROGRAM_META: Record<PracticeProgram, ProgramEmphasis> = {
  SetupExploration: { setup: 1.0, tire: 0.2, reliability: 0.1, confidence: 0.3, topics: ['Aero', 'Balance', 'RideHeight'], riskAdd: 0.0, defaultLaps: 14 },
  QualifyingSimulation: { setup: 0.5, tire: 0.1, reliability: 0.1, confidence: 0.4, topics: ['Balance', 'Confidence', 'Brakes'], riskAdd: 0.06, defaultLaps: 6 },
  RacePaceRun: { setup: 0.4, tire: 0.6, reliability: 0.3, confidence: 0.4, topics: ['LongRunPace', 'Degradation', 'Tires'], riskAdd: 0.0, defaultLaps: 18 },
  TireWearAnalysis: { setup: 0.2, tire: 1.0, reliability: 0.1, confidence: 0.2, topics: ['Tires', 'Degradation'], riskAdd: 0.0, defaultLaps: 16 },
  ReliabilityShakedown: { setup: 0.1, tire: 0.1, reliability: 1.0, confidence: 0.2, topics: ['Reliability', 'Engine'], riskAdd: 0.0, defaultLaps: 10 },
  FuelLoadTest: { setup: 0.3, tire: 0.4, reliability: 0.3, confidence: 0.3, topics: ['Fuel', 'LongRunPace'], riskAdd: 0.0, defaultLaps: 14 },
  BrakeTemperatureTest: { setup: 0.4, tire: 0.2, reliability: 0.3, confidence: 0.2, topics: ['Brakes', 'Balance'], riskAdd: 0.02, defaultLaps: 10 },
  WetWeatherPreparation: { setup: 0.3, tire: 0.3, reliability: 0.2, confidence: 0.5, topics: ['Confidence', 'Balance'], riskAdd: 0.08, defaultLaps: 12 },
  DriverConfidenceRun: { setup: 0.3, tire: 0.2, reliability: 0.1, confidence: 1.0, topics: ['Confidence', 'LongRunPace'], riskAdd: 0.0, defaultLaps: 12 },
};

export const ALL_PROGRAMS = Object.keys(PROGRAM_META) as PracticeProgram[];

export const PROGRAM_LABELS: Record<PracticeProgram, string> = {
  SetupExploration: 'Setup Exploration',
  QualifyingSimulation: 'Qualifying Simulation',
  RacePaceRun: 'Race Pace Run',
  TireWearAnalysis: 'Tyre Wear Analysis',
  ReliabilityShakedown: 'Reliability Shakedown',
  FuelLoadTest: 'Fuel Load Test',
  BrakeTemperatureTest: 'Brake Temperature Test',
  WetWeatherPreparation: 'Wet-Weather Preparation',
  DriverConfidenceRun: 'Driver Confidence Run',
};

export const SESSION_LABELS: Record<PracticeSessionKind, string> = {
  Practice1: 'Practice 1',
  Practice2: 'Practice 2',
  Practice3: 'Practice 3',
  Warmup: 'Warmup',
  QualifyingPrep: 'Qualifying Prep',
  RaceSimulation: 'Race Simulation',
};

// The set (and order) of practice sessions for a given era/series. Modern F1
// runs three free-practice sessions; the classic 1990s/2000s weekends ran two
// practice days plus a Sunday-morning warmup; IndyCar uses practice + warmup.
export function weekendSessionKinds(year: number, series: string): PracticeSessionKind[] {
  if (series === 'IndyCar') {
    return ['Practice1', 'Practice2', 'QualifyingPrep', 'Warmup'];
  }
  if (year >= 2006) {
    return ['Practice1', 'Practice2', 'Practice3'];
  }
  // Classic F1 (pre-2006): two practice days + a race-morning warmup.
  return ['Practice1', 'Practice2', 'Warmup'];
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
function r1(v: number): number {
  return Math.round(v * 10) / 10;
}

// A tagged, directional signal derived from the current setup vs. the ideal.
// Never exposes the ideal value — only the direction and feel.
type Signal = { topic: FeedbackTopic; sentiment: FeedbackSentiment; message: string };

function setupSignals(setup: CarSetup, track: Track, driver: Driver): Signal[] {
  const fit = calculateSetupFit(setup, track, driver);
  const e = fit.effects;
  const ideal = idealSetup(track, driver);
  const out: Signal[] = [];

  const wing = (setup.frontWing + setup.rearWing) / 2;
  const wingIdeal = (ideal.frontWing + ideal.rearWing) / 2;
  if (wing < wingIdeal - 1.2) out.push({ topic: 'Aero', sentiment: 'Concern', message: 'The car feels nervous on corner entry and lacks grip.' });
  else if (wing > wingIdeal + 1.2) out.push({ topic: 'Aero', sentiment: 'Concern', message: 'We are losing too much time on the straights.' });
  else out.push({ topic: 'Aero', sentiment: 'Positive', message: 'Aero balance is in a good window.' });

  if (e.cornering >= 7) out.push({ topic: 'Balance', sentiment: 'Positive', message: 'The car is planted through the corners.' });
  if (e.mistakeRisk >= 1.0) out.push({ topic: 'Balance', sentiment: 'Warning', message: 'The car feels nervous and snappy — hard to lean on.' });

  if (track.attributes.surfaceGripBumpiness >= 6 && (setup.suspensionStiffness > ideal.suspensionStiffness + 1.2 || setup.rideHeight < ideal.rideHeight - 1.2)) {
    out.push({ topic: 'RideHeight', sentiment: 'Warning', message: 'The car is bottoming out over the bumps.' });
  }

  if (setup.brakeCooling < ideal.brakeCooling - 1.2 || Math.abs(setup.brakeBias - 5) >= 3) {
    out.push({ topic: 'Brakes', sentiment: 'Concern', message: 'Brake temperatures are climbing and the fronts are locking.' });
  } else {
    out.push({ topic: 'Brakes', sentiment: 'Neutral', message: 'Brakes are working in their window.' });
  }

  if (e.reliabilityRisk >= 0.9 || setup.engineCooling < ideal.engineCooling - 1.2) {
    out.push({ topic: 'Engine', sentiment: 'Warning', message: 'Engine temperatures are climbing on the long runs.' });
  } else {
    out.push({ topic: 'Reliability', sentiment: 'Positive', message: 'The car ran the program with no reliability scares.' });
  }

  if (e.tyreWear >= 1.0 || setup.tyreUsage > ideal.tyreUsage + 1.2) {
    out.push({ topic: 'Tires', sentiment: 'Warning', message: 'Rear tyres are overheating on the long runs.' });
    out.push({ topic: 'Degradation', sentiment: 'Concern', message: 'Tyre degradation is worse than expected.' });
  } else {
    out.push({ topic: 'Tires', sentiment: 'Positive', message: 'Tyre temperatures are stable across a stint.' });
  }

  if (e.racePace >= 0.6) out.push({ topic: 'LongRunPace', sentiment: 'Positive', message: 'Long-run pace looks strong.' });
  out.push({ topic: 'Fuel', sentiment: 'Neutral', message: 'Fuel consumption is in line with our race estimate.' });

  if (fit.confidence >= 72) out.push({ topic: 'Confidence', sentiment: 'Positive', message: 'Driver confidence is improving.' });
  else if (fit.confidence < 48) out.push({ topic: 'Confidence', sentiment: 'Concern', message: 'The driver is not comfortable with the car yet.' });

  return out;
}

// Directional practice feedback for one driver running one program. Surfaces the
// signals most relevant to the chosen program first; never reveals the ideal.
export function generatePracticeFeedback(
  driver: Driver,
  setup: CarSetup,
  track: Track,
  program: PracticeProgram,
  rng: Rng,
): PracticeFeedbackItem[] {
  const meta = PROGRAM_META[program];
  const signals = setupSignals(setup, track, driver);
  const topicRank = (t: FeedbackTopic) => {
    const i = meta.topics.indexOf(t);
    return i === -1 ? meta.topics.length + 1 : i;
  };
  const ranked = [...signals].sort((a, b) => topicRank(a.topic) - topicRank(b.topic));
  // Surface the most relevant 2-3 plus always keep any warning.
  const warnings = ranked.filter((s) => s.sentiment === 'Warning');
  const picked = ranked.slice(0, 3);
  for (const w of warnings) if (!picked.includes(w)) picked.push(w);

  // A small amount of run-to-run variation in which engineer note leads.
  if (picked.length > 1 && rng.chance(0.3)) {
    picked.unshift(picked.splice(1, 1)[0]);
  }

  return picked.map((s, i) => ({
    id: `${driver.id}-${program}-${i}`,
    driverId: driver.id,
    topic: s.topic,
    sentiment: s.sentiment,
    message: s.message,
  }));
}

export type DriverProgramContext = {
  driver: Driver;
  setup: CarSetup;
  track: Track;
  priorSetupKnowledge: number;
  priorTireKnowledge: number;
  priorReliabilityKnowledge: number;
  // Whether the race is forecast to be wet; makes Wet-Weather Preparation pay off.
  raceWet?: boolean;
};

// Run one driver's assigned program. Pure + deterministic given the rng.
export function runDriverProgram(
  ctx: DriverProgramContext,
  program: PracticeProgram,
  lapsPlanned: number,
  rng: Rng,
): PracticeRunResult {
  const meta = PROGRAM_META[program];
  const fit = calculateSetupFit(ctx.setup, ctx.track, ctx.driver);

  // Aborted runs (incidents) complete fewer laps.
  const incidentP = clamp(
    0.02 + (60 - fit.confidence) / 320 + meta.riskAdd + (10 - ctx.driver.ratings.composure) / 200,
    0.01,
    0.3,
  );
  const incident = rng.chance(incidentP);
  const lapFactorBase = clamp(lapsPlanned / 12, 0.3, 1.6);
  const lapsCompleted = incident ? Math.max(1, Math.round(lapsPlanned * rng.range(0.3, 0.7))) : lapsPlanned;
  const lapFactor = incident ? lapFactorBase * (lapsCompleted / lapsPlanned) : lapFactorBase;

  const gain = (prior: number, emphasis: number): number => {
    const delta = (1 - prior) * 0.35 * emphasis * lapFactor;
    return r1(clamp(delta, 0, 1 - prior));
  };

  const setupKnowledgeGain = gain(ctx.priorSetupKnowledge, meta.setup);
  const tireKnowledgeGain = gain(ctx.priorTireKnowledge, meta.tire);
  const reliabilityKnowledgeGain = gain(ctx.priorReliabilityKnowledge, meta.reliability);

  // Wet-Weather Preparation pays off when the race is forecast wet: the driver
  // banks valuable running and goes in more confident for the conditions.
  const wetPayoff = program === 'WetWeatherPreparation' && ctx.raceWet ? 3 : 0;

  const confidenceGain = r1(
    clamp(
      (fit.confidence - 60) / 12 +
        meta.confidence * 2.5 +
        wetPayoff +
        (incident ? -5 : 0) +
        rng.variance(1.5),
      -6,
      11,
    ),
  );

  const feedback = generatePracticeFeedback(ctx.driver, ctx.setup, ctx.track, program, rng);
  if (wetPayoff > 0) {
    feedback.unshift({
      id: `${ctx.driver.id}-${program}-wet`,
      driverId: ctx.driver.id,
      topic: 'Confidence',
      sentiment: 'Positive',
      message: 'Banked valuable wet-weather running — the driver is ready if it rains on Sunday.',
    });
  }
  if (incident) {
    feedback.unshift({
      id: `${ctx.driver.id}-${program}-incident`,
      driverId: ctx.driver.id,
      topic: 'Balance',
      sentiment: 'Warning',
      message: 'Lost the car and cut the run short — lost track time.',
    });
  }

  return {
    driverId: ctx.driver.id,
    program,
    lapsCompleted,
    bestLapSec: undefined,
    incident,
    feedback,
    setupKnowledgeGain,
    tireKnowledgeGain,
    reliabilityKnowledgeGain,
    confidenceGain,
  };
}

export type SessionContext = {
  raceId: string;
  track: Track;
  seed: string;
  driversById: Record<string, Driver>;
  setupsById: Record<string, CarSetup>;
  knowledge: WeekendKnowledge;
  // Whether the race is forecast wet (rewards Wet-Weather Preparation).
  raceWet?: boolean;
};

// Run a full session: every assignment is simulated against the current
// (pre-session) knowledge so a session is internally consistent.
export function runPracticeSession(
  session: PracticeSession,
  ctx: SessionContext,
): PracticeRunResult[] {
  const results: PracticeRunResult[] = [];
  for (const a of session.assignments) {
    const driver = ctx.driversById[a.driverId];
    if (!driver) continue;
    const setup = ctx.setupsById[a.driverId];
    if (!setup) continue;
    const rng = createSeededRandom(
      deriveSeed(ctx.seed, 'practice', ctx.raceId, session.kind, a.driverId, a.program),
    );
    results.push(
      runDriverProgram(
        {
          driver,
          setup,
          track: ctx.track,
          priorSetupKnowledge: ctx.knowledge.setupKnowledge[a.driverId] ?? 0,
          priorTireKnowledge: ctx.knowledge.tireKnowledge[a.driverId] ?? 0,
          priorReliabilityKnowledge: ctx.knowledge.reliabilityKnowledge[a.driverId] ?? 0,
          raceWet: ctx.raceWet,
        },
        a.program,
        a.lapsPlanned,
        rng,
      ),
    );
  }
  return results;
}

export function emptyKnowledge(raceId: string): WeekendKnowledge {
  return {
    raceId,
    setupKnowledge: {},
    tireKnowledge: {},
    reliabilityKnowledge: {},
    confidenceDelta: {},
  };
}

// Fold a session's run results into the running weekend knowledge. Each axis is
// capped at 1; confidenceDelta accumulates the (signed) per-run nudges.
export function calculateSetupKnowledge(prior: number, runs: PracticeRunResult[]): number {
  return r1(clamp(runs.reduce((s, r) => s + r.setupKnowledgeGain, prior), 0, 1));
}
export function calculateTireKnowledge(prior: number, runs: PracticeRunResult[]): number {
  return r1(clamp(runs.reduce((s, r) => s + r.tireKnowledgeGain, prior), 0, 1));
}
export function calculateReliabilityKnowledge(prior: number, runs: PracticeRunResult[]): number {
  return r1(clamp(runs.reduce((s, r) => s + r.reliabilityKnowledgeGain, prior), 0, 1));
}

export function accumulateKnowledge(
  prior: WeekendKnowledge,
  results: PracticeRunResult[],
): WeekendKnowledge {
  const next: WeekendKnowledge = {
    raceId: prior.raceId,
    setupKnowledge: { ...prior.setupKnowledge },
    tireKnowledge: { ...prior.tireKnowledge },
    reliabilityKnowledge: { ...prior.reliabilityKnowledge },
    confidenceDelta: { ...prior.confidenceDelta },
  };
  for (const r of results) {
    const id = r.driverId;
    next.setupKnowledge[id] = calculateSetupKnowledge(next.setupKnowledge[id] ?? 0, [r]);
    next.tireKnowledge[id] = calculateTireKnowledge(next.tireKnowledge[id] ?? 0, [r]);
    next.reliabilityKnowledge[id] = calculateReliabilityKnowledge(next.reliabilityKnowledge[id] ?? 0, [r]);
    next.confidenceDelta[id] = r1((next.confidenceDelta[id] ?? 0) + r.confidenceGain);
  }
  return next;
}

// Apply accumulated practice confidence to a driver's base confidence (0-100).
export function updateDriverConfidenceFromPractice(
  baseConfidence: number,
  knowledge: WeekendKnowledge,
  driverId: string,
): number {
  return clamp(Math.round(baseConfidence + (knowledge.confidenceDelta[driverId] ?? 0)), 1, 100);
}

// Setup knowledge converted into a setup-confidence bonus (0-100 scale points)
// for deriveSetupOption: a fully-understood setup is worth up to +8 confidence.
export function practiceSetupConfidenceBonus(
  knowledge: WeekendKnowledge | undefined,
  driverId: string,
): number {
  if (!knowledge) return 0;
  return r1((knowledge.setupKnowledge[driverId] ?? 0) * 8);
}

// Build the default per-driver assignment for a session (sensible spread).
export function defaultAssignments(
  driverIds: string[],
  kind: PracticeSessionKind,
): PracticeAssignment[] {
  const program = defaultProgramForSession(kind);
  return driverIds.map((driverId) => ({
    driverId,
    program,
    lapsPlanned: PROGRAM_META[program].defaultLaps,
  }));
}

function defaultProgramForSession(kind: PracticeSessionKind): PracticeProgram {
  switch (kind) {
    case 'Practice1':
      return 'SetupExploration';
    case 'Practice2':
      return 'RacePaceRun';
    case 'Practice3':
      return 'QualifyingSimulation';
    case 'QualifyingPrep':
      return 'QualifyingSimulation';
    case 'Warmup':
      return 'DriverConfidenceRun';
    case 'RaceSimulation':
      return 'RacePaceRun';
    default:
      return 'SetupExploration';
  }
}

function weatherIsWet(w?: WeatherState): boolean {
  return !!w && (w.condition === 'LightRain' || w.condition === 'HeavyRain');
}

// The team's average weekend knowledge (0-1) on each axis, used to spot the
// biggest gap to address next.
export type KnowledgeGaps = { setup: number; tire: number; reliability: number };

export function teamKnowledgeGaps(knowledge: WeekendKnowledge | undefined, driverIds: string[]): KnowledgeGaps {
  if (!knowledge || driverIds.length === 0) return { setup: 0, tire: 0, reliability: 0 };
  const avg = (m: Record<string, number>) =>
    driverIds.reduce((s, id) => s + (m[id] ?? 0), 0) / driverIds.length;
  return {
    setup: avg(knowledge.setupKnowledge),
    tire: avg(knowledge.tireKnowledge),
    reliability: avg(knowledge.reliabilityKnowledge),
  };
}

export type ProgramRecommendation = { program: PracticeProgram; reason: string };

// The engineer's recommended program for a session, given the forecast for the
// relevant session, the track's demands, and the team's current knowledge gaps.
export function recommendedPracticeProgram(
  kind: PracticeSessionKind,
  track: Track,
  weather: WeatherState | undefined,
  gaps: KnowledgeGaps,
): ProgramRecommendation {
  if (weatherIsWet(weather)) {
    return { program: 'WetWeatherPreparation', reason: 'Rain forecast — bank wet-weather running while you can.' };
  }
  if (kind === 'QualifyingPrep' || kind === 'Practice3') {
    return { program: 'QualifyingSimulation', reason: 'Qualifying is next — dial in a single-lap setup.' };
  }
  if (kind === 'Warmup') {
    return { program: 'DriverConfidenceRun', reason: 'Final tune-up — build the driver up for the race.' };
  }

  // Otherwise address the biggest knowledge gap, weighted by the circuit's
  // demands (high-deg tracks prize tyre data; endurance tracks prize reliability).
  const highDeg = track.attributes.enduranceConsistency >= 7 || track.attributes.tractionAcceleration >= 8;
  const enduranceRisk = track.attributes.enduranceConsistency >= 7 || track.attributes.riskWallProximity >= 7;
  const setupNeed = (1 - gaps.setup) * 1.1;
  const tireNeed = (1 - gaps.tire) * (highDeg ? 1.35 : 1);
  const relNeed = (1 - gaps.reliability) * (enduranceRisk ? 1.3 : 0.85);

  if (tireNeed >= setupNeed && tireNeed >= relNeed) {
    return {
      program: 'TireWearAnalysis',
      reason: highDeg ? 'High tyre wear here — gather degradation data.' : 'Tyre knowledge is thin — log some long-run data.',
    };
  }
  if (relNeed >= setupNeed && relNeed >= tireNeed) {
    return {
      program: 'ReliabilityShakedown',
      reason: enduranceRisk ? 'Hard on the car here — shake down reliability.' : 'Verify reliability before committing to a plan.',
    };
  }
  return { program: 'SetupExploration', reason: 'Setup is still unknown — explore the balance window first.' };
}

// The weekend's practice lap budget (per car), era/series-scaled. Modern weekends
// have generous running; classic eras and IndyCar have tighter pools — so you
// cannot run every program on every car and must triage what to learn.
export function practiceLapBudgetPerCar(year: number, series: string): number {
  if (series === 'IndyCar') return 40;
  if (year >= 2006) return 46;
  return 38; // classic F1
}

// Total lap budget for the weekend across the player's cars.
export function practiceLapBudget(year: number, series: string, carCount: number): number {
  return practiceLapBudgetPerCar(year, series) * Math.max(1, carCount);
}

// Laps a planned session would consume (sum of its assignments).
export function sessionLapCost(assignments: PracticeAssignment[]): number {
  return assignments.reduce((s, a) => s + a.lapsPlanned, 0);
}
