// Race tick engine — advances a live race by one lap.
//
// Pure: each lap derives its own seeded RNG from (seed, driverId, lap), so the
// same state always produces the same next state and a race replays identically.
// Player decisions are applied between steps via `resolvePrompt`; while a prompt
// is pending, `stepLiveRace` is a no-op so the screen can pause for input.

import type { RaceEvent } from '../types/simTypes';
import type {
  AnalyticsRecommendation,
  LiveCarState,
  LiveRaceState,
  PaceMode,
  RecAction,
  RecPriority,
} from '../types/liveTypes';
import { createSeededRandom, deriveSeed } from './random';
import { REF_LAP, type LiveRaceMeta } from './liveRaceEngine';
import {
  computeLivePace,
  modeSpec,
  displayPace,
  reliabilityRiskLevel,
  crashRiskLevel,
  trafficStatus,
  statusMessage,
  tyreMistakeRisk,
  tyreFailureRisk,
  LIVE_PACE_K,
  DIRTY_AIR_GAP,
} from './liveRacePace';
import { mechanicalLabel, crashLabel, tyreLabel, otherLabel } from './dnfModel';
import { generateCandidates, cooldownFor, isModeAction, REC_COOLDOWN } from './analyticsEngine';
import type { Track } from '../types/gameTypes';
import type { StrategyModeSpec } from './liveRacePace';
import type { Rng } from './random';
import { stepWeather } from './weatherEngine';
import {
  stepSafetyCar,
  SAFETY_CAR_LAP_PENALTY,
  SAFETY_CAR_PIT_SAVING,
} from './safetyCarEngine';
import { aiLapDecision } from './aiStrategyEngine';
import { pitWindowFor } from './pitStrategyEngine';
import { generateRaceEventPool, resolveRaceEventTrigger } from './raceEventEngine';
import { rollReliabilityIssue } from './reliabilityEngine';
import { findOption, applyDecisionEffects } from './raceDecisionEngine';

const MAX_RACE_EVENTS = 3;
// Baseline "other" (fuel system, illness, debris, etc.) per-lap DNF probability.
const OTHER_PER_LAP = 0.00015;

const PRIORITY_RANK: Record<RecPriority, number> = { low: 1, medium: 2, high: 3, urgent: 4 };

// --- Battle / position-change event tuning -------------------------------
// Gap (s) within which a car behind is "challenging" the car ahead.
const BATTLE_GAP = 1.0;
// Consecutive laps of sustained pressure before a defend / stuck-behind line.
const BATTLE_DEFEND_LAPS = 3;
// Max battle events logged per lap (player-involved always kept, then front-runners).
const MAX_BATTLE_EVENTS = 4;
// A position battle is "meaningful" (worth logging) if it involves a player
// driver, teammates, the closing laps, or the points/podium positions.
const BATTLE_POINTS_CUTOFF = 10;

