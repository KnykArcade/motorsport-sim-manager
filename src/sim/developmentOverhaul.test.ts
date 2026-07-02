import { describe, it, expect } from 'vitest';

import type { Car, CarRatings, DevelopmentProject } from '../types/gameTypes';
import {
  applyDevelopmentProgress,
  computeAdjustedDuration,
  rollOutcome,
  OUTCOME_GAIN_MULTIPLIERS,
  OUTCOME_LABELS,
  PROJECT_SIZE_MODS,
  RUSH_COST_MULTIPLIER,
} from './developmentEngine';
import {
  developmentSlots,
  relevantFacilityLevel,
  facilityTimeMultiplier,
  facilityImpactMultiplier,
  facilityOutcomeChances,
  aiFacilityLevel,
  createInitialFacilities,
  CATEGORY_FACILITY_MAP,
} from './facilityEngine';
import { createSeededRandom } from './random';

const flat = (v: number): CarRatings => ({
  enginePower: v,
  aeroEfficiency: v,
  mechanicalGrip: v,
  reliability: v,
  pitCrewOperations: v,
});

const makeCar = (overrides: Partial<Car> = {}): Car => ({
  id: 'c1',
  teamId: 't1',
  seasonYear: 2024,
  ratings: flat(5),
  condition: 100,
  developmentLevel: flat(0),
  ...overrides,
});

const makeProject = (overrides: Partial<DevelopmentProject> = {}): DevelopmentProject => ({
  id: 'test-proj',
  name: 'Test Project',
  category: 'Engine',
  horizon: 'CurrentSeason',
  cost: 1_000_000,
  durationRaces: 3,
  progressRaces: 0,
  successChance: 0.7,
  currentSeasonEffects: { enginePower: 1 },
  carryoverRate: 0.4,
  regulationSensitivity: 0.5,
  riskLevel: 'Standard',
  projectSize: 'Medium',
  facilityLevelAtStart: 3,
  ...overrides,
});

describe('developmentSlots — facility-based slot count', () => {
  it('returns 1 when facilities are undefined', () => {
    expect(developmentSlots(undefined)).toBe(1);
  });

  it('returns at least 1 for low-level facilities', () => {
    const fs = createInitialFacilities('t-test', 0);
    expect(developmentSlots(fs)).toBeGreaterThanOrEqual(1);
  });

  it('returns more slots for higher-level facilities', () => {
    const low = createInitialFacilities('t-low', 0);
    const high = createInitialFacilities('t-high', 90);
    expect(developmentSlots(high)).toBeGreaterThanOrEqual(developmentSlots(low));
  });
});

describe('relevantFacilityLevel — category-specific facility level', () => {
  it('returns 1 when facilities are undefined', () => {
    expect(relevantFacilityLevel(undefined, 'Engine')).toBe(1);
  });

  it('returns a value between 1 and 5 for valid facilities', () => {
    const fs = createInitialFacilities('t-test', 50);
    const level = relevantFacilityLevel(fs, 'Aero');
    expect(level).toBeGreaterThanOrEqual(1);
    expect(level).toBeLessThanOrEqual(5);
  });
});

describe('facilityTimeMultiplier — higher facilities reduce project time', () => {
  it('is monotonically decreasing with facility level', () => {
    const l1 = facilityTimeMultiplier(1);
    const l3 = facilityTimeMultiplier(3);
    const l5 = facilityTimeMultiplier(5);
    expect(l1).toBeGreaterThan(l3);
    expect(l3).toBeGreaterThan(l5);
  });

  it('returns 1.0 at level 3 (neutral)', () => {
    expect(facilityTimeMultiplier(3)).toBe(1.0);
  });
});

describe('facilityImpactMultiplier — higher facilities amplify gains', () => {
  it('is monotonically increasing with facility level', () => {
    const l1 = facilityImpactMultiplier(1);
    const l3 = facilityImpactMultiplier(3);
    const l5 = facilityImpactMultiplier(5);
    expect(l1).toBeLessThan(l3);
    expect(l3).toBeLessThan(l5);
  });

  it('returns 1.0 at level 3 (neutral)', () => {
    expect(facilityImpactMultiplier(3)).toBe(1.0);
  });
});

