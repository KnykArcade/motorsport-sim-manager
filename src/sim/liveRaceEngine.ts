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
import { calculateRacePace, weekendForm, operationsForm, PACE_SPREAD } from './raceEngine';
import { calculateReliabilityRisk, perLapFailureRisk } from './reliabilityEngine';
import { calculateMistakeRisk, calculateCrashRisk } from './mistakeEngine';
import { eraReliabilityScale, liveRiskCalibration } from './dnfModel';
import { assignPersonality } from './aiStrategyEngine';
import { buildPitPlan, pitStopLoss, pitWindowFor } from './pitStrategyEngine';
import { effectiveCarRatings } from './trackFitEngine';
import { createSeededRandom, deriveSeed } from './random';
import { initialWeather } from './weatherEngine';
import { initialSafetyCar, SAFETY_CAR_PIT_SAVING } from './safetyCarEngine';
import { initialStint } from './strategyStint';

export type LiveRaceOptions = {
  raceId: string;
  playerTeamId: string;
  totalLaps: number;
  driverNames: Record<string, string>;
  // Team reputation (by team id) used to assign AI personalities.
  teamReputation: Record<string, number>;
  // Race Operations Rating (1-10) by team id — drives the team pace component
  // and the per-weekend operations variance.
  teamRaceOps: Record<string, number>;
  // Season year — drives era-specific DNF-cause balancing.
  year: number;
  // Series (e.g. 'F1', 'IndyCar') — drives series-specific DNF calibration.
  series: string;
};

// Metadata threaded through the tick engine for events and player prompts.
export type LiveRaceMeta = {
  track: Track;
  driverNames: Record<string, string>;
  teamNames: Record<string, string>;
  playerTeamId: string;
  // Season year — drives era-specific DNF-cause balancing during the race.
  year: number;
};

const REF_LAP = 90; // reference lap time (s) — only relative deltas matter

