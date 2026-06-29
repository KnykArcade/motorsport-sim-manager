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
  //    they still have a scheduled stop to make.
  if (state.safetyCar.active && car.pit.stopsMade < car.pit.plannedStops && car.tire.age >= 5) {
    const grabChance =
      car.personality === 'Opportunistic' || car.personality === 'UndercutFocused'
        ? 0.85
        : car.personality === 'TrackPositionFocused' || car.personality === 'OvercutFocused'
          ? 0.25
          : 0.55;
    if (rng.chance(grabChance)) {
      action.pitNow = true;
      action.switchCompound = state.weather.wet ? 'Wet' : 'Dry';
      action.note = 'takes the safety-car pit stop';
      return action;
    }
  }

  // 3. Scheduled stop (with personality-driven undercut/overcut bias).
  const lowOvertaking = track.attributes.overtakingRacecraft <= 4;
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
      action.pitNow = true;
      action.switchCompound = state.weather.wet ? 'Wet' : 'Dry';
      action.note = 'makes a scheduled stop';
      return action;
    }
  }

  // 4. Pace mode: manage reliability and tyres, or push to recover positions.
  if (car.reliabilityIssue && !car.reliabilityIssue.managed) {
    const nurse = car.personality === 'ReliabilityProtective' || car.personality === 'RiskAverse' || car.personality === 'Conservative';
    action.paceMode = nurse ? 'Nurse' : car.reliabilityIssue.severity === 'Severe' ? 'Conserve' : 'Balanced';
    return action;
  }

  if (car.tire.wear > 70) {
    action.paceMode = 'Conserve';
  } else if (push > 0.4 && car.position != null && car.position > car.grid) {
    action.paceMode = 'Push'; // recovering lost ground
  } else if (push < -0.4) {
    action.paceMode = 'Conserve';
  } else {
    action.paceMode = 'Balanced';
  }

  // Late-race push from aggressive personalities running in the points.
  if (lap > state.totalLaps * 0.8 && push > 0.4 && car.tire.wear < 60) {
    action.paceMode = 'Push';
  }

  return action;
}
