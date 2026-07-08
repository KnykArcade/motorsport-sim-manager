import type { LiveCarState, LiveRaceState } from '../types/liveTypes';
import { collectDamageComponents, hasForcedRepairNeed as damageHasForcedRepairNeed, hasTerminalDamage, DEFAULT_DAMAGE_SETTINGS } from './damageComponents';

export const SAFETY_CAR_PIT_RECOMMENDATION_MIN_LAP = 16;

export function hasForcedRepairNeed(car: LiveCarState): boolean {
  return damageHasForcedRepairNeed(collectDamageComponents(car, undefined, undefined, car.damageSettings ?? DEFAULT_DAMAGE_SETTINGS));
}

export function hasTerminalDamageNeed(car: LiveCarState): boolean {
  return hasTerminalDamage(collectDamageComponents(car, undefined, undefined, car.damageSettings ?? DEFAULT_DAMAGE_SETTINGS));
}

export function hasRealSafetyCarPitWindow(car: LiveCarState, lap: number): boolean {
  if (car.pit.plannedStops !== 1 || car.pit.stopsMade >= car.pit.plannedStops) return false;
  const window = car.pit.window;
  if (!window) return false;
  return lap >= window.open && lap <= window.close;
}

export function shouldOfferSafetyCarPit(car: LiveCarState, lap: number): boolean {
  return lap >= SAFETY_CAR_PIT_RECOMMENDATION_MIN_LAP || hasForcedRepairNeed(car) || hasRealSafetyCarPitWindow(car, lap);
}

export function safetyCarPitAlreadyPrompted(car: LiveCarState, state: LiveRaceState): boolean {
  return (car.pit.lastSafetyCarPitPromptDeployment ?? null) === state.safetyCar.deployments;
}

export function markSafetyCarPitPrompted(car: LiveCarState, deployment: number): LiveCarState {
  return { ...car, pit: { ...car.pit, lastSafetyCarPitPromptDeployment: deployment } };
}

export function restartModeForPosition(
  position: number | null,
  overtakingRacecraft: number | undefined,
  composure: number | undefined,
  defaultMode: LiveCarState['paceMode'],
): LiveCarState['paceMode'] {
  const racecraft = overtakingRacecraft ?? 50;
  const calm = composure ?? 50;
  const frontBias = racecraft >= 68 || calm >= 70;
  const rearBias = racecraft < 45 || calm < 45;

  if (position == null) return defaultMode;
  if (position <= 3) return frontBias ? 'Defend' : 'Balanced';
  if (position <= 10) return frontBias ? 'Attack' : defaultMode;
  return rearBias ? 'Conservative' : 'Balanced';
}

export function modeComfortForRestart(
  car: LiveCarState,
  trackRacecraft: number | undefined,
): LiveCarState['paceMode'] {
  const position = car.position;
  const composure = car.driverComposure;
  return restartModeForPosition(position, trackRacecraft, composure, 'Conservative');
}

export function restartModeByDriver(
  cars: LiveCarState[],
  trackRacecraft: number | undefined,
): Record<string, LiveCarState['paceMode']> {
  const out: Record<string, LiveCarState['paceMode']> = {};
  for (const car of cars) {
    if (!car.running) continue;
    out[car.driverId] = modeComfortForRestart(car, trackRacecraft);
  }
  return out;
}

export function combinedRestartDefaultModes(
  cars: LiveCarState[],
  trackRacecraft: number | undefined,
): Record<string, LiveCarState['paceMode']> {
  return restartModeByDriver(cars, trackRacecraft);
}

export function driverDisagreementBias(rel: {
  trustInTeam: number;
  trustInPrincipal: number;
  ego: number;
}): number {
  const trust = (rel.trustInTeam + rel.trustInPrincipal) / 2;
  const distrust = Math.max(0, 70 - trust) / 70;
  const ego = Math.max(0, rel.ego - 55) / 45;
  return Math.max(0, Math.min(1, distrust * 0.65 + ego * 0.35));
}
