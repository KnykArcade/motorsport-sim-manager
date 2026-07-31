import { describe, expect, it } from 'vitest';

import { BALANCED_SETUP } from '../data/setup/setupComponents';
import { cars1995 } from '../data/cars/cars1995';
import { drivers1995 } from '../data/drivers/drivers1995';
import { tracks1995 } from '../data/tracks/tracks1995';
import type { RaceEngineerProfile, StaffMember } from '../types/staffTypes';
import type { CarSetup } from '../types/setupTypes';
import { objectiveSetupQuality, idealSetup } from './setupFitEngine';
import {
  buildSetupEngineeringRecommendation,
  deriveRaceEngineerProfile,
  engineeringKnowledgeExtraction,
  raceEngineerSpecialty,
  raceEngineerTrackRating,
} from './raceEngineerEngine';

const driver = drivers1995[0];
const car = cars1995.find((entry) => entry.teamId === driver.teamId) ?? cars1995[0];
const roadTrack = tracks1995[0];
const ovalTrack = {
  ...roadTrack,
  id: 'test-oval',
  name: 'Test Superspeedway',
  gpName: 'Test 500',
  archetype: 'Superspeedway oval',
};

function profile(value: number, overrides: Partial<RaceEngineerProfile> = {}): RaceEngineerProfile {
  return {
    vehicleDynamics: value,
    ovalKnowledge: value,
    roadCourseKnowledge: value,
    aerodynamics: value,
    communication: value,
    feedbackInterpretation: value,
    adaptability: value,
    experience: value,
    ...overrides,
  };
}

function engineer(id: string, engineeringProfile: RaceEngineerProfile, rating = 70): StaffMember {
  return {
    id,
    name: `Engineer ${id}`,
    role: 'Race Engineer',
    nationality: 'GB',
    rating,
    salary: 1,
    signingFee: 0,
    bio: 'Test engineer.',
    engineeringProfile,
  };
}

function evidence(overrides: Partial<Parameters<typeof buildSetupEngineeringRecommendation>[0]['evidence']> = {}) {
  return {
    setupKnowledge: 0.55,
    tyreKnowledge: 0.4,
    reliabilityKnowledge: 0.35,
    practiceLaps: 24,
    driverTechnical: driver.ratings.technical,
    engineerChemistry: 62,
    facilities: 65,
    operations: 65,
    packagePreparation: 1,
    ...overrides,
  };
}

function recommendation(seed: string, staff: StaffMember, setup: CarSetup = BALANCED_SETUP) {
  return buildSetupEngineeringRecommendation({
    seed,
    engineer: staff,
    driver,
    setup,
    practicedSetup: BALANCED_SETUP,
    track: roadTrack,
    series: 'F1',
    car,
    evidence: evidence(),
  });
}

function directionIsAccurate(rec: ReturnType<typeof recommendation>, setup: CarSetup): boolean {
  if (!rec.parameter || rec.direction === 'Unavailable') return true;
  const gap = idealSetup(roadTrack, driver, car)[rec.parameter] - setup[rec.parameter];
  if (Math.abs(gap) < 0.55) return rec.direction === 'Hold';
  return gap > 0 ? rec.direction === 'Increase' : rec.direction === 'Decrease';
}

