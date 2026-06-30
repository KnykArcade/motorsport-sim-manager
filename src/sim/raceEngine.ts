// Race engine — uses qualifying results as a starting point but does NOT inherit
// qualifying aggression. Race strategy/instructions are chosen separately.

import type {
  Car,
  Driver,
  DriverInstruction,
  RaceResult,
  RaceStrategy,
  SetupOption,
  Track,
} from '../types/gameTypes';
import type { RaceContext, RaceEvent, ScoreBreakdown } from '../types/simTypes';
import { createSeededRandom, deriveSeed } from './random';
import {
  calculateCarTrackFit,
  calculateDriverTrackFit,
  calculateTrackFit,
  effectiveCarRatings,
} from './trackFitEngine';
import { calculateSetupFit } from './setupEngine';
import { calculateReliabilityRisk } from './reliabilityEngine';
import { calculateMistakeRisk } from './mistakeEngine';
import { calculatePitStopPerformance } from './pitStopEngine';

// Pace is a weighted blend of four components, each on a ~1-10 scale:
//   50% car, 25% driver, 15% team, 10% form/morale/setup/strategy.
// Car strength is deliberately the dominant factor. PACE_SPREAD scales the
// blend up so the deterministic spread between cars dominates the stochastic
// per-race variance (~1.6), keeping results car-led rather than random.
export const PACE_WEIGHTS = { car: 0.5, driver: 0.25, team: 0.15, other: 0.1 } as const;
export const PACE_SPREAD = 4;

function clamp10(n: number): number {
  return Math.max(1, Math.min(10, n));
}

export function calculateRacePace(
  driver: Driver,
  car: Car,
  track: Track,
  setup: SetupOption,
  strategy: RaceStrategy,
  instruction: DriverInstruction,
  teamRating = 5,
): { score: number; breakdown: ScoreBreakdown } {
  // Car component: raw car strength plus how well the car suits the circuit.
  const carComp = clamp10(avgCar(car) + calculateCarTrackFit(car, track));
  // Driver component: race pace / overall plus the driver's track fit.
  const driverComp = clamp10(
    (driver.ratings.racePace + driver.ratings.overall) / 2 + calculateDriverTrackFit(driver, track),
  );
  // Team component: organisation strength (reputation/10).
  const teamComp = clamp10(teamRating);
  // Everything else: setup, strategy, driver instruction and morale.
  const setupFit = calculateSetupFit(setup, track) + setup.racePaceBoost;
  const moraleFactor = (driver.morale - 65) / 15;
  const otherComp = clamp10(
    5.5 + setupFit * 0.5 + strategy.paceModifier + instruction.paceModifier + moraleFactor,
  );

  const score =
    PACE_SPREAD *
    (PACE_WEIGHTS.car * carComp +
      PACE_WEIGHTS.driver * driverComp +
      PACE_WEIGHTS.team * teamComp +
      PACE_WEIGHTS.other * otherComp);

  const breakdown: ScoreBreakdown = {
    driverId: driver.id,
    driverBase: driverComp,
    carBase: carComp,
    trackFit: calculateTrackFit(driver, car, track),
    setupFit,
    reliabilityRisk: 0,
    mistakeRisk: 0,
    variance: 0,
    finalScore: score,
  };
  return { score, breakdown };
}

// Representative race distance used to scale the lap log and DNF laps. Exposed
// so the live-race state machine animates over the same number of laps.
export const RACE_TOTAL_LAPS = 60;

export type RaceOutcome = {
  results: RaceResult[];
  events: RaceEvent[];
  breakdowns: Record<string, ScoreBreakdown>;
  totalLaps: number;
};

export function simulateRace(context: RaceContext): {
  results: RaceResult[];
  events: RaceEvent[];
  breakdowns: Record<string, ScoreBreakdown>;
} {
  const { results, events, breakdowns } = computeRaceOutcome(context);
  return { results, events, breakdowns };
}

