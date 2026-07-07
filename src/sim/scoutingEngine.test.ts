import { describe, it, expect } from 'vitest';
import { createInitialFacilities } from './facilityEngine';
import {
  createInitialScoutingState,
  effectiveAccuracy,
  fogView,
  isRevealed,
  recordScouting,
  scoutingCost,
  scoutingNetworkAccuracy,
  visiblePotentialRange,
  visibleSkill,
  type ScoutTarget,
} from './scoutingEngine';
import type { MarketSkillRatings } from '../types/marketTypes';

const skills: MarketSkillRatings = {
  cornering: 80,
  braking: 70,
  straights: 60,
  tractionAcceleration: 70,
  elevationBlindCorners: 60,
  technical: 80,
  overtakingRacecraft: 90,
  surfaceGripBumpiness: 60,
  riskManagement: 50,
  enduranceConsistency: 70,
};
const target: ScoutTarget = { id: 'drv-1', skills, potential: 85 };
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
  it('keeps a range even at maximum confidence and stays within 1-100', () => {
    const maxConfidence = visiblePotentialRange(85, 1, SEED, target.id);
    expect(maxConfidence[0]).toBeLessThan(85);
    expect(maxConfidence[1]).toBeGreaterThan(85);
    const [lo, hi] = visiblePotentialRange(85, 0, SEED, target.id);
    expect(lo).toBeGreaterThanOrEqual(1);
    expect(hi).toBeLessThanOrEqual(100);
    expect(lo).toBeLessThanOrEqual(hi);
  });

  it('narrows as accuracy improves', () => {
    const wide = visiblePotentialRange(85, 0.2, SEED, target.id);
    const narrow = visiblePotentialRange(85, 0.8, SEED, target.id);
    expect(wide[1] - wide[0]).toBeGreaterThan(narrow[1] - narrow[0]);
  });

  it('keeps youth prospects much wider even at maximum scouting', () => {
    const senior = visiblePotentialRange(85, 1, SEED, target.id, 'Driver');
    const youth = visiblePotentialRange(85, 1, SEED, target.id, 'YouthProspect');
    expect(youth[1] - youth[0]).toBeGreaterThan(senior[1] - senior[0]);
    expect(youth[1] - youth[0]).toBeGreaterThanOrEqual(2);
  });
});

describe('scoutingEngine — skill fog', () => {
  it('hides skills when barely scouted and narrows them to ranges when fully scouted', () => {
    expect(visibleSkill(80, 0.1, SEED, target.id, 'cornering')).toBe('Unknown');
    expect(visibleSkill(80, 1, SEED, target.id, 'cornering')).toEqual([78, 84]);
  });

  it('keeps youth skill reports wider than senior skill reports', () => {
    const senior = visibleSkill(80, 1, SEED, target.id, 'cornering', 'Driver');
    const youth = visibleSkill(80, 1, SEED, target.id, 'cornering', 'YouthProspect');
    expect(Array.isArray(senior)).toBe(true);
    expect(Array.isArray(youth)).toBe(true);
    const seniorRange = senior as [number, number];
    const youthRange = youth as [number, number];
    expect(youthRange[1] - youthRange[0]).toBeGreaterThan(seniorRange[1] - seniorRange[0]);
  });
});

describe('scoutingEngine — recordScouting', () => {
  const facilities = createInitialFacilities('t', 50);

  it('raises effort and eventually reaches the best available report', () => {
    let scouting = createInitialScoutingState('t', facilities);
    expect(scouting.reports[target.id]).toBeUndefined();
    for (let i = 0; i < 6; i++) {
      scouting = recordScouting(scouting, target, 'Driver', facilities, SEED, '2026-01-01');
    }
    const report = scouting.reports[target.id];
    expect(report.scoutingLevel).toBe(100);
    expect(isRevealed(report.accuracy)).toBe(true);
    expect(report.potentialRange![0]).toBeLessThan(85);
    expect(report.potentialRange![1]).toBeGreaterThan(85);
    expect(report.visibleRatings.cornering).toEqual([78, 84]);
  });

  it('is deterministic for the same inputs', () => {
    const a = recordScouting(createInitialScoutingState('t', facilities), target, 'Driver', facilities, SEED, '2026-01-01');
    const b = recordScouting(createInitialScoutingState('t', facilities), target, 'Driver', facilities, SEED, '2026-01-01');
    expect(a.reports[target.id]).toEqual(b.reports[target.id]);
  });
});

describe('scoutingEngine — fogView', () => {
  const facilities = createInitialFacilities('t', 50);

  it('is fogged when unscouted and range-based once fully scouted', () => {
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
    expect(revealed.maxed).toBe(true);
    expect(revealed.potential.value).toBeUndefined();
    expect(revealed.potential.range[1]).toBeGreaterThan(revealed.potential.range[0]);
    expect(revealed.skills.overtakingRacecraft).toEqual([86, 92]);
  });
});

describe('scoutingEngine — scoutingCost', () => {
  it('charges more for senior drivers than youth', () => {
    expect(scoutingCost('Driver', 0)).toBeGreaterThan(scoutingCost('YouthProspect', 0));
  });

  it('rises as a target is refined', () => {
    expect(scoutingCost('Driver', 75)).toBeGreaterThan(scoutingCost('Driver', 0));
  });

  it('returns positive raw-dollar amounts', () => {
    expect(scoutingCost('Driver', 0)).toBeGreaterThan(0);
    expect(Number.isInteger(scoutingCost('Driver', 50))).toBe(true);
  });
});