describe('facilityOutcomeChances — probability distribution', () => {
  it('produces probabilities that sum to approximately 1.0', () => {
    const chances = facilityOutcomeChances(3, 'Standard');
    const total = Object.values(chances).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1.0, 5);
  });

  it('higher facility levels shift probability toward success outcomes', () => {
    const low = facilityOutcomeChances(1, 'Standard');
    const high = facilityOutcomeChances(5, 'Standard');
    expect(high.GreatSuccess + high.FullSuccess).toBeGreaterThan(
      low.GreatSuccess + low.FullSuccess,
    );
  });

  it('riskier projects have more variance (higher great success and failure)', () => {
    const safe = facilityOutcomeChances(3, 'Safe');
    const experimental = facilityOutcomeChances(3, 'Experimental');
    expect(experimental.GreatSuccess).toBeGreaterThan(safe.GreatSuccess);
    expect(experimental.Failed + experimental.RareBackfire).toBeGreaterThan(
      safe.Failed + safe.RareBackfire,
    );
  });

  it('staff bonus shifts probability toward success', () => {
    const noBonus = facilityOutcomeChances(3, 'Standard', 0);
    const withBonus = facilityOutcomeChances(3, 'Standard', 0.15);
    expect(withBonus.GreatSuccess + withBonus.FullSuccess).toBeGreaterThan(
      noBonus.GreatSuccess + noBonus.FullSuccess,
    );
  });
});

describe('rollOutcome — deterministic seeded outcome', () => {
  it('produces a valid outcome from the chance table', () => {
    const rng = createSeededRandom('test-seed');
    const chances = facilityOutcomeChances(3, 'Standard');
    const outcome = rollOutcome(rng, chances);
    expect(['GreatSuccess', 'FullSuccess', 'PartialSuccess', 'MinorSuccess', 'Failed', 'RareBackfire']).toContain(outcome);
  });

  it('is deterministic with the same seed', () => {
    const chances = facilityOutcomeChances(3, 'Standard');
    const r1 = createSeededRandom('deterministic');
    const r2 = createSeededRandom('deterministic');
    expect(rollOutcome(r1, chances)).toBe(rollOutcome(r2, chances));
  });
});

describe('OUTCOME_GAIN_MULTIPLIERS — outcome to gain scaling', () => {
  it('GreatSuccess gives more than FullSuccess', () => {
    expect(OUTCOME_GAIN_MULTIPLIERS.GreatSuccess).toBeGreaterThan(OUTCOME_GAIN_MULTIPLIERS.FullSuccess);
  });

  it('Failed gives zero gain', () => {
    expect(OUTCOME_GAIN_MULTIPLIERS.Failed).toBe(0);
  });

  it('RareBackfire gives negative gain', () => {
    expect(OUTCOME_GAIN_MULTIPLIERS.RareBackfire).toBeLessThan(0);
  });
});

describe('PROJECT_SIZE_MODS — size modifiers', () => {
  it('larger projects have higher gain scale', () => {
    expect(PROJECT_SIZE_MODS.Major.gainScale).toBeGreaterThan(PROJECT_SIZE_MODS.Medium.gainScale);
    expect(PROJECT_SIZE_MODS.Experimental.gainScale).toBeGreaterThan(PROJECT_SIZE_MODS.Major.gainScale);
  });

  it('larger projects take more time', () => {
    expect(PROJECT_SIZE_MODS.Major.timeScale).toBeGreaterThan(PROJECT_SIZE_MODS.Medium.timeScale);
  });
});

describe('computeAdjustedDuration — facility, size, and rush effects', () => {
  it('higher facility level reduces duration', () => {
    const low = computeAdjustedDuration(4, 1, 'Medium');
    const high = computeAdjustedDuration(4, 5, 'Medium');
    expect(high).toBeLessThan(low);
  });

  it('larger projects take longer', () => {
    const small = computeAdjustedDuration(4, 3, 'Small');
    const major = computeAdjustedDuration(4, 3, 'Major');
    expect(major).toBeGreaterThan(small);
  });

  it('rushing reduces duration', () => {
    const normal = computeAdjustedDuration(4, 3, 'Medium', false);
    const rushed = computeAdjustedDuration(4, 3, 'Medium', true);
    expect(rushed).toBeLessThan(normal);
  });

  it('never returns less than 1', () => {
    expect(computeAdjustedDuration(1, 5, 'Small', true)).toBeGreaterThanOrEqual(1);
  });
});

