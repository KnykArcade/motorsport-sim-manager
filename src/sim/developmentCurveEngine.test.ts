import { describe, it, expect } from 'vitest';
import type { Driver, DriverRatings } from '../types/gameTypes';
import {
  createDriverDevelopmentCurve,
  developmentPhase,
  developmentStep,
  driverAge,
  projectTrajectory,
  seedDevelopmentCurves,
  synthesizeAge,
} from './developmentCurveEngine';

const SEED = 'seed-dev';

function ratings(overall: number): DriverRatings {
  return {
    cornering: overall,
    braking: overall,
    straights: overall,
    tractionAcceleration: overall,
    elevationBlindCorners: overall,
    technical: overall,
    overtakingRacecraft: overall,
    surfaceGripBumpiness: overall,
    riskManagement: overall,
    enduranceConsistency: overall,
    qualifying: overall,
    racePace: overall,
    adaptability: overall,
    aggression: 5,
    composure: overall,
    overall,
  };
}

function driver(id: string, overall: number, age?: number): Driver {
  return {
    id,
    name: id,
    number: 1,
    teamId: 't-x',
    age,
    ratings: ratings(overall),
    morale: 60,
    confidence: 60,
    traits: [],
  };
}

describe('developmentCurveEngine — age synthesis', () => {
  it('produces a plausible deterministic age when missing', () => {
    const a = synthesizeAge(SEED, 'd1', 7);
    const b = synthesizeAge(SEED, 'd1', 7);
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(18);
    expect(a).toBeLessThanOrEqual(38);
  });

  it('uses the driver age when present', () => {
    expect(driverAge(driver('d1', 7, 24), SEED)).toBe(24);
  });
});

describe('developmentCurveEngine — curve + phase', () => {
  it('gives a young driver headroom above their current overall', () => {
    const curve = createDriverDevelopmentCurve(driver('young', 60, 19), SEED);
    expect(curve.potentialCeiling).toBeGreaterThan(60);
    expect(developmentPhase(curve, 19)).toBe('Developing');
  });

  it('classifies peak and decline by age', () => {
    const curve = createDriverDevelopmentCurve(driver('vet', 80, 30), SEED);
    expect(developmentPhase(curve, curve.peakAgeStart)).toBe('Peak');
    expect(developmentPhase(curve, curve.peakAgeEnd + 1)).toBe('Declining');
  });
});

describe('developmentCurveEngine — step', () => {
  it('improves a young driver and ages them a year', () => {
    const d = driver('young', 60, 20);
    const curve = createDriverDevelopmentCurve(d, SEED);
    const { driver: next, result } = developmentStep(curve, d, SEED, { seasonYear: 2000 });
    expect(next.age).toBe(21);
    expect(result.overallAfter).toBeGreaterThan(result.overallBefore);
    expect(result.phase).toBe('Developing');
  });

  it('declines an older driver', () => {
    const d = driver('vet', 80, 40);
    const curve = createDriverDevelopmentCurve(d, SEED);
    const { result } = developmentStep(curve, d, SEED, { seasonYear: 2000 });
    expect(result.phase).toBe('Declining');
    expect(result.overallAfter).toBeLessThan(result.overallBefore);
  });

  it('keeps ratings within 1-100 and is deterministic', () => {
    const d = driver('max', 99, 19);
    const curve = createDriverDevelopmentCurve(d, SEED);
    const a = developmentStep(curve, d, SEED, { seasonYear: 2000 });
    const b = developmentStep(curve, d, SEED, { seasonYear: 2000 });
    expect(a.driver.ratings).toEqual(b.driver.ratings);
    for (const v of Object.values(a.driver.ratings)) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('academy boost helps a developing driver more', () => {
    const d = driver('kid', 60, 20);
    const curve = createDriverDevelopmentCurve(d, SEED);
    const withBoost = developmentStep(curve, d, SEED, { seasonYear: 2000, academyBoost: 0.6 });
    const without = developmentStep(curve, d, SEED, { seasonYear: 2000, academyBoost: 0 });
    expect(withBoost.result.overallAfter).toBeGreaterThanOrEqual(without.result.overallAfter);
  });

  it('directs additional growth toward the selected individual focus', () => {
    const d = driver('focused', 60, 20);
    const curve = createDriverDevelopmentCurve(d, SEED);
    const focused = developmentStep(curve, d, SEED, {
      seasonYear: 2000,
      planEffect: 0.1,
      planFocus: 'QualifyingPace',
    });
    const balanced = developmentStep(curve, d, SEED, {
      seasonYear: 2000,
      planEffect: 0.1,
      planFocus: 'Balanced',
    });
    expect(focused.driver.ratings.qualifying).toBeGreaterThan(balanced.driver.ratings.qualifying);
    expect(focused.driver.ratings.racePace).toBe(balanced.driver.ratings.racePace);
  });
});

describe('developmentCurveEngine — projection + seeding', () => {
  it('projects a trajectory that rises then falls over a career', () => {
    const d = driver('arc', 60, 20);
    const curve = createDriverDevelopmentCurve(d, SEED);
    const points = projectTrajectory(curve, 20, 60, 20);
    const overalls = points.map((p) => p.overall);
    const peak = Math.max(...overalls);
    expect(peak).toBeGreaterThanOrEqual(60);
    // Late-career overall is below the peak (decline happened).
    expect(overalls[overalls.length - 1]).toBeLessThan(peak);
  });

  it('seeds a curve for every driver and fills missing ages', () => {
    const roster = [driver('a', 70), driver('b', 80, 30)];
    const { curves, drivers } = seedDevelopmentCurves(roster, SEED);
    expect(Object.keys(curves)).toHaveLength(2);
    expect(drivers.every((d) => typeof d.age === 'number')).toBe(true);
    expect(drivers.find((d) => d.id === 'b')!.age).toBe(30);
  });
});
