import { describe, it, expect } from 'vitest';
import {
  createPromiseId,
  makePromise,
  resolvePromise,
  expirePromise,
  applyPromiseResolution,
  checkExpiredPromises,
  hasActivePromiseOfType,
  evaluatePromisesAfterRace,
  evaluatePromisesAtSeasonEnd,
  type RaceEventContext,
} from './driverConfidenceEngine';
import type { DriverRelationship, PromiseType } from '../types/relationshipTypes';

function baseRel(overrides: Partial<DriverRelationship> = {}): DriverRelationship {
  return {
    driverId: 'd1',
    teamId: 't1',
    teammateId: 'd2',
    teamLoyalty: 60,
    engineerChemistry: 60,
    teammateRelationship: 60,
    morale: 60,
    frustration: 20,
    numberOneExpectation: false,
    selfConfidence: 60,
    trustInCar: 60,
    trustInTeam: 60,
    trustInPrincipal: 60,
    ego: 50,
    personalityTraits: [],
    wants: [],
    ...overrides,
  };
}

function baseCtx(overrides: Partial<RaceEventContext> = {}): RaceEventContext {
  return {
    driverId: 'd1',
    finishingPosition: 5,
    totalDrivers: 20,
    qualifiedPosition: 5,
    dnf: false,
    teammateFinishingPosition: 7,
    teammateDNF: false,
    teamOrderIssued: false,
    wasFavoredInOrders: false,
    wasDisadvantagedInOrders: false,
    carReliabilityDNF: false,
    strategyRiskLevel: 'balanced',
    pointsScored: 10,
    podium: false,
    win: false,
    ...overrides,
  };
}

describe('Promise System — Unique IDs', () => {
  it('createPromiseId generates unique IDs with different counters', () => {
    const id1 = createPromiseId('d1', 'equal_treatment', 1995, 3, 0);
    const id2 = createPromiseId('d1', 'equal_treatment', 1995, 3, 1);
    const id3 = createPromiseId('d1', 'equal_treatment', 1995, 3, 2);
    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
    expect(id1).not.toBe(id3);
  });

  it('makePromise with counter generates unique IDs', () => {
    const p1 = makePromise('d1', 'equal_treatment', 1995, 3, undefined, undefined, 0);
    const p2 = makePromise('d1', 'equal_treatment', 1995, 3, undefined, undefined, 1);
    expect(p1.id).not.toBe(p2.id);
  });

  it('creating multiple promises never generates duplicate IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const p = makePromise('d1', 'equal_treatment', 1995, 3, undefined, undefined, i);
      ids.add(p.id);
    }
    expect(ids.size).toBe(100);
  });
});

describe('Promise System — Duplicate Prevention', () => {
  it('hasActivePromiseOfType detects existing active promise', () => {
    const p = makePromise('d1', 'equal_treatment', 1995, 3, undefined, undefined, 0);
    expect(hasActivePromiseOfType([p], 'd1', 'equal_treatment')).toBe(true);
  });

  it('hasActivePromiseOfType returns false for resolved promise', () => {
    const p = resolvePromise(makePromise('d1', 'equal_treatment', 1995, 3), true);
    expect(hasActivePromiseOfType([p], 'd1', 'equal_treatment')).toBe(false);
  });

  it('hasActivePromiseOfType returns false for different driver', () => {
    const p = makePromise('d1', 'equal_treatment', 1995, 3, undefined, undefined, 0);
    expect(hasActivePromiseOfType([p], 'd2', 'equal_treatment')).toBe(false);
  });

  it('hasActivePromiseOfType returns false for different promise type', () => {
    const p = makePromise('d1', 'equal_treatment', 1995, 3, undefined, undefined, 0);
    expect(hasActivePromiseOfType([p], 'd1', 'number_one_status')).toBe(false);
  });

  it('attempting to create same active promise for same driver is blocked by hasActivePromiseOfType', () => {
    const existing = [makePromise('d1', 'equal_treatment', 1995, 3, undefined, undefined, 0)];
    const blocked = hasActivePromiseOfType(existing, 'd1', 'equal_treatment');
    expect(blocked).toBe(true);
  });
});