describe('RUSH_COST_MULTIPLIER', () => {
  it('returns 1.5', () => {
    expect(RUSH_COST_MULTIPLIER()).toBe(1.5);
  });
});

describe('OUTCOME_LABELS — all outcomes have labels', () => {
  it('has a label for every outcome', () => {
    const outcomes = ['GreatSuccess', 'FullSuccess', 'PartialSuccess', 'MinorSuccess', 'Failed', 'RareBackfire'] as const;
    for (const o of outcomes) {
      expect(OUTCOME_LABELS[o]).toBeTruthy();
    }
  });
});

describe('aiFacilityLevel — org ratings to facility level', () => {
  it('returns 1 for very low ratings', () => {
    expect(aiFacilityLevel(10, 10)).toBe(1);
  });

  it('returns 5 for very high ratings', () => {
    expect(aiFacilityLevel(95, 95)).toBe(5);
  });

  it('returns a value between 1 and 5', () => {
    expect(aiFacilityLevel(50, 50)).toBeGreaterThanOrEqual(1);
    expect(aiFacilityLevel(50, 50)).toBeLessThanOrEqual(5);
  });
});

describe('CATEGORY_FACILITY_MAP — every category has facility mappings', () => {
  it('maps every DevelopmentCategory', () => {
    const categories = ['Engine', 'Aero', 'Mechanical', 'Reliability', 'PitCrew', 'Strategy', 'Driver', 'Facilities', 'Research'];
    for (const cat of categories) {
      expect(CATEGORY_FACILITY_MAP[cat as keyof typeof CATEGORY_FACILITY_MAP]).toBeDefined();
      expect(CATEGORY_FACILITY_MAP[cat as keyof typeof CATEGORY_FACILITY_MAP].length).toBeGreaterThan(0);
    }
  });
});

describe('applyDevelopmentProgress — outcome-based resolution', () => {
  it('progresses incomplete projects without resolving them', () => {
    const project = makeProject({ progressRaces: 0, durationRaces: 3, adjustedDurationRaces: 3 });
    const result = applyDevelopmentProgress([project], makeCar(), 'seed', 1);
    expect(result.active).toHaveLength(1);
    expect(result.active[0].progressRaces).toBe(1);
    expect(result.completed).toHaveLength(0);
  });

  it('resolves completed projects with an outcome result', () => {
    const project = makeProject({ progressRaces: 2, durationRaces: 3, adjustedDurationRaces: 3 });
    const result = applyDevelopmentProgress([project], makeCar(), 'seed', 1);
    expect(result.active).toHaveLength(0);
    expect(result.completed).toHaveLength(1);
    expect(result.completed[0].outcomeResult).toBeDefined();
    expect(result.completed[0].outcomeResult!.outcome).toBeDefined();
  });

  it('applies car rating deltas for successful outcomes', () => {
    const project = makeProject({ progressRaces: 2, durationRaces: 3, adjustedDurationRaces: 3, currentSeasonEffects: { enginePower: 1 } });
    const result = applyDevelopmentProgress([project], makeCar(), 'seed', 1);
    // The delta should be non-zero for any outcome except Failed
    if (result.completed[0].outcomeResult!.outcome !== 'Failed') {
      expect(Object.keys(result.carRatingDeltas).length).toBeGreaterThan(0);
    }
  });

  it('generates descriptive messages', () => {
    const project = makeProject({ progressRaces: 2, durationRaces: 3, adjustedDurationRaces: 3 });
    const result = applyDevelopmentProgress([project], makeCar(), 'seed', 1);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toContain('Test Project');
  });

  it('uses adjustedDurationRaces when set', () => {
    const project = makeProject({ progressRaces: 1, durationRaces: 6, adjustedDurationRaces: 2 });
    const result = applyDevelopmentProgress([project], makeCar(), 'seed', 1);
    expect(result.active).toHaveLength(0);
    expect(result.completed).toHaveLength(1);
  });
});
