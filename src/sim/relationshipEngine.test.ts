import { describe, it, expect } from 'vitest';
import { teams1995, drivers1995 } from '../data';
import { buildTeamReputations } from './expectationEngine';
import {
  TEAM_ORDER_SPECS,
  applyTeamOrderToLive,
  createDriverRelationships,
  recordTeamOrder,
  resolveTeamOrderConsequences,
  rolloverRelationships,
} from './relationshipEngine';
import type { DriverRelationship, TeamOrderDecision } from '../types/relationshipTypes';
import type { LiveCarState, LiveRaceState } from '../types/liveTypes';

const reps = buildTeamReputations(teams1995);
const nameOf = (id: string) => drivers1995.find((d) => d.id === id)?.name ?? id;

function build(seed = 'rel-test') {
  return createDriverRelationships(teams1995, drivers1995, reps, seed);
}

// Minimal live car for team-order tests.
function car(driverId: string, isPlayer: boolean, totalTime: number): LiveCarState {
  return {
    driverId,
    teamId: 't-player',
    isPlayer,
    grid: 1,
    position: 1,
    totalTime,
    gapToLeader: 0,
    interval: 0,
    lastLapTime: 90,
    bestLap: 90,
    lapsCompleted: 10,
    running: true,
    status: 'Finished',
    retiredOnLap: null,
    paceRating: 50,
    baseRacePace: 6,
    baseFailureRisk: 0,
    baseCrashRisk: 0,
    baseMistakeRisk: 0,
    tireDegRate: 2,
    pitLossBase: 22,
    opsForm: 0,
    personality: 'Balanced',
    strategyId: 's',
    instructionId: 'Balanced',
    paceMode: 'Balanced',
    liveRacePace: 6,
    tire: { compound: 'Dry', age: 5, wear: 30, stintTarget: 20 },
    pit: {
      plannedStops: 1,
      stopsMade: 0,
      scheduledLaps: [25],
      lastPitLap: null,
      inPitThisLap: false,
      window: null,
      pitRequested: false,
    },
    reliabilityIssue: null,
    reliabilityRisk: 0,
    crashRisk: 0,
    damaged: false,
    fuel: 60,
    engineHealth: 100,
    gearboxHealth: 100,
    brakeHealth: 100,
    lastSectors: null,
    bestSectors: null,
    reliabilityRiskLevel: 'Low',
    crashRiskLevel: 'Low',
    trafficStatus: 'Clear',
    statusMessage: '',
  };
}

function liveWith(cars: LiveCarState[]): LiveRaceState {
  return {
    raceId: 'r1',
    trackId: 'trk',
    seed: 's',
    totalLaps: 50,
    currentLap: 10,
    phase: 'racing',
    weather: { condition: 'Dry', gripLevel: 1, wet: false, changingSoon: false, label: 'Dry' },
    safetyCar: { active: false, lapsRemaining: 0, deployedOnLap: null, reason: null, deployments: 0 },
    cars,
    events: [],
    pendingPrompt: null,
    promptCooldown: {},
    firedEventIds: [],
    recommendations: [],
    ignoredRecs: [],
    recCooldowns: {},
    retirements: 0,
  };
}

