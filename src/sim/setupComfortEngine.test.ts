import { describe, it, expect } from 'vitest';

import { tracks1995 } from '../data/tracks/tracks1995';
import { drivers1995 } from '../data/drivers/drivers1995';
import { cars1995 } from '../data/cars/cars1995';
import { BALANCED_SETUP } from '../data/setup/setupComponents';
import { qualifyingRunPlansById } from '../data/decisions/qualifyingRunPlans';
import type { Car, Driver } from '../types/gameTypes';
import type { CarSetup, DriverComfort, ObjectiveSetupQuality } from '../types/setupTypes';
import { adjustedSetupTolerance, idealSetup, objectiveSetupQuality } from './setupFitEngine';
import {
  driverSetupComfort,
  inferSetupPreferences,
  setupChangeDelta,
} from './driverComfortEngine';
import { deriveSetupOption } from './setupDerive';
import { calculateQualifyingPace } from './qualifyingEngine';
import {
  canRevealComponentFit,
  reliabilityWarningConfidence,
  setupQualityEstimate,
  stintWindowEstimate,
} from './setupUncertaintyEngine';

const track = tracks1995[0];
const baseDriver = drivers1995[0];
const car = cars1995[0];

function rangeWidth(e: { low: number; high: number }): number {
  return e.high - e.low;
}

// Build a driver with overridden ratings for preference/adaptability tests.
function driverWith(overrides: Partial<Driver['ratings']>): Driver {
  return { ...baseDriver, id: `test-${JSON.stringify(overrides)}`, ratings: { ...baseDriver.ratings, ...overrides } };
}

function carWith(overrides: Partial<Car['ratings']>): Car {
  return { ...car, ratings: { ...car.ratings, ...overrides } };
}

// Minimal ObjectiveSetupQuality / DriverComfort factories for isolating the
// performance-formula behaviour in deriveSetupOption.
function q(quality: number): ObjectiveSetupQuality {
  return {
    quality,
    components: [],
    effects: { qualifyingPaceCeiling: 0, racePaceCeiling: 0, tyreWear: 0, reliabilityRisk: 0, overheatingRisk: 0 },
    warnings: [],
  };
}
function cm(comfort: number): DriverComfort {
  const cf = (comfort - 60) / 20;
  return {
    comfort,
    label: 'Workable',
    familiarity: 0.5,
    relevance: 1,
    changeDelta: 0,
    stale: false,
    effects: {
      execution: cf * 0.6,
      consistency: cf * 0.5,
      mistakeRisk: Math.max(0, 60 - comfort) / 40,
      lockupSpinRisk: 0,
      tyreManagement: 0,
    },
    notes: [],
  };
}

describe('Objective Setup Quality — track + car aware', () => {
  it('is affected by track demands: the same setup scores differently per track', () => {
    const qualities = tracks1995.slice(0, 6).map((t) => objectiveSetupQuality(BALANCED_SETUP, t, car).quality);
    const spread = Math.max(...qualities) - Math.min(...qualities);
    expect(spread).toBeGreaterThan(0);
  });

  it('is affected by car ratings: a high-aero car has a lower ideal wing than a low-aero car', () => {
    const highAero = idealSetup(track, undefined, carWith({ aeroEfficiency: 90 }));
    const lowAero = idealSetup(track, undefined, carWith({ aeroEfficiency: 20 }));
    expect(highAero.rearWing).toBeLessThan(lowAero.rearWing);
  });

  it('shifts the ideal toward more cooling for a fragile car', () => {
    const fragile = idealSetup(track, undefined, carWith({ reliability: 20 }));
    const bulletproof = idealSetup(track, undefined, carWith({ reliability: 90 }));
    expect(fragile.engineCooling).toBeGreaterThan(bulletproof.engineCooling);
  });

  it('punishes tight cooling on a fragile car harder than on a reliable car', () => {
    const tight: CarSetup = { ...BALANCED_SETUP, engineCooling: 1 };
    const fragileRisk = objectiveSetupQuality(tight, track, carWith({ reliability: 20 })).effects.reliabilityRisk;
    const reliableRisk = objectiveSetupQuality(tight, track, carWith({ reliability: 90 })).effects.reliabilityRisk;
    expect(fragileRisk).toBeGreaterThan(reliableRisk);
  });

  it('is deterministic', () => {
    expect(objectiveSetupQuality(BALANCED_SETUP, track, car)).toEqual(
      objectiveSetupQuality(BALANCED_SETUP, track, car),
    );
  });
});

