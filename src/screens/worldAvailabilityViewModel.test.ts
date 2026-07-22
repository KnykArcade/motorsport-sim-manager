import { describe, expect, it } from 'vitest';
import type { UniverseChampionshipState } from '../types/universeTypes';
import { worldDriverAvailability } from './worldAvailabilityViewModel';

describe('world driver availability view model', () => {
  it('null-guards older saves and surfaces injuries with their real replacement', () => {
    const championship: UniverseChampionshipState = {
      series: 'F1', seasonYear: 1998,
      teams: [{ teamId: 't', name: 'Team', reputation: 80, seatCount: 1, driverIds: ['d'] }],
      drivers: [{ driverId: 'd', name: 'Driver', teamId: 't', series: 'F1', contractYearsRemaining: 2 }],
    };
    expect(worldDriverAvailability(championship).get('d')).toEqual({ driverId: 'd', status: 'Available' });
    const injured: UniverseChampionshipState = {
      ...championship,
      driverAbsences: [{
        driverId: 'd', driverName: 'Driver', teamId: 't', injuryType: 'Hand injury',
        startRound: 2, expectedReturnRound: 5,
        replacement: { driverId: 'sub', registryDriverId: 'reg', name: 'Reserve', teamId: 't', series: 'F1', replacesDriverId: 'd' },
      }],
    };
    expect(worldDriverAvailability(injured).get('d')).toEqual({
      driverId: 'd', status: 'Injured', detail: 'Hand injury · target return R5', replacementName: 'Reserve',
    });
  });
});