describe('relationshipEngine — seeding', () => {
  it('seeds a relationship for every driver, paired with the teammate', () => {
    const rels = build();
    expect(Object.keys(rels).length).toBe(drivers1995.length);
    for (const d of drivers1995) {
      const rel = rels[d.id];
      expect(rel.driverId).toBe(d.id);
      expect(rel.teamId).toBe(d.teamId);
      if (rel.teammateId) {
        expect(rels[rel.teammateId]?.teamId).toBe(rel.teamId);
      }
    }
  });

  it('is deterministic for the same seed', () => {
    expect(build('seed-a')).toEqual(build('seed-a'));
    expect(build('seed-a')).not.toEqual(build('seed-b'));
  });

  it('keeps all values within 0..100', () => {
    const rels = build();
    for (const rel of Object.values(rels)) {
      for (const v of [rel.teamLoyalty, rel.engineerChemistry, rel.teammateRelationship, rel.morale, rel.frustration]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('relationshipEngine — team orders on the live race', () => {
  it('swaps on-track positions in favour of the chosen driver', () => {
    const lead = car('d-a', true, 100);
    const trail = car('d-b', true, 102);
    const result = applyTeamOrderToLive(liveWith([lead, trail]), 'SwapPositions', 'd-b', nameOf);
    expect(result).not.toBeNull();
    const cars = result!.state.cars;
    const newLeadId = [...cars].sort((a, b) => a.totalTime - b.totalTime)[0].driverId;
    expect(newLeadId).toBe('d-b');
    expect(cars.find((c) => c.driverId === 'd-b')!.position).toBe(1);
  });

  it('refuses intra-team orders with fewer than two cars running', () => {
    const solo = car('d-a', true, 100);
    expect(applyTeamOrderToLive(liveWith([solo]), 'SwapPositions', 'd-a', nameOf)).toBeNull();
    expect(applyTeamOrderToLive(liveWith([solo]), 'HoldPosition', undefined, nameOf)).toBeNull();
  });

  it('gives the favoured driver pit-crew priority (lower pit loss)', () => {
    const a = car('d-a', true, 100);
    const b = car('d-b', true, 102);
    const before = a.pitLossBase;
    const result = applyTeamOrderToLive(liveWith([a, b]), 'PriorityPitStop', 'd-a', nameOf);
    const after = result!.state.cars.find((c) => c.driverId === 'd-a')!.pitLossBase;
    expect(after).toBeLessThan(before);
  });

  it('every spec needing a favoured driver is rejected without one', () => {
    const a = car('d-a', true, 100);
    const b = car('d-b', true, 102);
    for (const spec of TEAM_ORDER_SPECS.filter((s) => s.needsFavored)) {
      expect(applyTeamOrderToLive(liveWith([a, b]), spec.order, undefined, nameOf)).toBeNull();
    }
  });
});

describe('relationshipEngine — consequences', () => {
  function pair(): Record<string, DriverRelationship> {
    return {
      fav: { driverId: 'fav', teamId: 't', teammateId: 'dis', teamLoyalty: 60, engineerChemistry: 60, teammateRelationship: 60, morale: 60, frustration: 20, numberOneExpectation: false },
      dis: { driverId: 'dis', teamId: 't', teammateId: 'fav', teamLoyalty: 60, engineerChemistry: 60, teammateRelationship: 60, morale: 60, frustration: 20, numberOneExpectation: false },
    };
  }

  it('hurts the disadvantaged driver and lifts the favoured one on a swap', () => {
    const order = recordTeamOrder('r1', 'SwapPositions', 'fav', ['fav', 'dis'], 12);
    expect(order.disadvantagedDriverId).toBe('dis');
    const res = resolveTeamOrderConsequences([order], pair(), (id) => id);
    expect(res.relationships.dis.morale).toBeLessThan(60);
    expect(res.relationships.dis.frustration).toBeGreaterThan(20);
    expect(res.relationships.dis.teammateRelationship).toBeLessThan(60);
    expect(res.relationships.fav.morale).toBeGreaterThanOrEqual(60);
  });

  it('hits a number-one driver harder and draws a media reaction', () => {
    const base = pair();
    base.dis.numberOneExpectation = true;
    const order = recordTeamOrder('r1', 'SwapPositions', 'fav', ['fav', 'dis'], 12);
    const plain = resolveTeamOrderConsequences([order], pair(), (id) => id);
    const no1 = resolveTeamOrderConsequences([order], base, (id) => id);
    expect(no1.relationships.dis.morale).toBeLessThan(plain.relationships.dis.morale);
    expect(no1.news.length).toBeGreaterThan(0);
  });

  it('letting them race nudges the teammate relationship up', () => {
    const order: TeamOrderDecision = {
      id: 'o', raceId: 'r1', order: 'LetThemRace', favoredDriverId: 'fav', disadvantagedDriverId: 'dis', lap: 5,
    };
    const res = resolveTeamOrderConsequences([order], pair(), (id) => id);
    expect(res.relationships.fav.teammateRelationship).toBeGreaterThan(60);
    expect(res.relationships.dis.teammateRelationship).toBeGreaterThan(60);
  });
});

describe('relationshipEngine — rollover', () => {
  it('recovers morale and frustration for drivers who stay', () => {
    const prev = build();
    const id = drivers1995[0].id;
    prev[id] = { ...prev[id], morale: 10, frustration: 90 };
    const next = rolloverRelationships(prev, teams1995, drivers1995, reps, 'roll');
    expect(next[id].morale).toBeGreaterThan(10);
    expect(next[id].frustration).toBeLessThan(90);
  });
});
