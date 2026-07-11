import type { LiveCarState, LiveRaceState } from '../types/liveTypes';

export type LegacyTrackDotPosition = {
  driverId: string;
  trackProgress: number | undefined;
};

export function trackProgressFromAuthoritativePosition(car: LiveCarState): number | undefined {
  return car.positionState?.normalizedLapProgress;
}

export function buildTrackProgressByDriver(state: LiveRaceState): Record<string, number> {
  return Object.fromEntries(
    state.cars
      .map((car): [string, number | undefined] => [car.driverId, trackProgressFromAuthoritativePosition(car)])
      .filter((entry): entry is [string, number] => entry[1] !== undefined),
  );
}
