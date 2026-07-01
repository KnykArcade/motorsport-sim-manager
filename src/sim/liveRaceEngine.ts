// Live race engine — creation and classification.
//
// `createLiveRace` turns a RaceContext into a forward-simulatable LiveRaceState:
// each car gets a baseline pace, per-lap reliability/mistake risks (amplified by
// qualifying incidents), a pit plan, and (for AI) a strategy personality.
// `finalizeResults` converts the finished live state back into the existing
// RaceResult[] shape so standings/news/morale handling is unchanged.
//
// The per-lap advancement lives in raceTickEngine.ts.

import type { RaceResult, Track } from '../types/gameTypes';
import type { RaceContext, RaceEvent, ScoreBreakdown } from '../types/simTypes';
import type {
  AIStrategyPersonality,
  LiveCarState,
  LiveRaceState,
  PaceMode,
  TireCompound,
} from '../types/liveTypes';
import { calculateRacePace, weekendForm, operationsForm } from './raceEngine';
import { calculateReliabilityRisk, perLapFailureRisk } from './reliabilityEngine';
import { calculateMistakeRisk } from './mistakeEngine';
import { assignPersonality } from './aiStrategyEngine';
import { buildPitPlan, pitStopLoss, pitWindowFor } from './pitStrategyEngine';
import { initialWeather } from './weatherEngine';
import { initialSafetyCar, SAFETY_CAR_PIT_SAVING } from './safetyCarEngine';

export type LiveRaceOptions = {
  raceId: string;
  playerTeamId: string;
  totalLaps: number;
  driverNames: Record<string, string>;
  // Team reputation (by team id) used to assign AI personalities.
  teamReputation: Record<string, number>;
  // Race Operations Rating (1-10) by team id — drives the team pace component.
  teamRaceOps?: Record<string, number>;
};

// Metadata threaded through the tick engine for events and player prompts.
export type LiveRaceMeta = {
  track: Track;
  driverNames: Record<string, string>;
  teamNames: Record<string, string>;
  playerTeamId: string;
};

const REF_LAP = 90; // reference lap time (s) — only relative deltas matter

function initialPaceMode(instructionId: string): PaceMode {
  switch (instructionId) {
    case 'Aggressive':
    case 'MaximumAttack':
    case 'AttackTeammate':
      return 'Push';
    case 'Conservative':
    case 'ProtectCar':
    case 'SupportTeammate':
      return 'Conserve';
    default:
      return 'Balanced';
  }
}

export function createLiveRace(context: RaceContext, options: LiveRaceOptions): LiveRaceState {
  const { track } = context;
  const totalLaps = options.totalLaps;
  const weather = initialWeather(track, context.seed);

  const gridByDriver: Record<string, number> = {};
  const incidentByDriver: Record<string, string | undefined> = {};
  context.qualifyingResults.forEach((q) => {
    gridByDriver[q.driverId] = q.position;
    if (q.incident && q.incident.type !== 'None') incidentByDriver[q.driverId] = q.incident.type;
  });

  const cars: LiveCarState[] = context.entrants.map((e) => {
    const decision = context.decisions[e.driver.id];
    const setup = context.setupOptions[decision.setupId];
    const strategy = context.strategies[decision.strategyId];
    const instruction = context.instructions[decision.instructionId];
    const grid = gridByDriver[e.driver.id] ?? context.entrants.length;

    const teamRating = options.teamRaceOps?.[e.driver.teamId] ?? 5;
    const { score: paceScore } = calculateRacePace(e.driver, e.car, track, setup, strategy, instruction, teamRating);
    // Per-team weekend form so the live race shares the quick race's variation.
    const score = paceScore + weekendForm(context.seed, e.driver.teamId, teamRating);
    // Per-car weekend operations execution (pit/reliability/strategy), zero-mean.
    const opsForm = operationsForm(context.seed, e.driver.teamId, e.driver.id, teamRating);

    // Reliability: per-race risk amplified by quali incidents, spread per lap.
    // The weekend's operations execution shifts the per-race risk up or down.
    const stress = Math.max(0, instruction.reliabilityStressModifier + setup.riskModifier * 0.2);
    let perRaceRel = calculateReliabilityRisk(e.car, track, setup, stress, opsForm);
    const qIncident = incidentByDriver[e.driver.id];
    if (qIncident === 'Crash') perRaceRel += 0.06;
    else if (qIncident === 'Mechanical Issue') perRaceRel += 0.04;
    const baseFailureRisk = perLapFailureRisk(perRaceRel, totalLaps);

    const perRaceMistake = calculateMistakeRisk(
      e.driver,
      track,
      instruction.mistakeModifier,
      grid <= 6 ? 0.5 : 0,
    );
    const baseMistakeRisk = perLapFailureRisk(perRaceMistake * 0.7, totalLaps);

    const pitPlan = buildPitPlan(strategy, totalLaps);
    const tireDegRate = computeDegRate(setup.tirePreservation, instruction.tireWearModifier, strategy.tireDegModifier, pitPlan.stintTarget);

    const isPlayer = e.driver.teamId === options.playerTeamId;
    const personality: AIStrategyPersonality = isPlayer
      ? 'Balanced'
      : assignPersonality(
          { id: e.driver.teamId, reputation: options.teamReputation[e.driver.teamId] ?? 50 },
          e.driver,
          context.seed,
        );

    const compound: TireCompound = weather.wet ? 'Wet' : 'Dry';

    return {
      driverId: e.driver.id,
      teamId: e.driver.teamId,
      isPlayer,
      grid,
      position: grid,
      totalTime: grid * 0.3, // grid order at the start, before pace takes over
      gapToLeader: 0,
      interval: 0,
      lastLapTime: 0,
      bestLap: null,
      lapsCompleted: 0,
      running: true,
      status: 'Finished',
      retiredOnLap: null,
      lastIncident: qIncident === 'Crash' ? 'Carrying qualifying crash damage' : undefined,
      paceRating: score,
      baseFailureRisk,
      baseMistakeRisk,
      tireDegRate,
      pitLossBase: pitStopLoss(e.car, false, SAFETY_CAR_PIT_SAVING, opsForm),
      opsForm,
      personality,
      strategyId: strategy.id,
      instructionId: instruction.id,
      paceMode: initialPaceMode(instruction.id),
      tire: { compound, age: 0, wear: 0, stintTarget: pitPlan.stintTarget },
      pit: {
        plannedStops: pitPlan.plannedStops,
        stopsMade: 0,
        scheduledLaps: pitPlan.scheduledLaps,
        lastPitLap: null,
        inPitThisLap: false,
        // The player owns pit timing: show an advisory window for the first
        // stop and wait for the player to call the car in. AI cars pit off
        // their schedule and leave these unset.
        window: isPlayer && pitPlan.scheduledLaps.length > 0
          ? pitWindowFor(pitPlan.scheduledLaps[0], totalLaps)
          : null,
        pitRequested: false,
      },
      reliabilityIssue: null,
      reliabilityRisk: baseFailureRisk,
      damaged: false,
    };
  });

  // Formation order = grid order.
  cars.sort((a, b) => a.grid - b.grid);
  cars.forEach((c, i) => (c.position = i + 1));

  const events: RaceEvent[] = [];
  for (const c of cars) {
    if (c.lastIncident) {
      const name = options.driverNames[c.driverId] ?? c.driverId;
      events.push({ lap: 0, text: `${name} starts with qualifying damage to manage.` });
    }
  }

  return {
    raceId: options.raceId,
    trackId: track.id,
    seed: context.seed,
    totalLaps,
    currentLap: 0,
    phase: 'formation',
    weather,
    safetyCar: initialSafetyCar(),
    cars,
    events,
    pendingPrompt: null,
    promptCooldown: {},
    firedEventIds: [],
  };
}

