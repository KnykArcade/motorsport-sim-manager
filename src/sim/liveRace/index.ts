// Public API for the headless live-race state machine (Phase 2).
export type { LiveCarState, LiveRacePhase, LiveRaceState } from './raceState';
export {
  createLiveRace,
  stepLiveRace,
  stepLiveRaceToEnd,
  runLiveRaceToEnd,
} from './raceLoop';
