// Headless live-race state machine.
//
// `createLiveRace` resolves the deterministic outcome up front (via
// `computeRaceOutcome`) and seeds a lap-0 formation state. `stepLiveRace`
// advances one lap, interpolating running order and gaps from the grid toward
// that final outcome and revealing scheduled events, until the flag — at which
// point the classification is exactly the precomputed outcome. This guarantees
// a live-played race and an instantly-resolved race finish identically.

import type { RaceResult } from '../../types/gameTypes';
import type { RaceContext, RaceEvent } from '../../types/simTypes';
import { computeRaceOutcome, type RaceOutcome } from '../raceEngine';
import type { LiveCarState, LiveRaceState } from './raceState';

// Per-car constants derived from the final outcome, used to drive interpolation.
type CarPlan = {
  driverId: string;
  teamId: string;
  grid: number;
  classifiedRank: number; // 1-based index within the final classification
  retiredOnLap: number | null; // lap a DNF car drops out; null for finishers
  finishLaps: number; // laps completed in the final result
  gapScore: number; // seconds-behind-leader basis for gap interpolation
  finalGapToLeader: number; // gap shown at the flag (0 for retired cars)
  finalPosition: number | null;
  incident?: string;
};

function buildPlans(results: RaceResult[]): CarPlan[] {
  const finishers = results.filter((r) => r.status === 'Finished');
  const leaderScore = finishers[0]?.raceScore ?? 0;
  const lastFinisherGap =
    finishers.length > 0 ? Math.max(0, (leaderScore - finishers[finishers.length - 1].raceScore) * 2.4) : 0;
  const spacing = finishers.length > 1 ? lastFinisherGap / (finishers.length - 1) : 1.5;

  return results.map((r, index) => {
    const classifiedRank = index + 1;
    const isFinisher = r.status === 'Finished';
    const finisherGap = Math.max(0, (leaderScore - r.raceScore) * 2.4);
    // DNF-bound cars are placed behind the finishers so they fade before retiring.
    const gapScore = isFinisher
      ? finisherGap
      : lastFinisherGap + (classifiedRank - finishers.length) * Math.max(spacing, 1);
    return {
      driverId: r.driverId,
      teamId: r.teamId,
      grid: r.gridPosition,
      classifiedRank,
      retiredOnLap: isFinisher ? null : r.lapsCompleted,
      finishLaps: r.lapsCompleted,
      gapScore,
      finalGapToLeader: isFinisher ? round1(finisherGap) : 0,
      finalPosition: r.position,
      incident: r.incidents[0],
    };
  });
}

function initialState(context: RaceContext, outcome: RaceOutcome): LiveRaceState {
  const plans = buildPlans(outcome.results);
  const cars: LiveCarState[] = [...plans]
    .sort((a, b) => a.grid - b.grid)
    .map((p) => ({
      driverId: p.driverId,
      teamId: p.teamId,
      grid: p.grid,
      position: p.grid,
      gapToLeader: 0,
      interval: 0,
      lapsCompleted: 0,
      running: true,
      status: 'Finished',
    }));

  return {
    trackId: context.track.id,
    totalLaps: outcome.totalLaps,
    currentLap: 0,
    phase: 'formation',
    cars,
    events: [],
    finalResults: outcome.results,
  };
}

export function createLiveRace(context: RaceContext): LiveRaceState {
  return initialState(context, computeRaceOutcome(context));
}