// The deterministic, single-shot race computation used for quick simulation
// and tests. The live race (src/sim/liveRaceEngine + raceTickEngine) is a
// separate forward simulation whose classification emerges from the running
// order. All randomness flows through the seeded RNG in a fixed order.
export function computeRaceOutcome(context: RaceContext): RaceOutcome {
  const rng = createSeededRandom(deriveSeed(context.seed, 'race', context.track.id));
  const breakdowns: Record<string, ScoreBreakdown> = {};
  const events: RaceEvent[] = [];

  const gridByDriver: Record<string, number> = {};
  context.qualifyingResults.forEach((q) => {
    gridByDriver[q.driverId] = q.position;
  });

  type Row = {
    driver: Driver;
    car: Car;
    grid: number;
    score: number;
    status: RaceResult['status'];
    incidents: string[];
    lapsCompleted: number;
  };

  const totalLaps = RACE_TOTAL_LAPS; // representative; lap log scales to this
  const rows: Row[] = context.entrants.map((e) => {
    const decision = context.decisions[e.driver.id];
    const setup = context.setupOptions[decision.setupId];
    const strategy = context.strategies[decision.strategyId];
    const instruction = context.instructions[decision.instructionId];
    const grid = gridByDriver[e.driver.id] ?? context.entrants.length;

    const teamRating = (context.teamReputation?.[e.driver.teamId] ?? 50) / 10;
    const { score, breakdown } = calculateRacePace(
      e.driver,
      e.car,
      context.track,
      setup,
      strategy,
      instruction,
      teamRating,
    );

    // Grid position matters but the race can reorder things.
    const gridBonus = (context.entrants.length - grid) * 0.12;

    // Stress to reliability from aggressive choices.
    const stress = Math.max(0, instruction.reliabilityStressModifier + setup.riskModifier * 0.2);
    const relRisk = calculateReliabilityRisk(e.car, context.track, setup, stress);
    const mistakeRisk = calculateMistakeRisk(
      e.driver,
      context.track,
      instruction.mistakeModifier,
      grid <= 6 ? 0.5 : 0,
    );

    const incidents: string[] = [];
    let status: RaceResult['status'] = 'Finished';
    let lapsCompleted = totalLaps;
    let finalScore = score + gridBonus + rng.variance(1.6);

    // Reliability failure?
    if (rng.chance(relRisk)) {
      status = 'DNF';
      lapsCompleted = rng.int(3, totalLaps - 5);
      incidents.push(rng.pick(['Engine failure', 'Gearbox failure', 'Hydraulics failure', 'Electrical issue']));
      finalScore = -100 - grid; // sort to the back, keep grid order among DNFs
    } else if (rng.chance(mistakeRisk * 0.5)) {
      // A race-ending crash.
      status = 'DNF';
      lapsCompleted = rng.int(1, totalLaps - 5);
      incidents.push(rng.pick(['Crashed out', 'Spun into the gravel', 'Collision damage, retired']));
      finalScore = -100 - grid;
    } else {
      // Pit stop contribution for finishers.
      const pit = calculatePitStopPerformance(e.car, strategy, rng);
      finalScore += pit.scoreDelta;
      if (pit.note) incidents.push(pit.note);

      // A non-fatal mistake costs time.
      if (rng.chance(mistakeRisk)) {
        finalScore -= rng.range(0.5, 2);
        incidents.push(rng.pick(['Ran wide and lost time', 'Lock-up at the hairpin', 'Brief off-track moment']));
      }
    }

    breakdown.variance = finalScore - score - gridBonus;
    breakdown.reliabilityRisk = relRisk;
    breakdown.mistakeRisk = mistakeRisk;
    breakdown.finalScore = finalScore;
    breakdowns[e.driver.id] = breakdown;

    return { driver: e.driver, car: e.car, grid, score: finalScore, status, incidents, lapsCompleted };
  });

  // Finishers first (by score desc), then DNFs by laps completed.
  const finishers = rows.filter((r) => r.status === 'Finished').sort((a, b) => b.score - a.score);
  const dnfs = rows.filter((r) => r.status !== 'Finished').sort((a, b) => b.lapsCompleted - a.lapsCompleted);

  const winnerScore = finishers[0]?.score ?? 0;
  const results: RaceResult[] = [];

  finishers.forEach((row, i) => {
    const points = context.pointsByPosition[i + 1] ?? 0;
    const gap = i === 0 ? 'WIN' : `+${round1((winnerScore - row.score) * 2.4)}s`;
    results.push({
      position: i + 1,
      driverId: row.driver.id,
      teamId: row.driver.teamId,
      gridPosition: row.grid,
      status: 'Finished',
      lapsCompleted: row.lapsCompleted,
      points,
      raceScore: round2(row.score),
      gapText: gap,
      incidents: row.incidents,
      rating: ratingFor(i + 1, row.grid, finishers.length),
    });
  });

  dnfs.forEach((row, i) => {
    results.push({
      position: null,
      driverId: row.driver.id,
      teamId: row.driver.teamId,
      gridPosition: row.grid,
      status: row.status,
      lapsCompleted: row.lapsCompleted,
      points: 0,
      raceScore: round2(row.score),
      gapText: `DNF (lap ${row.lapsCompleted})`,
      incidents: row.incidents,
      rating: ratingFor(finishers.length + i + 1, row.grid, context.entrants.length),
    });
  });

  buildEventLog(context, results, rng, events, totalLaps);

  return { results, events, breakdowns, totalLaps };
}