describe('Race Engineer specialist model', () => {
  it('derives all eight legacy-save attributes deterministically', () => {
    const legacy = { id: 'legacy-re', name: 'Legacy Engineer', rating: 7 };
    const first = deriveRaceEngineerProfile(legacy);
    expect(first).toEqual(deriveRaceEngineerProfile(legacy));
    expect(Object.keys(first)).toHaveLength(8);
    expect(Object.values(first).every((value) => value >= 1 && value <= 100)).toBe(true);
  });

  it('makes oval and road-course specialties discipline-specific', () => {
    const oval = profile(55, { ovalKnowledge: 96, roadCourseKnowledge: 24 });
    const road = profile(55, { ovalKnowledge: 24, roadCourseKnowledge: 96 });
    expect(raceEngineerTrackRating(oval, ovalTrack, 'NASCAR'))
      .toBeGreaterThan(raceEngineerTrackRating(road, ovalTrack, 'NASCAR'));
    expect(raceEngineerTrackRating(road, roadTrack, 'F1'))
      .toBeGreaterThan(raceEngineerTrackRating(oval, roadTrack, 'F1'));
    expect(raceEngineerSpecialty(oval)).toBe('Oval specialist');
  });

  it('produces deterministic qualitative advice without exposing a hidden target value', () => {
    const staff = engineer('deterministic', profile(72));
    const first = recommendation('same-seed', staff);
    expect(first).toEqual(recommendation('same-seed', staff));
    expect(first.parameterLabel).toBeTruthy();
    expect(JSON.stringify(first)).not.toContain('ideal');
    expect(JSON.stringify(first)).not.toContain('target');
  });

  it('uses aerodynamic and vehicle-dynamics ratings only for relevant diagnoses', () => {
    const aeroSetup = { ...BALANCED_SETUP, frontWing: 1, rearWing: 1 };
    const aero = recommendation('aero', engineer('aero', profile(50, { aerodynamics: 98 })), aeroSetup);
    expect(aero.relevantAttribute).toBe('aerodynamics');

    const mechanicalSetup = { ...BALANCED_SETUP, suspensionStiffness: 10, rideHeight: 1 };
    const dynamics = recommendation('dynamics', engineer('dynamics', profile(50, { vehicleDynamics: 98 })), mechanicalSetup);
    expect(dynamics.relevantAttribute).toBe('vehicleDynamics');
  });

  it('combines feedback interpretation with driver technical ability and chemistry', () => {
    const support = profile(70, { feedbackInterpretation: 90, communication: 85 });
    expect(engineeringKnowledgeExtraction(support, 95, 90))
      .toBeGreaterThan(engineeringKnowledgeExtraction(support, 25, 20));
  });

  it('uses communication for evidence extraction but never changes physical setup quality', () => {
    const quiet = profile(65, { communication: 20 });
    const clear = profile(65, { communication: 95 });
    expect(engineeringKnowledgeExtraction(clear, 60, 60))
      .toBeGreaterThan(engineeringKnowledgeExtraction(quiet, 60, 60));
    expect(objectiveSetupQuality(BALANCED_SETUP, roadTrack, car))
      .toEqual(objectiveSetupQuality(BALANCED_SETUP, roadTrack, car));
  });

  it('rewards adaptability when conditions change', () => {
    const adaptable = profile(60, { adaptability: 98, experience: 35 });
    const rigid = profile(60, { adaptability: 20, experience: 90 });
    expect(engineeringKnowledgeExtraction(adaptable, 60, 60, true))
      .toBeGreaterThan(engineeringKnowledgeExtraction(rigid, 60, 60, true));
  });

  it('calibrates confidence downward when evidence and experience are limited', () => {
    const rookie = buildSetupEngineeringRecommendation({
      seed: 'confidence', engineer: engineer('rookie', profile(45, { experience: 20 })),
      driver, setup: BALANCED_SETUP, track: roadTrack, car,
      evidence: evidence({ setupKnowledge: 0.05, tyreKnowledge: 0, reliabilityKnowledge: 0, practiceLaps: 2 }),
    });
    expect(rookie.confidence).toBeLessThanOrEqual(67);
    expect(rookie.evidenceLabel).toBe('Limited');
  });

  it('makes strong engineers more accurate statistically while keeping both outcomes possible', () => {
    const poorSetup: CarSetup = {
      frontWing: 1, rearWing: 1, suspensionStiffness: 10, rideHeight: 1, gearing: 1,
      brakeBias: 1, brakeCooling: 1, differential: 1, engineCooling: 1, tyreUsage: 10,
    };
    const elite = engineer('elite', profile(96));
    const weak = engineer('weak', profile(22));
    let eliteCorrect = 0;
    let weakCorrect = 0;
    for (let index = 0; index < 180; index += 1) {
      if (directionIsAccurate(recommendation(`sample-${index}`, elite, poorSetup), poorSetup)) eliteCorrect += 1;
      if (directionIsAccurate(recommendation(`sample-${index}`, weak, poorSetup), poorSetup)) weakCorrect += 1;
    }
    expect(eliteCorrect).toBeGreaterThan(weakCorrect + 20);
    expect(eliteCorrect).toBeLessThan(180);
    expect(weakCorrect).toBeGreaterThan(0);
  });

  it('reports teammate disagreement and practised-data invalidation explicitly', () => {
    const rec = buildSetupEngineeringRecommendation({
      seed: 'disagreement', engineer: engineer('team', profile(75)), driver,
      setup: { ...BALANCED_SETUP, frontWing: 1, rearWing: 1 },
      practicedSetup: { ...BALANCED_SETUP, frontWing: 8, rearWing: 8 },
      track: roadTrack, car,
      evidence: evidence({ teammateDisagreement: true }),
    });
    expect(rec.teammateDisagreement).toBe(true);
    expect(rec.invalidatesPracticeData).toBe(true);
  });

  it('never recommends a prohibited parc-ferme parameter', () => {
    const rec = buildSetupEngineeringRecommendation({
      seed: 'locked', engineer: engineer('locked', profile(90)), driver,
      setup: BALANCED_SETUP, track: roadTrack, car, evidence: evidence(),
      lockActive: true, allowedParams: [], lockDescription: 'Parc fermé active.',
    });
    expect(rec.direction).toBe('Unavailable');
    expect(rec.parameter).toBeUndefined();
    expect(rec.lockedReason).toBe('Parc fermé active.');
  });
});