// Advance the race by one lap. Pure: returns a new state, never mutates input.
export function stepLiveRace(state: LiveRaceState): LiveRaceState {
  if (state.phase === 'finished') return state;

  const nextLap = state.currentLap + 1;
  const plans = buildPlans(state.finalResults);
  const planById = new Map(plans.map((p) => [p.driverId, p]));
  const events = revealEvents(state.finalResults, plans, nextLap, state.totalLaps);

  if (nextLap >= state.totalLaps) {
    return {
      ...state,
      currentLap: state.totalLaps,
      phase: 'finished',
      cars: finalCars(state.finalResults, planById),
      events,
    };
  }

  const f = nextLap / state.totalLaps;

  const running = plans.filter((p) => p.retiredOnLap === null || nextLap < p.retiredOnLap);
  const retired = plans.filter((p) => p.retiredOnLap !== null && nextLap >= p.retiredOnLap);

  const runningOrdered = running
    .map((p) => ({ plan: p, score: p.grid * (1 - f) + p.classifiedRank * f }))
    .sort((a, b) => a.score - b.score);

  const leaderGapScore = runningOrdered[0]?.plan.gapScore ?? 0;
  const runningCars: LiveCarState[] = [];
  let prevGap = 0;
  runningOrdered.forEach(({ plan }, i) => {
    const rawGap = Math.max(0, (plan.gapScore - leaderGapScore) * f);
    const gapToLeader = i === 0 ? 0 : Math.max(prevGap, round1(rawGap));
    runningCars.push({
      driverId: plan.driverId,
      teamId: plan.teamId,
      grid: plan.grid,
      position: i + 1,
      gapToLeader,
      interval: round1(gapToLeader - prevGap),
      lapsCompleted: nextLap,
      running: true,
      status: 'Finished',
    });
    prevGap = gapToLeader;
  });

  // Retired cars trail the field, most-recently-retired first.
  const retiredCars: LiveCarState[] = retired
    .sort((a, b) => (b.retiredOnLap ?? 0) - (a.retiredOnLap ?? 0))
    .map((p) => ({
      driverId: p.driverId,
      teamId: p.teamId,
      grid: p.grid,
      position: null,
      gapToLeader: 0,
      interval: 0,
      lapsCompleted: p.finishLaps,
      running: false,
      status: 'DNF',
      lastIncident: p.incident,
    }));

  return {
    ...state,
    currentLap: nextLap,
    phase: 'racing',
    cars: [...runningCars, ...retiredCars],
    events,
  };
}

// Step from the current state to the flag.
export function stepLiveRaceToEnd(state: LiveRaceState): LiveRaceState {
  let s = state;
  let guard = 0;
  while (s.phase !== 'finished' && guard <= s.totalLaps + 1) {
    s = stepLiveRace(s);
    guard += 1;
  }
  return s;
}

// Convenience: resolve a race entirely through the live machine. Returns the
// same shape as `simulateRace` and, by construction, the same values.
export function runLiveRaceToEnd(context: RaceContext): {
  results: RaceResult[];
  events: RaceEvent[];
  breakdowns: RaceOutcome['breakdowns'];
} {
  const outcome = computeRaceOutcome(context);
  const finished = stepLiveRaceToEnd(initialState(context, outcome));
  return { results: finished.finalResults, events: outcome.events, breakdowns: outcome.breakdowns };
}

function finalCars(results: RaceResult[], planById: Map<string, CarPlan>): LiveCarState[] {
  return results.map((r) => {
    const plan = planById.get(r.driverId);
    return {
      driverId: r.driverId,
      teamId: r.teamId,
      grid: r.gridPosition,
      position: r.position,
      gapToLeader: plan?.finalGapToLeader ?? 0,
      interval: 0,
      lapsCompleted: r.lapsCompleted,
      running: false,
      status: r.status,
      lastIncident: r.incidents[0],
    };
  });
}

function revealEvents(
  results: RaceResult[],
  plans: CarPlan[],
  uptoLap: number,
  totalLaps: number,
): RaceEvent[] {
  // Events live on the precomputed outcome via the reducer, but the headless
  // machine reconstructs DNF-timing events from the classification so a live
  // race surfaces incidents as they happen even without the event log.
  void results;
  void totalLaps;
  const out: RaceEvent[] = [];
  plans
    .filter((p) => p.retiredOnLap !== null && p.retiredOnLap <= uptoLap)
    .sort((a, b) => (a.retiredOnLap ?? 0) - (b.retiredOnLap ?? 0))
    .forEach((p) => {
      out.push({ lap: p.retiredOnLap ?? 0, text: `Car #${p.classifiedRank}: ${p.incident ?? 'retires'}.` });
    });
  return out;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
