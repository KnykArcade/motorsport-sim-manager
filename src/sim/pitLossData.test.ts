import { afterEach, describe, expect, it } from 'vitest';

import { cars1995 } from '../data/cars/cars1995';
import type { Car, Track } from '../types/gameTypes';
import {
  pitLossBaseline,
  registerPitLossDataOverrides,
  resolveTrackPitLaneDelta,
} from './pitLossData';
import { pitStopLoss } from './pitStrategyEngine';

const BASE_CAR = cars1995[0];

function car(pitCrewOperations: number): Car {
  return {
    ...BASE_CAR,
    ratings: {
      ...BASE_CAR.ratings,
      pitCrewOperations,
    },
  };
}

function track(overrides: Partial<Track> & Pick<Track, 'id' | 'name' | 'gpName' | 'archetype'>): Track {
  return {
    ...overrides,
    attributes: overrides.attributes ?? {
      corners: 70,
      braking: 70,
      straights: 70,
      tractionAcceleration: 70,
      elevationBlindCorners: 70,
      technical: 70,
      overtakingRacecraft: 70,
      surfaceGripBumpiness: 70,
      riskWallProximity: 70,
      enduranceConsistency: 70,
    },
    setupProfile: overrides.setupProfile ?? {
      primarySetupProfile: overrides.archetype,
      downforceLevel: 'Balanced Circuit',
      topSpeedEmphasis: 70,
      mechanicalGripEmphasis: 70,
      brakeDemand: 70,
      reliabilityRiskFocus: 70,
      strategyNotes: '',
      aeroDemand: 70,
      powerDemand: 70,
      mechanicalDemand: 70,
      riskDemand: 70,
    },
    ratingNotes: overrides.ratingNotes ?? '',
  };
}

afterEach(() => {
  registerPitLossDataOverrides(null);
});

describe('pit loss data defaults and overrides', () => {
  it('keeps NASCAR higher than IndyCar, and IndyCar higher than modern F1 for the same crew rating', () => {
    const c = car(72);
    const road = track({ id: 'TRK-ROAD', name: 'Generic Road Course', gpName: 'Generic Road Course', archetype: 'Road' });

    const f1 = pitStopLoss(c, false, 0, 0, { track: road, series: 'F1', year: 2024 });
    const indy = pitStopLoss(c, false, 0, 0, { track: road, series: 'IndyCar', year: 2024 });
    const nascar = pitStopLoss(c, false, 0, 0, { track: road, series: 'NASCAR', year: 2024 });

    expect(nascar).toBeGreaterThan(indy);
    expect(indy).toBeGreaterThan(f1);
  });

  it('gives a superspeedway a larger pit-lane delta than a short street circuit', () => {
    const shortStreet = track({
      id: 'TRK-STREET',
      name: 'Short Street Circuit',
      gpName: 'Short Street Circuit',
      archetype: 'Street',
      setupProfile: {
        primarySetupProfile: 'Temporary Street Circuit',
        downforceLevel: 'Street',
        topSpeedEmphasis: 46,
        mechanicalGripEmphasis: 75,
        brakeDemand: 84,
        reliabilityRiskFocus: 88,
        strategyNotes: '',
        aeroDemand: 80,
        powerDemand: 50,
        mechanicalDemand: 72,
        riskDemand: 85,
      },
      attributes: {
        corners: 82,
        braking: 90,
        straights: 44,
        tractionAcceleration: 74,
        elevationBlindCorners: 34,
        technical: 82,
        overtakingRacecraft: 48,
        surfaceGripBumpiness: 84,
        riskWallProximity: 92,
        enduranceConsistency: 88,
      },
    });
    const superspeedway = track({
      id: 'TRK-SS',
      name: 'Long Superspeedway',
      gpName: 'Long Superspeedway',
      archetype: 'Oval',
      setupProfile: {
        primarySetupProfile: 'Superspeedway Oval',
        downforceLevel: 'Oval',
        topSpeedEmphasis: 96,
        mechanicalGripEmphasis: 52,
        brakeDemand: 44,
        reliabilityRiskFocus: 48,
        strategyNotes: '',
        aeroDemand: 55,
        powerDemand: 92,
        mechanicalDemand: 50,
        riskDemand: 55,
      },
      attributes: {
        corners: 46,
        braking: 42,
        straights: 96,
        tractionAcceleration: 82,
        elevationBlindCorners: 20,
        technical: 42,
        overtakingRacecraft: 88,
        surfaceGripBumpiness: 48,
        riskWallProximity: 58,
        enduranceConsistency: 76,
      },
    });

    expect(resolveTrackPitLaneDelta(superspeedway, 'NASCAR', 2024)).toBeGreaterThan(resolveTrackPitLaneDelta(shortStreet, 'NASCAR', 2024));
  });

  it('weak pitCrewOperations still increases loss', () => {
    const road = track({ id: 'TRK-ROAD', name: 'Generic Road Course', gpName: 'Generic Road Course', archetype: 'Road' });
    const strong = pitStopLoss(car(88), false, 0, 0, { track: road, series: 'F1', year: 2024 });
    const weak = pitStopLoss(car(28), false, 0, 0, { track: road, series: 'F1', year: 2024 });
    expect(weak).toBeGreaterThan(strong);
  });

  it('uses override values ahead of the defaults', () => {
    const road = track({ id: 'TRK-OVERRIDE', name: 'Override Road', gpName: 'Override Road', archetype: 'Road' });
    registerPitLossDataOverrides({
      trackPitLaneDeltaSeconds: [
        {
          trackId: 'TRK-OVERRIDE',
          series: 'F1',
          eraStartYear: 2024,
          eraEndYear: 2026,
          pitLaneDeltaSeconds: 27.5,
        },
      ],
      seriesEraStationarySeconds: [
        {
          series: 'F1',
          eraStartYear: 2024,
          eraEndYear: 2026,
          stationarySeconds: 9.5,
        },
      ],
    });

    expect(pitLossBaseline(road, 'F1', 2025)).toBeCloseTo(37.0, 5);
  });
});
