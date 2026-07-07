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
import { createSeededRandom, deriveSeed, type Rng } from './random';
import {
  calculateCarTrackFit,
  calculateDriverTrackFit,
  calculateTrackFit,
  effectiveCarRatings,
} from './trackFitEngine';
import { calculateSetupFit } from './setupEngine';
import { calculateReliabilityRisk } from './reliabilityEngine';
import { calculateMistakeRisk, calculateCrashRisk } from './mistakeEngine';
import { calculatePitStopPerformance } from './pitStopEngine';
import { eraReliabilityScale, pickDnfCause, type DnfCauseContext } from './dnfModel';
import { toLegacyRating } from './ratingScale';

// Pace is a weighted blend of four components, each on a ~1-100 scale:
//   50% car, 25% driver, 15% team, 10% form/morale/setup/strategy.
// Car strength is deliberately the dominant factor. PACE_SPREAD scales the
// blend up so the deterministic spread between cars dominates the stochastic
// per-race variance (~1.6), keeping results car-led rather than random.
export const PACE_WEIGHTS = { car: 0.5, driver: 0.25, team: 0.15, other: 0.1 } as const;
export const PACE_SPREAD = 4;

// Weekend form: a per-team, per-weekend swing (a strong/weak weekend hits both of
// a team's cars together). This is what lets closely-matched front-runners trade
// wins across a season instead of the fastest car winning every race. Teams with
// weaker Race Operations (strategy/pit/engineering consistency) swing more; the
// gap to the midfield/backmarkers is far larger than the swing, so they only
// profit from a top team's off weekend rather than beating it on pace.
export const WEEKEND_FORM_SPREAD = 3.5;
export const FORM_OPS_FACTOR = 0.22;

// Per-team weekend form for a race weekend, shared by both of the team's cars.
export function weekendForm(seed: string, teamId: string, raceOps: number): number {
  const rng = createSeededRandom(deriveSeed(seed, 'weekendform', teamId));
  const spread = WEEKEND_FORM_SPREAD + Math.max(0, 5 - raceOps) * FORM_OPS_FACTOR;
  return rng.variance(spread);
}

// Per-car, per-weekend "operations execution" — how well the pit crew and
// engineers execute for this car on the day. Zero-mean (peaks at 0), so it adds
// race-to-race variation *without* shifting a car's average competitive order.
// Every car gets a base swing; weaker Race Operations teams swing more. Drawn
// per-car (not per-team) so a multi-car team's cars don't all swing together
// into correlated blowout weekends. Consumed by pit stops, reliability and
// strategy. Neutral (0) when raceOps is unknown.
export const OPS_FORM_BASE = 0.35;
export const OPS_FORM_WEAK = 0.14;

export function operationsForm(
  seed: string,
  teamId: string,
  driverId: string,
  raceOps: number,
): number {
  const rng = createSeededRandom(deriveSeed(seed, 'opsform', teamId, driverId));
  const spread = OPS_FORM_BASE + Math.max(0, 5 - raceOps) * OPS_FORM_WEAK;
  return rng.variance(spread);
}

// Strategy-execution outcome for a finisher, driven by the weekend's operations
// form (pit-wall calls). Zero-mean: a sharp day gains track position, a scrappy
// one loses it and can tip into an outright blunder. Neutral at opsForm 0.
export const STRATEGY_OPS_GAIN = 0.6;

