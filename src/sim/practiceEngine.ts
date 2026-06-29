// Practice / setup-confidence summary shown before qualifying.
//
// Setup trim is now chosen automatically as part of professional team
// preparation (a track-appropriate package, run with a low-fuel qualifying
// trim on Saturday and a long-run race trim on Sunday). The player no longer
// picks trim manually; instead practice reports how confident each driver is
// with the prepared car so the player can plan their run/strategy decisions.

import type { Car, Driver, SetupOption, Track } from '../types/gameTypes';
import { createSeededRandom, deriveSeed } from './random';
import { calculateTrackFit } from './trackFitEngine';
import { calculateSetupFit } from './setupEngine';

export type ConfidenceLabel = 'Dialed In' | 'Comfortable' | 'Workable' | 'Struggling';
export type PaceLabel = 'Strong' | 'Competitive' | 'Average' | 'Weak';

export type PracticeDriverSummary = {
  driverId: string;
  setupName: string;
  trackFit: number; // ~[-5, 5]
  setupFit: number; // ~[-3, 3]
  confidence: number; // 0-100
  confidenceLabel: ConfidenceLabel;
  onePLapPace: PaceLabel;
  longRunPace: PaceLabel;
  notes: string[];
};

export type PracticeSummary = {
  trackId: string;
  qualifyingTrimName: string;
  raceTrimName: string;
  drivers: PracticeDriverSummary[];
};

export type PracticeContext = {
  track: Track;
  entrants: { driver: Driver; car: Car }[];
  setup: SetupOption; // auto-selected, track-appropriate package
  seed: string;
};

const FLAVOR = {
  strong: [
    'Quick straight out of the box.',
    'Found a strong balance in the long runs.',
    'Happy with the rear end through the quick stuff.',
  ],
  ok: [
    'Reasonable balance, a few tenths still on the table.',
    'Car is in a workable window.',
    'Fine-tuning the brake balance.',
  ],
  poor: [
    'Struggling for grip over a lap.',
    'Fighting understeer in the slow corners.',
    'Not comfortable with the car yet.',
  ],
};

export function runPractice(context: PracticeContext): PracticeSummary {
  const rng = createSeededRandom(deriveSeed(context.seed, 'practice', context.track.id));
  const setupFit = calculateSetupFit(context.setup, context.track);

  const drivers: PracticeDriverSummary[] = context.entrants.map((e) => {
    const trackFit = calculateTrackFit(e.driver, e.car, context.track);
    const variance = rng.variance(4);

    const confidenceRaw =
      52 +
      trackFit * 4 +
      setupFit * 5 +
      (e.car.condition - 90) * 0.3 +
      (e.driver.confidence - 65) * 0.2 +
      variance;
    const confidence = clamp(Math.round(confidenceRaw), 1, 99);

    const onePLapPace = paceLabel(trackFit + setupFit + variance * 0.2 + 0.5);
    const longRunPace = paceLabel(trackFit + setupFit * 0.6 + variance * 0.2);

    const notes: string[] = [];
    if (confidence >= 72) notes.push(rng.pick(FLAVOR.strong));
    else if (confidence >= 52) notes.push(rng.pick(FLAVOR.ok));
    else notes.push(rng.pick(FLAVOR.poor));

    return {
      driverId: e.driver.id,
      setupName: context.setup.name,
      trackFit,
      setupFit,
      confidence,
      confidenceLabel: confidenceLabel(confidence),
      onePLapPace,
      longRunPace,
      notes,
    };
  });

  return {
    trackId: context.track.id,
    qualifyingTrimName: `${context.setup.name} (qualifying trim)`,
    raceTrimName: `${context.setup.name} (race trim)`,
    drivers,
  };
}

function confidenceLabel(c: number): ConfidenceLabel {
  if (c >= 80) return 'Dialed In';
  if (c >= 64) return 'Comfortable';
  if (c >= 48) return 'Workable';
  return 'Struggling';
}

function paceLabel(score: number): PaceLabel {
  if (score >= 1.6) return 'Strong';
  if (score >= 0.4) return 'Competitive';
  if (score >= -0.8) return 'Average';
  return 'Weak';
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
