import { describe, expect, it } from 'vitest';
import type { Track } from '../../types/gameTypes';
import { generateFallbackSegments } from './fallbackSegmentGenerator';

function track(overrides: Partial<Track> = {}): Track {
  return {
    id: 'test-track',
    name: 'Test Speedway',
    gpName: 'Test 400',
    archetype: 'High-Speed Circuit',
    attributes: {
      corners: 50,
      braking: 50,
      straights: 80,
      tractionAcceleration: 60,
      elevationBlindCorners: 20,
      technical: 40,
      overtakingRacecraft: 70,
      surfaceGripBumpiness: 50,
      riskWallProximity: 75,
      enduranceConsistency: 60,
    },
    setupProfile: {
      primarySetupProfile: 'Speedway',
      downforceLevel: 'Low',
      topSpeedEmphasis: 8,
      mechanicalGripEmphasis: 4,
      brakeDemand: 5,
      reliabilityRiskFocus: 6,
      strategyNotes: '',
      aeroDemand: 60,
      powerDemand: 85,
      mechanicalDemand: 45,
      riskDemand: 70,
    },
    ratingNotes: '',
    ...overrides,
  };
}

describe('fallback segment generator', () => {
  it('creates an inferred serializable segment set with timing lines', () => {
    const set = generateFallbackSegments(track());
    expect(set.inferred).toBe(true);
    expect(set.source).toBe('fallback');
    expect(set.segments.length).toBeGreaterThanOrEqual(20);
    expect(set.segments[0].timingLine).toBe('StartFinish');
    expect(set.segments.some((segment) => segment.timingLine === 'Sector1')).toBe(true);
    expect(set.segments.some((segment) => segment.timingLine === 'Sector2')).toBe(true);
    expect(set.segments.at(-1)?.endProgress).toBe(1);
  });
});