describe('Driver Setup Comfort — practice + adaptability', () => {
  const practiced = idealSetup(track, undefined, car);

  it('rises with practice laps run on the setup family', () => {
    const few = driverSetupComfort({ driver: baseDriver, currentSetup: practiced, practicedSetup: practiced, practiceLaps: 2, setupKnowledge: 0.2 });
    const many = driverSetupComfort({ driver: baseDriver, currentSetup: practiced, practicedSetup: practiced, practiceLaps: 22, setupKnowledge: 0.8 });
    expect(many.comfort).toBeGreaterThan(few.comfort);
    expect(many.familiarity).toBeGreaterThan(few.familiarity);
  });

  it('is higher for a more adaptable driver, all else equal', () => {
    const adaptable = driverWith({ adaptability: 95 });
    const rigid = driverWith({ adaptability: 10 });
    const cA = driverSetupComfort({ driver: adaptable, currentSetup: practiced, practicedSetup: practiced, practiceLaps: 10 });
    const cR = driverSetupComfort({ driver: rigid, currentSetup: practiced, practicedSetup: practiced, practiceLaps: 10 });
    expect(cA.comfort).toBeGreaterThan(cR.comfort);
  });

  it('reports Unknown comfort before any practice', () => {
    const c = driverSetupComfort({ driver: baseDriver, currentSetup: practiced });
    expect(c.label).toBe('Unknown');
    expect(c.familiarity).toBe(0);
  });
});

describe('Practiced snapshot / familiarity', () => {
  const practiced: CarSetup = {
    frontWing: 7, rearWing: 7, suspensionStiffness: 6, rideHeight: 6, gearing: 6,
    brakeBias: 5, brakeCooling: 7, differential: 6, engineCooling: 6, tyreUsage: 6,
  };
  // A wholesale move to the opposite end of the range — a genuinely large change.
  const bigChange: CarSetup = {
    frontWing: 1, rearWing: 1, suspensionStiffness: 1, rideHeight: 1, gearing: 1,
    brakeBias: 5, brakeCooling: 1, differential: 1, engineCooling: 1, tyreUsage: 1,
  };
  const smallChange: CarSetup = { ...practiced, brakeCooling: 8 };

  it('a setup change after practice reduces familiarity', () => {
    const same = driverSetupComfort({ driver: baseDriver, currentSetup: practiced, practicedSetup: practiced, practiceLaps: 20 });
    const changed = driverSetupComfort({ driver: baseDriver, currentSetup: bigChange, practicedSetup: practiced, practiceLaps: 20 });
    expect(changed.familiarity).toBeLessThan(same.familiarity);
    expect(changed.comfort).toBeLessThan(same.comfort);
  });

  it('a large setup change makes feedback stale', () => {
    const changed = driverSetupComfort({ driver: baseDriver, currentSetup: bigChange, practicedSetup: practiced, practiceLaps: 20 });
    expect(changed.stale).toBe(true);
    expect(changed.notes.some((n) => /major setup change/i.test(n))).toBe(true);
  });

  it('a small setup change preserves most familiarity and is not stale', () => {
    const same = driverSetupComfort({ driver: baseDriver, currentSetup: practiced, practicedSetup: practiced, practiceLaps: 20 });
    const small = driverSetupComfort({ driver: baseDriver, currentSetup: smallChange, practicedSetup: practiced, practiceLaps: 20 });
    expect(small.stale).toBe(false);
    expect(small.familiarity).toBeGreaterThan(same.familiarity * 0.8);
  });

  it('setupChangeDelta grows with the size of the change', () => {
    expect(setupChangeDelta(practiced, smallChange)).toBeLessThan(setupChangeDelta(practiced, bigChange));
    expect(setupChangeDelta(practiced, practiced)).toBe(0);
  });
});

