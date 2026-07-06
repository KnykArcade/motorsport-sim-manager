// AI strategy engine for the live race.
//
// Every non-player car is driven by an AI personality that makes its own
// per-lap calls: when to pit (including reactive safety-car and undercut
// stops), how hard to push, and how to respond to weather and reliability
// warnings. Personalities are assigned deterministically from team/driver
// character so the grid feels varied but replays identically.

import type { Driver, Track } from '../types/gameTypes';
import type {
  AIStrategyPersonality,
  LiveCarState,
  LiveRaceState,
  PaceMode,
  TireCompound,
} from '../types/liveTypes';
import { createSeededRandom, deriveSeed } from './random';

const PERSONALITIES: AIStrategyPersonality[] = [
  'Conservative',
  'Balanced',
  'Aggressive',
  'Opportunistic',
  'RiskAverse',
  'UndercutFocused',
  'OvercutFocused',
  'ReliabilityProtective',
  'TrackPositionFocused',
];

// Pick a personality from team/driver character so it is stable per save.
export function assignPersonality(
  team: { id: string; reputation: number },
  driver: Driver,
  seed: string,
): AIStrategyPersonality {
  const rng = createSeededRandom(deriveSeed(seed, 'ai-personality', team.id, driver.id));
  const aggression = driver.ratings.aggression; // 1-10
  const risk = driver.ratings.riskManagement; // 1-10 (high = cautious)

  // Bias the draw by character, then fall back to a seeded pick.
  if (aggression >= 8 && rng.chance(0.6)) return 'Aggressive';
  if (risk >= 8 && rng.chance(0.5)) return 'RiskAverse';
  if (team.reputation >= 75 && rng.chance(0.4)) return 'TrackPositionFocused';
  if (aggression >= 7 && rng.chance(0.4)) return 'UndercutFocused';
  return rng.pick(PERSONALITIES);
}

export type AIAction = {
  pitNow: boolean;
  paceMode: PaceMode;
  switchCompound: TireCompound | null;
  note: string | null;
};

function pushiness(personality: AIStrategyPersonality): number {
  switch (personality) {
    case 'Aggressive':
      return 1;
    case 'Opportunistic':
    case 'UndercutFocused':
      return 0.6;
    case 'Balanced':
    case 'OvercutFocused':
    case 'TrackPositionFocused':
      return 0;
    case 'Conservative':
    case 'RiskAverse':
    case 'ReliabilityProtective':
      return -0.7;
    default:
      return 0;
  }
}

// The nearest teammate running ahead of this car, with the approximate gap (s)
// between them. Used for double-stack avoidance and team-order awareness.
function teammateAhead(
  car: LiveCarState,
  state: LiveRaceState,
): { mate: LiveCarState; gap: number } | null {
  if (car.position == null) return null;
  let best: { mate: LiveCarState; gap: number } | null = null;
  for (const o of state.cars) {
    if (o.driverId === car.driverId || o.teamId !== car.teamId || !o.running) continue;
    if (o.position == null || o.position >= car.position) continue;
    const gap = Math.abs(car.gapToLeader - o.gapToLeader);
    if (!best || gap < best.gap) best = { mate: o, gap };
  }
  return best;
}

