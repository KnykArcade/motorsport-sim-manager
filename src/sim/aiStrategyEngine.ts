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
  PitIntensity,
  TireCompound,
} from '../types/liveTypes';
import { createSeededRandom, deriveSeed } from './random';
import {
  shouldOfferSafetyCarPit,
  driverDisagreementBias,
} from './safetyCarStrategy';
import { collectDamageComponents, repairModeForComponents, DEFAULT_DAMAGE_SETTINGS } from './damageComponents';

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
  const aggression = driver.ratings.aggression; // 1-100
  const risk = driver.ratings.riskManagement; // 1-100 (high = cautious)

  // Bias the draw by character, then fall back to a seeded pick.
  if (aggression >= 80 && rng.chance(0.6)) return 'Aggressive';
  if (risk >= 80 && rng.chance(0.5)) return 'RiskAverse';
  if (team.reputation >= 75 && rng.chance(0.4)) return 'TrackPositionFocused';
  if (aggression >= 70 && rng.chance(0.4)) return 'UndercutFocused';
  return rng.pick(PERSONALITIES);
}

export type AIAction = {
  pitNow: boolean;
  paceMode: PaceMode;
  switchCompound: TireCompound | null;
  note: string | null;
  pitIntensity?: PitIntensity;
  pitExitMode?: PaceMode;
  repairMode?: 'None' | 'Critical' | 'Full';
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

function stableRiskAppetite(seed: string, teamId: string): number {
  return createSeededRandom(deriveSeed(seed, 'ai-pit-risk-appetite', teamId)).next();
}

function choosePitIntensity(car: LiveCarState, state: LiveRaceState, track: Track, lap: number): PitIntensity {
  const appetite = stableRiskAppetite(state.seed, car.teamId);
  const strongCrew = (car.pitCrewOperations ?? 55) >= 78;
  const strongDriver = (car.driverComposure ?? 55) >= 72 && (car.driverRiskManagement ?? 55) >= 72;
  const crewBias = strongCrew ? 0.18 : (car.pitCrewOperations ?? 55) < 48 ? -0.12 : 0;
  const driverBias = strongDriver ? 0.12 : (car.driverComposure ?? 55) < 45 || (car.driverRiskManagement ?? 55) < 45 ? -0.1 : 0;
  const appetiteBias = appetite - 0.5;
  let score = crewBias + driverBias + appetiteBias * 0.55;

  if (state.safetyCar.active) score += 0.22;
  if (car.tire.wear >= 82) score += 0.12;
  if (car.tire.wear <= 55) score -= 0.05;
  if (car.position != null && car.position <= 5) score += 0.08;
  if (car.position != null && car.position > 10) score -= 0.05;
  if ((car.interval < 1.2 || (state.cars.find((o) => o.running && o.position === (car.position ?? 0) + 1)?.interval ?? 99) < 1.2)) {
    score += 0.12;
  }
  if (lap >= state.totalLaps * 0.7) score += 0.08;
  if (track.attributes.overtakingRacecraft < 45) score += 0.05;

  if (score >= 0.78) return 'AllOut';
  if (score >= 0.35) return 'Aggressive';
  if (score <= -0.18) return 'Conservative';
  return 'Standard';
}

function chooseRepairMode(car: LiveCarState, state: LiveRaceState): 'None' | 'Critical' | 'Full' {
  return repairModeForComponents(collectDamageComponents(car, state.series, undefined, state.damageSettings ?? DEFAULT_DAMAGE_SETTINGS));
}

function applyDriverDisagreement(
  car: LiveCarState,
  state: LiveRaceState,
  rng: ReturnType<typeof createSeededRandom>,
  mode: PaceMode,
): { mode: PaceMode; note: string | null } {
  const rel = state.driverRelationships?.[car.driverId];
  if (!rel) return { mode, note: null };
  const bias = driverDisagreementBias(rel);
  if (bias < 0.22 || !rng.chance(Math.min(0.55, bias))) return { mode, note: null };

  const hotter: Record<PaceMode, PaceMode> = {
    Conservative: 'Balanced',
    Balanced: 'Push',
    Push: 'Attack',
    Attack: 'Attack',
    Defend: 'Balanced',
    ProtectEngine: 'Conservative',
  };
  const calmer: Record<PaceMode, PaceMode> = {
    Conservative: 'Conservative',
    Balanced: 'Conservative',
    Push: 'Balanced',
    Attack: 'Push',
    Defend: 'Balanced',
    ProtectEngine: 'Conservative',
  };
  const hotBias = (rel.ego ?? 0) >= 65 || (rel.trustInTeam ?? 100) < 50;
  const nextMode = hotBias ? hotter[mode] : calmer[mode];
  if (nextMode === mode) return { mode, note: null };
  return { mode: nextMode, note: 'driver disagrees with pit wall and adjusts the restart plan' };
}

function finalizeModeDecision(
  car: LiveCarState,
  state: LiveRaceState,
  rng: ReturnType<typeof createSeededRandom>,
  action: AIAction,
): AIAction {
  if (!action.paceMode || action.pitNow) return action;
  const decision = applyDriverDisagreement(car, state, rng, action.paceMode);
  if (decision.mode === action.paceMode) return action;
  return { ...action, paceMode: decision.mode, note: decision.note };
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
      action.pitIntensity = choosePitIntensity(car, state, track, lap);
      action.pitExitMode = 'Conservative';
      action.repairMode = chooseRepairMode(car, state);
      return action;
    }
  }
  if (!state.weather.wet && onWets && state.weather.condition !== 'Drying') {
    action.pitNow = true;
    action.switchCompound = 'Dry';
    action.note = 'pits for slicks';
    action.pitIntensity = choosePitIntensity(car, state, track, lap);
    action.pitExitMode = 'Conservative';
    action.repairMode = chooseRepairMode(car, state);
    return action;
  }

  // 2. Safety car: opportunistic / undercut personalities grab the cheap stop if
  //    they still have a scheduled stop to make. Sharper race operations react
  //    to the safety car more reliably; weaker operations miss the window more.
  if (state.safetyCar.active && car.pit.stopsMade < car.pit.plannedStops && car.tire.age >= 5 && shouldOfferSafetyCarPit(car, lap)) {
    const baseGrab =
      car.personality === 'Opportunistic' || car.personality === 'UndercutFocused'
        ? 0.85
        : car.personality === 'TrackPositionFocused' || car.personality === 'OvercutFocused'
          ? 0.25
          : 0.55;
    const grabChance = Math.max(0.1, Math.min(0.97, baseGrab + car.opsForm * 0.4));
    if (rng.chance(grabChance)) {
      action.pitNow = true;
      action.switchCompound = state.weather.wet ? 'Wet' : 'Dry';
      action.note = 'takes the safety-car pit stop';
      action.pitIntensity = choosePitIntensity(car, state, track, lap);
      action.pitExitMode = car.paceMode;
      action.repairMode = chooseRepairMode(car, state);
      return action;
    }
  }

  // 3. Scheduled stop (with personality-driven undercut/overcut bias).
  const lowOvertaking = track.attributes.overtakingRacecraft <= 40;
  const nextStop = car.pit.scheduledLaps[0];
  if (nextStop != null) {
    let target = nextStop;
    if (car.personality === 'UndercutFocused') target -= 2;
    if (car.personality === 'OvercutFocused') target += 2;
    // At low-overtaking tracks, track-position-minded cars stay out longer to
    // avoid losing places they can't win back on track.
    if (lowOvertaking && (car.personality === 'TrackPositionFocused' || car.personality === 'OvercutFocused')) {
      target += 1;
    }
    // Worn tyres force the stop regardless.
    if (lap >= target || car.tire.wear > 82) {
      // Double-stack avoidance: if a teammate just ahead is also pitting this
      // lap, the trailing car holds one more lap to avoid queuing behind its
      // own crew — unless its tyres are already at the cliff, where the stop
      // can't wait. Only the car behind defers, so the pair doesn't deadlock.
      const mate = teammateAhead(car, state);
      if (
        car.tire.wear <= 80 &&
        mate &&
        mate.gap < 4 &&
        likelyToPit(mate.mate, lap) &&
        !state.safetyCar.active
      ) {
        action.paceMode = 'Push';
        action.note = 'stays out a lap to avoid double-stacking';
        return action;
      }
      action.pitNow = true;
      action.switchCompound = state.weather.wet ? 'Wet' : 'Dry';
      action.note = 'makes a scheduled stop';
      action.pitIntensity = choosePitIntensity(car, state, track, lap);
      action.pitExitMode = car.paceMode;
      action.repairMode = chooseRepairMode(car, state);
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
    return finalizeModeDecision(car, state, rng, action);
  }

  // Proactive reliability: even without a flagged issue, a car with badly worn
  // components nurses them home to reach the flag rather than risk a DNF.
  const worstComponent = Math.min(car.engineHealth, car.gearboxHealth, car.brakeHealth);
  if (worstComponent < 22) {
    action.paceMode = worstComponent < 12 ? 'ProtectEngine' : 'Conservative';
    return finalizeModeDecision(car, state, rng, action);
  }

  // Damage: a damaged car backs off to protect itself and avoid a bigger
  // failure, rather than pushing on into more trouble.
  if (car.damaged) {
    action.paceMode = 'Conservative';
    return finalizeModeDecision(car, state, rng, action);
  }

  // Worn tyres → conserve (a pit will follow from the stop logic above).
  if (car.tire.wear > 70) {
    action.paceMode = 'Conservative';
    return finalizeModeDecision(car, state, rng, action);
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
      return finalizeModeDecision(car, state, rng, action);
    }
  }

  // Stuck behind a car within striking range → Attack (aggressive personalities).
  if (intervalAhead < 1.2 && push > 0.2 && car.tire.wear < 65) {
    action.paceMode = 'Attack';
    return finalizeModeDecision(car, state, rng, action);
  }
  // Defending a points position late under pressure from behind → Defend.
  if (late && inPoints && intervalBehind < 1.2) {
    action.paceMode = 'Defend';
    return finalizeModeDecision(car, state, rng, action);
  }
  // Leading comfortably late → back off and bring it home.
  if (late && car.position === 1 && intervalBehind > 6) {
    action.paceMode = push > 0.4 ? 'Balanced' : 'Conservative';
    return finalizeModeDecision(car, state, rng, action);
  }
  // Chasing (lost ground, or late in the points) → Push.
  if (push > 0.4 && car.position != null && car.position > car.grid) {
    action.paceMode = 'Push';
    return finalizeModeDecision(car, state, rng, action);
  }
  if (late && push > 0.4 && car.tire.wear < 60) {
    action.paceMode = 'Push';
    return finalizeModeDecision(car, state, rng, action);
  }
  // Cautious personalities cruise conservatively.
  if (push < -0.4) {
    action.paceMode = 'Conservative';
    return finalizeModeDecision(car, state, rng, action);
  }

  action.paceMode = 'Balanced';
  return finalizeModeDecision(car, state, rng, action);
}