// Advance one lap. `meta` carries track + names + player team.
export function stepLiveRace(state: LiveRaceState, meta: LiveRaceMeta): LiveRaceState {
  if (state.phase === 'finished') return state;
  if (state.pendingPrompt) return state; // resolve the prompt first

  const { track } = meta;
  const nextLap = state.currentLap + 1;
  const isFinalLap = nextLap >= state.totalLaps;
  const name = (id: string) => meta.driverNames[id] ?? id;

  const lapEvents: RaceEvent[] = [];
  const pittedThisLap: LiveCarState[] = [];
  let incidentThisLap = false;
  let incidentSeverity = 0;

  // Weather first (affects the whole field this lap).
  const { weather, changed: weatherChanged } = stepWeather(
    state.weather,
    track,
    state.seed,
    nextLap,
    state.totalLaps,
  );

  // Previous-lap running order, used for dirty-air / traffic and pressure. A
  // car's `interval` is its gap to the car directly ahead; the next car's
  // interval is therefore this car's gap to the car behind.
  const prevRunning = state.cars
    .filter((c) => c.running)
    .sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
  const intervalAheadByDriver: Record<string, number> = {};
  const intervalBehindByDriver: Record<string, number> = {};
  prevRunning.forEach((c, i) => {
    intervalAheadByDriver[c.driverId] = i === 0 ? 0 : c.interval;
    const behind = prevRunning[i + 1];
    intervalBehindByDriver[c.driverId] = behind ? behind.interval : 0;
  });

  // Transient per-car facts for post-order status messages.
  const mistakeByDriver: Record<string, boolean> = {};

  const newCars: LiveCarState[] = state.cars.map((car) => {
    if (!car.running) return car; // already retired — carried unchanged

    const rng = createSeededRandom(deriveSeed(state.seed, 'lap', car.driverId, nextLap));
    let c: LiveCarState = {
      ...car,
      tire: { ...car.tire },
      pit: { ...car.pit, inPitThisLap: false, scheduledLaps: [...car.pit.scheduledLaps] },
      reliabilityIssue: car.reliabilityIssue ? { ...car.reliabilityIssue } : null,
    };

    // --- AI decision (player pace/pits come from player decisions) ---
    let wantsPit = false;
    if (!c.isPlayer) {
      const action = aiLapDecision(c, state, track, nextLap);
      c.paceMode = action.paceMode;
      if (action.pitNow) {
        wantsPit = true;
        if (action.note) lapEvents.push({ lap: nextLap, text: `${name(c.driverId)} ${action.note}.` });
      }
      // AI fallback: pit on the scheduled lap.
      if (!wantsPit && c.pit.scheduledLaps.length > 0 && nextLap >= c.pit.scheduledLaps[0]) wantsPit = true;
    } else {
      // Player owns pit timing: the car only pits when the player has called it
      // in (via the pit-wall / an accepted analytics recommendation). The planned
      // window is *prompted*, never auto-executed (see analyticsEngine), so an
      // unattended window no longer boxes the car — only the tyre-cliff net below
      // forces a stop as a last resort.
      if (c.pit.pitRequested) wantsPit = true;
    }
    // Tyre-cliff forced stop (both player and AI) — safety net.
    if (!wantsPit && c.tire.wear > 92) {
      wantsPit = true;
      if (c.isPlayer) {
        lapEvents.push({ lap: nextLap, text: `${name(c.driverId)} is forced to box — tyres past the cliff.` });
      }
    }

    // --- Execute pit stop ---
    let pitLoss = 0;
    if (wantsPit) {
      // A stop fulfils the nearest planned stop. Detect an *early* stop (one made
      // before reaching the next scheduled lap, e.g. a cheap safety-car stop) so
      // we can consume that planned stop too — otherwise the car would pit again
      // in the original window for a redundant second stop.
      const hadDueScheduled = c.pit.scheduledLaps.some((l) => l <= nextLap);
      const nextPlanned = c.pit.scheduledLaps.find((l) => l > nextLap);
      const earlyStop = !hadDueScheduled && nextPlanned != null;
      const beforeWindow = c.isPlayer && c.pit.window != null && nextLap < c.pit.window.open;
      const recalc = earlyStop && (beforeWindow || state.safetyCar.active);

      c.pit.scheduledLaps = c.pit.scheduledLaps.filter((l) => l > nextLap);
      if (earlyStop && c.pit.scheduledLaps.length > 0) c.pit.scheduledLaps.shift();
      c.pit.stopsMade += 1;
      c.pit.lastPitLap = nextLap;
      c.pit.inPitThisLap = true;
      c.pit.pitRequested = false;
      c.pit.planCancelled = false;
      // Advance the advisory window to the player's next planned stop (if any).
      c.pit.window =
        c.isPlayer && c.pit.scheduledLaps.length > 0
          ? pitWindowFor(c.pit.scheduledLaps[0], state.totalLaps)
          : null;
      c.pit.lastWindowPromptLap = null;
      c.pit.planStatus =
        c.pit.scheduledLaps.length > 0 ? (recalc ? 'recalculated' : 'planned') : 'completed';
      // Clarify the strategy narrative when an early stop absorbs a planned stop.
      if (c.isPlayer && recalc) {
        lapEvents.push({
          lap: nextLap,
          text: `Planned stop recalculated after ${name(c.driverId)}'s early ${
            state.safetyCar.active ? 'Safety Car ' : ''
          }pit.`,
        });
      }
      pitLoss = state.safetyCar.active
        ? Math.max(8, c.pitLossBase - SAFETY_CAR_PIT_SAVING)
        : c.pitLossBase;
      c.tire = {
        compound: weather.wet ? 'Wet' : 'Dry',
        age: 0,
        wear: 0,
        stintTarget: c.tire.stintTarget,
      };
      pittedThisLap.push(c);
    }

    const spec = modeSpec(c.paceMode);
    const intervalAhead = intervalAheadByDriver[c.driverId] ?? 0;
    const intervalBehind = intervalBehindByDriver[c.driverId] ?? 0;
    const fighting =
      (intervalAhead > 0 && intervalAhead < 1.5) || (intervalBehind > 0 && intervalBehind < 1.5);

    // --- Tyre wear (applied before pace so this lap reflects current rubber) ---
    if (!wantsPit) {
      const wearAdd = c.tireDegRate * spec.wearMult * (weather.wet ? 0.6 : 1);
      c.tire = { ...c.tire, age: c.tire.age + 1, wear: clamp(c.tire.wear + wearAdd, 0, 100) };
    }

    const pushing = c.paceMode === 'Push' || c.paceMode === 'Attack';

    // --- Reliability issue onset (warning) ---
    if (!c.reliabilityIssue) {
      const issue = rollReliabilityIssue(rng, c.baseFailureRisk, nextLap, pushing);
      if (issue) {
        c.reliabilityIssue = issue;
        lapEvents.push({ lap: nextLap, text: `${name(c.driverId)} reports ${issue.label.toLowerCase()}.` });
      }
    } else if (!c.isPlayer && !c.reliabilityIssue.managed && c.reliabilityIssue.lap < nextLap) {
      // AI teams react to a warning (turn the engine down, adjust) so it doesn't
      // sit unmanaged and compound into a near-certain retirement. The player
      // still owns the decision via the prompt.
      if (rng.chance(0.7)) c.reliabilityIssue = { ...c.reliabilityIssue, managed: true };
    }

    // --- Retirement risk, split into independent buckets ---------------------
    // Each bucket is rolled separately and the DNF is labelled by whichever
    // bucket actually fired, so the reported cause reflects the real trigger
    // (no combined roll + era-profile re-draw). Base risks are the per-lap
    // conversions of the same per-race reliability/crash risks the Quick Sim
    // uses, so Live totals track Quick Sim over large samples.

    // 1. Mechanical: car/engine reliability, mode, and any active warning.
    let mechRisk = c.baseFailureRisk * spec.reliabilityMult;
    if (c.reliabilityIssue) {
      mechRisk += c.reliabilityIssue.managed
        ? c.reliabilityIssue.failureRisk * 0.3
        : c.reliabilityIssue.failureRisk;
    }
    c.reliabilityRisk = mechRisk;

    // 2. Crash/contact: driver/track incident risk, amplified by mode, fighting,
    //    wet weather, wall proximity and existing damage; tyre wear only nudges.
    const tyreRiskAdd = tyreMistakeRisk(c.tire.wear);
    const wallFactor = 1 + (track.attributes.riskWallProximity - 5) * 0.03;
    const crashRisk =
      (c.baseCrashRisk * spec.crashMult + tyreRiskAdd * 0.05) *
      (fighting ? 1.25 : 1) *
      (weather.wet ? 1.4 : 1) *
      wallFactor *
      (c.damaged ? 1.15 : 1);
    c.crashRisk = crashRisk;

    // 3. Tyre failure: rare, only in the high-wear window before a forced pit.
    const tyreFailRisk = tyreFailureRisk(c.tire.wear, weather.wet);
    // 4. Other: fuel system, illness, debris, etc.
    const otherRisk = OTHER_PER_LAP;

    // Independent rolls; the first bucket to fire ends the race and names itself.
    let retired: { label: string; severity: number } | null = null;
    if (rng.chance(mechRisk)) {
      // Name the failure after an active warning, except tyre-vibration whose
      // wording would misread as a tyre/damage retirement — use a generic one.
      const label =
        c.reliabilityIssue && !c.reliabilityIssue.managed && c.reliabilityIssue.type !== 'TireVibration'
          ? `${c.reliabilityIssue.label} — failure`
          : mechanicalLabel(rng);
      retired = { label, severity: 0.5 };
    } else if (rng.chance(crashRisk)) {
      retired = { label: crashLabel(rng), severity: 0.7 };
    } else if (rng.chance(tyreFailRisk)) {
      retired = { label: tyreLabel(rng), severity: 0.6 };
    } else if (rng.chance(otherRisk)) {
      retired = { label: otherLabel(rng), severity: 0.4 };
    }
    if (retired) {
      c = retire(c, nextLap, retired.label);
      lapEvents.push({ lap: nextLap, text: `${name(c.driverId)} retires — ${retired.label.toLowerCase()}.` });
      incidentThisLap = true;
      incidentSeverity = Math.max(incidentSeverity, retired.severity);
      return c;
    }

    // --- Non-terminal mistake (costs time, may cause damage) ---
    let mistakeThisLap = false;
    const mistakeRisk = (c.baseMistakeRisk + tyreRiskAdd) * spec.crashMult;
    if (rng.chance(mistakeRisk)) {
      mistakeThisLap = true;
      if (!c.damaged && rng.chance(0.25)) {
        c.damaged = true;
        lapEvents.push({ lap: nextLap, text: `${name(c.driverId)} picks up front-wing damage.` });
      }
    }
    mistakeByDriver[c.driverId] = mistakeThisLap;

    // --- Live Race Pace (recomputed every lap) ---
    const formSwing = rng.variance(0.28);
    c.liveRacePace = computeLivePace({
      car: c,
      lap: nextLap,
      totalLaps: state.totalLaps,
      gripLevel: weather.gripLevel,
      intervalAhead,
      formSwing,
      mistakeThisLap,
    });

    // --- Lap time (derived from Live Race Pace) ---
    let lapTime = REF_LAP - c.liveRacePace * LIVE_PACE_K;
    // Wrong tyres for the conditions cost time on top of the grip loss already
    // folded into live pace.
    if (weather.wet && c.tire.compound === 'Dry') {
      lapTime += weather.condition === 'HeavyRain' ? 12 : 6;
    } else if (!weather.wet && c.tire.compound === 'Wet') {
      lapTime += weather.condition === 'Drying' ? 1.5 : 4;
    }
    lapTime += rng.variance(0.15);
    if (mistakeThisLap) lapTime += rng.range(0.5, 2.5);
    if (state.safetyCar.active) lapTime = REF_LAP + SAFETY_CAR_LAP_PENALTY; // neutralised
    lapTime += pitLoss;

    c.lastLapTime = round1(lapTime);
    c.totalTime += lapTime;
    c.lapsCompleted = nextLap;
    // Track the fastest representative lap (ignore pit and safety-car laps).
    const representative = !wantsPit && !state.safetyCar.active;
    if (representative) {
      const prevBest = c.bestLap;
      c.bestLap = prevBest == null ? c.lastLapTime : Math.min(prevBest, c.lastLapTime);
      c.lastSectors = splitSectors(c.lastLapTime, rng);
      if (prevBest == null || c.lastLapTime <= prevBest) c.bestSectors = c.lastSectors;
    }

    // --- Fuel burn-off + component health wear (drives the pit-wall gauges) ---
    updateFuelAndComponents(c, track, spec, nextLap, state.totalLaps);
    return c;
  });

  // --- Unique race events (each fires at most once; up to a few per race) ---
  let firedEventIds = state.firedEventIds;
  if (firedEventIds.length < MAX_RACE_EVENTS) {
    const pool = generateRaceEventPool(track, weather);
    const fired = resolveRaceEventTrigger(
      pool,
      state.seed,
      track.id,
      nextLap,
      state.totalLaps,
      firedEventIds,
    );
    if (fired) {
      firedEventIds = [...firedEventIds, fired.template.id];
      lapEvents.push({ lap: nextLap, text: `${fired.template.title} — ${fired.template.description}` });
      const fx = fired.template.effect;
      if (fx) {
        for (const c of newCars) {
          if (!c.running) continue;
          if (fx.tyreWear) c.tire.wear = clamp(c.tire.wear + fx.tyreWear, 0, 100);
          if (fx.reliabilityRisk) c.reliabilityRisk += fx.reliabilityRisk;
          if (fx.paceDelta) {
            c.lastLapTime = round1(c.lastLapTime + fx.paceDelta);
            c.totalTime += fx.paceDelta;
          }
        }
        if (fx.retireRandomCar) {
          const erng = createSeededRandom(deriveSeed(state.seed, 'event-crash', nextLap, fired.template.id));
          const victims = newCars.filter((c) => c.running && !c.isPlayer);
          if (victims.length > 0) {
            const victim = erng.pick(victims);
            const idx = newCars.findIndex((c) => c.driverId === victim.driverId);
            newCars[idx] = retire(newCars[idx], nextLap, 'Crashed out');
            lapEvents.push({ lap: nextLap, text: `${name(victim.driverId)} is caught up in it and retires.` });
            incidentThisLap = true;
            incidentSeverity = Math.max(incidentSeverity, 0.7);
          }
        }
        if (fx.triggerSafetyCar) {
          incidentThisLap = true;
          incidentSeverity = Math.max(incidentSeverity, 0.8);
        }
      }
    }
  }

  // Normal in-race strategy decisions (pit window, tyre wear, rain, safety-car
  // pit, rival stop, teammate battle) no longer raise separate Decision pop-ups.
  // They are surfaced entirely by the Data Analytics recommendation panel — see
  // the analytics engine + the lifecycle merge below — so the player answers each
  // question exactly once.

  // --- Weather change event line (no pop-up; the wet-tyre call is an analytics rec) ---
  if (weatherChanged) {
    lapEvents.push({ lap: nextLap, text: `Weather update: ${weather.label}.` });
  }

  // --- Safety car ---
  const scResult = stepSafetyCar(
    state.safetyCar,
    track,
    weather,
    { incidentThisLap, incidentSeverity },
    state.seed,
    nextLap,
    state.totalLaps,
  );
  if (scResult.justDeployed) {
    lapEvents.push({ lap: nextLap, text: `Safety car deployed — ${scResult.safetyCar.reason}.` });
  }
  if (scResult.justEnded) lapEvents.push({ lap: nextLap, text: 'Safety car in this lap — racing resumes.' });

  // --- Order the field ---
  const running = newCars.filter((c) => c.running).sort((x, y) => x.totalTime - y.totalTime);
  const retired = newCars
    .filter((c) => !c.running)
    .sort((x, y) => (y.retiredOnLap ?? 0) - (x.retiredOnLap ?? 0));

  // Compress the field on safety-car deployment (bunch up behind the leader).
  if (scResult.justDeployed && running.length > 0) {
    const lead = running[0].totalTime;
    running.forEach((c, i) => (c.totalTime = lead + i * 1));
  }

  running.forEach((c, i) => {
    c.position = i + 1;
    c.gapToLeader = i === 0 ? 0 : round1(c.totalTime - running[0].totalTime);
    c.interval = i === 0 ? 0 : round1(c.totalTime - running[i - 1].totalTime);
  });
  retired.forEach((c) => {
    c.position = null;
    c.gapToLeader = 0;
    c.interval = 0;
  });

  // --- Battle / position-change events for the log's Battles feed ---------
  const { events: battleEvents, tracker: battleTracker } = detectBattleEvents(
    state.cars,
    running,
    nextLap,
    state.totalLaps,
    state.battleTracker,
    name,
  );
  lapEvents.push(...battleEvents);

  // --- Live status (risk bands, traffic, readable message) for running cars ---
  running.forEach((c, i) => {
    const intervalAhead = i === 0 ? 0 : c.interval;
    const behind = running[i + 1];
    const intervalBehind = behind ? behind.interval : 0;
    const underPressure = intervalBehind > 0 && intervalBehind < DIRTY_AIR_GAP;
    const freshFromPit = c.pit.stopsMade > 0 && c.tire.age <= 2 && !c.pit.inPitThisLap;
    c.reliabilityRiskLevel = reliabilityRiskLevel(c);
    c.crashRiskLevel = crashRiskLevel(c);
    c.trafficStatus = trafficStatus({ mode: c.paceMode, intervalAhead, underPressure });
    c.statusMessage = statusMessage({
      car: c,
      intervalAhead,
      intervalBehind,
      underPressure,
      mistakeThisLap: mistakeByDriver[c.driverId] ?? false,
      pittedThisLap: c.pit.inPitThisLap,
      freshFromPit,
    });
    c.liveRacePace = displayPace(c.liveRacePace);
  });

  let orderedCars = [...running, ...retired];

  // --- Finish ---
  let phase: LiveRaceState['phase'] = state.phase === 'formation' ? 'racing' : state.phase;
  if (isFinalLap) {
    phase = 'finished';
    orderedCars = orderedCars.map((c) =>
      c.running ? { ...c, running: false, status: 'Finished', lapsCompleted: state.totalLaps } : c,
    );
  }

  // --- Data analytics recommendations for the player's drivers -------------
  // The analytics panel is the sole decision interface. The lifecycle merge
  // carries active instructions forward (without re-prompting), completes them
  // when their duration ends, and only raises genuinely new / worsened advice.
  const recEvents: RaceEvent[] = [];
  const { recommendations, ignoredRecs, recCooldowns } = refreshRecommendations(
    orderedCars,
    { ...state, currentLap: nextLap, weather, safetyCar: scResult.safetyCar },
    nextLap,
    name,
    recEvents,
  );

  const retirements = orderedCars.filter((c) => c.status === 'DNF').length;

  return {
    ...state,
    currentLap: nextLap,
    phase,
    weather,
    safetyCar: scResult.safetyCar,
    cars: orderedCars,
    events: [...state.events, ...lapEvents, ...recEvents],
    pendingPrompt: null,
    promptCooldown: state.promptCooldown,
    firedEventIds,
    recommendations,
    ignoredRecs,
    recCooldowns,
    battleTracker,
    retirements,
  };
}

