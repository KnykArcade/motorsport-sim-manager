import { describe, it, expect } from 'vitest';
import { createInitialFacilities } from './facilityEngine';
import {
  createInitialScoutingState,
  effectiveAccuracy,
  fogView,
  isRevealed,
  recordScouting,
  scoutingNetworkAccuracy,
  visiblePotentialRange,
  visibleSkill,
  type ScoutTarget,
} from './scoutingEngine';
import type { MarketSkillRatings } from '../types/marketTypes';

const skills: MarketSkillRatings = {
  cornering: 8,
  braking: 7,
  straights: 6,
  tractionAcceleration: 7,
  elevationBlindCorners: 6,
  technical: 8,
  overtakingRacecraft: 9,
  surfaceGripBumpiness: 6,
  riskManagement: 5,
  enduranceConsistency: 7,
};
const target: ScoutTarget = { id: 'drv-1', skills, potential: 8.5 };
const SEED = 'seed-xyz';

describe('scoutingEngine — accuracy', () => {
  it('rises with per-target effort', () => {
    expect(effectiveAccuracy(0, 0.2)).toBeLessThan(effectiveAccuracy(50, 0.2));
    expect(effectiveAccuracy(50, 0.2)).toBeLessThan(effectiveAccuracy(100, 0.2));
  });

  it('network facility raises the baseline', () => {
    expect(scoutingNetworkAccuracy(undefined)).toBeCloseTo(0.15, 5);
    const strong = createInitialFacilities('t', 100);
    const weak = createInitialFacilities('t', 0);
    expect(scoutingNetworkAccuracy(strong)).toBeGreaterThan(scoutingNetworkAccuracy(weak));
  });
});

describe('scoutingEngine — potential fog', () => {
  it('returns the exact value once revealed and stays within 1-10', () => {
    expect(visiblePotentialRange(8.5, 1, SEED, target.id)).toEqual([8.5, 8.5]);
    const [lo, hi] = visiblePotentialRange(8.5, 0, SEED, target.id);
    expect(lo).toBeGreaterThanOrEqual(1);
    expect(hi).toBeLessThanOrEqual(10);
    expect(lo).toBeLessThanOrEqual(hi);
  });

  it('narrows as accuracy improves', () => {
    const wide = visiblePotentialRange(8.5, 0.2, SEED, target.id);
    const narrow = visiblePotentialRange(8.5, 0.8, SEED, target.id);
    expect(wide[1] - wide[0]).toBeGreaterThan(narrow[1] - narrow[0]);
  });
});

describe('scoutingEngine — skill fog', () => {
  it('hides skills when barely scouted and reveals them when fully scouted', () => {
    expect(visibleSkill(8, 0.1, SEED, target.id, 'cornering')).toBe('Unknown');
    expect(visibleSkill(8, 1, SEED, target.id, 'cornering')).toBe(8);
  });
});

describe('scoutingEngine — recordScouting', () => {
  const facilities = createInitialFacilities('t', 50);

  it('raises effort and eventually fully reveals a target', () => {
    let scouting = createInitialScoutingState('t', facilities);
    expect(scouting.reports[target.id]).toBeUndefined();
    for (let i = 0; i < 6; i++) {
      scouting = recordScouting(scouting, target, 'Driver', facilities, SEED, '2026-01-01');
    }
    const report = scouting.reports[target.id];
    expect(report.scoutingLevel).toBe(100);
    expect(isRevealed(report.accuracy)).toBe(true);
    expect(report.potentialRange).toEqual([8.5, 8.5]);
    expect(report.visibleRatings.cornering).toBe(8);
  });

  it('is deterministic for the same inputs', () => {
    const a = recordScouting(createInitialScoutingState('t', facilities), target, 'Driver', facilities, SEED, '2026-01-01');
    const b = recordScouting(createInitialScoutingState('t', facilities), target, 'Driver', facilities, SEED, '2026-01-01');
    expect(a.reports[target.id]).toEqual(b.reports[target.id]);
  });
});

describe('scoutingEngine — fogView', () => {
  const facilities = createInitialFacilities('t', 50);

  it('is fogged when unscouted and exact once fully scouted', () => {
    const base = createInitialScoutingState('t', facilities);
    const unscouted = fogView(target, base.reports[target.id], base.networkAccuracy, SEED);
    expect(unscouted.revealed).toBe(false);
    expect(unscouted.potential.value).toBeUndefined();
    expect(unscouted.potential.range[1]).toBeGreaterThan(unscouted.potential.range[0]);

    let scouting = base;
    for (let i = 0; i < 6; i++) {
      scouting = recordScouting(scouting, target, 'Driver', facilities, SEED, '2026-01-01');
    }
    const revealed = fogView(target, scouting.reports[target.id], scouting.networkAccuracy, SEED);
    expect(revealed.revealed).toBe(true);
    expect(revealed.potential.value).toBe(8.5);
    expect(revealed.skills.overtakingRacecraft).toBe(9);
  });
});
