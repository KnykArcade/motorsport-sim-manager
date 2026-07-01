// Race tick engine — advances a live race by one lap.
//
// Pure: each lap derives its own seeded RNG from (seed, driverId, lap), so the
// same state always produces the same next state and a race replays identically.
// Player decisions are applied between steps via `resolvePrompt`; while a prompt
// is pending, `stepLiveRace` is a no-op so the screen can pause for input.

import type { RaceEvent } from '../types/simTypes';
import type {
  LiveCarState,
  LiveRaceState,
  PaceMode,
  RaceDecisionPrompt,
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
import { generateRecommendations, REC_COOLDOWN } from './analyticsEngine';
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
import {
  damagePrompt,
  findOption,
  pitWindowPrompt,
  rainPrompt,
  reliabilityPrompt,
  rivalPitPrompt,
  safetyCarPrompt,
  teammateBattlePrompt,
  tyreWearPrompt,
  applyDecisionEffects,
} from './raceDecisionEngine';

const PROMPT_COOLDOWN = 6;
const MAX_RACE_EVENTS = 3;
// Baseline "other" (fuel system, illness, debris, etc.) per-lap DNF probability.
const OTHER_PER_LAP = 0.00015;

type PromptCandidate = { prompt: RaceDecisionPrompt; priority: number };

// Advance one lap. `meta` carries track + names + player team.
export function stepLiveRace(state: LiveRaceState, meta: LiveRaceMeta): LiveRaceState {
  if (state.phase === 'finished') return state;
  if (state.pendingPrompt) return state; // resolve the prompt first

  const { track } = meta;
  const nextLap = state.currentLap + 1;
  const isFinalLap = nextLap >= state.totalLaps;
  const name = (id: string) => meta.driverNames[id] ?? id;

  const lapEvents: RaceEvent[] = [];
  const candidates: PromptCandidate[] = [];
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
      // Player owns pit timing: only pit when the player has called the car in,
      // or as a fallback once the advisory window has closed with a stop still
      // owed (so the planned stop is never silently skipped).
      if (c.pit.pitRequested) wantsPit = true;
      else if (
        c.pit.window &&
        nextLap >= c.pit.window.close &&
        c.pit.stopsMade < c.pit.plannedStops
      ) {
        wantsPit = true;
        lapEvents.push({ lap: nextLap, text: `${name(c.driverId)} boxes as the pit window closes.` });
      }
    }
    // Tyre-cliff forced stop (both player and AI) — safety net.
    if (!wantsPit && c.tire.wear > 92) wantsPit = true;

    // --- Execute pit stop ---
    let pitLoss = 0;
    if (wantsPit) {
      c.pit.scheduledLaps = c.pit.scheduledLaps.filter((l) => l > nextLap);
      c.pit.stopsMade += 1;
      c.pit.lastPitLap = nextLap;
      c.pit.inPitThisLap = true;
      c.pit.pitRequested = false;
      // Advance the advisory window to the player's next planned stop (if any).
      c.pit.window =
        c.isPlayer && c.pit.scheduledLaps.length > 0
          ? pitWindowFor(c.pit.scheduledLaps[0], state.totalLaps)
          : null;
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
        if (c.isPlayer) candidates.push({ prompt: reliabilityPrompt(c, nextLap, issue.label), priority: 3 });
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
        if (c.isPlayer) candidates.push({ prompt: damagePrompt(c, nextLap), priority: 2 });
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

  // --- Pit window opens prompt (player) ---
  for (const c of newCars) {
    if (
      c.isPlayer &&
      c.running &&
      !c.pit.inPitThisLap &&
      !c.pit.pitRequested &&
      c.pit.window &&
      nextLap === c.pit.window.open &&
      c.pit.stopsMade < c.pit.plannedStops
    ) {
      candidates.push({ prompt: pitWindowPrompt(c, nextLap), priority: 2 });
    }
  }

  // --- High tyre wear prompt (player) ---
  for (const c of newCars) {
    if (
      c.isPlayer &&
      c.running &&
      c.tire.compound === 'Dry' &&
      c.tire.wear >= 78 &&
      c.pit.stopsMade < c.pit.plannedStops
    ) {
      candidates.push({ prompt: tyreWearPrompt(c, nextLap), priority: 2 });
    }
  }

  // --- Weather change events / player rain prompt ---
  if (weatherChanged) {
    lapEvents.push({ lap: nextLap, text: `Weather update: ${weather.label}.` });
    if (weather.wet) {
      for (const c of newCars) {
        if (c.isPlayer && c.running && c.tire.compound === 'Dry') {
          candidates.push({ prompt: rainPrompt(c, nextLap, weather.condition === 'HeavyRain'), priority: 4 });
        }
      }
    }
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
    for (const c of newCars) {
      if (c.isPlayer && c.running && c.pit.stopsMade < c.pit.plannedStops) {
        candidates.push({ prompt: safetyCarPrompt(c, nextLap), priority: 5 });
      }
    }
  }
  if (scResult.justEnded) lapEvents.push({ lap: nextLap, text: 'Safety car in this lap — racing resumes.' });

  // --- Rival pits early prompt ---
  for (const player of newCars) {
    if (!player.isPlayer || !player.running || player.pit.inPitThisLap) continue;
    const rival = pittedThisLap.find(
      (r) => !r.isPlayer && Math.abs(r.totalTime - player.totalTime) < 6,
    );
    if (rival) {
      candidates.push({ prompt: rivalPitPrompt(player, nextLap, name(rival.driverId)), priority: 1 });
    }
  }

  // --- Teammate battle prompt ---
  const playerRunning = newCars.filter((c) => c.isPlayer && c.running);
  if (playerRunning.length === 2 && nextLap > state.totalLaps * 0.25 && nextLap < state.totalLaps * 0.9) {
    const [a, b] = playerRunning;
    if (Math.abs(a.totalTime - b.totalTime) < 1.5) {
      const lead = a.totalTime <= b.totalTime ? a : b;
      const chase = lead === a ? b : a;
      candidates.push({ prompt: teammateBattlePrompt(chase, nextLap, name(lead.driverId)), priority: 1 });
    }
  }

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

  // --- Choose a single pending prompt (highest priority, off cooldown) ---
  const cooldown = { ...state.promptCooldown };
  let pendingPrompt: RaceDecisionPrompt | null = null;
  if (!isFinalLap) {
    candidates.sort((p, q) => q.priority - p.priority);
    for (const cand of candidates) {
      const until = cooldown[cand.prompt.driverId] ?? 0;
      if (nextLap >= until) {
        pendingPrompt = cand.prompt;
        cooldown[cand.prompt.driverId] = nextLap + PROMPT_COOLDOWN;
        break;
      }
    }
  }

  // --- Data analytics recommendations for the player's drivers -------------
  const recEvents: RaceEvent[] = [];
  const { recommendations, ignoredRecs } = refreshRecommendations(
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
    pendingPrompt,
    promptCooldown: cooldown,
    firedEventIds,
    recommendations,
    ignoredRecs,
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

// Rebuild the player-driver recommendation list from the advanced state, prune
// stale ignore records, and log when an ignored reliability warning has since
// worsened into a High/Critical risk.
function refreshRecommendations(
  cars: LiveCarState[],
  partial: LiveRaceState,
  lap: number,
  name: (id: string) => string,
  events: RaceEvent[],
): { recommendations: LiveRaceState['recommendations']; ignoredRecs: LiveRaceState['ignoredRecs'] } {
  const recommendations = generateRecommendations(cars, partial, lap);

  const ignoredRecs = partial.ignoredRecs
    .filter((i) => lap - i.lap < REC_COOLDOWN * 3)
    .map((i) => {
      if (i.escalated) return i;
      const [driverId, kind] = i.key.split(':');
      if (kind !== 'reliability' && kind !== 'component') return i;
      const car = cars.find((c) => c.driverId === driverId && c.running);
      if (!car) return i;
      if (car.reliabilityRiskLevel === 'High' || car.reliabilityRiskLevel === 'Critical') {
        events.push({
          lap,
          text: `${name(driverId)} — earlier ignored warning worsens; reliability risk now ${car.reliabilityRiskLevel}.`,
        });
        return { ...i, escalated: true };
      }
      return i;
    });

  return { recommendations, ignoredRecs };
}

// ---------------------------------------------------------------------------
// Data analytics recommendation actions (Accept / Modify / Ignore)
// ---------------------------------------------------------------------------

// Apply a recommendation's concrete on-track effect (mode switch and/or pit
// call), remove it from the active list, and log the decision. Team-order
// actions carry no mode/pit effect here — the UI applies the on-track order via
// the relationship engine and still calls this to remove + log the decision.
function applyRecAction(
  state: LiveRaceState,
  rec: LiveRaceState['recommendations'][number],
  action: { paceMode?: PaceMode; pitNow?: boolean; label: string },
  meta: LiveRaceMeta,
  verb: 'accepted' | 'modified',
): LiveRaceState {
  let s = state;
  if (action.paceMode) s = setPlayerPaceMode(s, rec.driverId, action.paceMode);
  if (action.pitNow) s = requestPlayerPit(s, rec.driverId);
  const recommendations = s.recommendations.filter((r) => r.id !== rec.id);
  const name = meta.driverNames[rec.driverId] ?? rec.driverId;
  const events = [
    ...s.events,
    { lap: s.currentLap, text: `Lap ${s.currentLap} — pit wall ${verb} analytics recommendation: ${name} — ${action.label}.` },
  ];
  return { ...s, recommendations, events };
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

// Dismiss a recommendation without acting on it. Medium+ priority ignores are
// logged, and the kind is put on cooldown so it is not re-raised immediately (a
// worsened reliability warning is later surfaced by refreshRecommendations).
export function ignoreRecommendation(state: LiveRaceState, recId: string): LiveRaceState {
  const rec = state.recommendations.find((r) => r.id === recId);
  if (!rec) return state;
  const recommendations = state.recommendations.filter((r) => r.id !== recId);
  const ignoredRecs = [
    ...state.ignoredRecs.filter((i) => i.key !== rec.id),
    { key: rec.id, lap: state.currentLap, issue: rec.issue, escalated: false },
  ];
  const events =
    rec.priority === 'low'
      ? state.events
      : [
          ...state.events,
          { lap: state.currentLap, text: `Lap ${state.currentLap} — pit wall ignored analytics recommendation: ${rec.recommendedAction}` },
        ];
  return { ...state, recommendations, ignoredRecs, events };
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
  const recommendations = state.recommendations.filter((r) => r.id !== recId);
  const name = meta.driverNames[rec.driverId] ?? rec.driverId;
  const events = [
    ...state.events,
    { lap: state.currentLap, text: `Lap ${state.currentLap} — pit wall ${verb} analytics recommendation: ${name} — ${label}.` },
  ];
  return { ...state, recommendations, events };
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