// Apply the player's chosen option and clear the prompt so stepping resumes.
export function resolvePrompt(state: LiveRaceState, optionId: string, meta: LiveRaceMeta): LiveRaceState {
  const prompt = state.pendingPrompt;
  if (!prompt) return state;
  const option = findOption(prompt, optionId);
  if (!option) return state;

  const cars = state.cars.map((c) =>
    c.driverId === prompt.driverId ? applyDecisionEffects(c, option.effects, state.currentLap) : c,
  );
  const name = meta.driverNames[prompt.driverId] ?? prompt.driverId;
  const events = option.effects.note
    ? [...state.events, { lap: state.currentLap, text: `${name} ${option.effects.note}.` }]
    : state.events;

  return { ...state, cars, events, pendingPrompt: null };
}

// Call a player car into the pits. The stop is executed on the next lap step.
// No-op if the car has retired or finished, or already requested a stop.
export function requestPlayerPit(state: LiveRaceState, driverId: string): LiveRaceState {
  let changed = false;
  const cars = state.cars.map((c) => {
    if (c.driverId !== driverId || !c.isPlayer || !c.running || c.pit.pitRequested) return c;
    changed = true;
    return { ...c, pit: { ...c.pit, pitRequested: true } };
  });
  return changed ? { ...state, cars } : state;
}