describe('Practice knowledge controls certainty', () => {
  it('narrows the setup quality estimate range as knowledge rises', () => {
    const wide = setupQualityEstimate(80, 0);
    const medium = setupQualityEstimate(80, 0.6);
    const exact = setupQualityEstimate(80, 0.99);
    expect(rangeWidth(wide)).toBeGreaterThan(rangeWidth(medium));
    expect(exact.exact).toBe(80);
  });

  it('hides exact setup fit at low knowledge and reveals it at high knowledge', () => {
    expect(canRevealComponentFit(0.2)).toBe(false);
    expect(canRevealComponentFit(0.9)).toBe(true);
    expect(setupQualityEstimate(80, 0.2).exact).toBeUndefined();
    expect(setupQualityEstimate(80, 0.95).exact).toBeUndefined();
    expect(setupQualityEstimate(80, 0.99).exact).toBe(80);
  });

  it('makes setup tolerance harder with poor prep and easier with stronger ops/practice', () => {
    const poorPrep = adjustedSetupTolerance(2.2, 3, 0, 0);
    const strongPrep = adjustedSetupTolerance(2.2, 8, 6, 0.9);
    expect(strongPrep).toBeGreaterThan(poorPrep);
  });

  it('tyre knowledge tightens the predicted stint (pit) window', () => {
    const low = stintWindowEstimate(24, 0.1);
    const high = stintWindowEstimate(24, 0.9);
    expect(rangeWidth(high)).toBeLessThan(rangeWidth(low));
  });

  it('reliability knowledge raises reliability warning confidence', () => {
    expect(reliabilityWarningConfidence(0.1)).toBe('Low');
    expect(reliabilityWarningConfidence(0.5)).toBe('Medium');
    expect(reliabilityWarningConfidence(0.9)).toBe('High');
  });
});

describe('Driver setup preferences', () => {
  const aggressive = driverWith({ aggression: 95, enduranceConsistency: 30 });
  const steady = driverWith({ aggression: 10, enduranceConsistency: 95 });
  const sharpSetup: CarSetup = { ...BALANCED_SETUP, frontWing: 10, differential: 10, suspensionStiffness: 9 };
  const stableSetup: CarSetup = { ...BALANCED_SETUP, frontWing: 1, differential: 1, suspensionStiffness: 1, tyreUsage: 1 };

  it('infers a sharper front-end / aggressive-diff lean for aggressive drivers', () => {
    const p = inferSetupPreferences(aggressive);
    expect(p.prefersAggressiveDiff).toBeGreaterThan(0);
    expect(p.prefersSharpFrontEnd).toBeGreaterThan(0);
  });

  it('a driver preference makes a less-ideal setup more comfortable', () => {
    // The aggressive driver is more comfortable on the sharp setup than on the
    // stable one, even though the stable one may be objectively closer to ideal.
    const onSharp = driverSetupComfort({ driver: aggressive, currentSetup: sharpSetup, practicedSetup: sharpSetup, practiceLaps: 12 });
    const onStable = driverSetupComfort({ driver: aggressive, currentSetup: stableSetup, practicedSetup: stableSetup, practiceLaps: 12 });
    expect(onSharp.comfort).toBeGreaterThan(onStable.comfort);
  });

  it('two drivers on the same team can prefer different setups', () => {
    const aggroSharp = driverSetupComfort({ driver: aggressive, currentSetup: sharpSetup, practicedSetup: sharpSetup, practiceLaps: 12 }).comfort;
    const aggroStable = driverSetupComfort({ driver: aggressive, currentSetup: stableSetup, practicedSetup: stableSetup, practiceLaps: 12 }).comfort;
    const steadySharp = driverSetupComfort({ driver: steady, currentSetup: sharpSetup, practicedSetup: sharpSetup, practiceLaps: 12 }).comfort;
    const steadyStable = driverSetupComfort({ driver: steady, currentSetup: stableSetup, practicedSetup: stableSetup, practiceLaps: 12 }).comfort;
    // The aggressive driver leans to the sharp setup; the steady driver to the
    // stable one — the preferred setup differs between teammates.
    expect(aggroSharp - aggroStable).toBeGreaterThan(steadySharp - steadyStable);
  });
});

