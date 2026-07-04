import { describe, expect, it } from 'vitest';
import { getSeasonBundle } from '../data/seasonData';
import { createNewGame } from '../game/initialCareer';
import { makePromise } from '../sim/driverConfidenceEngine';
import { promiseProgress } from './relationships/promiseProgress';

function makeState() {
  const bundle = getSeasonBundle(1995, 'F1');
  if (!bundle) throw new Error('Missing 1995 F1 bundle');
  return createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-sauber',
    seed: 'promise-progress-test',
    bundle,
  });
}

describe('relationship promise progress', () => {
  it('tracks number-one promises from team-order evidence instead of manual resolution', () => {
    const state = makeState();
    const driverId = state.drivers.find((driver) => driver.teamId === state.selectedTeamId)?.id;
    if (!driverId) throw new Error('Missing selected team driver');
    const promise = makePromise(driverId, 'number_one_status', 1995, 1, 1995, 10, 0);

    const neutral = promiseProgress(promise, state);
    expect(neutral.status).toBe('Waiting for proof');
    expect(neutral.percent).toBeGreaterThan(0);

    const withOrderAgainst = {
      ...state,
      teamOrderHistory: [
        {
          id: 'order-1',
          raceId: 'race-1',
          order: 'SwapPositions' as const,
          disadvantagedDriverId: driverId,
          favoredDriverId: 'teammate',
          lap: 20,
        },
      ],
    };
    const atRisk = promiseProgress(promise, withOrderAgainst);
    expect(atRisk.status).toBe('At risk');
    expect(atRisk.percent).toBeLessThan(neutral.percent);
  });

  it('tracks contract renewal promises from contract state', () => {
    const state = makeState();
    const driver = state.drivers.find((d) => d.teamId === state.selectedTeamId);
    if (!driver) throw new Error('Missing selected team driver');
    const promise = makePromise(driver.id, 'contract_renewal', 1995, 1, 1995, undefined, 0);

    const needsRenewal = promiseProgress(promise, state);
    const renewedState = {
      ...state,
      drivers: state.drivers.map((d) => (d.id === driver.id ? { ...d, contractYearsRemaining: 2 } : d)),
    };
    const secured = promiseProgress(promise, renewedState);

    expect(needsRenewal.status).toBe('Needs renewal');
    expect(secured.status).toBe('Contract secured');
    expect(secured.percent).toBeGreaterThan(needsRenewal.percent);
  });
});