// Cancel a player car's planned pit stop. The car keeps running and is only
// re-prompted if tyres/rules/strategy force a stop (the tyre analytics recs and
// the tyre-cliff net still apply). Clears the advisory window so the pit-window
// prompt is not re-raised. No-op for AI / retired / finished cars.
export function cancelPlayerPitPlan(state: LiveRaceState, driverId: string): LiveRaceState {
  let changed = false;
  const cars = state.cars.map((c) => {
    if (c.driverId !== driverId || !c.isPlayer || !c.running) return c;
    changed = true;
    return {
      ...c,
      pit: {
        ...c.pit,
        scheduledLaps: [],
        window: null,
        pitRequested: false,
        planCancelled: true,
        planStatus: 'cancelled' as const,
      },
    };
  });
  return changed ? { ...state, cars } : state;
}

// Change a player car's strategy mode mid-race. Takes effect on the next lap.
// No-op for AI cars (their mode is chosen each lap) or retired/finished cars.
export function setPlayerPaceMode(
  state: LiveRaceState,
  driverId: string,
  mode: PaceMode,
): LiveRaceState {
  let changed = false;
  const cars = state.cars.map((c) => {
    if (c.driverId !== driverId || !c.isPlayer || !c.running || c.paceMode === mode) return c;
    changed = true;
    return { ...c, paceMode: mode };
  });
  return changed ? { ...state, cars } : state;
}

