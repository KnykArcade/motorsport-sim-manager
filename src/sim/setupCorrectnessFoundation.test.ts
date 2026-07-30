import { describe, expect, it } from 'vitest';

import { getTrackById, loadSeasonBundle } from '../data';
import { BALANCED_SETUP } from '../data/setup/setupComponents';
import { tracks1995 } from '../data/tracks/tracks1995';
import type { Series, Track } from '../types/gameTypes';
import { autoSetupsForTrack } from './autoSetup';
import {
  assertLegacyRating,
  assertRating100,
  historicalRatingToGameRating,
  toGameRating,
  toLegacyRating,
} from './ratingScale';
import { calculateSetupFit } from './setupEngine';
import {
  idealSetup,
  initialBaselineSetup,
  objectiveSetupQuality,
  setupToleranceForCar,
} from './setupFitEngine';

const representativeSeasons: Array<{ year: number; series: Series }> = [
  { year: 1995, series: 'F1' },
  { year: 1998, series: 'CART' },
  { year: 2011, series: 'IndyCar' },
  { year: 1995, series: 'NASCAR' },
];

describe('setup correctness foundation — rating boundaries', () => {
  it('converts only at explicit 1-10 and 1-100 boundaries', () => {
    expect(toLegacyRating(83)).toBe(8.3);
    expect(toGameRating(8.3)).toBe(83);
    expect(toGameRating(-0.55)).toBe(-5.5);
    expect(historicalRatingToGameRating(8.3)).toBe(83);
    expect(historicalRatingToGameRating(83)).toBe(83);
    expect(assertRating100(1)).toBe(1);
    expect(assertRating100(100)).toBe(100);
    expect(assertLegacyRating(1)).toBe(1);
    expect(assertLegacyRating(10)).toBe(10);
  });

  it('rejects invalid or non-finite rating inputs instead of silently clamping them', () => {
    expect(() => assertRating100(0)).toThrow(/1-100/);
    expect(() => assertRating100(101)).toThrow(/1-100/);
    expect(() => assertRating100(Number.NaN)).toThrow(/finite/);
    expect(() => assertLegacyRating(11)).toThrow(/1-10/);
  });

  it('scores equivalent legacy and canonical track profiles identically', () => {
    const legacyTrack = tracks1995[0];
    const canonicalTrack: Track = {
      ...legacyTrack,
      setupProfile: {
        ...legacyTrack.setupProfile,
        aeroDemand: legacyTrack.setupProfile.aeroDemand * 10,
        powerDemand: legacyTrack.setupProfile.powerDemand * 10,
        mechanicalDemand: legacyTrack.setupProfile.mechanicalDemand * 10,
        brakeDemand: legacyTrack.setupProfile.brakeDemand * 10,
      },
    };
    expect(calculateSetupFit(autoSetupsForTrack(legacyTrack).base, legacyTrack)).toBeCloseTo(
      calculateSetupFit(autoSetupsForTrack(canonicalTrack).base, canonicalTrack),
      10,
    );
  });
});

describe('setup correctness foundation — physical setup window', () => {
  it('makes the same miss more expensive in a narrow-window car', () => {
    const track = tracks1995[0];
    const ideal = idealSetup(track);
    const oneStepMiss = {
      ...ideal,
      frontWing: Math.max(1, ideal.frontWing - 1),
    };
    const narrowTolerance = setupToleranceForCar({ setupWindow: 15 });
    const wideTolerance = setupToleranceForCar({ setupWindow: 85 });
    const narrowQuality = objectiveSetupQuality(oneStepMiss, track, undefined, narrowTolerance).quality;
    const wideQuality = objectiveSetupQuality(oneStepMiss, track, undefined, wideTolerance).quality;
    expect(narrowQuality).toBeLessThan(wideQuality);
  });

  it('uses a neutral backward-compatible setup window when old cars omit the field', () => {
    expect(setupToleranceForCar()).toBe(setupToleranceForCar({ setupWindow: 50 }));
  });
});

describe('setup correctness foundation — production bundle calibration', () => {
  it('keeps every representative runtime bundle canonical and separates setup from pit work', async () => {
    let foundIndependentRatings = false;

    for (const { year, series } of representativeSeasons) {
      const bundle = await loadSeasonBundle(year, series);
      expect(bundle, `${year} ${series} bundle`).toBeDefined();

      for (const team of bundle!.teams) {
        expect(assertRating100(team.raceOperations, `${year} ${series} Race Operations`))
          .toBe(team.raceOperations);
      }

      for (const car of bundle!.cars) {
        expect(car.setupWindow, `${year} ${series} ${car.id} setup window`).toBeDefined();
        expect(assertRating100(car.setupWindow!, `${year} ${series} setup window`))
          .toBe(car.setupWindow);
        for (const [key, rating] of Object.entries(car.ratings)) {
          expect(assertRating100(rating, `${year} ${series} ${key}`)).toBe(rating);
        }
        if (car.setupWindow !== car.ratings.pitCrewOperations) {
          foundIndependentRatings = true;
        }
      }

      for (const race of bundle!.season.calendar.slice(0, 3)) {
        const track = getTrackById(race.trackId);
        expect(track, `${year} ${series} ${race.trackId}`).toBeDefined();
        const baseSetup = autoSetupsForTrack(track!).base;
        const fit = calculateSetupFit(baseSetup, track!);
        expect(fit).toBeGreaterThanOrEqual(-3);
        expect(fit).toBeLessThanOrEqual(3);
      }
    }

    expect(foundIndependentRatings).toBe(true);
  });

  it('keeps a production ideal at 100 and its supplied baseline below the ideal', async () => {
    const bundle = await loadSeasonBundle(1995, 'F1');
    const track = getTrackById(bundle!.season.calendar[0].trackId)!;
    const car = bundle!.cars[0];
    const ideal = idealSetup(track, undefined, car);
    const baseline = initialBaselineSetup(track, car);

    expect(objectiveSetupQuality(ideal, track, car).quality).toBe(100);
    expect(objectiveSetupQuality(baseline, track, car).quality).toBeLessThan(100);
    expect(objectiveSetupQuality(BALANCED_SETUP, track, car).quality).toBeLessThanOrEqual(100);
  });
});