function initialPaceMode(instructionId: string): PaceMode {
  switch (instructionId) {
    case 'Aggressive':
    case 'MaximumAttack':
      return 'Push';
    case 'AttackTeammate':
      return 'Attack';
    case 'Conservative':
    case 'ProtectCar':
    case 'SupportTeammate':
      return 'Conservative';
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

    const teamRating = options.teamRaceOps[e.driver.teamId];
    const pkgEffects = context.packageEffectsByTeam?.[e.driver.teamId];
    const confidenceModifier = context.confidenceModifierByDriver?.[e.driver.id] ?? 0;
    const { score: paceScore } = calculateRacePace(e.driver, e.car, track, setup, strategy, instruction, teamRating, confidenceModifier);
    // Per-team weekend form so the live race shares the quick race's variation.
    const score = paceScore + weekendForm(context.seed, e.driver.teamId, teamRating);

    // Apply Race Weekend Package pace modifier.
    const packagePaceBonus = pkgEffects?.paceModifier ?? 0;

    // Apply race prep focus effect for the player's team (small, one-race bonus).
    const racePrepFocus = context.racePrepFocusEffect;
    const isPlayerTeam = e.driver.teamId === context.playerTeamId;
    const prepPaceBonus = racePrepFocus && isPlayerTeam ? racePrepFocus.paceModifier : 0;
    const prepReliabilityMod = racePrepFocus && isPlayerTeam ? racePrepFocus.reliabilityModifier : 0;
    const prepMistakeMultiplier = racePrepFocus && isPlayerTeam ? racePrepFocus.mistakeRiskMultiplier : 1;

    // Base Race Pace on the 1-10 scale (the pace score divided back out of the
    // internal PACE_SPREAD blow-up), which the live-pace model builds on.
    const baseRacePace = clamp10((score + packagePaceBonus + prepPaceBonus) / PACE_SPREAD);
    // Per-car weekend operations execution (pit/reliability/strategy), zero-mean.
    // Package reliability/pit prep shifts the operations form up or down.
    const opsForm = operationsForm(context.seed, e.driver.teamId, e.driver.id, teamRating)
      + (pkgEffects ? (pkgEffects.reliabilityPrep + pkgEffects.pitCrewPrep) / 2 : 0);

    // Reliability: per-race risk amplified by quali incidents, spread per lap.
    // The weekend's operations execution shifts the per-race risk up or down.
    // Era-scaled down to cut reliability retirements per the balance brief.
    const stress = Math.max(0, instruction.reliabilityStressModifier + setup.riskModifier * 0.2);
    let perRaceRel = calculateReliabilityRisk(e.car, track, setup, stress, opsForm);
    const qIncident = incidentByDriver[e.driver.id];
    if (qIncident === 'Crash') perRaceRel += 0.06;
    else if (qIncident === 'Mechanical Issue') perRaceRel += 0.04;
    // Live-only era/series calibration so the labelled bucket split (mechanical
    // vs crash) lands on the era targets; the Quick Sim is unaffected.
    const cal = liveRiskCalibration(options.year, options.series);
    const baseFailureRisk =
      perLapFailureRisk(Math.max(0, perRaceRel - prepReliabilityMod), totalLaps) * eraReliabilityScale(options.year) * cal.mech;

    // Crash/incident risk, kept separate from mechanical failure.
    // Package crash risk multiplier scales the base crash risk.
    const perRaceCrash = calculateCrashRisk(e.driver, track, instruction.mistakeModifier)
      * (pkgEffects?.crashRiskMultiplier ?? 1);
    const baseCrashRisk = perLapFailureRisk(perRaceCrash, totalLaps) * cal.crash;

    const perRaceMistake = calculateMistakeRisk(
      e.driver,
      track,
      instruction.mistakeModifier,
      grid <= 6 ? 0.5 : 0,
    ) * prepMistakeMultiplier * (pkgEffects?.operationalRiskMultiplier ?? 1);
    const baseMistakeRisk = perLapFailureRisk(perRaceMistake * 0.7, totalLaps);

    const pitPlan = buildPitPlan(strategy, totalLaps);
    const pkgTyrePres = pkgEffects?.tyrePreservation ?? 0;
    const tireDegRate = computeDegRate(
      setup.tirePreservation + pkgTyrePres * 5,
      instruction.tireWearModifier,
      strategy.tireDegModifier,
      pitPlan.stintTarget,
      {
        mechanicalGrip: effectiveCarRatings(e.car).mechanicalGrip,
        enduranceConsistency: e.driver.ratings.enduranceConsistency,
        composure: e.driver.ratings.composure,
        aggression: e.driver.ratings.aggression,
        trackWearDemand:
          (track.attributes.surfaceGripBumpiness + track.attributes.technical + track.attributes.enduranceConsistency) / 3,
      },
    );

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
      baseRacePace,
      baseFailureRisk,
      baseCrashRisk,
      baseMistakeRisk,
      tireDegRate,
      pitLossBase: pitStopLoss(
        e.car,
        false,
        SAFETY_CAR_PIT_SAVING,
        0,
        opsForm + (isPlayer ? (context.playerStaffBonus?.pitCrew ?? 0) : 0),
      ),
      opsForm,
      confidenceModifier,
      personality,
      strategyId: strategy.id,
      instructionId: instruction.id,
      paceMode: initialPaceMode(instruction.id),
      safetyCarModeBefore: null,
      strategyStint: initialStint(initialPaceMode(instruction.id)),
      liveRacePace: baseRacePace,
      tire: { compound, age: 0, wear: 0, stintTarget: pitPlan.stintTarget },
      pit: {
        plannedStops: pitPlan.plannedStops,
        stopsMade: 0,
        scheduledLaps: pitPlan.scheduledLaps,
        lastPitLap: null,
        lastPitStopTime: null,
        inPitThisLap: false,
        // The player owns pit timing: show an advisory window for the first
        // stop and wait for the player to call the car in. AI cars pit off
        // their schedule and leave these unset.
        window: isPlayer && pitPlan.scheduledLaps.length > 0
          ? pitWindowFor(pitPlan.scheduledLaps[0], totalLaps)
          : null,
        pitRequested: false,
        planStatus: pitPlan.scheduledLaps.length > 0 ? 'planned' : 'completed',
        planCancelled: false,
        lastWindowPromptLap: null,
      },
      reliabilityIssue: null,
      reliabilityRisk: baseFailureRisk,
      crashRisk: baseCrashRisk,
      damaged: false,
      fuel: 100,
      engineHealth: 100,
      gearboxHealth: 100,
      brakeHealth: 100,
      aeroHealth: qIncident === 'Crash' ? 82 : 100,
      lastSectors: null,
      bestSectors: null,
      reliabilityRiskLevel: 'Low',
      crashRiskLevel: 'Low',
      trafficStatus: 'Clear',
      statusMessage: 'On the grid',
    };
  });

  // Formation order = grid order.
  cars.sort((a, b) => a.grid - b.grid);
  cars.forEach((c, i) => (c.position = i + 1));

  const aiPitPlans = buildAiPitPlans(cars, track, totalLaps, context.seed);
  for (const c of cars) {
    if (c.isPlayer) continue;
    const plan = aiPitPlans.get(c.driverId);
    if (!plan) continue;
    c.pit = {
      ...c.pit,
      plannedStops: plan.plannedStops,
      scheduledLaps: [...plan.scheduledLaps],
      strategyRole: plan.strategyRole,
      strategyTargetLap: plan.strategyTargetLap,
      window: plan.window,
      planStatus: 'planned',
    };
    c.tire = { ...c.tire, stintTarget: plan.stintTarget };
  }

  const aiTeamStrategyState: NonNullable<LiveRaceState['aiTeamStrategyState']> = {};
  for (const c of cars) {
    if (c.isPlayer) continue;
    if (aiTeamStrategyState[c.teamId]) continue;
    const primary = cars.find((car) => !car.isPlayer && car.teamId === c.teamId && car.pit.strategyRole === 'primary');
    if (primary) {
      aiTeamStrategyState[c.teamId] = { leaderDriverId: primary.driverId, reversedLaps: 0, lastSwapLap: null };
    }
  }

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
    recommendations: [],
    ignoredRecs: [],
    recCooldowns: {},
    battleTracker: {},
    aiTeamStrategyState,
    retirements: 0,
  };
}