// Resolve a pending prompt with its default (first) option — used by skip-to-end.
export function resolvePromptDefault(state: LiveRaceState, meta: LiveRaceMeta): LiveRaceState {
  if (!state.pendingPrompt) return state;
  return resolvePrompt(state, state.pendingPrompt.options[0].id, meta);
}

// Step to the flag, auto-resolving any prompts with their default option.
export function stepLiveRaceToEnd(state: LiveRaceState, meta: LiveRaceMeta): LiveRaceState {
  let s = state;
  let guard = 0;
  const maxIters = state.totalLaps * 3 + 10;
  while (s.phase !== 'finished' && guard < maxIters) {
    if (s.pendingPrompt) s = resolvePromptDefault(s, meta);
    else s = stepLiveRace(s, meta);
    guard += 1;
  }
  return s;
}

function retire(c: LiveCarState, lap: number, cause: string): LiveCarState {
  return {
    ...c,
    running: false,
    status: 'DNF',
    position: null,
    retiredOnLap: lap,
    lapsCompleted: lap,
    lastIncident: cause,
  };
}

// Split a lap time into three sector times. No real track geometry is modelled,
// so the split is a lightly-jittered ~34/33/33% partition summing to the lap.
function splitSectors(lapTime: number, rng: Rng): [number, number, number] {
  const p1 = 0.34 + rng.variance(0.008);
  const p2 = 0.33 + rng.variance(0.008);
  const s1 = round3(lapTime * p1);
  const s2 = round3(lapTime * p2);
  const s3 = round3(lapTime - s1 - s2);
  return [s1, s2, s3];
}

// Burn fuel off across the distance and wear the mechanical components. Wear is
// deterministic: worse cars (higher baseFailureRisk), aggressive modes, stress
// tracks and active reliability issues all raise the per-lap drop, so the
// pit-wall component gauges reflect the same mechanical stress the DNF model uses.
function updateFuelAndComponents(
  c: LiveCarState,
  track: Track,
  spec: StrategyModeSpec,
  lap: number,
  totalLaps: number,
): void {
  c.fuel = clamp(100 * (1 - lap / Math.max(1, totalLaps)), 0, 100);

  const base = 0.12 + c.baseFailureRisk * 12;
  const modeMult = spec.reliabilityMult;
  let eng = base * modeMult * (0.85 + track.attributes.straights * 0.03);
  let gear = base * modeMult * 0.85;
  let brake = base * (0.6 + track.attributes.braking * 0.05);

  const issue = c.reliabilityIssue;
  if (issue) {
    const extra = issue.managed ? 0.25 : 0.7;
    if (issue.type === 'EngineOverheating' || issue.type === 'CoolingProblem') eng += extra;
    else if (issue.type === 'GearboxWarning') gear += extra;
    else if (issue.type === 'BrakeIssue') brake += extra;
    else eng += extra * 0.4;
  }

  c.engineHealth = clamp(c.engineHealth - eng, 0, 100);
  c.gearboxHealth = clamp(c.gearboxHealth - gear, 0, 100);
  c.brakeHealth = clamp(c.brakeHealth - brake, 0, 100);
}

