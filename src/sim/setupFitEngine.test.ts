import { describe, it, expect } from 'vitest';

import { tracks1995, drivers1995 } from '../data';
import { idealSetup, calculateSetupFit, generateSetupFeedback } from './setupFitEngine';
import { deriveSetupOption } from './setupDerive';
import { BALANCED_SETUP } from '../data/setup/setupComponents';

const track = tracks1995[0];
const driver = drivers1995[0];

describe('setupFitEngine', () => {
  it('rewards the ideal setup with high confidence and penalises a far-off one', () => {
    const ideal = idealSetup(track, driver);
    const good = calculateSetupFit(ideal, track, driver);

    // Push every parameter to the opposite extreme of the ideal.
    const bad = calculateSetupFit(
      {
        ...ideal,
        frontWing: 11 - ideal.frontWing,
        rearWing: 11 - ideal.rearWing,
        gearing: 11 - ideal.gearing,
        engineCooling: 11 - ideal.engineCooling,
        tyreUsage: 11 - ideal.tyreUsage,
        differential: 11 - ideal.differential,
      },
      track,
      driver,
    );

    expect(good.confidence).toBeGreaterThan(bad.confidence);
    expect(good.overall).toBeGreaterThan(bad.overall);
  });

  it('is deterministic for the same inputs', () => {
    const a = calculateSetupFit(BALANCED_SETUP, track, driver);
    const b = calculateSetupFit(BALANCED_SETUP, track, driver);
    expect(a).toEqual(b);
  });

  it('clamps component fit and confidence to 0-100', () => {
    const fit = calculateSetupFit(BALANCED_SETUP, track, driver);
    expect(fit.confidence).toBeGreaterThanOrEqual(0);
    expect(fit.confidence).toBeLessThanOrEqual(100);
    for (const c of fit.components) {
      expect(c.fit).toBeGreaterThanOrEqual(0);
      expect(c.fit).toBeLessThanOrEqual(100);
    }
  });

  it('warns about an extreme tyre-usage / cooling choice', () => {
    const feedback = generateSetupFeedback(
      { ...BALANCED_SETUP, tyreUsage: 10, engineCooling: 1 },
      track,
      driver,
    );
    expect(feedback.warnings.length).toBeGreaterThan(0);
    expect(feedback.driverFeedback.length).toBeGreaterThan(0);
  });
});

describe('setupDerive', () => {
  it('produces distinct qualifying and race trims from one base setup', () => {
    const ideal = idealSetup(track, driver);
    const quali = deriveSetupOption(ideal, track, driver, 'qualifying');
    const race = deriveSetupOption(ideal, track, driver, 'race');

    expect(quali.qualifyingBoost).toBeGreaterThan(race.qualifyingBoost);
    expect(race.tirePreservation).toBeGreaterThan(quali.tirePreservation);
    expect(quali.id).not.toEqual(race.id);
  });

  it('keeps all derived axes within the valid 1-10 / risk range', () => {
    const opt = deriveSetupOption(BALANCED_SETUP, track, driver, 'race');
    for (const axis of [
      opt.downforce, opt.topSpeed, opt.mechanicalGrip, opt.brakingStability,
      opt.tirePreservation, opt.reliabilityProtection,
    ]) {
      expect(axis).toBeGreaterThanOrEqual(1);
      expect(axis).toBeLessThanOrEqual(10);
    }
    expect(opt.riskModifier).toBeGreaterThanOrEqual(-3);
    expect(opt.riskModifier).toBeLessThanOrEqual(5);
  });
});
