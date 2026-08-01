import { describe, expect, it } from 'vitest';
import { tracks1995 } from '../data/tracks/tracks1995';
import { drivers1995 } from '../data/drivers/drivers1995';
import { cars1995 } from '../data/cars/cars1995';
import { BALANCED_SETUP } from '../data/setup/setupComponents';
import type { SetupArchiveEntry } from '../types/practiceTypes';
import { archiveCompletedWeekend, carDevelopmentFingerprint, rankSetupArchive } from './setupArchiveEngine';

const track = tracks1995[0];
const driver = drivers1995[0];
const car = cars1995.find((item) => item.teamId === driver.teamId) ?? cars1995[0];

function record(overrides: Partial<SetupArchiveEntry> = {}): SetupArchiveEntry {
  return {
    id: 'archive-1',
    teamId: driver.teamId,
    driverId: driver.id,
    raceId: 'race-old',
    trackId: track.id,
    trackName: track.name,
    trackArchetype: track.archetype,
    seasonYear: 1994,
    carId: car.id,
    carDevelopmentFingerprint: carDevelopmentFingerprint(car),
    condition: { label: 'Dry', wet: false, gripLevel: 0.95 },
    qualifyingSetup: { ...BALANCED_SETUP },
    raceSetup: { ...BALANCED_SETUP },
    evidenceConfidence: 0.8,
    ...overrides,
  };
}

describe('setup archive and circuit learning', () => {
  it('ranks an exact layout above a merely similar circuit', () => {
    const similar = tracks1995.find((item) => item.id !== track.id && item.archetype === track.archetype);
    if (!similar) return;
    const ranked = rankSetupArchive({
      archive: [record(), record({ id: 'similar', trackId: similar.id, trackName: similar.name })],
      teamId: driver.teamId,
      driver,
      track,
      car,
      seasonYear: 1995,
      wet: false,
    });
    expect(ranked[0].entry.id).toBe('archive-1');
    expect(ranked[0].relevance).toBeGreaterThan(ranked[1].relevance);
    expect(ranked[0].verifiedThisWeekend).toBe(false);
  });

  it('decays relevance for age, changed cars, weather and another driver', () => {
    const current = rankSetupArchive({ archive: [record({ seasonYear: 1995 })], teamId: driver.teamId, driver, track, car, seasonYear: 1995, wet: false })[0];
    const stale = rankSetupArchive({
      archive: [record({ seasonYear: 1990, driverId: 'former-driver', carDevelopmentFingerprint: 0 })],
      teamId: driver.teamId,
      driver,
      track,
      car,
      seasonYear: 1995,
      wet: true,
    })[0];
    expect(stale.relevance).toBeLessThan(current.relevance);
    expect(stale.reasons).toContain('Different weather conditions');
    expect(stale.reasons).toContain('Recorded for another driver');
  });

  it('archives tested team setups and bounds long-term save growth', () => {
    const archive = Array.from({ length: 250 }, (_, index) => record({ id: `old-${index}`, raceId: `old-${index}` }));
    const result = archiveCompletedWeekend({
      archive,
      teamId: driver.teamId,
      drivers: [driver],
      raceId: 'race-new',
      track,
      seasonYear: 1995,
      car,
      practice: {
        raceId: 'race-new', sessions: [], lapsUsed: 20,
        knowledge: { raceId: 'race-new', setupKnowledge: { [driver.id]: 0.75 }, tireKnowledge: {}, reliabilityKnowledge: {}, confidenceDelta: {} },
        practiceLapsByDriver: { [driver.id]: 20 },
      },
      setups: { [driver.id]: BALANCED_SETUP },
      wet: false,
    });
    expect(result).toHaveLength(80);
    expect(result.some((entry) => entry.raceId === 'race-new')).toBe(true);
  });

  it('keeps archives owned by the team after the recorded driver leaves', () => {
    const replacement = { ...driver, id: 'replacement' };
    const ranked = rankSetupArchive({ archive: [record()], teamId: driver.teamId, driver: replacement, track, car, seasonYear: 1995, wet: false });
    expect(ranked).toHaveLength(1);
    expect(ranked[0].reasons).toContain('Recorded for another driver');
  });
});
