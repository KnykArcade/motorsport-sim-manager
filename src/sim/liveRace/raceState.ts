// Live-race state model.
//
// The live race is a deterministic state machine that animates a race over its
// laps and *converges to* the exact outcome produced by `computeRaceOutcome`
// (src/sim/raceEngine.ts). Phase 2 builds the headless machine; the Live Race
// screen (Phase 3) renders this state and later phases let player/AI decisions
// perturb the outcome.

import type { RaceFinishStatus, RaceResult } from '../../types/gameTypes';
import type { RaceEvent } from '../../types/simTypes';

export type LiveRacePhase = 'formation' | 'racing' | 'finished';

// Per-car running state at the current lap.
export type LiveCarState = {
  driverId: string;
  teamId: string;
  grid: number;
  // Current classification position (1-based) while running, or the final
  // classification position once finished. `null` for a retired car.
  position: number | null;
  gapToLeader: number; // seconds behind the leader (0 for the leader)
  interval: number; // seconds to the car ahead in the current order
  lapsCompleted: number;
  running: boolean;
  status: RaceFinishStatus; // 'Finished' while running and at the flag; 'DNF' once retired
  lastIncident?: string;
};

export type LiveRaceState = {
  trackId: string;
  totalLaps: number;
  currentLap: number; // 0 = formation/pre-start
  phase: LiveRacePhase;
  // Cars ordered by current running order (leader first); retired cars trail,
  // most-recently-retired first.
  cars: LiveCarState[];
  // Events revealed up to and including `currentLap`.
  events: RaceEvent[];
  // The deterministic outcome this race converges to. Held so the machine can
  // be stepped to the flag without re-running the RNG, and so a save can resume.
  finalResults: RaceResult[];
};
