// Strategy-mode stint tracking.
//
// Each player car shows how many *consecutive* laps it has spent in its current
// strategy mode (Conserve / Balanced / Push / Attack / Defend / Protect). The
// counter resets to 1 whenever the mode changes — from any source (manual button,
// accepted/modified analytics recommendation, an active instruction completing
// and returning to Balanced, a pit/weather/safety-car strategy change, or AI) —
// and is never a race-long total.
//
// The counter is advanced once per completed lap by `advanceStint` (called from
// the tick engine), so it does not move while the race is paused / a decision
// timer is running, and it freezes when a car retires (that path simply stops
// calling advance for non-running cars).

import type { PaceMode, StrategyModeSource, StrategyStintState } from '../types/liveTypes';

// The stint a car is in at the very start of the race (its formation-lap mode).
export function initialStint(mode: PaceMode, lap = 0): StrategyStintState {
  return {
    mode,
    previousMode: null,
    startedLap: lap,
    consecutiveLaps: 1,
    source: 'initial',
    lastChangedLap: lap,
    warned: false,
  };
}

// Begin a new stint because the mode changed. Always starts the counter at 1.
export function startStint(
  mode: PaceMode,
  previousMode: PaceMode | null,
  lap: number,
  source: StrategyModeSource,
): StrategyStintState {
  return {
    mode,
    previousMode,
    startedLap: lap,
    consecutiveLaps: 1,
    source,
    lastChangedLap: lap,
    warned: false,
  };
}

// Reconcile a car's stint for a completed lap given its (possibly just-changed)
// current mode. If the mode differs from the stint's mode the mode changed this
// lap through some path that did not itself reset the stint (instruction
// completion, weather/safety-car effects, AI) — start a fresh stint. Otherwise
// the car stayed in the same mode, so increment the consecutive-lap count.
export function advanceStint(
  stint: StrategyStintState,
  currentMode: PaceMode,
  lap: number,
  fallbackSource: StrategyModeSource = 'auto',
): StrategyStintState {
  if (currentMode !== stint.mode) {
    return startStint(currentMode, stint.mode, lap, fallbackSource);
  }
  return { ...stint, consecutiveLaps: stint.consecutiveLaps + 1 };
}

// Lap thresholds at which staying in a mode is worth a single analytics note.
const LONG_STINT_THRESHOLD: Partial<Record<PaceMode, number>> = {
  Attack: 5,
  Push: 6,
  Defend: 8,
  ProtectEngine: 8,
  Conservative: 12,
};

// An occasional long-stint note for the event log (returns null when there is
// nothing worth saying). Fired at most once per stint by the caller (which
// tracks the `warned` flag), so the log is never spammed lap after lap.
export function longStintNote(mode: PaceMode, laps: number, name: string): string | null {
  const threshold = LONG_STINT_THRESHOLD[mode];
  if (threshold == null || laps < threshold) return null;
  switch (mode) {
    case 'Attack':
      return `${name} has been attacking for ${laps} laps — tyre wear and crash risk rising.`;
    case 'Push':
      return `${name} has been pushing for ${laps} laps — engine and tyre stress rising.`;
    case 'Defend':
      return `${name} has been defending for ${laps} laps — tyres suffering in dirty air.`;
    case 'ProtectEngine':
      return `${name} has run Protect Engine for ${laps} laps — temperatures stable but losing track position.`;
    case 'Conservative':
      return `${name} has been conserving for ${laps} laps — protecting the car but lap-time loss increasing.`;
    default:
      return null;
  }
}
