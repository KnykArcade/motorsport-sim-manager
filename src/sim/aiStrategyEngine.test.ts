import { describe, it, expect } from 'vitest';
import { aiLapDecision, assignPersonality } from './aiStrategyEngine';
import type { LiveCarState, LiveRaceState } from '../types/liveTypes';
import { initialStint } from './strategyStint';
import type { Driver, Track } from '../types/gameTypes';

function car(overrides: Partial<LiveCarState> = {}): LiveCarState {
  const base: LiveCarState = {
    driverId: 'd1',
    teamId: 't1',
    isPlayer: false,
    grid: 5,
    position: 5,
    totalTime: 900,
    gapToLeader: 10,
    interval: 5,
    lastLapTime: 90,
    bestLap: 89,
    lapsCompleted: 20,
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
    strategyStint: initialStint('Balanced'),
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
      planStatus: 'planned',
      planCancelled: false,
      lastWindowPromptLap: null,
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
    seed: 'seed',
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
    recCooldowns: {},
    battleTracker: {},
    retirements: 0,
    ...overrides,
  };
}

const TRACK = { attributes: { overtakingRacecraft: 6 } } as unknown as Track;

describe('assignPersonality', () => {
  it('is deterministic for the same team/driver/seed', () => {
    const driver = { id: 'd1', ratings: { aggression: 6, riskManagement: 6 } } as unknown as Driver;
    const team = { id: 't1', reputation: 60 };
    expect(assignPersonality(team, driver, 'x')).toBe(assignPersonality(team, driver, 'x'));
  });
});

describe('aiLapDecision — core behaviours', () => {
  it('pits for wets when the track is wet and it is on slicks', () => {
    const c = car({ personality: 'RiskAverse' });
    const action = aiLapDecision(c, live([c], { weather: { condition: 'HeavyRain', gripLevel: 0.7, wet: true, changingSoon: false, label: 'Heavy Rain' } }), TRACK, 21);
    expect(action.pitNow).toBe(true);
    expect(action.switchCompound).toBe('Wet');
  });

  it('extends a scheduled stop by a lap when tyres are still comfortable', () => {
    const c = car({
      pit: {
        plannedStops: 1,
        stopsMade: 0,
        scheduledLaps: [22],
        strategyTargetLap: 22,
        lastPitLap: null,
        inPitThisLap: false,
        window: null,
        pitRequested: false,
        planStatus: 'planned',
        planCancelled: false,
        lastWindowPromptLap: null,
      },
    });
    const action = aiLapDecision(c, live([c]), TRACK, 22);
    expect(action.pitNow).toBe(false);
    expect(action.note).toMatch(/extends the stint/);
  });

  it('still makes the stop once the stretch window closes', () => {
    const c = car({
      pit: {
        plannedStops: 1,
        stopsMade: 0,
        scheduledLaps: [22],
        strategyTargetLap: 22,
        lastPitLap: null,
        inPitThisLap: false,
        window: null,
        pitRequested: false,
        planStatus: 'planned',
        planCancelled: false,
        lastWindowPromptLap: null,
      },
    });
    const action = aiLapDecision(c, live([c]), TRACK, 24);
    expect(action.pitNow).toBe(true);
  });

  it('varies pit timing by strategy personality', () => {
    const pit: LiveCarState['pit'] = {
      plannedStops: 1,
      stopsMade: 0,
      scheduledLaps: [24],
      lastPitLap: null,
      inPitThisLap: false,
      window: null,
      pitRequested: false,
      planStatus: 'planned',
      planCancelled: false,
      lastWindowPromptLap: null,
    };
    const undercut = car({ personality: 'UndercutFocused', pit, tire: { compound: 'Dry', age: 18, wear: 76, stintTarget: 25 } });
    const overcut = car({ personality: 'OvercutFocused', pit, tire: { compound: 'Dry', age: 18, wear: 76, stintTarget: 25 } });

    expect(aiLapDecision(undercut, live([undercut]), TRACK, 22).pitNow).toBe(true);
    expect(aiLapDecision(overcut, live([overcut]), TRACK, 22).pitNow).toBe(false);
  });

  it('protects the engine when a severe reliability issue is unmanaged', () => {
    const c = car({ reliabilityIssue: { severity: 'Severe', managed: false } as LiveCarState['reliabilityIssue'] });
    const action = aiLapDecision(c, live([c]), TRACK, 21);
    expect(action.paceMode).toBe('ProtectEngine');
  });
});

