import { describe, it, expect } from 'vitest';

import {
  clampSetupValue,
  formatSetupRange,
  formatSetupScore,
  isValidSetupValue,
  safeAverage,
  safeScore,
  sanitizeSetupProfile,
  sanitizeSetupValue,
} from './setupSanitize';
import { objectiveSetupQuality } from './setupFitEngine';
import { setupQualityEstimate } from './setupUncertaintyEngine';
import { driverSetupComfort } from './driverComfortEngine';
import { tracks1995, drivers1995 } from '../data';
import { BALANCED_SETUP } from '../data/setup/setupComponents';
import type { CarSetup } from '../types/setupTypes';

const track = tracks1995[0];
const driver = drivers1995[0];

describe('numeric guards', () => {
  it('isValidSetupValue rejects NaN / Infinity / non-numbers', () => {
    expect(isValidSetupValue(5)).toBe(true);
    expect(isValidSetupValue(NaN)).toBe(false);
    expect(isValidSetupValue(Infinity)).toBe(false);
    expect(isValidSetupValue(undefined)).toBe(false);
    expect(isValidSetupValue('5')).toBe(false);
  });

  it('clampSetupValue clamps to 1-10 and rounds', () => {
    expect(clampSetupValue(0)).toBe(1);
    expect(clampSetupValue(99)).toBe(10);
    expect(clampSetupValue(5.6)).toBe(6);
  });

  it('sanitizeSetupValue falls back for invalid values', () => {
    expect(sanitizeSetupValue(7, 5)).toBe(7);
    expect(sanitizeSetupValue(undefined, 5)).toBe(5);
    expect(sanitizeSetupValue(NaN, 3)).toBe(3);
  });

  it('safeAverage returns the fallback for an empty / all-invalid array', () => {
    expect(safeAverage([2, 4])).toBe(3);
    expect(safeAverage([], 9)).toBe(9);
    expect(safeAverage([NaN, Infinity], 1)).toBe(1);
  });

  it('safeScore returns the fallback for invalid values', () => {
    expect(safeScore(42)).toBe(42);
    expect(safeScore(NaN, 7)).toBe(7);
  });

  it('formatSetupScore never renders NaN', () => {
    expect(formatSetupScore(67)).toBe('67');
    expect(formatSetupScore(NaN)).toBe('Estimating');
    expect(formatSetupScore(undefined, 'Unknown')).toBe('Unknown');
  });

  it('formatSetupRange never renders NaN-NaN', () => {
    expect(formatSetupRange(60, 80)).toBe('60–80');
    expect(formatSetupRange(70, 70)).toBe('70'); // collapses equal bounds
    expect(formatSetupRange(NaN, NaN)).toBe('Estimating');
    expect(formatSetupRange(undefined, 80)).toBe('80');
  });
});

describe('sanitizeSetupProfile', () => {
  it('fills every missing field from the balanced fallback', () => {
    const partial = { frontWing: 8 } as Partial<CarSetup>;
    const sane = sanitizeSetupProfile(partial);
    // The changed field is kept; every other field is a valid number.
    expect(sane.frontWing).toBe(8);
    for (const key of Object.keys(BALANCED_SETUP) as (keyof CarSetup)[]) {
      expect(isValidSetupValue(sane[key])).toBe(true);
    }
    expect(sane.rearWing).toBe(BALANCED_SETUP.rearWing);
  });

  it('replaces NaN / undefined fields and clamps out-of-range values', () => {
    const dirty = {
      ...BALANCED_SETUP,
      frontWing: NaN,
      rearWing: undefined as unknown as number,
      gearing: 99,
      brakeBias: 0,
    };
    const sane = sanitizeSetupProfile(dirty);
    expect(sane.frontWing).toBe(BALANCED_SETUP.frontWing);
    expect(sane.rearWing).toBe(BALANCED_SETUP.rearWing);
    expect(sane.gearing).toBe(10);
    expect(sane.brakeBias).toBe(1);
  });

  it('handles null / undefined input', () => {
    expect(sanitizeSetupProfile(null)).toEqual(BALANCED_SETUP);
    expect(sanitizeSetupProfile(undefined)).toEqual(BALANCED_SETUP);
  });
});

describe('NaN prevention against the score engines', () => {
  // Reproduces the original bug: a slider edit spread over an undefined draft
  // produced a partial setup ({ frontWing: 8 }) whose missing fields fed NaN
  // into the score maths. Sanitizing first keeps every score finite.
  it('objectiveSetupQuality stays finite for a sanitized partial setup', () => {
    const partial = { frontWing: 8 } as Partial<CarSetup>;
    const q = objectiveSetupQuality(sanitizeSetupProfile(partial), track);
    expect(Number.isFinite(q.quality)).toBe(true);
    for (const e of Object.values(q.effects)) expect(Number.isFinite(e)).toBe(true);
    for (const c of q.components) expect(Number.isFinite(c.fit)).toBe(true);
    const est = setupQualityEstimate(q.quality, 0);
    expect(formatSetupRange(est.low, est.high)).not.toContain('NaN');
  });

  it('driverSetupComfort stays finite for a sanitized partial setup', () => {
    const partial = { rearWing: 3 } as Partial<CarSetup>;
    const c = driverSetupComfort({
      driver,
      currentSetup: sanitizeSetupProfile(partial),
      practicedSetup: undefined,
      practiceLaps: 0,
      setupKnowledge: 0,
    });
    expect(Number.isFinite(c.comfort)).toBe(true);
    expect(Number.isFinite(c.familiarity)).toBe(true);
    expect(Number.isFinite(c.relevance)).toBe(true);
    for (const e of Object.values(c.effects)) expect(Number.isFinite(e)).toBe(true);
  });

  it('simulated slider edits over a complete setup never introduce NaN', () => {
    // Mimic the fixed onChangeParam: spread over the COMPLETE resolved setup.
    let setup: CarSetup = { ...BALANCED_SETUP };
    const keys = Object.keys(BALANCED_SETUP) as (keyof CarSetup)[];
    for (const key of keys) {
      setup = sanitizeSetupProfile({ ...setup, [key]: 8 });
      const q = objectiveSetupQuality(setup, track);
      expect(Number.isFinite(q.quality)).toBe(true);
    }
    // Every field remains a valid clamped number after all the edits.
    for (const key of keys) expect(isValidSetupValue(setup[key])).toBe(true);
  });
});