// Whether a car looks committed to pitting on this lap (worn tyres or its next
// scheduled stop has come due) — used to predict a teammate's stop so the car
// behind can avoid stacking in the pit lane.
function likelyToPit(mate: LiveCarState, lap: number): boolean {
  if (mate.tire.wear > 78) return true;
  const next = mate.pit.scheduledLaps[0];
  return next != null && mate.pit.stopsMade < mate.pit.plannedStops && lap >= next - 1;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function stopUrgency(car: LiveCarState, lap: number): number {
  const target = car.pit.strategyTargetLap ?? car.pit.scheduledLaps[0];
  const lapsToTarget = target == null ? 4 : target - lap;
  const targetNeed = clamp01((4 - lapsToTarget) / 4);
  const wearNeed = clamp01((car.tire.wear - 58) / 24);
  const cliffNeed = car.tire.wear > 82 ? 1 : 0;
  const dueNeed = target != null && lap >= target - 1 ? 0.18 : 0;
  return Math.max(wearNeed, targetNeed) + cliffNeed + dueNeed;
}

// Decide an AI car's action for the upcoming lap. Pure given (car, state, lap).
export function aiLapDecision(
  car: LiveCarState,
  state: LiveRaceState,
  track: Track,
  lap: number,
): AIAction {
  const rng = createSeededRandom(deriveSeed(state.seed, 'ai-lap', car.driverId, lap));
  const action: AIAction = { pitNow: false, paceMode: car.paceMode, switchCompound: null, note: null };
  const push = pushiness(car.personality);

  // 1. Weather: get onto the right tyres. Wet track + dry tyres = pit for wets.
  const onWets = car.tire.compound === 'Wet';
  if (state.weather.wet && !onWets) {
    // Reactive personalities switch immediately; others may gamble briefly.
    const switchChance = car.personality === 'RiskAverse' || car.personality === 'ReliabilityProtective' ? 0.95 : 0.7;
    if (rng.chance(switchChance)) {
      action.pitNow = true;
      action.switchCompound = 'Wet';
      action.note = 'pits for wet tyres';
      return action;
    }
  }
  if (!state.weather.wet && onWets && state.weather.condition !== 'Drying') {
    action.pitNow = true;
    action.switchCompound = 'Dry';
    action.note = 'pits for slicks';
    return action;
  }

  // 2. Safety car: opportunistic / undercut personalities grab the cheap stop if
  //    they still have a scheduled stop to make. Sharper race operations react
  //    to the safety car more reliably; weaker operations miss the window more.
  if (state.safetyCar.active && car.pit.stopsMade < car.pit.plannedStops && car.tire.age >= 5) {
    const teammate = state.cars.find(
      (o) => o.running && o.teamId === car.teamId && o.driverId !== car.driverId,
    );
    const need = stopUrgency(car, lap);
    const teammateNeed = teammate ? stopUrgency(teammate, lap) : null;
    if (teammate && teammateNeed != null) {
      const teammateAhead =
        teammate.position != null &&
        car.position != null &&
        teammate.position < car.position;
      const teammateTakesIt =
        teammateNeed > need + 0.02 ||
        (Math.abs(teammateNeed - need) <= 0.02 && teammateAhead);
      if (teammateTakesIt && car.tire.wear < 83) {
        action.note = 'defers a lap to avoid stacking under the safety car';
        return action;
      }
    }
    const stagger = rng.range(-0.18, 0.18);
    const grabThreshold = car.tire.wear > 82 ? 0.35 : 0.72;
    if (need + stagger >= grabThreshold) {
      action.pitNow = true;
      action.switchCompound = state.weather.wet ? 'Wet' : 'Dry';
      action.note = 'takes the safety-car pit stop';
      return action;
    }
  }

  // 3. Scheduled stop (with personality-driven undercut/overcut bias).
  const lowOvertaking = track.attributes.overtakingRacecraft <= 4;
  const nextStop = car.pit.strategyTargetLap ?? car.pit.scheduledLaps[0];
  if (nextStop != null) {
    let target = nextStop;
    if (car.personality === 'UndercutFocused') target -= 2;
    if (car.personality === 'OvercutFocused') target += 2;
    // At low-overtaking tracks, track-position-minded cars stay out longer to
    // avoid losing places they can't win back on track.
    if (lowOvertaking && (car.personality === 'TrackPositionFocused' || car.personality === 'OvercutFocused')) {
      target += 1;
    }
    const rivalAheadPit =
      car.position != null &&
      car.position > 1 &&
      car.interval <= Math.max(4.5, car.pitLossBase * 0.25) &&
      (() => {
        const ahead = state.cars.find((o) => o.running && o.position === (car.position ?? 0) - 1);
        return !!ahead && ahead.teamId !== car.teamId && (ahead.pit.inPitThisLap || ahead.pit.lastPitLap === lap - 1);
      })();
    // Worn tyres force the stop regardless.
    const comfortableTyres = car.tire.wear < 72;
    const mate = teammateAhead(car, state);
    const matePitting =
      mate &&
      mate.gap < 4 &&
      likelyToPit(mate.mate, lap) &&
      !state.safetyCar.active;
    if (matePitting && car.tire.wear <= 80) {
      action.paceMode = 'Push';
      action.note = 'stays out a lap to avoid double-stacking';
      return action;
    }
    if (rivalAheadPit && lap >= target - 3 && car.tire.wear >= 28 && car.tire.wear <= 80) {
      if (car.personality === 'OvercutFocused' || car.personality === 'TrackPositionFocused') {
        action.paceMode = 'Push';
        action.note = 'extends the stint to try the overcut';
        return action;
      }
      if (
        car.personality === 'UndercutFocused' ||
        car.personality === 'Opportunistic' ||
        (car.personality === 'Aggressive' && car.tire.wear >= 45)
      ) {
        action.pitNow = true;
        action.switchCompound = state.weather.wet ? 'Wet' : 'Dry';
        action.note = 'covers with an undercut';
        return action;
      }
    }
    const canStretch = comfortableTyres && lap >= target && lap < target + 2;
    if (canStretch) {
      action.note = 'extends the stint on comfortable tyres';
      action.paceMode = car.personality === 'OvercutFocused' ? 'Push' : action.paceMode;
      return action;
    }
    if (lap >= target || car.tire.wear > 82) {
      action.pitNow = true;
      action.switchCompound = state.weather.wet ? 'Wet' : 'Dry';
      action.note = 'makes a scheduled stop';
      return action;
    }
  }

  // 4. Strategy mode: pick by situation, mirroring the player's options.
  //    Priority: protect the car > manage tyres > fight for position > cruise.

  // Reliability warning → Protect Engine (or Conservative for milder cases).
  if (car.reliabilityIssue && !car.reliabilityIssue.managed) {
    const protect =
      car.personality === 'ReliabilityProtective' ||
      car.personality === 'RiskAverse' ||
      car.personality === 'Conservative' ||
      car.reliabilityIssue.severity === 'Severe';
    action.paceMode = protect ? 'ProtectEngine' : 'Conservative';
    return action;
  }

  // Proactive reliability: even without a flagged issue, a car with badly worn
  // components nurses them home to reach the flag rather than risk a DNF.
  const worstComponent = Math.min(car.engineHealth, car.gearboxHealth, car.brakeHealth);
  if (worstComponent < 22) {
    action.paceMode = worstComponent < 12 ? 'ProtectEngine' : 'Conservative';
    return action;
  }

  // Damage: a damaged car backs off to protect itself and avoid a bigger
  // failure, rather than pushing on into more trouble.
  if (car.damaged) {
    action.paceMode = 'Conservative';
    return action;
  }

  // Worn tyres → conserve (a pit will follow from the stop logic above).
  if (car.tire.wear > 70) {
    action.paceMode = 'Conservative';
    return action;
  }

  // Position fights: gaps to the cars immediately ahead and behind.
  const intervalAhead = car.position != null && car.position > 1 ? car.interval : Infinity;
  const behind = state.cars.find((o) => o.running && o.position === (car.position ?? 0) + 1);
  const intervalBehind = behind ? behind.interval : Infinity;
  const late = lap > state.totalLaps * 0.65;
  const inPoints = car.position != null && car.position <= 10;

  // Team orders: don't launch a risky attack on your own teammate — hold
  // station behind them (especially late, when both are scoring) to avoid a
  // costly double-DNF. A clearly faster car (much fresher tyres) is still let
  // race. The car directly ahead is a teammate when the interval matches.
  const carAhead = car.position != null && car.position > 1
    ? state.cars.find((o) => o.running && o.position === (car.position ?? 0) - 1)
    : undefined;
  const teammateJustAhead =
    carAhead != null && carAhead.teamId === car.teamId && intervalAhead < 1.2;
  if (teammateJustAhead && inPoints) {
    const clearlyFaster = car.tire.age + 6 < carAhead.tire.age && push > 0.4;
    if (!clearlyFaster) {
      action.paceMode = 'Balanced';
      return action;
    }
  }

  // Stuck behind a car within striking range → Attack (aggressive personalities).
  if (intervalAhead < 1.2 && push > 0.2 && car.tire.wear < 65) {
    action.paceMode = 'Attack';
    return action;
  }
  // Defending a points position late under pressure from behind → Defend.
  if (late && inPoints && intervalBehind < 1.2) {
    action.paceMode = 'Defend';
    return action;
  }
  // Leading comfortably late → back off and bring it home.
  if (late && car.position === 1 && intervalBehind > 6) {
    action.paceMode = push > 0.4 ? 'Balanced' : 'Conservative';
    return action;
  }
  // Chasing (lost ground, or late in the points) → Push.
  if (push > 0.4 && car.position != null && car.position > car.grid) {
    action.paceMode = 'Push';
    return action;
  }
  if (late && push > 0.4 && car.tire.wear < 60) {
    action.paceMode = 'Push';
    return action;
  }
  // Cautious personalities cruise conservatively.
  if (push < -0.4) {
    action.paceMode = 'Conservative';
    return action;
  }

  action.paceMode = 'Balanced';
  return action;
}
