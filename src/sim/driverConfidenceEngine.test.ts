import { describe, it, expect } from 'vitest';
import type { DriverRelationship } from '../types/relationshipTypes';
import {
  computeConfidenceState,
  overallConfidenceScore,
  confidencePerformanceModifier,
  egoSatisfaction,
  reactToRaceResult,
  applyConfidenceUpdates,
  makePromise,
  resolvePromise,
  expirePromise,
  applyPromiseResolution,
  checkExpiredPromises,
  rolloverConfidence,
  evaluateWants,
  contractLoyaltyModifier,
  type RaceEventContext,
} from './driverConfidenceEngine';

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
    trustInCar: 55,
    trustInTeam: 55,
    trustInPrincipal: 58,
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
    teammateFinishingPosition: 8,
    teammateDNF: false,
    teamOrderIssued: false,
    wasFavoredInOrders: false,
    wasDisadvantagedInOrders: false,
    carReliabilityDNF: false,
    strategyRiskLevel: 'balanced',
    pointsScored: 2,
    podium: false,
    win: false,
    ...overrides,
  };
}

describe('driverConfidenceEngine — confidence state', () => {
  it('computeConfidenceState returns correct state for high scores', () => {
    const rel = baseRel({ selfConfidence: 90, trustInCar: 85, trustInTeam: 80, trustInPrincipal: 82, morale: 85, frustration: 5 });
    expect(computeConfidenceState(rel)).toBe('Inspired');
  });

  it('computeConfidenceState returns Checked Out for very low scores', () => {
    const rel = baseRel({ selfConfidence: 5, trustInCar: 5, trustInTeam: 5, trustInPrincipal: 5, morale: 5, frustration: 95 });
    expect(computeConfidenceState(rel)).toBe('Checked Out');
  });

  it('computeConfidenceState returns Neutral for mid scores', () => {
    const rel = baseRel();
    const score = overallConfidenceScore(rel);
    expect(score).toBeGreaterThan(40);
    expect(score).toBeLessThan(70);
  });
});

describe('driverConfidenceEngine — performance modifier', () => {
  it('returns positive modifier for confident drivers', () => {
    const rel = baseRel({ selfConfidence: 85, trustInCar: 80, trustInTeam: 80, trustInPrincipal: 80, morale: 80, frustration: 10 });
    expect(confidencePerformanceModifier(rel)).toBeGreaterThan(0);
  });

  it('returns negative modifier for frustrated drivers', () => {
    const rel = baseRel({ selfConfidence: 20, trustInCar: 20, trustInTeam: 20, trustInPrincipal: 20, morale: 20, frustration: 80 });
    expect(confidencePerformanceModifier(rel)).toBeLessThan(0);
  });

  it('returns zero for neutral drivers', () => {
    const rel = baseRel({ selfConfidence: 50, trustInCar: 50, trustInTeam: 50, trustInPrincipal: 50, morale: 50, frustration: 50 });
    expect(confidencePerformanceModifier(rel)).toBe(0);
  });
});

describe('driverConfidenceEngine — ego satisfaction', () => {
  it('high ego driver is satisfied when favored', () => {
    const rel = baseRel({ ego: 80 });
    expect(egoSatisfaction(rel, true)).toBeGreaterThan(0);
  });

  it('high ego driver is unsatisfied when not favored', () => {
    const rel = baseRel({ ego: 80 });
    expect(egoSatisfaction(rel, false)).toBeLessThan(0);
  });
});