function computeDegRate(
  tirePreservation: number,
  tireWearModifier: number,
  tireDegModifier: number,
  stintTarget: number,
  wearModifiers: {
    mechanicalGrip: number;
    enduranceConsistency: number;
    composure: number;
    aggression: number;
    trackWearDemand: number;
  },
): number {
  const base = 100 / Math.max(10, stintTarget + 8);
  const setupMult = 1 + tireWearModifier * 0.3 + tireDegModifier * 0.3 - (tirePreservation - 5) * 0.04;
  const clamp10 = (n: number): number => Math.max(1, Math.min(10, n));
  const ratingMult = Math.max(
    0.85,
    Math.min(
      1.15,
      1
        - (clamp10(wearModifiers.mechanicalGrip) - 5.5) * 0.025
        - (((clamp10(wearModifiers.enduranceConsistency) + clamp10(wearModifiers.composure)) / 2) - 5.5) * 0.025
        + (clamp10(wearModifiers.aggression) - 5.5) * 0.015
        + (clamp10(wearModifiers.trackWearDemand) - 5.5) * 0.01,
    ),
  );
  return Math.max(0.4, base * setupMult * ratingMult);
}

type AiPitPlan = {
  plannedStops: 1 | 2;
  scheduledLaps: number[];
  stintTarget: number;
  strategyRole: 'primary' | 'secondary';
  strategyTargetLap: number;
  window: { open: number; ideal: number; close: number };
};

const AI_TARGET_WEAR = 75;
const AI_MIN_STINT_LAPS = 8;
const AI_ROLE_GAP_LAPS = 3;

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function normalizeAiSchedule(schedule: number[], totalLaps: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < schedule.length; i++) {
    const min = i === 0 ? AI_MIN_STINT_LAPS : out[i - 1] + AI_MIN_STINT_LAPS;
    const max = totalLaps - AI_MIN_STINT_LAPS * (schedule.length - i - 1) - 1;
    out.push(clampInt(schedule[i], min, max));
  }
  return out;
}