function buildEventLog(
  context: RaceContext,
  results: RaceResult[],
  rng: ReturnType<typeof createSeededRandom>,
  events: RaceEvent[],
  totalLaps: number,
): void {
  const nameById: Record<string, string> = {};
  context.entrants.forEach((e) => (nameById[e.driver.id] = e.driver.name));

  // Lap 1 launch story from the front rows.
  const front = [...results].filter((r) => r.gridPosition <= 6).sort((a, b) => a.gridPosition - b.gridPosition);
  if (front.length >= 2) {
    events.push({
      lap: 1,
      text: `${nameById[front[1].driverId]} gets a clean launch and pressures ${nameById[front[0].driverId]} into Turn 1.`,
    });
  }

  // Incident events.
  results
    .filter((r) => r.status === 'DNF')
    .slice(0, 4)
    .forEach((r) => {
      events.push({ lap: r.lapsCompleted, text: `${nameById[r.driverId]}: ${r.incidents[0] ?? 'retires'}.` });
    });

  // A clear-air pace note for the winner.
  if (results[0]) {
    events.push({
      lap: rng.int(20, 40),
      text: `${nameById[results[0].driverId]} sets a strong pace in clear air.`,
    });
  }

  // Late battle for the final points position.
  const lastPoints = results.find((r) => r.points > 0 && r.position === pointsPaying(context));
  if (lastPoints) {
    events.push({
      lap: totalLaps - rng.int(2, 8),
      text: `Late-race tyre wear creates a battle for the final points position around ${nameById[lastPoints.driverId]}.`,
    });
  }

  events.sort((a, b) => a.lap - b.lap);
}

function pointsPaying(context: RaceContext): number {
  return Math.max(...Object.keys(context.pointsByPosition).map(Number));
}

function ratingFor(finishPos: number, grid: number, field: number): number {
  // Reward beating grid position; scale to 1-10.
  const positionsGained = grid - finishPos;
  const base = 6 + positionsGained * 0.3 - (finishPos - 1) * 0.1;
  return Math.max(1, Math.min(10, round1(base + (field > 0 ? 0 : 0))));
}

function avgCar(car: Car): number {
  const c = effectiveCarRatings(car);
  return (c.enginePower + c.aeroEfficiency + c.mechanicalGrip + c.reliability + c.pitCrewOperations) / 5;
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