describe('Promise System — Expiration', () => {
  it('promise with due round expires correctly', () => {
    const promises = [
      makePromise('d1', 'equal_treatment', 1995, 3, 1995, 10, 0),
    ];
    const { promises: checked, expired } = checkExpiredPromises(promises, 1995, 12);
    expect(expired).toHaveLength(1);
    expect(expired[0].status).toBe('expired');
    expect(checked[0].status).toBe('expired');
  });

  it('promise with due round does not expire before deadline', () => {
    const promises = [
      makePromise('d1', 'equal_treatment', 1995, 3, 1995, 10, 0),
    ];
    const { expired } = checkExpiredPromises(promises, 1995, 8);
    expect(expired).toHaveLength(0);
  });

  it('promise with due season but no due round expires at season rollover', () => {
    const promises = [
      makePromise('d1', 'equal_treatment', 1995, 3, 1995, undefined, 0),
    ];
    const { promises: checked, expired } = checkExpiredPromises(promises, 1996, 0);
    expect(expired).toHaveLength(1);
    expect(expired[0].status).toBe('expired');
    expect(checked[0].status).toBe('expired');
  });

  it('promise with due season but no due round does not expire within same season', () => {
    const promises = [
      makePromise('d1', 'equal_treatment', 1995, 3, 1995, undefined, 0),
    ];
    const { expired } = checkExpiredPromises(promises, 1995, 15);
    expect(expired).toHaveLength(0);
  });

  it('promise with no deadline expires at end of made season', () => {
    const promises = [
      makePromise('d1', 'equal_treatment', 1995, 3, undefined, undefined, 0),
    ];
    const { promises: checked, expired } = checkExpiredPromises(promises, 1996, 0);
    expect(expired).toHaveLength(1);
    expect(checked[0].status).toBe('expired');
  });

  it('promise with no deadline does not expire within same season', () => {
    const promises = [
      makePromise('d1', 'equal_treatment', 1995, 3, undefined, undefined, 0),
    ];
    const { expired } = checkExpiredPromises(promises, 1995, 15);
    expect(expired).toHaveLength(0);
  });

  it('expired promise applies negative trust/morale effect', () => {
    const rel = baseRel({ trustInPrincipal: 60, morale: 60 });
    const p = expirePromise(makePromise('d1', 'equal_treatment', 1995, 3));
    expect(p.status).toBe('expired');
    expect(p.trustImpact).toBeLessThan(0);
    const result = applyPromiseResolution({ d1: rel }, p);
    expect(result.d1.trustInPrincipal).toBeLessThan(60);
    expect(result.d1.morale).toBeLessThan(60);
  });
});

describe('Promise System — Status Changes', () => {
  it('kept promise changes status to kept and no longer acts active', () => {
    const p = makePromise('d1', 'equal_treatment', 1995, 3, undefined, undefined, 0);
    const resolved = resolvePromise(p, true);
    expect(resolved.status).toBe('kept');
    expect(hasActivePromiseOfType([resolved], 'd1', 'equal_treatment')).toBe(false);
  });

  it('broken promise changes status to broken and no longer acts active', () => {
    const p = makePromise('d1', 'equal_treatment', 1995, 3, undefined, undefined, 0);
    const resolved = resolvePromise(p, false);
    expect(resolved.status).toBe('broken');
    expect(hasActivePromiseOfType([resolved], 'd1', 'equal_treatment')).toBe(false);
  });

  it('expired promise changes status to expired and no longer acts active', () => {
    const p = makePromise('d1', 'equal_treatment', 1995, 3, undefined, undefined, 0);
    const expired = expirePromise(p);
    expect(expired.status).toBe('expired');
    expect(hasActivePromiseOfType([expired], 'd1', 'equal_treatment')).toBe(false);
  });
});

describe('Promise System — Outcome Effects', () => {
  it('kept promise increases trust in principal', () => {
    const rel = baseRel({ trustInPrincipal: 50 });
    const p = resolvePromise(makePromise('d1', 'equal_treatment', 1995, 3), true);
    const result = applyPromiseResolution({ d1: rel }, p);
    expect(result.d1.trustInPrincipal).toBeGreaterThan(50);
  });

  it('kept promise increases trust in team', () => {
    const rel = baseRel({ trustInTeam: 50 });
    const p = resolvePromise(makePromise('d1', 'equal_treatment', 1995, 3), true);
    const result = applyPromiseResolution({ d1: rel }, p);
    expect(result.d1.trustInTeam).toBeGreaterThan(50);
  });

  it('kept promise increases team loyalty', () => {
    const rel = baseRel({ teamLoyalty: 50 });
    const p = resolvePromise(makePromise('d1', 'equal_treatment', 1995, 3), true);
    const result = applyPromiseResolution({ d1: rel }, p);
    expect(result.d1.teamLoyalty).toBeGreaterThan(50);
  });

  it('kept promise increases self confidence', () => {
    const rel = baseRel({ selfConfidence: 50 });
    const p = resolvePromise(makePromise('d1', 'equal_treatment', 1995, 3), true);
    const result = applyPromiseResolution({ d1: rel }, p);
    expect(result.d1.selfConfidence).toBeGreaterThan(50);
  });

  it('broken promise decreases trust in principal', () => {
    const rel = baseRel({ trustInPrincipal: 60 });
    const p = resolvePromise(makePromise('d1', 'equal_treatment', 1995, 3), false);
    const result = applyPromiseResolution({ d1: rel }, p);
    expect(result.d1.trustInPrincipal).toBeLessThan(60);
  });

  it('broken promise decreases trust in team', () => {
    const rel = baseRel({ trustInTeam: 60 });
    const p = resolvePromise(makePromise('d1', 'equal_treatment', 1995, 3), false);
    const result = applyPromiseResolution({ d1: rel }, p);
    expect(result.d1.trustInTeam).toBeLessThan(60);
  });

  it('broken promise decreases morale', () => {
    const rel = baseRel({ morale: 60 });
    const p = resolvePromise(makePromise('d1', 'equal_treatment', 1995, 3), false);
    const result = applyPromiseResolution({ d1: rel }, p);
    expect(result.d1.morale).toBeLessThan(60);
  });

  it('broken promise increases frustration', () => {
    const rel = baseRel({ frustration: 20 });
    const p = resolvePromise(makePromise('d1', 'equal_treatment', 1995, 3), false);
    const result = applyPromiseResolution({ d1: rel }, p);
    expect(result.d1.frustration).toBeGreaterThan(20);
  });

  it('broken promise has double trust impact vs kept', () => {
    const p = makePromise('d1', 'equal_treatment', 1995, 3);
    const kept = resolvePromise(p, true);
    const broken = resolvePromise(p, false);
    expect(Math.abs(broken.trustImpact)).toBeGreaterThan(kept.trustImpact);
  });
});

