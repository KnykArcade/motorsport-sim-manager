import { describe, it, expect } from 'vitest';
import { calculateReliabilityRisk } from './reliabilityEngine';
import type { Car, SetupOption, Track } from '../types/gameTypes';

function car(reliability: number): Car {
  return {
    id: 'car-test',
    teamId: 't-test',
    seasonYear: 1990,
    ratings: {
      enginePower: 50,
      aeroEfficiency: 50,
      mechanicalGrip: 50,
      reliability,
      pitCrewOperations: 50,
    },
    condition: 100,
    developmentLevel: { enginePower: 0, aeroEfficiency: 0, mechanicalGrip: 0, reliability: 0, pitCrewOperations: 0 },
  };
}

function track(riskDemand: number, enduranceConsistency: number): Track {
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
      technical: 50,
      overtakingRacecraft: 50,
      surfaceGripBumpiness: 50,
      riskWallProximity: 50,
      enduranceConsistency,
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
      riskDemand,
    },
    ratingNotes: '',
  };
}

const setup: SetupOption = {
  id: 'setup-balanced',
  name: 'Balanced',
  description: '',
  downforce: 5,
  topSpeed: 5,
  mechanicalGrip: 5,
  brakingStability: 5,
  tirePreservation: 5,
  reliabilityProtection: 5,
  qualifyingBoost: 0,
  racePaceBoost: 0,
  riskModifier: 0,
};

const aggressiveSetup: SetupOption = {
  ...setup,
  reliabilityProtection: 2,
  riskModifier: 2,
};

const safeSetup: SetupOption = {
  ...setup,
  reliabilityProtection: 9,
  riskModifier: -1,
};

describe('calculateReliabilityRisk', () => {
  it('produces a spread of risk for 1-100 reliability ratings', () => {
    const low = calculateReliabilityRisk(car(35), track(50, 50), setup, 0, 0);
    const medium = calculateReliabilityRisk(car(60), track(50, 50), setup, 0, 0);
    const high = calculateReliabilityRisk(car(90), track(50, 50), setup, 0, 0);

    expect(low).toBeGreaterThan(medium);
    expect(medium).toBeGreaterThan(high);
    expect(high).toBeGreaterThan(0.01);
  });

  it('does not clamp all normal 1-100 ratings to the same minimum risk', () => {
    const r65 = calculateReliabilityRisk(car(65), track(50, 50), setup, 0, 0);
    const r85 = calculateReliabilityRisk(car(85), track(50, 50), setup, 0, 0);

    expect(r65).toBeGreaterThan(r85);
    expect(r65 - r85).toBeGreaterThan(0.01);
  });

  it('raises risk on punishing tracks and lowers it on gentle tracks', () => {
    const punishing = calculateReliabilityRisk(car(65), track(85, 80), setup, 0, 0);
    const gentle = calculateReliabilityRisk(car(65), track(30, 30), setup, 0, 0);

    expect(punishing).toBeGreaterThan(gentle);
  });

  it('rewards reliability-focused setups and penalises aggressive trim', () => {
    const safe = calculateReliabilityRisk(car(65), track(50, 50), safeSetup, 0, 0);
    const aggressive = calculateReliabilityRisk(car(65), track(50, 50), aggressiveSetup, 0, 0);

    expect(safe).toBeGreaterThan(0);
    expect(aggressive).toBeGreaterThan(safe);
  });

  it('increases risk with aggressive driving stress', () => {
    const calm = calculateReliabilityRisk(car(65), track(50, 50), setup, 0, 0);
    const stressed = calculateReliabilityRisk(car(65), track(50, 50), setup, 3, 0);

    expect(stressed).toBeGreaterThan(calm);
  });
});
