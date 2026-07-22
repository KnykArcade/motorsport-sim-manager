import type { UniverseChampionshipState } from '../types/universeTypes';

export type WorldDriverAvailabilityRow = {
  driverId: string;
  status: 'Available' | 'Injured';
  detail?: string;
  replacementName?: string;
};

export function worldDriverAvailability(
  championship: UniverseChampionshipState,
): Map<string, WorldDriverAvailabilityRow> {
  const rows = new Map<string, WorldDriverAvailabilityRow>();
  for (const driver of championship.drivers) {
    rows.set(driver.driverId, { driverId: driver.driverId, status: 'Available' });
  }
  for (const absence of championship.driverAbsences ?? []) {
    rows.set(absence.driverId, {
      driverId: absence.driverId,
      status: 'Injured',
      detail: `${absence.injuryType} · target return R${absence.expectedReturnRound}`,
      replacementName: absence.replacement.name,
    });
  }
  return rows;
}