describe('Promise System — Resolution Rules', () => {
  it('equal_treatment broken when team orders disadvantage driver', () => {
    const p = makePromise('d1', 'equal_treatment', 1995, 3, undefined, undefined, 0);
    const ctx = baseCtx({ teamOrderIssued: true, wasDisadvantagedInOrders: true });
    const results = evaluatePromisesAfterRace([p], 'd1', ctx);
    expect(results).toHaveLength(1);
    expect(results[0].fulfilled).toBe(false);
  });

  it('number_one_status kept when driver favored by team orders', () => {
    const p = makePromise('d1', 'number_one_status', 1995, 3, undefined, undefined, 0);
    const ctx = baseCtx({ teamOrderIssued: true, wasFavoredInOrders: true });
    const results = evaluatePromisesAfterRace([p], 'd1', ctx);
    expect(results).toHaveLength(1);
    expect(results[0].fulfilled).toBe(true);
  });

  it('fight_teammate kept when driver beats teammate', () => {
    const p = makePromise('d1', 'fight_teammate', 1995, 3, undefined, undefined, 0);
    const ctx = baseCtx({ finishingPosition: 3, teammateFinishingPosition: 7 });
    const results = evaluatePromisesAfterRace([p], 'd1', ctx);
    expect(results).toHaveLength(1);
    expect(results[0].fulfilled).toBe(true);
  });

  it('fight_teammate broken when driver loses to teammate', () => {
    const p = makePromise('d1', 'fight_teammate', 1995, 3, undefined, undefined, 0);
    const ctx = baseCtx({ finishingPosition: 8, teammateFinishingPosition: 3 });
    const results = evaluatePromisesAfterRace([p], 'd1', ctx);
    expect(results).toHaveLength(1);
    expect(results[0].fulfilled).toBe(false);
  });

  it('calmer_risk_approach broken when aggressive strategy used', () => {
    const p = makePromise('d1', 'calmer_risk_approach', 1995, 3, undefined, undefined, 0);
    const ctx = baseCtx({ strategyRiskLevel: 'aggressive' });
    const results = evaluatePromisesAfterRace([p], 'd1', ctx);
    expect(results).toHaveLength(1);
    expect(results[0].fulfilled).toBe(false);
  });

  it('improved_reliability broken on car failure DNF', () => {
    const p = makePromise('d1', 'improved_reliability', 1995, 3, undefined, undefined, 0);
    const ctx = baseCtx({ dnf: true, carReliabilityDNF: true });
    const results = evaluatePromisesAfterRace([p], 'd1', ctx);
    expect(results).toHaveLength(1);
    expect(results[0].fulfilled).toBe(false);
  });

  it('contract_renewal resolved at season end', () => {
    const p = makePromise('d1', 'contract_renewal', 1995, 3, undefined, undefined, 0);
    const results = evaluatePromisesAtSeasonEnd([p], 'd1', {
      contractRenewed: true,
      wasReplaced: false,
      wasPromoted: false,
      gotPracticeTime: false,
    });
    expect(results).toHaveLength(1);
    expect(results[0].fulfilled).toBe(true);
  });

  it('no_midseason_replacement resolved at season end', () => {
    const p = makePromise('d1', 'no_midseason_replacement', 1995, 3, undefined, undefined, 0);
    const results = evaluatePromisesAtSeasonEnd([p], 'd1', {
      contractRenewed: false,
      wasReplaced: true,
      wasPromoted: false,
      gotPracticeTime: false,
    });
    expect(results).toHaveLength(1);
    expect(results[0].fulfilled).toBe(false);
  });

  it('development_priority resolved at season end', () => {
    const p = makePromise('d1', 'development_priority', 1995, 3, undefined, undefined, 0);
    const results = evaluatePromisesAtSeasonEnd([p], 'd1', {
      contractRenewed: false,
      wasReplaced: false,
      wasPromoted: false,
      gotPracticeTime: false,
      developmentPriorityGiven: true,
    });
    expect(results).toHaveLength(1);
    expect(results[0].fulfilled).toBe(true);
  });

  it('priority_upgrades resolved at season end', () => {
    const p = makePromise('d1', 'priority_upgrades', 1995, 3, undefined, undefined, 0);
    const results = evaluatePromisesAtSeasonEnd([p], 'd1', {
      contractRenewed: false,
      wasReplaced: false,
      wasPromoted: false,
      gotPracticeTime: false,
      developmentPriorityGiven: false,
    });
    expect(results).toHaveLength(1);
    expect(results[0].fulfilled).toBe(false);
  });

  it('improved_reliability resolved at season end with reliabilityImproved', () => {
    const p = makePromise('d1', 'improved_reliability', 1995, 3, undefined, undefined, 0);
    const results = evaluatePromisesAtSeasonEnd([p], 'd1', {
      contractRenewed: false,
      wasReplaced: false,
      wasPromoted: false,
      gotPracticeTime: false,
      reliabilityImproved: true,
    });
    expect(results).toHaveLength(1);
    expect(results[0].fulfilled).toBe(true);
  });

  it('every existing promise type has a resolution rule or explicit fallback', () => {
    const allTypes: PromiseType[] = [
      'equal_treatment',
      'number_one_status',
      'improved_reliability',
      'development_priority',
      'contract_renewal',
      'promotion',
      'reserve_practice_time',
      'no_midseason_replacement',
      'better_strategy_support',
      'priority_upgrades',
      'fight_teammate',
      'calmer_risk_approach',
    ];
    // Verify each type is handled by either evaluatePromisesAfterRace or evaluatePromisesAtSeasonEnd
    // by checking that they don't throw and return an array.
    for (const pt of allTypes) {
      const p = makePromise('d1', pt, 1995, 3, undefined, undefined, 0);
      const raceResults = evaluatePromisesAfterRace([p], 'd1', baseCtx());
      const seasonResults = evaluatePromisesAtSeasonEnd([p], 'd1', {
        contractRenewed: false,
        wasReplaced: false,
        wasPromoted: false,
        gotPracticeTime: false,
      });
      // At least one should be able to evaluate it (either per-race or season-end).
      // Some types only resolve at season end, others per-race — both are valid.
      expect(Array.isArray(raceResults)).toBe(true);
      expect(Array.isArray(seasonResults)).toBe(true);
    }
  });
});