function aiScheduleForWearLap(wearLap: number, totalLaps: number): { plannedStops: 1 | 2; scheduledLaps: number[] } {
  const halfRace = Math.max(2, Math.round(totalLaps / 2));
  const plannedStops: 1 | 2 = wearLap < halfRace - 2 ? 2 : 1;
  if (plannedStops === 1) {
    return { plannedStops, scheduledLaps: [clampInt(wearLap, AI_MIN_STINT_LAPS, totalLaps - 1)] };
  }
  const first = clampInt(wearLap, AI_MIN_STINT_LAPS, totalLaps - AI_MIN_STINT_LAPS * 2);
  const second = clampInt(first + wearLap, first + AI_MIN_STINT_LAPS, totalLaps - AI_MIN_STINT_LAPS);
  return { plannedStops, scheduledLaps: normalizeAiSchedule([first, second], totalLaps) };
}

function buildAiPitPlans(cars: LiveCarState[], track: Track, totalLaps: number, seed: string): Map<string, AiPitPlan> {
  const byTeam = new Map<string, LiveCarState[]>();
  for (const car of cars) {
    if (car.isPlayer) continue;
    const list = byTeam.get(car.teamId) ?? [];
    list.push(car);
    byTeam.set(car.teamId, list);
  }

  const trackWearDemand =
    (track.attributes.surfaceGripBumpiness + track.attributes.technical + track.attributes.enduranceConsistency) / 3;
  const plans = new Map<string, AiPitPlan>();

  for (const teamCars of byTeam.values()) {
    const ordered = [...teamCars].sort(
      (a, b) =>
        (a.grid - b.grid) ||
        (b.paceRating - a.paceRating) ||
        (b.baseRacePace - a.baseRacePace) ||
        a.driverId.localeCompare(b.driverId),
    );
    const primary = ordered[0];
    if (!primary) continue;

    const wearTarget = AI_TARGET_WEAR - (trackWearDemand - 5.5) * 2;
    const wearLap = clampInt(wearTarget / Math.max(0.4, primary.tireDegRate), AI_MIN_STINT_LAPS, totalLaps - 1);
    const primaryPlan = aiScheduleForWearLap(wearLap, totalLaps);
    const primaryIdeal = primaryPlan.scheduledLaps[0];
    plans.set(primary.driverId, {
      plannedStops: primaryPlan.plannedStops,
      scheduledLaps: primaryPlan.scheduledLaps,
      stintTarget: primaryIdeal,
      strategyRole: 'primary',
      strategyTargetLap: primaryIdeal,
      window: pitWindowFor(primaryIdeal, totalLaps),
    });

    const secondary = ordered[1];
    if (!secondary) continue;

    const rng = createSeededRandom(deriveSeed(seed, 'ai-pit-plan', primary.teamId, secondary.driverId, totalLaps));
    const direction = rng.chance(0.5) ? -1 : 1;
    const shift = direction * (2 + Math.floor(rng.next() * 2));
    const preferredShift =
      (direction < 0 && primaryIdeal <= AI_MIN_STINT_LAPS + AI_ROLE_GAP_LAPS)
        ? Math.abs(shift)
        : (direction > 0 && primaryIdeal >= totalLaps - AI_MIN_STINT_LAPS - AI_ROLE_GAP_LAPS)
          ? -Math.abs(shift)
          : shift;
    const secondarySchedule = normalizeAiSchedule(
      primaryPlan.scheduledLaps.map((lap) => lap + preferredShift),
      totalLaps,
    );
    let adjustedSecondary = secondarySchedule;
    let attempts = 0;
    while (
      Math.abs(adjustedSecondary[0] - primaryIdeal) < AI_ROLE_GAP_LAPS &&
      attempts < 3
    ) {
      const extraShift = preferredShift >= 0 ? preferredShift + 1 + attempts : preferredShift - 1 - attempts;
      adjustedSecondary = normalizeAiSchedule(
        primaryPlan.scheduledLaps.map((lap) => lap + extraShift),
        totalLaps,
      );
      attempts += 1;
    }

    const secondaryIdeal = adjustedSecondary[0];
    plans.set(secondary.driverId, {
      plannedStops: primaryPlan.plannedStops,
      scheduledLaps: adjustedSecondary,
      stintTarget: secondaryIdeal,
      strategyRole: 'secondary',
      strategyTargetLap: secondaryIdeal,
      window: pitWindowFor(secondaryIdeal, totalLaps),
    });
  }

  return plans;
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

function clamp10(n: number): number {
  return Math.max(1, Math.min(10, n));
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export { REF_LAP };
