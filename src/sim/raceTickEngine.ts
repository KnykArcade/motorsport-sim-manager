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
import { createSeededRandom, deriveSeed, type Rng } from './random';
import { REF_LAP, type LiveRaceMeta } from './liveRaceEngine';
import { stepWeather } from './weatherEngine';
import {
  stepSafetyCar,
  SAFETY_CAR_LAP_PENALTY,
  SAFETY_CAR_PIT_SAVING,
} from './safetyCarEngine';
import { aiLapDecision } from './aiStrategyEngine';
import { generateRaceEventPool, resolveRaceEventTrigger } from './raceEventEngine';
import { rollReliabilityIssue } from './reliabilityEngine';
import {
  damagePrompt,
  findOption,
  rainPrompt,
  reliabilityPrompt,
  rivalPitPrompt,
  safetyCarPrompt,
  teammateBattlePrompt,
  tyreWearPrompt,
  applyDecisionEffects,
} from './raceDecisionEngine';

const PACE_K = 0.45;
const PROMPT_COOLDOWN = 6;
const MAX_RACE_EVENTS = 3;

function paceTimeAdj(mode: PaceMode): number {
  switch (mode) {
    case 'Push':
      return -0.3;
    case 'Conserve':
      return 0.4;
    case 'Nurse':
      return 1.1;
    default:
      return 0;
  }
}
function paceWearMult(mode: PaceMode): number {
  switch (mode) {
    case 'Push':
      return 1.35;
    case 'Conserve':
      return 0.7;
    case 'Nurse':
      return 0.5;
    default:
      return 1;
  }
}
function paceRiskMult(mode: PaceMode): number {
  switch (mode) {
    case 'Push':
      return 1.6;
    case 'Conserve':
      return 0.7;
    case 'Nurse':
      return 0.45;
    default:
      return 1;
  }
}

function failureCause(rng: Rng, issueLabel?: string): string {
  if (issueLabel) return `${issueLabel} — retired`;
  return rng.pick(['Engine failure', 'Gearbox failure', 'Hydraulics failure', 'Electrical failure', 'Suspension failure']);
}

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
    }
    // Scheduled stop (player + AI fallback) and tyre-cliff forced stop.
    if (!wantsPit && c.pit.scheduledLaps.length > 0 && nextLap >= c.pit.scheduledLaps[0]) wantsPit = true;
    if (!wantsPit && c.tire.wear > 92) wantsPit = true;

    // --- Execute pit stop ---
    let pitLoss = 0;
    if (wantsPit) {
      c.pit.scheduledLaps = c.pit.scheduledLaps.filter((l) => l > nextLap);
      c.pit.stopsMade += 1;
      c.pit.lastPitLap = nextLap;
      c.pit.inPitThisLap = true;
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

    // --- Lap time ---
    let lapTime = REF_LAP - c.paceRating * PACE_K;
    lapTime += c.tire.wear * 0.04;
    lapTime += paceTimeAdj(c.paceMode);
    if (weather.wet && c.tire.compound === 'Dry') {
      lapTime += weather.condition === 'HeavyRain' ? 12 : 6;
    } else if (!weather.wet && c.tire.compound === 'Wet') {
      lapTime += weather.condition === 'Drying' ? 1.5 : 4;
    }
    lapTime += rng.variance(0.3);
    if (state.safetyCar.active) lapTime = REF_LAP + SAFETY_CAR_LAP_PENALTY; // neutralised
    lapTime += pitLoss;

    // --- Tyre wear ---
    if (!wantsPit) {
      const wearAdd = c.tireDegRate * paceWearMult(c.paceMode) * (weather.wet ? 0.6 : 1);
      c.tire = { ...c.tire, age: c.tire.age + 1, wear: clamp(c.tire.wear + wearAdd, 0, 100) };
    }

    const pushing = c.paceMode === 'Push';

    // --- Reliability issue onset (warning) ---
    if (!c.reliabilityIssue) {
      const issue = rollReliabilityIssue(rng, c.baseFailureRisk, nextLap, pushing);
      if (issue) {
        c.reliabilityIssue = issue;
        lapEvents.push({ lap: nextLap, text: `${name(c.driverId)} reports ${issue.label.toLowerCase()}.` });
        if (c.isPlayer) candidates.push({ prompt: reliabilityPrompt(c, nextLap, issue.label), priority: 3 });
      }
    }

    // --- Failure (DNF) ---
    let failRisk = c.reliabilityRisk * paceRiskMult(c.paceMode);
    if (c.reliabilityIssue && !c.reliabilityIssue.managed) failRisk += c.reliabilityIssue.failureRisk;
    if (rng.chance(failRisk)) {
      const cause = failureCause(rng, c.reliabilityIssue?.label);
      c = retire(c, nextLap, cause);
      lapEvents.push({ lap: nextLap, text: `${name(c.driverId)} retires — ${cause.toLowerCase()}.` });
      incidentThisLap = true;
      incidentSeverity = Math.max(incidentSeverity, 0.5);
      return c;
    }

    // --- Mistake / crash ---
    const mistakeRisk = c.baseMistakeRisk * paceRiskMult(c.paceMode);
    if (rng.chance(mistakeRisk)) {
      if (rng.chance(0.28)) {
        c = retire(c, nextLap, 'Crashed out');
        lapEvents.push({ lap: nextLap, text: `${name(c.driverId)} crashes out.` });
        incidentThisLap = true;
        incidentSeverity = Math.max(incidentSeverity, 0.65);
        return c;
      }
      lapTime += rng.range(0.5, 2.5);
      if (!c.damaged && rng.chance(0.25)) {
        c.damaged = true;
        lapEvents.push({ lap: nextLap, text: `${name(c.driverId)} picks up front-wing damage.` });
        if (c.isPlayer) candidates.push({ prompt: damagePrompt(c, nextLap), priority: 2 });
      }
    }

    c.lastLapTime = round1(lapTime);
    c.totalTime += lapTime;
    c.lapsCompleted = nextLap;
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

  return {
    ...state,
    currentLap: nextLap,
    phase,
    weather,
    safetyCar: scResult.safetyCar,
    cars: orderedCars,
    events: [...state.events, ...lapEvents],
    pendingPrompt,
    promptCooldown: cooldown,
    firedEventIds,
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

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