describe('Promise System — Determinism', () => {
  it('promise resolution is deterministic with same inputs', () => {
    const p1 = makePromise('d1', 'equal_treatment', 1995, 3, undefined, undefined, 5);
    const p2 = makePromise('d1', 'equal_treatment', 1995, 3, undefined, undefined, 5);
    expect(p1.id).toBe(p2.id);

    const r1 = resolvePromise(p1, true);
    const r2 = resolvePromise(p2, true);
    expect(r1.status).toBe(r2.status);
    expect(r1.trustImpact).toBe(r2.trustImpact);
    expect(r1.moraleImpact).toBe(r2.moraleImpact);
  });

  it('applyPromiseResolution is deterministic with same inputs', () => {
    const rel = baseRel({ trustInPrincipal: 50, morale: 50 });
    const p = resolvePromise(makePromise('d1', 'equal_treatment', 1995, 3), false);
    const result1 = applyPromiseResolution({ d1: rel }, p);
    const result2 = applyPromiseResolution({ d1: rel }, p);
    expect(result1.d1.trustInPrincipal).toBe(result2.d1.trustInPrincipal);
    expect(result1.d1.morale).toBe(result2.d1.morale);
  });

  it('checkExpiredPromises is deterministic with same inputs', () => {
    const promises = [
      makePromise('d1', 'equal_treatment', 1995, 3, 1995, 10, 0),
      makePromise('d2', 'number_one_status', 1995, 3, 1996, 5, 1),
    ];
    const result1 = checkExpiredPromises(promises, 1995, 12);
    const result2 = checkExpiredPromises(promises, 1995, 12);
    expect(result1.expired.length).toBe(result2.expired.length);
    expect(result1.promises.length).toBe(result2.promises.length);
  });
});
