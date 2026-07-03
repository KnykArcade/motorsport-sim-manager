import { describe, it, expect } from 'vitest';

import { cars1995 } from '../data/cars/cars1995';
import { tracks1995 } from '../data/tracks/tracks1995';
import { autoSetupOptionsForTrack } from './autoSetup';
import { createSeededRandom } from './random';
import { operationsForm, strategyExecution } from './raceEngine';
import { calculateReliabilityRisk, operationsRiskMultiplier } from './reliabilityEngine';
import { pitStopLoss } from './pitStrategyEngine';
import { calculatePitStopPerformance } from './pitStopEngine';
import { raceStrategiesById } from '../data/decisions/raceStrategies';

const TRACK = tracks1995[0];
const CAR = cars1995[0];
const SETUP = Object.values(autoSetupOptionsForTrack(TRACK))[0];
const STRATEGY = raceStrategiesById[Object.keys(raceStrategiesById)[0]];

describe('race operations wiring — variance-centered', () => {
  it('is neutral at the default (unknown race-ops) so old saves are unaffected', () => {
    // opsForm 0 => no reliability multiplier, no pit-loss shift, no strategy delta.
    expect(operationsRiskMultiplier(0)).toBe(1);
    expect(pitStopLoss(CAR, false, 0, 0)).toBe(pitStopLoss(CAR, false, 0));
    const strat = strategyExecution(0, createSeededRandom('x'));
    expect(strat.delta).toBe(0);
    expect(strat.note).toBeUndefined();
  });

  it('operationsForm is zero-mean and weaker race-ops swings more', () => {
    const sample = (raceOps: number) => {
      const vals: number[] = [];
      for (let i = 0; i < 4000; i++) vals.push(operationsForm(`s${i}`, 't', `d${i}`, raceOps));
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
      return { mean, std: Math.sqrt(variance) };
    };
    const strong = sample(9); // top team
    const weak = sample(3); // backmarker
    // Zero-mean (both), within sampling tolerance.
    expect(Math.abs(strong.mean)).toBeLessThan(0.03);
    expect(Math.abs(weak.mean)).toBeLessThan(0.03);
    // Weaker operations are less consistent — they swing more.
    expect(weak.std).toBeGreaterThan(strong.std * 1.3);
  });

  it('a sharp operations day trims the reliability risk; a scrappy one raises it', () => {
    const neutral = calculateReliabilityRisk(CAR, TRACK, SETUP, 0, 0);
    const sharp = calculateReliabilityRisk(CAR, TRACK, SETUP, 0, 0.3);
    const scrappy = calculateReliabilityRisk(CAR, TRACK, SETUP, 0, -0.3);
    expect(sharp).toBeLessThan(neutral);
    expect(scrappy).toBeGreaterThan(neutral);
    // Symmetric around neutral (before clamping): a good day helps as much as a
    // bad day hurts.
    expect(sharp + scrappy).toBeCloseTo(2 * neutral, 5);
  });

  it('a sharp operations day gains pit time on average; a scrappy one loses it', () => {
    const meanScore = (opsForm: number) => {
      let sum = 0;
      const n = 3000;
      for (let i = 0; i < n; i++) {
        sum += calculatePitStopPerformance(CAR, STRATEGY, createSeededRandom(`p${i}`), opsForm).scoreDelta;
      }
      return sum / n;
    };
    expect(meanScore(0.3)).toBeGreaterThan(meanScore(0));
    expect(meanScore(-0.3)).toBeLessThan(meanScore(0));
  });

  it('a sharp operations day trims pit-stop time loss (and the reverse)', () => {
    expect(pitStopLoss(CAR, false, 0, 0.3)).toBeLessThan(pitStopLoss(CAR, false, 0, 0));
    expect(pitStopLoss(CAR, false, 0, -0.3)).toBeGreaterThan(pitStopLoss(CAR, false, 0, 0));
  });
});