// Advance the recommendation lifecycle for the player's drivers each lap:
//  1. carry active instructions forward (no re-prompt), completing them when
//     their approved duration ends;
//  2. keep still-valid pending recs (stable createdLap, refreshed wording);
//  3. raise genuinely new pending advice, deduped against live recs and per-kind
//     cooldowns (urgent bypasses cooldown; worsened ignored warnings re-raise).
// Also prunes stale ignore records and logs when an ignored reliability warning
// has since worsened into a High/Critical risk.
export function refreshRecommendations(
  cars: LiveCarState[],
  partial: LiveRaceState,
  lap: number,
  name: (id: string) => string,
  events: RaceEvent[],
): {
  recommendations: LiveRaceState['recommendations'];
  ignoredRecs: LiveRaceState['ignoredRecs'];
  recCooldowns: LiveRaceState['recCooldowns'];
} {
  const prev = partial.recommendations;
  const candidates = generateCandidates(cars, partial, lap);
  const candById = new Map(candidates.map((c) => [c.id, c]));
  const carFor = (id: string) => cars.find((c) => c.driverId === id);

  const recCooldowns: Record<string, number> = { ...partial.recCooldowns };
  // Clear situational cooldowns once the situation resets so a fresh event can
  // raise new advice: safety-car pit calls when the SC is gone, wet-tyre calls
  // once the track is dry again.
  for (const key of Object.keys(recCooldowns)) {
    if (key.endsWith(':safetyCarPit') && !partial.safetyCar.active) delete recCooldowns[key];
    if (key.endsWith(':weatherTyres') && !partial.weather.wet) delete recCooldowns[key];
  }

  // Escalate ignored warnings that have since worsened (a current candidate for
  // the same key now outranks the priority it had when ignored) and clear their
  // cooldown so the re-raise is allowed this lap.
  const escalatedIds = new Set<string>();
  const ignoredRecs = partial.ignoredRecs
    .filter((i) => lap - i.lap < REC_COOLDOWN * 3)
    .map((i) => {
      if (i.escalated) return i;
      const cand = candById.get(i.key);
      if (!cand || PRIORITY_RANK[cand.priority] <= PRIORITY_RANK[i.priority]) return i;
      const [driverId] = i.key.split(':');
      events.push({
        lap,
        text: `Lap ${lap} — ${name(driverId)}: earlier ignored warning worsens — ${cand.issue}`,
      });
      delete recCooldowns[i.key];
      escalatedIds.add(i.key);
      return { ...i, escalated: true };
    });

  const result: AnalyticsRecommendation[] = [];
  const liveIds = new Set<string>();

  // 1. Advance existing recommendations: carry active instructions, complete them
  //    when their duration ends, keep still-valid pending recs.
  for (const rec of prev) {
    const car = carFor(rec.driverId);
    if (rec.status === 'active') {
      if (!car || !car.running) continue; // car gone — instruction moot
      if (rec.appliedUntilLap != null && lap >= rec.appliedUntilLap) {
        // Completed: return to Balanced if still running the applied mode, and
        // log the completion once for the notable racing instructions.
        const applied = rec.appliedAction;
        if (applied?.paceMode && applied.paceMode !== 'Balanced' && car.paceMode === applied.paceMode) {
          car.paceMode = 'Balanced';
        }
        if (rec.priority === 'high' || rec.priority === 'urgent' || rec.kind === 'attack' || rec.kind === 'defend') {
          events.push({
            lap,
            text: `Lap ${lap} — ${name(rec.driverId)} completes ${applied?.label ?? rec.action.label} instruction and returns to Balanced.`,
          });
        }
        recCooldowns[rec.id] = lap + cooldownFor(rec.kind);
        continue;
      }
      result.push(rec);
      liveIds.add(rec.id);
      continue;
    }
    if (rec.status === 'pending') {
      const cand = candById.get(rec.id);
      if (cand) {
        // Still applies — keep it pending, refreshing wording/priority if it has
        // worsened, but preserve the original createdLap so the card is stable.
        result.push({ ...cand, createdLap: rec.createdLap, status: 'pending' });
        liveIds.add(rec.id);
      }
      // Trigger gone → drop (superseded); no log noise.
      continue;
    }
    // Terminal statuses are not carried.
  }

  // 2. Raise genuinely new pending recommendations (dedup vs live recs + cooldown).
  for (const cand of candidates) {
    if (liveIds.has(cand.id)) continue;
    const cd = recCooldowns[cand.id];
    if (cand.priority !== 'urgent' && cd != null && lap < cd) continue;
    result.push(cand);
    liveIds.add(cand.id);
    // Log the first appearance of important advice once (skip if it was just
    // surfaced by the "ignored warning worsens" line above).
    if ((cand.priority === 'high' || cand.priority === 'urgent') && !escalatedIds.has(cand.id)) {
      events.push({ lap, text: `Lap ${lap} — analytics alert (${name(cand.driverId)}): ${cand.issue}` });
    }
  }

  return { recommendations: result, ignoredRecs, recCooldowns };
}

// ---------------------------------------------------------------------------
// Data analytics recommendation actions (Accept / Modify / Ignore)
// ---------------------------------------------------------------------------

function addEvent(state: LiveRaceState, text: string): LiveRaceState {
  return { ...state, events: [...state.events, { lap: state.currentLap, text }] };
}

function withCooldown(state: LiveRaceState, rec: AnalyticsRecommendation): LiveRaceState {
  return {
    ...state,
    recCooldowns: { ...state.recCooldowns, [rec.id]: state.currentLap + cooldownFor(rec.kind) },
  };
}

function removeRec(state: LiveRaceState, recId: string): LiveRaceState {
  return { ...state, recommendations: state.recommendations.filter((r) => r.id !== recId) };
}

