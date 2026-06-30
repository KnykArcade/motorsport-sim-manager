// Pit strategy engine for the live race.
//
// Translates a chosen race strategy into a concrete pit schedule (which laps a
// car plans to stop) and a target stint length, and prices an individual stop.
// Reactive decisions (undercut/cover, safety-car stops) mutate the schedule.

import type { Car, RaceStrategy } from '../types/gameTypes';
import type { PitWindow } from '../types/liveTypes';
import { effectiveCarRatings } from './trackFitEngine';

// Laps either side of the strategist's ideal stop lap that make up the window.
const WINDOW_BEFORE = 3;
const WINDOW_AFTER = 4;

// The advisory pit window around a planned stop lap, clamped to the race length.
export function pitWindowFor(idealLap: number, totalLaps: number): PitWindow {
  const ideal = Math.max(1, Math.min(totalLaps - 1, Math.round(idealLap)));
  return {
    open: Math.max(1, ideal - WINDOW_BEFORE),
    ideal,
    close: Math.max(ideal, Math.min(totalLaps - 1, ideal + WINDOW_AFTER)),
  };
}

// Base time lost for a green-flag stop (pit lane + service), before crew skill.
const BASE_PIT_LOSS = 22;

export type PitPlan = {
  plannedStops: number;
  scheduledLaps: number[];
  stintTarget: number;
};

// Number of planned stops implied by a strategy id.
function plannedStopsFor(strategy: RaceStrategy): number {
  switch (strategy.id) {
    case 'AggressiveTwoStop':
      return 2;
    case 'ConservativeOneStop':
    case 'BalancedOneStop':
    case 'UndercutFocused':
    case 'OvercutFocused':
    case 'TrackPositionFocus':
    case 'SafetyFirstPoints':
      return 1;
    case 'ReactiveStrategy':
      return 1;
    default:
      return 1;
  }
}

// Build the planned pit schedule. Undercut stops early, overcut stops late.
export function buildPitPlan(strategy: RaceStrategy, totalLaps: number): PitPlan {
  const plannedStops = plannedStopsFor(strategy);
  const laps: number[] = [];

  if (plannedStops === 2) {
    laps.push(Math.round(totalLaps * 0.34));
    laps.push(Math.round(totalLaps * 0.66));
  } else {
    let frac = 0.5;
    if (strategy.id === 'UndercutFocused') frac = 0.4;
    else if (strategy.id === 'OvercutFocused') frac = 0.62;
    else if (strategy.id === 'ConservativeOneStop' || strategy.id === 'SafetyFirstPoints') frac = 0.55;
    laps.push(Math.round(totalLaps * frac));
  }

  const stintTarget = Math.round(totalLaps / (plannedStops + 1));
  return { plannedStops, scheduledLaps: laps, stintTarget };
}

// Time lost for a single stop, accounting for crew quality and whether it is a
// cheap stop under the safety car.
export function pitStopLoss(car: Car, underSafetyCar: boolean, safetyCarSaving: number): number {
  const ops = effectiveCarRatings(car).pitCrewOperations; // 1-10
  const crewDelta = (5.5 - ops) * 0.4; // strong crews save ~1.8s, weak ones lose
  const loss = BASE_PIT_LOSS + crewDelta;
  return Math.max(8, underSafetyCar ? loss - safetyCarSaving : loss);
}
