import { describe, it, expect } from 'vitest';
import { calculateMistakeRisk, calculateCrashRisk } from './mistakeEngine';
import type { Driver, Track } from '../types/gameTypes';

function driver(composure: number, riskManagement: number, aggression = 50): Driver {
  return {
    id: 'd-test',
    name: 'Test Driver',
    number: 1,
    teamId: 't-test',
    ratings: {
      cornering: 50,
      braking: 50,
      straights: 50,
      tractionAcceleration: 50,
      elevationBlindCorners: 50,
      technical: 50,
      overtakingRacecraft: 50,
      surfaceGripBumpiness: 50,
      riskManagement,
      enduranceConsistency: 50,
      qualifying: 50,
      racePace: 50,
      adaptability: 50,
      aggression,
      composure,
      overall: 50,
    },
    morale: 65,
    confidence: 65,
    traits: [],
  };
}

function track(wallProximity: number, technical: number): Track {
  return {
    id: 'track-test',
    name: 'Test Track',
    gpName: 'Test GP',
    archetype: 'Balanced Circuit',
    attributes: {
      corners: 50,
      braking: 50,
      straights: 50,
      tractionAcceleration: 50,
      elevationBlindCorners: 50,
      technical,
      overtakingRacecraft: 50,
      surfaceGripBumpiness: 50,
      riskWallProximity: wallProximity,
      enduranceConsistency: 50,
    },
    setupProfile: {
      primarySetupProfile: 'Balanced',
      downforceLevel: 'Medium',
      topSpeedEmphasis: 5,
      mechanicalGripEmphasis: 5,
      brakeDemand: 5,
      reliabilityRiskFocus: 5,
      strategyNotes: '',
      aeroDemand: 50,
      powerDemand: 50,
      mechanicalDemand: 50,
      riskDemand: 50,
    },
    ratingNotes: '',
  };
}

describe('calculateMistakeRisk', () => {
  it('gives low-composure / low-risk-management drivers a higher mistake risk', () => {
    const low = calculateMistakeRisk(driver(35, 35), track(50, 50), 0, 0);
    const high = calculateMistakeRisk(driver(85, 85), track(50, 50), 0, 0);

    expect(low).toBeGreaterThan(high);
    expect(high).toBeGreaterThan(0.01);
  });

  it('raises risk on high-wall / technical tracks', () => {
    const risky = calculateMistakeRisk(driver(65, 65), track(80, 80), 0, 0);
    const safe = calculateMistakeRisk(driver(65, 65), track(30, 30), 0, 0);

    expect(risky).toBeGreaterThan(safe);
  });

  it('does not clamp normal 1-100 track attributes to the maximum', () => {
    const high = calculateMistakeRisk(driver(65, 65), track(95, 95), 0, 0);
    expect(high).toBeLessThan(0.5);
  });

  it('increases risk with aggression', () => {
    const calm = calculateMistakeRisk(driver(65, 65), track(50, 50), 0, 0);
    const aggressive = calculateMistakeRisk(driver(65, 65), track(50, 50), 3, 0);

    expect(aggressive).toBeGreaterThan(calm);
  });
});

describe('calculateCrashRisk', () => {
  it('is higher on wall-heavy tracks than open tracks', () => {
    const wall = calculateCrashRisk(driver(65, 65), track(85, 50), 0);
    const open = calculateCrashRisk(driver(65, 65), track(30, 50), 0);

    expect(wall).toBeGreaterThan(open);
  });
});
