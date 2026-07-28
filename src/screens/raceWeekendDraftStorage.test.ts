import { describe, expect, it } from 'vitest';
import type { RaceWeekendUiDraft } from './raceWeekendDraftStorage';
import {
  clearRaceWeekendUiDraft,
  readRaceWeekendUiDraft,
  writeRaceWeekendUiDraft,
} from './raceWeekendDraftStorage';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
}

const draft: RaceWeekendUiDraft = {
  raceId: 'race-1',
  phase: 'setup',
  furthestPhase: 'setup',
  setupDraft: {
    'driver-1': {
      frontWing: 5,
      rearWing: 6,
      suspensionStiffness: 5,
      rideHeight: 5,
      brakeBias: 5,
      brakeCooling: 5,
      gearing: 5,
      differential: 5,
      engineCooling: 5,
      tyreUsage: 5,
    },
  },
  qualifyingOverrides: { 'driver-1': { runPlanId: 'StandardPush' } },
  raceOverrides: { 'driver-1': { instructionId: 'Balanced' } },
};

describe('race weekend draft storage', () => {
  it('restores the exact unconfirmed weekend workspace and decisions', () => {
    const storage = memoryStorage();
    writeRaceWeekendUiDraft(storage, draft);

    expect(readRaceWeekendUiDraft(storage, draft.raceId)).toEqual(draft);
  });

  it('does not reuse one race weekend draft for another race', () => {
    const storage = memoryStorage();
    writeRaceWeekendUiDraft(storage, draft);

    expect(readRaceWeekendUiDraft(storage, 'race-2')).toBeUndefined();
  });

  it('rejects malformed drafts and clears completed race drafts', () => {
    const storage = memoryStorage();
    storage.setItem('motorsport-manager:race-weekend-draft:race-1', '{"phase":"setup"}');
    expect(readRaceWeekendUiDraft(storage, 'race-1')).toBeUndefined();

    writeRaceWeekendUiDraft(storage, draft);
    clearRaceWeekendUiDraft(storage, draft.raceId);
    expect(readRaceWeekendUiDraft(storage, draft.raceId)).toBeUndefined();
  });
});
