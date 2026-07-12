import { describe, expect, it } from 'vitest';
import { advanceTrackProgress, blendTrackProgress, reconcileTrackProgressForward, sectorPlaybackIntervalMs } from './trackMapInterpolation';

describe('track map interpolation', () => {
  it('uses real lap duration at 1x and scales display time only', () => {
    expect(sectorPlaybackIntervalMs(90, 1)).toBe(30_000);
    expect(sectorPlaybackIntervalMs(90, 5)).toBe(6_000);
  });

  it('advances a car from its own speed and authoritative progress', () => {
    expect(advanceTrackProgress(0.25, 50, 1_000, 1, 5_000)).toBeCloseTo(0.26);
    expect(advanceTrackProgress(0.25, 50, 1_000, 5, 5_000)).toBeCloseTo(0.3);
  });

  it('blends forward across start-finish without moving backwards around the lap', () => {
    expect(blendTrackProgress(0.98, 0.02, 0.5)).toBeCloseTo(0);
  });

  it('does not reverse when a refreshed snapshot is behind the displayed marker', () => {
    expect(reconcileTrackProgressForward(0.35, 0.3, 1)).toBeCloseTo(0.35);
    expect(reconcileTrackProgressForward(0.35, 0.3, 0.5)).toBeCloseTo(0.35);
  });

  it('still reconciles forward, including across start-finish', () => {
    expect(reconcileTrackProgressForward(0.2, 0.3, 0.5)).toBeCloseTo(0.25);
    expect(reconcileTrackProgressForward(0.98, 0.02, 0.5)).toBeCloseTo(0);
  });
});
