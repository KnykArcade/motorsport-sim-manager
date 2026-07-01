import { describe, it, expect } from 'vitest';

import type { CarRatings } from '../types/gameTypes';
import {
  applyOffseasonDecay,
  catchUpMultiplier,
  diminishingGainMultiplier,
  nearCapFailureChance,
} from './developmentEngine';

const flat = (v: number): CarRatings => ({
  enginePower: v,
  aeroEfficiency: v,
  mechanicalGrip: v,
  reliability: v,
  pitCrewOperations: v,
});

describe('diminishingGainMultiplier — development gains diminish near the cap', () => {
  it('is largest at low ratings and shrinks monotonically toward the ceiling', () => {
    const low = diminishingGainMultiplier(3);
    const mid = diminishingGainMultiplier(6);
    const high = diminishingGainMultiplier(8);
    const veryHigh = diminishingGainMultiplier(9);
    const nearCap = diminishingGainMultiplier(9.8);
    expect(low).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(high);
    expect(high).toBeGreaterThan(veryHigh);
    expect(veryHigh).toBeGreaterThan(nearCap);
  });

  it('makes a top car improve far more slowly than a midfield car for the same raw gain', () => {
    const rawGain = 0.5;
    const midfieldEffective = rawGain * diminishingGainMultiplier(6);
    const topEffective = rawGain * diminishingGainMultiplier(9.5);
    // A near-cap car should get less than a third of a midfield car's gain.
    expect(topEffective).toBeLessThan(midfieldEffective * 0.35);
  });
});

describe('nearCapFailureChance — high-rated projects fail more often', () => {
  it('is zero below the difficulty bands and rises toward the cap', () => {
    expect(nearCapFailureChance(7)).toBe(0);
    expect(nearCapFailureChance(9)).toBeGreaterThan(0);
    expect(nearCapFailureChance(9.5)).toBeGreaterThan(nearCapFailureChance(9));
  });
});

describe('catchUpMultiplier — midfield catch-up efficiency', () => {
  it('gives no bonus to the front-runner and a bounded bonus to a car behind', () => {
    expect(catchUpMultiplier(0)).toBe(1);
    expect(catchUpMultiplier(2)).toBeGreaterThan(1);
    // A car further back gets more help than one just off the front.
    expect(catchUpMultiplier(3)).toBeGreaterThan(catchUpMultiplier(1));
    // Bounded so the midfield can close but not leapfrog overnight.
    expect(catchUpMultiplier(20)).toBeLessThanOrEqual(1.6);
  });
});

describe('applyOffseasonDecay — ratings do not stay maxed forever', () => {
  it('erodes a maxed car in a stable year (maintenance decay), never below the floor', () => {
    const decayed = applyOffseasonDecay(flat(10), { regulationShakeup: 0 });
    expect(decayed.aeroEfficiency).toBeLessThan(10);
    expect(decayed.aeroEfficiency).toBeGreaterThan(5);
  });

  it('barely touches an average car (only performance above the floor erodes)', () => {
    const decayed = applyOffseasonDecay(flat(5), { regulationShakeup: 0 });
    // A 5.0 car sits at/under the floor, so maintenance decay is negligible.
    expect(decayed.aeroEfficiency).toBeGreaterThanOrEqual(4.9);
  });

  it('a major regulation shakeup resets a strong car far more than a stable year', () => {
    const stable = applyOffseasonDecay(flat(9.5), { regulationShakeup: 0 });
    const major = applyOffseasonDecay(flat(9.5), { regulationShakeup: 1 });
    expect(major.aeroEfficiency).toBeLessThan(stable.aeroEfficiency);
    // The shakeup should bite the strong car by a meaningful margin.
    expect(stable.aeroEfficiency - major.aeroEfficiency).toBeGreaterThan(0.3);
  });

  it('reshuffles the order: a shakeup hits a dominant car harder than a midfield one', () => {
    const topBefore = 9.5;
    const midBefore = 7.0;
    const top = applyOffseasonDecay(flat(topBefore), { regulationShakeup: 1 });
    const mid = applyOffseasonDecay(flat(midBefore), { regulationShakeup: 1 });
    const topLoss = topBefore - top.aeroEfficiency;
    const midLoss = midBefore - mid.aeroEfficiency;
    expect(topLoss).toBeGreaterThan(midLoss);
  });

  it('a team that nails the new regulation concept adapts better than one that misses it', () => {
    const nailed = applyOffseasonDecay(flat(9), { regulationShakeup: 1, regulationAdaptation: 1 });
    const missed = applyOffseasonDecay(flat(9), { regulationShakeup: 1, regulationAdaptation: -1 });
    expect(nailed.aeroEfficiency).toBeGreaterThan(missed.aeroEfficiency);
  });

  it('strong facilities/staff and a healthy budget resist decay', () => {
    const poor = applyOffseasonDecay(flat(9), {
      regulationShakeup: 0.6,
      facilityStaffQuality: 20,
      budgetHealth: 0.1,
    });
    const rich = applyOffseasonDecay(flat(9), {
      regulationShakeup: 0.6,
      facilityStaffQuality: 95,
      budgetHealth: 0.95,
    });
    expect(rich.aeroEfficiency).toBeGreaterThan(poor.aeroEfficiency);
  });
});
