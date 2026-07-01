import { describe, it, expect } from 'vitest';
import { generateRecommendations, REC_COOLDOWN } from './analyticsEngine';
import {
  acceptRecommendation,
  ignoreRecommendation,
  modifyRecommendation,
} from './raceTickEngine';
import type { LiveRaceMeta } from './liveRaceEngine';
import type { LiveCarState, LiveRaceState } from '../types/liveTypes';
import type { Track } from '../types/gameTypes';

// A running player car with sensible defaults; override the fields under test.
function car(overrides: Partial<LiveCarState> = {}): LiveCarState {
  const base: LiveCarState = {
    driverId: 'd1',
    teamId: 't-player',
    isPlayer: true,
    grid: 5,
    position: 5,
    totalTime: 900,
    gapToLeader: 10,
    interval: 5,
    lastLapTime: 90,
    bestLap: 89,
    lapsCompleted: 20,
    running: true,
    status: 'Running',
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
    tire: { compound: 'Dry', age: 15, wear: 30, stintTarget: 25 },
    pit: {
      plannedStops: 1,
      stopsMade: 0,
      scheduledLaps: [30],
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
  return {
    ...base,
    ...overrides,
    tire: { ...base.tire, ...(overrides.tire ?? {}) },
    pit: { ...base.pit, ...(overrides.pit ?? {}) },
  };
}

function live(cars: LiveCarState[], overrides: Partial<LiveRaceState> = {}): LiveRaceState {
  return {
    raceId: 'r1',
    trackId: 'trk',
    seed: 's',
    totalLaps: 50,
    currentLap: 20,
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
    retirements: 0,
    ...overrides,
  };
}

const META: LiveRaceMeta = {
  track: {} as Track,
  driverNames: { d1: 'Driver One', d2: 'Driver Two' },
  teamNames: { 't-player': 'Player Team' },
  playerTeamId: 't-player',
  year: 2005,
};

describe('analyticsEngine — recommendation generation', () => {
  it('flags critical reliability as an urgent Protect Engine recommendation', () => {
    const s = live([car({ reliabilityRiskLevel: 'Critical' })]);
    const recs = generateRecommendations(s.cars, s, s.currentLap);
    expect(recs).toHaveLength(1);
    expect(recs[0].kind).toBe('reliability');
    expect(recs[0].priority).toBe('urgent');
    expect(recs[0].action.paceMode).toBe('ProtectEngine');
    expect(recs[0].driverId).toBe('d1');
  });

  it('recommends pitting for wets when the track is wet and the car is on slicks', () => {
    const s = live([car({ tire: { compound: 'Dry', age: 15, wear: 30, stintTarget: 25 } })], {
      weather: { condition: 'HeavyRain', gripLevel: 0.7, wet: true, changingSoon: false, label: 'Heavy Rain' },
    });
    const recs = generateRecommendations(s.cars, s, s.currentLap);
    expect(recs[0].kind).toBe('weatherTyres');
    expect(recs[0].priority).toBe('urgent');
    expect(recs[0].action.pitNow).toBe(true);
  });

  it('recommends pitting for critically worn tyres', () => {
    const s = live([car({ tire: { compound: 'Dry', age: 35, wear: 88, stintTarget: 25 } })]);
    const recs = generateRecommendations(s.cars, s, s.currentLap);
    expect(recs[0].kind).toBe('tyres');
    expect(recs[0].action.pitNow).toBe(true);
  });

  it('picks the single highest-priority candidate when several apply', () => {
    // High crash while pushing (high) + fading tyres (medium) → one high rec.
    const s = live([
      car({ crashRiskLevel: 'High', paceMode: 'Push', tire: { compound: 'Dry', age: 30, wear: 65, stintTarget: 25 } }),
    ]);
    const recs = generateRecommendations(s.cars, s, s.currentLap);
    expect(recs).toHaveLength(1);
    expect(recs[0].priority).toBe('high');
  });

  it('never produces recommendations for non-player cars', () => {
    const s = live([car({ isPlayer: false, reliabilityRiskLevel: 'Critical' })]);
    expect(generateRecommendations(s.cars, s, s.currentLap)).toHaveLength(0);
  });

  it('advises the blocking car to let a faster teammate race', () => {
    // The front car is already defending, so the generic "under pressure" advice
    // is suppressed and the teammate recommendation surfaces instead.
    const front = car({ driverId: 'd1', position: 5, interval: 5, baseRacePace: 6, paceMode: 'Defend' });
    const back = car({ driverId: 'd2', position: 6, interval: 0.6, baseRacePace: 6.5 });
    const s = live([front, back]);
    const recs = generateRecommendations(s.cars, s, s.currentLap);
    const teammateRec = recs.find((r) => r.kind === 'teammate');
    expect(teammateRec).toBeDefined();
    expect(teammateRec!.driverId).toBe('d1');
    expect(teammateRec!.action.teamOrder).toBe('LetThemRace');
  });

  it('preserves createdLap while the trigger persists so the card does not flicker', () => {
    const s0 = live([car({ reliabilityRiskLevel: 'High' })]);
    const recs0 = generateRecommendations(s0.cars, s0, 20);
    const s1 = live([car({ reliabilityRiskLevel: 'High' })], { currentLap: 23, recommendations: recs0 });
    const recs1 = generateRecommendations(s1.cars, s1, 23);
    expect(recs1[0].createdLap).toBe(20);
    expect(recs1[0].expiresLap).toBe(23 + 5);
  });
});

describe('analyticsEngine — Accept / Modify / Ignore', () => {
  it('Accept applies the recommended action, removes the rec, and logs the decision', () => {
    let s = live([car({ reliabilityRiskLevel: 'High' })]);
    s = { ...s, recommendations: generateRecommendations(s.cars, s, s.currentLap) };
    const rec = s.recommendations[0];
    const after = acceptRecommendation(s, rec.id, META);
    expect(after.cars[0].paceMode).toBe('ProtectEngine');
    expect(after.recommendations).toHaveLength(0);
    expect(after.events.some((e) => /accepted analytics recommendation/.test(e.text))).toBe(true);
  });

  it('Modify applies a chosen alternative action and logs it', () => {
    let s = live([car({ reliabilityRiskLevel: 'High' })]);
    s = { ...s, recommendations: generateRecommendations(s.cars, s, s.currentLap) };
    const rec = s.recommendations[0];
    const alt = rec.alternatives.find((a) => a.type === 'PitNow')!;
    const after = modifyRecommendation(s, rec.id, alt.type, META);
    expect(after.cars[0].pit.pitRequested).toBe(true);
    expect(after.recommendations).toHaveLength(0);
    expect(after.events.some((e) => /modified analytics recommendation/.test(e.text))).toBe(true);
  });

  it('Ignore dismisses the rec, logs it (medium+), and puts the kind on cooldown', () => {
    let s = live([car({ reliabilityRiskLevel: 'High' })]);
    s = { ...s, recommendations: generateRecommendations(s.cars, s, s.currentLap) };
    const rec = s.recommendations[0];
    const after = ignoreRecommendation(s, rec.id);
    expect(after.recommendations).toHaveLength(0);
    expect(after.ignoredRecs.some((i) => i.key === rec.id)).toBe(true);
    expect(after.events.some((e) => /ignored analytics recommendation/.test(e.text))).toBe(true);

    // While on cooldown the same (non-urgent) kind is suppressed...
    const soon = live([car({ reliabilityRiskLevel: 'High' })], {
      currentLap: s.currentLap + 2,
      ignoredRecs: after.ignoredRecs,
    });
    expect(generateRecommendations(soon.cars, soon, soon.currentLap)).toHaveLength(0);

    // ...but it re-raises once the cooldown elapses.
    const later = live([car({ reliabilityRiskLevel: 'High' })], {
      currentLap: s.currentLap + REC_COOLDOWN,
      ignoredRecs: after.ignoredRecs,
    });
    expect(generateRecommendations(later.cars, later, later.currentLap)).toHaveLength(1);
  });

  it('urgent recommendations bypass the ignore cooldown', () => {
    const ignoredRecs = [{ key: 'd1:reliability', lap: 20, issue: 'x', escalated: false }];
    const s = live([car({ reliabilityRiskLevel: 'Critical' })], { currentLap: 22, ignoredRecs });
    const recs = generateRecommendations(s.cars, s, s.currentLap);
    expect(recs).toHaveLength(1);
    expect(recs[0].priority).toBe('urgent');
  });
});