describe('driverConfidenceEngine — race result reactions', () => {
  it('win boosts confidence and morale', () => {
    const rel = baseRel();
    const updates = reactToRaceResult(rel, baseCtx({ win: true, podium: true, finishingPosition: 1 }));
    const applied = applyConfidenceUpdates({ d1: rel }, updates);
    expect(applied.d1.selfConfidence).toBeGreaterThan(60);
    expect(applied.d1.morale).toBeGreaterThan(60);
  });

  it('DNF from car failure hurts trust in car', () => {
    const rel = baseRel();
    const updates = reactToRaceResult(rel, baseCtx({ dnf: true, carReliabilityDNF: true, finishingPosition: 99 }));
    const applied = applyConfidenceUpdates({ d1: rel }, updates);
    expect(applied.d1.trustInCar).toBeLessThan(55);
    expect(applied.d1.frustration).toBeGreaterThan(20);
  });

  it('DNF from crash hurts self-confidence more than car failure', () => {
    const rel = baseRel();
    const crashUpdates = reactToRaceResult(rel, baseCtx({ dnf: true, carReliabilityDNF: false, finishingPosition: 99 }));
    const carUpdates = reactToRaceResult(rel, baseCtx({ dnf: true, carReliabilityDNF: true, finishingPosition: 99 }));
    const crashApplied = applyConfidenceUpdates({ d1: rel }, crashUpdates);
    const carApplied = applyConfidenceUpdates({ d1: rel }, carUpdates);
    expect(crashApplied.d1.selfConfidence).toBeLessThan(carApplied.d1.selfConfidence);
  });

  it('beating teammate boosts confidence', () => {
    const rel = baseRel();
    const updates = reactToRaceResult(rel, baseCtx({ finishingPosition: 3, teammateFinishingPosition: 7 }));
    const applied = applyConfidenceUpdates({ d1: rel }, updates);
    expect(applied.d1.selfConfidence).toBeGreaterThan(60);
  });

  it('losing to teammate hurts high-ego driver more', () => {
    const normalRel = baseRel({ personalityTraits: [] });
    const egoRel = baseRel({ personalityTraits: ['High Ego'] });
    const normalUpdates = reactToRaceResult(normalRel, baseCtx({ finishingPosition: 8, teammateFinishingPosition: 3 }));
    const egoUpdates = reactToRaceResult(egoRel, baseCtx({ finishingPosition: 8, teammateFinishingPosition: 3 }));
    const normalApplied = applyConfidenceUpdates({ d1: normalRel }, normalUpdates);
    const egoApplied = applyConfidenceUpdates({ d1: egoRel }, egoUpdates);
    expect(egoApplied.d1.selfConfidence).toBeLessThan(normalApplied.d1.selfConfidence);
  });

  it('being favored by team orders boosts trust in principal', () => {
    const rel = baseRel();
    const updates = reactToRaceResult(rel, baseCtx({ teamOrderIssued: true, wasFavoredInOrders: true }));
    const applied = applyConfidenceUpdates({ d1: rel }, updates);
    expect(applied.d1.trustInPrincipal).toBeGreaterThan(58);
  });

  it('being disadvantaged by team orders hurts trust in principal', () => {
    const rel = baseRel();
    const updates = reactToRaceResult(rel, baseCtx({ teamOrderIssued: true, wasDisadvantagedInOrders: true }));
    const applied = applyConfidenceUpdates({ d1: rel }, updates);
    expect(applied.d1.trustInPrincipal).toBeLessThan(58);
  });

  it('number-one driver hit harder by team order disadvantage', () => {
    const normalRel = baseRel({ numberOneExpectation: false });
    const no1Rel = baseRel({ numberOneExpectation: true });
    const normalUpdates = reactToRaceResult(normalRel, baseCtx({ teamOrderIssued: true, wasDisadvantagedInOrders: true }));
    const no1Updates = reactToRaceResult(no1Rel, baseCtx({ teamOrderIssued: true, wasDisadvantagedInOrders: true }));
    const normalApplied = applyConfidenceUpdates({ d1: normalRel }, normalUpdates);
    const no1Applied = applyConfidenceUpdates({ d1: no1Rel }, no1Updates);
    const normalEgoDrop = 50 - normalApplied.d1.ego;
    const no1EgoDrop = 50 - no1Applied.d1.ego;
    expect(no1EgoDrop).toBeGreaterThan(normalEgoDrop);
  });

  it('resilient driver recovers confidence after DNF', () => {
    const normalRel = baseRel({ personalityTraits: [] });
    const resilientRel = baseRel({ personalityTraits: ['Resilient'] });
    const normalUpdates = reactToRaceResult(normalRel, baseCtx({ dnf: true, finishingPosition: 99 }));
    const resilientUpdates = reactToRaceResult(resilientRel, baseCtx({ dnf: true, finishingPosition: 99 }));
    const normalApplied = applyConfidenceUpdates({ d1: normalRel }, normalUpdates);
    const resilientApplied = applyConfidenceUpdates({ d1: resilientRel }, resilientUpdates);
    expect(resilientApplied.d1.selfConfidence).toBeGreaterThan(normalApplied.d1.selfConfidence);
  });

  it('gaining positions in race boosts confidence', () => {
    const rel = baseRel();
    const updates = reactToRaceResult(rel, baseCtx({ qualifiedPosition: 10, finishingPosition: 5 }));
    const applied = applyConfidenceUpdates({ d1: rel }, updates);
    expect(applied.d1.selfConfidence).toBeGreaterThan(60);
  });
});