export function strategyExecution(opsForm: number, rng: Rng): { delta: number; note?: string } {
  const delta = opsForm * STRATEGY_OPS_GAIN;
  // A scrappy operations weekend risks an outright strategy blunder.
  const blunderChance = Math.max(0, Math.min(0.14, -opsForm * 0.18));
  if (opsForm < 0 && rng.chance(blunderChance)) {
    return { delta: delta - rng.range(0.5, 2), note: 'Strategy error cost track position.' };
  }
  return { delta };
}

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
  teamRating = 50,
  confidenceModifier = 0,
): { score: number; breakdown: ScoreBreakdown } {
  // Car component: raw car strength plus how well the car suits the circuit.
  const carComp = clamp10(toLegacyRating(avgCar(car)) + calculateCarTrackFit(car, track));
  // Driver component: race pace / overall plus the driver's track fit.
  const driverComp = clamp10(
    (toLegacyRating(driver.ratings.racePace) + toLegacyRating(driver.ratings.overall)) / 2 + calculateDriverTrackFit(driver, track),
  );
  // Team component: organisation strength (reputation/10).
  const teamComp = clamp10(toLegacyRating(teamRating));
  // Everything else: setup, strategy, driver instruction and morale.
  const setupFit = calculateSetupFit(setup, track) + setup.racePaceBoost;
  const moraleFactor = (driver.morale - 65) / 15 + confidenceModifier;
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

    const teamRating = context.teamRaceOps[e.driver.teamId];
    const pkgEffects = context.packageEffectsByTeam?.[e.driver.teamId];
    const { score, breakdown } = calculateRacePace(
      e.driver,
      e.car,
      context.track,
      setup,
      strategy,
      instruction,
      teamRating,
      context.confidenceModifierByDriver?.[e.driver.id] ?? 0,
    );

    // Apply Race Weekend Package pace modifier.
    const packagePaceBonus = pkgEffects?.paceModifier ?? 0;

    // Apply race prep focus effect for the player's team (small, one-race bonus).
    const racePrepFocus = context.racePrepFocusEffect;
    const isPlayerTeam = e.driver.teamId === context.playerTeamId;
    const prepPaceBonus = racePrepFocus && isPlayerTeam ? racePrepFocus.paceModifier : 0;
    const prepReliabilityMod = racePrepFocus && isPlayerTeam ? racePrepFocus.reliabilityModifier : 0;
    const prepMistakeMultiplier = racePrepFocus && isPlayerTeam ? racePrepFocus.mistakeRiskMultiplier : 1;

    // Grid position matters but the race can reorder things. Tracks that are
    // hard to overtake at (low overtaking racecraft) make track position
    // stickier — the aggregate of the live race's dirty-air/traffic model.
    const overtaking = context.track.attributes.overtakingRacecraft ?? 5;
    const trackPosFactor = 1 + (5 - overtaking) * 0.05;
    const gridBonus = (context.entrants.length - grid) * 0.12 * trackPosFactor;

    // Per-team weekend form (both cars share it) — the main source of race-to-race
    // variation that lets front-runners trade wins. Driver consistency (composure)
    // damps the individual swing so reliable drivers are steadier.
    const form = weekendForm(context.seed, e.driver.teamId, teamRating);
    const consistency = clamp10(toLegacyRating(e.driver.ratings.composure));
    const driverSwing = rng.variance(1.6 * (1 + (6 - consistency) * 0.06));

    // Per-car weekend operations execution (pit/reliability/strategy). Zero-mean
    // so it adds consistency-driven variation, not average pace; weaker Race
    // Operations teams swing more.
    const opsForm = operationsForm(context.seed, e.driver.teamId, e.driver.id, teamRating)
      + (pkgEffects ? (pkgEffects.reliabilityPrep + pkgEffects.pitCrewPrep) / 2 : 0);

    // Stress to reliability from aggressive choices; the weekend's operations
    // execution (reliability management) shifts the DNF risk up or down.
    const stress = Math.max(0, instruction.reliabilityStressModifier + setup.riskModifier * 0.2);
    // Mechanical-failure risk, era-scaled down to cut reliability retirements.
    // Package reliability prep is already folded into opsForm above.
    const relRisk =
      (calculateReliabilityRisk(e.car, context.track, setup, stress, opsForm) - prepReliabilityMod) *
      eraReliabilityScale(context.year);
    // Crash/incident risk, separate from mechanical failure. Package can reduce
    // crash risk (Conservative) or increase it (Budget).
    const crashRiskBase = calculateCrashRisk(e.driver, context.track, instruction.mistakeModifier);
    const crashRisk = crashRiskBase * (pkgEffects?.crashRiskMultiplier ?? 1);
    const mistakeRisk = calculateMistakeRisk(
      e.driver,
      context.track,
      instruction.mistakeModifier,
      grid <= 6 ? 0.5 : 0,
    ) * prepMistakeMultiplier;

    const incidents: string[] = [];
    let status: RaceResult['status'] = 'Finished';
    let lapsCompleted = totalLaps;
    let finalScore = score + gridBonus + form + driverSwing + packagePaceBonus + prepPaceBonus;

    // Total retirement probability, then the *cause* is drawn from the era
    // profile (nudged by car/driver/track), so the season-wide DNF cause split
    // matches the era target while individual retirements stay plausible.
    const otherRisk = 0.004;
    const pDnf = Math.min(0.7, relRisk + crashRisk + otherRisk);
    if (rng.chance(pDnf)) {
      const causeCtx: DnfCauseContext = {
        carReliability: effectiveCarRatings(e.car).reliability,
        aggression: e.driver.ratings.aggression + instruction.mistakeModifier * 30,
        composure: e.driver.ratings.composure,
        tyreWear: 55, // representative late-race wear for the quick sim
        wallProximity: context.track.attributes.riskWallProximity,
        inTraffic: grid > 6,
      };
      const { cause, label } = pickDnfCause(context.year, causeCtx, rng);
      status = 'DNF';
      lapsCompleted =
        cause === 'Crash' ? rng.int(1, totalLaps - 5) : rng.int(3, totalLaps - 5);
      incidents.push(label);
      finalScore = -100 - grid; // sort to the back, keep grid order among DNFs
    } else {
      // Pit stop contribution for finishers (pit-crew + weekend operations form).
      // Player's Pit Crew Chief adds a direct bonus on top of ops form.
      const staffPitBonus = isPlayerTeam ? (context.playerStaffBonus?.pitCrew ?? 0) : 0;
      const pit = calculatePitStopPerformance(e.car, strategy, rng, opsForm + staffPitBonus);
      finalScore += pit.scoreDelta;
      if (pit.note) incidents.push(pit.note);

      // Strategy execution (pit-wall calls) driven by the weekend's operations form.
      // Player's Strategist adds a direct bonus on top of ops form.
      const staffStratBonus = isPlayerTeam ? (context.playerStaffBonus?.strategy ?? 0) : 0;
      const strat = strategyExecution(opsForm + staffStratBonus, rng);
      finalScore += strat.delta;
      if (strat.note) incidents.push(strat.note);

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
    const points = Math.round((context.pointsByPosition[i + 1] ?? 0) * (context.pointsMultiplier ?? 1));
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