// Apply a chosen action to a recommendation and advance its lifecycle:
//  • Duration-based mode instructions (Attack for 4 laps, Protect Engine for 6,
//    Fuel Save, …) become `active` and are kept in the list until their duration
//    ends — the merge does not re-prompt while active and completes them later.
//  • Pit calls schedule exactly one stop (duplicate calls are logged, not doubled)
//    and are then removed + put on cooldown.
//  • Other one-shot actions (stay out, one-off mode change) are removed + cooled.
// "Let Crew Decide" resolves to the recommended action. Team-order actions carry
// no mode/pit effect here — the UI applies the on-track order via the relationship
// engine and calls resolveRecommendationExternally to remove + log the decision.
function applyRecAction(
  state: LiveRaceState,
  rec: AnalyticsRecommendation,
  action: RecAction,
  meta: LiveRaceMeta,
  verb: 'accepted' | 'modified',
): LiveRaceState {
  const lap = state.currentLap;
  const name = meta.driverNames[rec.driverId] ?? rec.driverId;
  const eff = action.type === 'LetCrewDecide' ? rec.action : action;

  // --- Cancel the planned stop: keep running, only re-prompt on tyre/rules ---
  if (eff.type === 'CancelStop') {
    let s = withCooldown(removeRec(state, rec.id), rec);
    const car = state.cars.find((c) => c.driverId === rec.driverId);
    if (!car || !car.running) return s;
    const priorStop = car.pit.stopsMade > 0;
    s = cancelPlayerPitPlan(s, rec.driverId);
    return addEvent(
      s,
      `Lap ${lap} — pit wall cancels ${name}'s planned stop${
        priorStop ? ' after the earlier stop' : ''
      }; car stays out.`,
    );
  }

  // --- Pit call: schedule at most one stop, with duplicate protection ---
  if (eff.pitNow) {
    const car = state.cars.find((c) => c.driverId === rec.driverId);
    let s = withCooldown(removeRec(state, rec.id), rec);
    if (!car || !car.running) return s;
    if (car.pit.inPitThisLap) return addEvent(s, `Lap ${lap} — ${name}'s pit call — already in the pits this lap.`);
    if (car.pit.pitRequested) return addEvent(s, `Lap ${lap} — ${name} is already called to the pits; duplicate stop avoided.`);
    if (car.pit.stopsMade >= car.pit.plannedStops && car.tire.wear < 60) {
      return addEvent(s, `Lap ${lap} — ${name}'s pit call postponed; no further stop planned.`);
    }
    s = requestPlayerPit(s, rec.driverId);
    return addEvent(s, `Lap ${lap} — pit wall ${verb} analytics recommendation: ${name} will pit this lap.`);
  }

  // --- Strategy-mode instruction ---
  if (eff.paceMode) {
    let s = setPlayerPaceMode(state, rec.driverId, eff.paceMode);
    const duration = isModeAction(eff) ? rec.suggestedDurationLaps : undefined;
    if (duration && duration > 0) {
      // Becomes an active instruction for its approved duration.
      const recommendations = s.recommendations.map((r) =>
        r.id === rec.id
          ? { ...r, status: 'active' as const, appliedAction: eff, appliedUntilLap: lap + duration }
          : r,
      );
      s = { ...s, recommendations };
      return addEvent(s, `Lap ${lap} — ${name} switches to ${eff.label} for ${duration} lap${duration > 1 ? 's' : ''}.`);
    }
    // One-off mode change (no approved duration): apply, remove, cool down.
    s = withCooldown(removeRec(s, rec.id), rec);
    return addEvent(s, `Lap ${lap} — pit wall ${verb} analytics recommendation: ${name} — ${eff.label}.`);
  }

  // --- Any other one-shot action (e.g. stay out) ---
  const s = withCooldown(removeRec(state, rec.id), rec);
  return addEvent(s, `Lap ${lap} — pit wall ${verb} analytics recommendation: ${name} — ${eff.label}.`);
}

// Accept a recommendation's recommended action.
export function acceptRecommendation(state: LiveRaceState, recId: string, meta: LiveRaceMeta): LiveRaceState {
  const rec = state.recommendations.find((r) => r.id === recId);
  if (!rec) return state;
  return applyRecAction(state, rec, rec.action, meta, 'accepted');
}

// Apply one of a recommendation's alternative (Modify) actions by type.
export function modifyRecommendation(
  state: LiveRaceState,
  recId: string,
  actionType: string,
  meta: LiveRaceMeta,
): LiveRaceState {
  const rec = state.recommendations.find((r) => r.id === recId);
  if (!rec) return state;
  const action = [rec.action, ...rec.alternatives].find((a) => a.type === actionType);
  if (!action) return state;
  return applyRecAction(state, rec, action, meta, 'modified');
}

// Apply an arbitrary action to a recommendation. Unlike modifyRecommendation this
// does not require the action to be one of the recommendation's own alternatives —
// used by "Apply to both drivers" where the same action is pushed onto every
// player driver. Team-order actions carry no effect here (caller applies the
// on-track order separately).
export function applyRecommendationAction(
  state: LiveRaceState,
  recId: string,
  action: RecAction,
  meta: LiveRaceMeta,
  verb: 'accepted' | 'modified',
): LiveRaceState {
  const rec = state.recommendations.find((r) => r.id === recId);
  if (!rec) return state;
  return applyRecAction(state, rec, action, meta, verb);
}

// Dismiss a recommendation without acting on it. Medium+ priority ignores are
// logged, and the kind is put on cooldown so it is not re-raised immediately (a
// worsened reliability warning is later surfaced by refreshRecommendations).
export function ignoreRecommendation(state: LiveRaceState, recId: string, meta?: LiveRaceMeta): LiveRaceState {
  const rec = state.recommendations.find((r) => r.id === recId);
  if (!rec) return state;
  const lap = state.currentLap;
  const ignoredRecs = [
    ...state.ignoredRecs.filter((i) => i.key !== rec.id),
    { key: rec.id, lap, issue: rec.issue, priority: rec.priority, escalated: false },
  ];
  let s = withCooldown(removeRec(state, rec.id), rec);
  s = { ...s, ignoredRecs };
  const name = meta?.driverNames[rec.driverId] ?? rec.driverId;
  return rec.priority === 'low'
    ? s
    : addEvent(s, `Lap ${lap} — ${name} ignored analytics recommendation: ${rec.recommendedAction}`);
}

// Auto-dismiss a recommendation whose decision countdown elapsed with no player
// response. Treated as an ignore (so a worsening warning can still re-raise) but
// logged as "no pit wall response — stays on the current plan".
export function expireRecommendation(state: LiveRaceState, recId: string, meta?: LiveRaceMeta): LiveRaceState {
  const rec = state.recommendations.find((r) => r.id === recId);
  if (!rec) return state;
  const lap = state.currentLap;
  const ignoredRecs = [
    ...state.ignoredRecs.filter((i) => i.key !== rec.id),
    { key: rec.id, lap, issue: rec.issue, priority: rec.priority, escalated: false },
  ];
  let s = withCooldown(removeRec(state, rec.id), rec);
  s = { ...s, ignoredRecs };
  const name = meta?.driverNames[rec.driverId] ?? rec.driverId;
  return addEvent(s, `Lap ${lap} — no pit wall response; ${name} stays on the current plan.`);
}