describe('Performance formula — quality + comfort, bounded', () => {
  it('qualifying trim uses objective quality: higher quality => more qualifying pace', () => {
    const good = deriveSetupOption(BALANCED_SETUP, track, baseDriver, 'qualifying', { quality: q(88), comfort: cm(60) });
    const poor = deriveSetupOption(BALANCED_SETUP, track, baseDriver, 'qualifying', { quality: q(45), comfort: cm(60) });
    expect(good.qualifyingBoost).toBeGreaterThan(poor.qualifyingBoost);
  });

  it('qualifying execution uses comfort: lower comfort => more risk, less boost', () => {
    const comfy = deriveSetupOption(BALANCED_SETUP, track, baseDriver, 'qualifying', { quality: q(75), comfort: cm(90) });
    const uneasy = deriveSetupOption(BALANCED_SETUP, track, baseDriver, 'qualifying', { quality: q(75), comfort: cm(30) });
    expect(comfy.qualifyingBoost).toBeGreaterThanOrEqual(uneasy.qualifyingBoost);
    expect(uneasy.riskModifier).toBeGreaterThan(comfy.riskModifier);
  });

  it('race trim uses objective quality and race comfort', () => {
    const good = deriveSetupOption(BALANCED_SETUP, track, baseDriver, 'race', { quality: q(88), comfort: cm(85) });
    const poor = deriveSetupOption(BALANCED_SETUP, track, baseDriver, 'race', { quality: q(45), comfort: cm(35) });
    expect(good.racePaceBoost).toBeGreaterThan(poor.racePaceBoost);
    expect(poor.riskModifier).toBeGreaterThan(good.riskModifier);
  });

  it('a driver can be faster in a slightly worse setup they are comfortable in', () => {
    const comfyWorse = deriveSetupOption(BALANCED_SETUP, track, baseDriver, 'race', { quality: q(70), comfort: cm(90) });
    const idealUneasy = deriveSetupOption(BALANCED_SETUP, track, baseDriver, 'race', { quality: q(76), comfort: cm(35) });
    expect(comfyWorse.racePaceBoost).toBeGreaterThanOrEqual(idealUneasy.racePaceBoost);
  });

  it('setup does not overpower car ratings in qualifying pace', () => {
    const plan = qualifyingRunPlansById['StandardPush'];
    const great = deriveSetupOption(BALANCED_SETUP, track, baseDriver, 'qualifying', { quality: q(95), comfort: cm(95) });
    const awful = deriveSetupOption(BALANCED_SETUP, track, baseDriver, 'qualifying', { quality: q(25), comfort: cm(25) });
    const setupSwing =
      calculateQualifyingPace(baseDriver, car, track, great, plan).score -
      calculateQualifyingPace(baseDriver, car, track, awful, plan).score;
    // A +3 across-the-board car upgrade with a fixed (great) setup.
    const strongCar = carWith({
      enginePower: Math.min(100, car.ratings.enginePower + 30),
      aeroEfficiency: Math.min(100, car.ratings.aeroEfficiency + 30),
      mechanicalGrip: Math.min(100, car.ratings.mechanicalGrip + 30),
    });
    const weakCar = carWith({
      enginePower: Math.max(1, car.ratings.enginePower - 30),
      aeroEfficiency: Math.max(1, car.ratings.aeroEfficiency - 30),
      mechanicalGrip: Math.max(1, car.ratings.mechanicalGrip - 30),
    });
    const carSwing =
      calculateQualifyingPace(baseDriver, strongCar, track, great, plan).score -
      calculateQualifyingPace(baseDriver, weakCar, track, great, plan).score;
    expect(carSwing).toBeGreaterThan(setupSwing);
  });
});