describe('aiLapDecision — Phase E extensions', () => {
  it('nurses a car with badly worn components even without a flagged issue', () => {
    const c = car({ engineHealth: 10 });
    const action = aiLapDecision(c, live([c]), TRACK, 21);
    expect(action.paceMode).toBe('ProtectEngine');
  });

  it('backs a damaged car off to Conservative', () => {
    const c = car({ damaged: true, tire: { compound: 'Dry', age: 5, wear: 20, stintTarget: 25 } });
    const action = aiLapDecision(c, live([c]), TRACK, 21);
    expect(action.paceMode).toBe('Conservative');
  });

  it('holds station behind a teammate instead of attacking (team orders)', () => {
    const mate = car({ driverId: 'd2', teamId: 't1', position: 4, gapToLeader: 9, tire: { compound: 'Dry', age: 15, wear: 30, stintTarget: 25 } });
    const c = car({ driverId: 'd1', teamId: 't1', personality: 'Aggressive', position: 5, interval: 0.8, gapToLeader: 9.8, tire: { compound: 'Dry', age: 15, wear: 40, stintTarget: 25 } });
    const action = aiLapDecision(c, live([mate, c]), TRACK, 21);
    expect(action.paceMode).toBe('Balanced');
    expect(action.paceMode).not.toBe('Attack');
  });

  it('still attacks a rival (not a teammate) within striking range', () => {
    const rival = car({ driverId: 'd2', teamId: 't2', position: 4, gapToLeader: 9 });
    const c = car({ driverId: 'd1', teamId: 't1', personality: 'Aggressive', position: 5, interval: 0.8, gapToLeader: 9.8, tire: { compound: 'Dry', age: 15, wear: 40, stintTarget: 25 } });
    const action = aiLapDecision(c, live([rival, c]), TRACK, 21);
    expect(action.paceMode).toBe('Attack');
  });

  it('defers a scheduled stop to avoid double-stacking behind a pitting teammate', () => {
    const pit: LiveCarState['pit'] = { plannedStops: 1, stopsMade: 0, scheduledLaps: [22], lastPitLap: null, inPitThisLap: false, window: null, pitRequested: false, planStatus: 'planned', planCancelled: false, lastWindowPromptLap: null };
    const mate = car({ driverId: 'd2', teamId: 't1', position: 4, gapToLeader: 9, tire: { compound: 'Dry', age: 22, wear: 85, stintTarget: 25 }, pit: { ...pit } });
    const c = car({ driverId: 'd1', teamId: 't1', position: 5, gapToLeader: 11, tire: { compound: 'Dry', age: 22, wear: 60, stintTarget: 25 }, pit: { ...pit } });
    const action = aiLapDecision(c, live([mate, c]), TRACK, 22);
    expect(action.pitNow).toBe(false);
    expect(action.note).toMatch(/double-stack/);
  });

  it('lets only the car in greater need take the safety-car stop', () => {
    const pit: LiveCarState['pit'] = { plannedStops: 1, stopsMade: 0, scheduledLaps: [22], lastPitLap: null, inPitThisLap: false, window: null, pitRequested: false, planStatus: 'planned', planCancelled: false, lastWindowPromptLap: null };
    const urgentMate = car({ driverId: 'd2', teamId: 't1', position: 4, gapToLeader: 9, tire: { compound: 'Dry', age: 22, wear: 78, stintTarget: 25 }, pit: { ...pit } });
    const cautiousCar = car({ driverId: 'd1', teamId: 't1', position: 5, gapToLeader: 11, tire: { compound: 'Dry', age: 22, wear: 58, stintTarget: 25 }, pit: { ...pit } });
    const state = live([urgentMate, cautiousCar], { safetyCar: { active: true, lapsRemaining: 2, deployedOnLap: 21, reason: 'Incident', deployments: 1 } });
    expect(aiLapDecision(urgentMate, state, TRACK, 22).pitNow).toBe(true);
    const cautiousAction = aiLapDecision(cautiousCar, state, TRACK, 22);
    expect(cautiousAction.pitNow).toBe(false);
    expect(cautiousAction.note).toMatch(/stacking under the safety car/);
  });

  it('does not defer when its own tyres are at the cliff', () => {
    const pit: LiveCarState['pit'] = { plannedStops: 1, stopsMade: 0, scheduledLaps: [22], lastPitLap: null, inPitThisLap: false, window: null, pitRequested: false, planStatus: 'planned', planCancelled: false, lastWindowPromptLap: null };
    const mate = car({ driverId: 'd2', teamId: 't1', position: 4, gapToLeader: 9, tire: { compound: 'Dry', age: 22, wear: 85, stintTarget: 25 }, pit: { ...pit } });
    const c = car({ driverId: 'd1', teamId: 't1', position: 5, gapToLeader: 11, tire: { compound: 'Dry', age: 26, wear: 90, stintTarget: 25 }, pit: { ...pit } });
    const action = aiLapDecision(c, live([mate, c]), TRACK, 22);
    expect(action.pitNow).toBe(true);
  });

  it('reacts to an opponent pit only near its window and with reasonable tyres', () => {
    const pit: LiveCarState['pit'] = { plannedStops: 1, stopsMade: 0, scheduledLaps: [24], lastPitLap: null, inPitThisLap: false, window: null, pitRequested: false, planStatus: 'planned', planCancelled: false, lastWindowPromptLap: null };
    const rival = car({ driverId: 'd2', teamId: 't2', position: 4, gapToLeader: 9, pit: { ...pit, inPitThisLap: true }, tire: { compound: 'Dry', age: 18, wear: 55, stintTarget: 25 } });
    const undercut = car({ driverId: 'd1', teamId: 't1', personality: 'UndercutFocused', position: 5, interval: 0.9, gapToLeader: 9.9, pit: { ...pit }, tire: { compound: 'Dry', age: 18, wear: 68, stintTarget: 25 } });
    const freshTyres = car({ driverId: 'd3', teamId: 't3', personality: 'UndercutFocused', position: 5, interval: 0.9, gapToLeader: 9.9, pit: { ...pit }, tire: { compound: 'Dry', age: 6, wear: 20, stintTarget: 25 } });
    const state = live([rival, undercut, freshTyres]);
    expect(aiLapDecision(undercut, state, TRACK, 22).pitNow).toBe(true);
    expect(aiLapDecision(freshTyres, state, TRACK, 22).pitNow).toBe(false);
  });

  it('is deterministic across repeated calls', () => {
    const c = car({ personality: 'Opportunistic' });
    const state = live([c], { safetyCar: { active: true, lapsRemaining: 2, deployedOnLap: 20, reason: 'Incident', deployments: 1 } });
    const first = aiLapDecision(c, state, TRACK, 21);
    const second = aiLapDecision(c, state, TRACK, 21);
    expect(first).toEqual(second);
  });
});