// Remove + log a recommendation whose on-track effect the caller applied itself
// (used for team-order recommendations). Kept separate so the tick engine does
// not depend on the relationship engine.
export function resolveRecommendationExternally(
  state: LiveRaceState,
  recId: string,
  label: string,
  verb: 'accepted' | 'modified',
  meta: LiveRaceMeta,
): LiveRaceState {
  const rec = state.recommendations.find((r) => r.id === recId);
  if (!rec) return state;
  const s = withCooldown(removeRec(state, rec.id), rec);
  const name = meta.driverNames[rec.driverId] ?? rec.driverId;
  return addEvent(s, `Lap ${s.currentLap} — pit wall ${verb} analytics recommendation: ${name} — ${label}.`);
}

// Detect meaningful on-track battles and pit-cycle position changes for the
// event log's Battles feed. Compares the previous running order (prevCars) with
// the freshly-ordered `running` field to spot completed passes, sustained
// defends, faded attacks and stops that cost/gain places — without spamming the
// log every lap. Only battles involving a player driver, teammates, the closing
// laps or the points/podium places are kept, and at most MAX_BATTLE_EVENTS fire
// per lap (player-involved prioritised, then front-runners).
export function detectBattleEvents(
  prevCars: LiveCarState[],
  running: LiveCarState[],
  lap: number,
  totalLaps: number,
  prevTracker: Record<string, number>,
  name: (id: string) => string,
): { events: RaceEvent[]; tracker: Record<string, number> } {
  const finalLaps = lap > totalLaps - 10;
  const prevPos: Record<string, number | null> = {};
  for (const c of prevCars) prevPos[c.driverId] = c.position;
  const runningById: Record<string, LiveCarState> = {};
  for (const c of running) runningById[c.driverId] = c;

  const candidates: { text: string; score: number }[] = [];
  const tracker: Record<string, number> = {};
  const passedPairs = new Set<string>();
  const activeKeys = new Set<string>();

  const significant = (posA: number, posB: number, players: boolean, sameTeam: boolean): boolean =>
    players || sameTeam || finalLaps || Math.min(posA, posB) <= BATTLE_POINTS_CUTOFF;
  const scoreOf = (posA: number, posB: number, players: boolean): number =>
    (players ? 1000 : 0) + (100 - Math.min(posA, posB));

  for (let i = 0; i < running.length - 1; i++) {
    const a = running[i]; // now ahead (P{i+1})
    const b = running[i + 1]; // now directly behind (P{i+2})
    const pa = prevPos[a.driverId];
    const pb = prevPos[b.driverId];
    const posA = i + 1;
    const posB = i + 2;
    const players = a.isPlayer || b.isPlayer;
    const sameTeam = a.teamId === b.teamId;

    // Clean on-track pass: the pair swapped since last lap, neither pitted.
    if (pa != null && pb != null && pa > pb && !a.pit.inPitThisLap && !b.pit.inPitThisLap) {
      passedPairs.add(`${a.driverId}>${b.driverId}`);
      passedPairs.add(`${b.driverId}>${a.driverId}`);
      if (significant(posA, posB, players, sameTeam)) {
        const suffix = sameTeam ? ' (teammates)' : '';
        candidates.push({
          text: `${name(a.driverId)} passes ${name(b.driverId)} for P${posA}${suffix}.`,
          score: scoreOf(posA, posB, players) + 5,
        });
      }
      continue;
    }

    // Sustained pressure: b sits within striking distance behind a.
    const gap = b.interval; // b's gap to the car ahead (a)
    if (gap > 0 && gap <= BATTLE_GAP && !a.pit.inPitThisLap && !b.pit.inPitThisLap) {
      const key = `${b.driverId}>${a.driverId}`;
      const streak = (prevTracker[key] ?? 0) + 1;
      tracker[key] = streak;
      activeKeys.add(key);
      if (streak === BATTLE_DEFEND_LAPS && significant(posA, posB, players, sameTeam)) {
        candidates.push({
          text: `${name(a.driverId)} defends P${posA} from ${name(b.driverId)}.`,
          score: scoreOf(posA, posB, players),
        });
      }
    }
  }

  // Pit-cycle position changes: a car that pitted this lap and rejoined in a
  // different place.
  for (let i = 0; i < running.length; i++) {
    const c = running[i];
    if (!c.pit.inPitThisLap) continue;
    const pc = prevPos[c.driverId];
    if (pc == null) continue;
    const posC = i + 1;
    const delta = pc - posC;
    if (delta === 0) continue;
    const players = c.isPlayer;
    const n = Math.abs(delta);
    if (!players && n < 2) continue; // ignore minor AI shuffles
    if (!significant(posC, pc, players, false)) continue;
    candidates.push({
      text:
        delta > 0
          ? `${name(c.driverId)} gains ${n} place${n === 1 ? '' : 's'} through the pit cycle to P${posC}.`
          : `${name(c.driverId)} drops ${n} place${n === 1 ? '' : 's'} to P${posC} after the stop.`,
      score: scoreOf(posC, pc, players) - 2,
    });
  }

  // Faded challenges: a threshold-length pressure streak that is no longer live
  // and did not end in a pass — log the failed attack once (both cars running).
  for (const [key, streak] of Object.entries(prevTracker)) {
    if (streak < BATTLE_DEFEND_LAPS) continue;
    if (activeKeys.has(key) || passedPairs.has(key)) continue;
    const [attackerId, defenderId] = key.split('>');
    const attacker = runningById[attackerId];
    const defender = runningById[defenderId];
    if (!attacker || !defender) continue;
    const players = attacker.isPlayer || defender.isPlayer;
    if (!players && !finalLaps) continue;
    candidates.push({
      text: `${name(attackerId)}'s attack on ${name(defenderId)} fades.`,
      score: players ? 1000 : 50,
    });
  }

  const events = candidates
    .sort((x, y) => y.score - x.score)
    .slice(0, MAX_BATTLE_EVENTS)
    .map<RaceEvent>((c) => ({ lap, text: c.text, category: 'battle' }));

  return { events, tracker };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