function computeDegRate(
  tirePreservation: number,
  tireWearModifier: number,
  tireDegModifier: number,
  stintTarget: number,
): number {
  let deg = 100 / Math.max(10, stintTarget + 8);
  deg *= 1 + tireWearModifier * 0.3 + tireDegModifier * 0.3 - (tirePreservation - 5) * 0.04;
  return Math.max(0.4, deg);
}

// ---------------------------------------------------------------------------
// Final classification
// ---------------------------------------------------------------------------

export function finalizeResults(
  state: LiveRaceState,
  context: RaceContext,
): { results: RaceResult[]; events: RaceEvent[]; breakdowns: Record<string, ScoreBreakdown> } {
  const finishers = state.cars
    .filter((c) => c.status === 'Finished')
    .sort((a, b) => a.totalTime - b.totalTime);
  const dnfs = state.cars
    .filter((c) => c.status !== 'Finished')
    .sort((a, b) => b.lapsCompleted - a.lapsCompleted);

  const winnerTime = finishers[0]?.totalTime ?? 0;
  const results: RaceResult[] = [];
  const breakdowns: Record<string, ScoreBreakdown> = {};

  finishers.forEach((c, i) => {
    results.push({
      position: i + 1,
      driverId: c.driverId,
      teamId: c.teamId,
      gridPosition: c.grid,
      status: 'Finished',
      lapsCompleted: state.totalLaps,
      points: context.pointsByPosition[i + 1] ?? 0,
      raceScore: round2(c.paceRating),
      gapText: i === 0 ? 'WIN' : `+${round1(c.totalTime - winnerTime)}s`,
      incidents: c.lastIncident ? [c.lastIncident] : [],
      rating: ratingFor(i + 1, c.grid),
    });
    breakdowns[c.driverId] = makeBreakdown(c);
  });

  dnfs.forEach((c, i) => {
    results.push({
      position: null,
      driverId: c.driverId,
      teamId: c.teamId,
      gridPosition: c.grid,
      status: c.status,
      lapsCompleted: c.lapsCompleted,
      points: 0,
      raceScore: round2(c.paceRating),
      gapText: `DNF (lap ${c.lapsCompleted})`,
      incidents: c.lastIncident ? [c.lastIncident] : [],
      rating: ratingFor(finishers.length + i + 1, c.grid),
    });
    breakdowns[c.driverId] = makeBreakdown(c);
  });

  return { results, events: state.events, breakdowns };
}

function makeBreakdown(c: LiveCarState): ScoreBreakdown {
  return {
    driverId: c.driverId,
    driverBase: 0,
    carBase: 0,
    trackFit: 0,
    setupFit: 0,
    reliabilityRisk: c.baseFailureRisk,
    mistakeRisk: c.baseMistakeRisk,
    variance: 0,
    finalScore: c.paceRating,
  };
}

function ratingFor(finishPos: number, grid: number): number {
  const positionsGained = grid - finishPos;
  const base = 6 + positionsGained * 0.3 - (finishPos - 1) * 0.1;
  return Math.max(1, Math.min(10, round1(base)));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export { REF_LAP };