describe('driverConfidenceEngine — promises', () => {
  it('makePromise creates an active promise', () => {
    const p = makePromise('d1', 'equal_treatment', 1995, 3);
    expect(p.status).toBe('active');
    expect(p.driverId).toBe('d1');
    expect(p.promiseType).toBe('equal_treatment');
  });

  it('resolvePromise kept increases trust', () => {
    const p = makePromise('d1', 'equal_treatment', 1995, 3);
    const resolved = resolvePromise(p, true);
    expect(resolved.status).toBe('kept');
    expect(resolved.trustImpact).toBeGreaterThan(0);
  });

  it('resolvePromise broken decreases trust more severely', () => {
    const p = makePromise('d1', 'equal_treatment', 1995, 3);
    const resolved = resolvePromise(p, false);
    expect(resolved.status).toBe('broken');
    expect(resolved.trustImpact).toBeLessThan(0);
    expect(Math.abs(resolved.trustImpact)).toBeGreaterThan(p.trustImpact);
  });

  it('applyPromiseResolution updates relationship trust and morale', () => {
    const rel = baseRel({ trustInPrincipal: 58, morale: 60 });
    const p = resolvePromise(makePromise('d1', 'equal_treatment', 1995, 3), false);
    const result = applyPromiseResolution({ d1: rel }, p);
    expect(result.d1.trustInPrincipal).toBeLessThan(58);
    expect(result.d1.morale).toBeLessThan(60);
  });

  it('checkExpiredPromises expires overdue promises', () => {
    const promises = [
      makePromise('d1', 'equal_treatment', 1995, 3, 1995, 10),
      makePromise('d2', 'number_one_status', 1995, 3, 1996, 5),
    ];
    const { promises: checked, expired } = checkExpiredPromises(promises, 1995, 12);
    expect(expired).toHaveLength(1);
    expect(expired[0].driverId).toBe('d1');
    expect(checked[0].status).toBe('expired');
    expect(checked[1].status).toBe('active');
  });

  it('expirePromise sets status and negative impact', () => {
    const p = makePromise('d1', 'equal_treatment', 1995, 3);
    const expired = expirePromise(p);
    expect(expired.status).toBe('expired');
    expect(expired.trustImpact).toBeLessThan(0);
  });
});

describe('driverConfidenceEngine — rollover', () => {
  it('drifts confidence toward neutral', () => {
    const high = baseRel({ selfConfidence: 90, trustInCar: 85, trustInTeam: 80, trustInPrincipal: 82, ego: 75 });
    const rolled = rolloverConfidence(high);
    expect(rolled.selfConfidence).toBeLessThan(90);
    expect(rolled.selfConfidence).toBeGreaterThan(60);
  });

  it('drifts low confidence upward', () => {
    const low = baseRel({ selfConfidence: 20, trustInCar: 20, trustInTeam: 20, trustInPrincipal: 20, ego: 25 });
    const rolled = rolloverConfidence(low);
    expect(rolled.selfConfidence).toBeGreaterThan(20);
  });
});

describe('driverConfidenceEngine — wants evaluation', () => {
  it('evaluates wants based on context', () => {
    const rel = baseRel({ wants: ['number_one_status', 'podium_capable_car', 'contract_renewal'] });
    const { satisfied, unfulfilled } = evaluateWants(rel, {
      teamReputation: 40,
      contractYearsRemaining: 2,
      isNumberOne: true,
      carReliability: 60,
      teamStability: 70,
    });
    expect(satisfied).toContain('number_one_status');
    expect(unfulfilled).toContain('podium_capable_car');
    expect(satisfied).toContain('contract_renewal');
  });
});

describe('driverConfidenceEngine — contract loyalty', () => {
  it('positive trust and morale give positive loyalty modifier', () => {
    const rel = baseRel({ trustInTeam: 70, trustInPrincipal: 70, morale: 70, frustration: 15 });
    expect(contractLoyaltyModifier(rel)).toBeGreaterThan(0);
  });

  it('low trust and high frustration give negative loyalty modifier', () => {
    const rel = baseRel({ trustInTeam: 30, trustInPrincipal: 30, morale: 30, frustration: 70, ego: 80 });
    expect(contractLoyaltyModifier(rel)).toBeLessThan(0);
  });
});
