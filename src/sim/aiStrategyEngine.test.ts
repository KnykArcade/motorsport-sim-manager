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

  it('waits for light rain to persist before changing tyres', () => {
    const c = car({ personality: 'RiskAverse' });
    const transient = live([c], { weather: { condition: 'LightRain', lapsInCondition: 1, gripLevel: 0.72, wet: true, changingSoon: true, label: 'Light Rain' } });
    const confirmed = live([c], { weather: { condition: 'LightRain', lapsInCondition: 2, gripLevel: 0.72, wet: true, changingSoon: false, label: 'Light Rain' } });
    expect(aiLapDecision(c, transient, TRACK, 21).pitNow).toBe(false);
    expect(aiLapDecision(c, confirmed, TRACK, 21).pitNow).toBe(true);
  });

  it('waits for a dry track to persist before abandoning wets', () => {
    const c = car({ tire: { compound: 'Wet', age: 8, wear: 20, stintTarget: 20 } });
    const transient = live([c], { weather: { condition: 'Dry', lapsInCondition: 1, gripLevel: 1, wet: false, changingSoon: true, label: 'Dry' } });
    const confirmed = live([c], { weather: { condition: 'Dry', lapsInCondition: 2, gripLevel: 1, wet: false, changingSoon: false, label: 'Dry' } });
    expect(aiLapDecision(c, transient, TRACK, 21).pitNow).toBe(false);
    expect(aiLapDecision(c, confirmed, TRACK, 21).pitNow).toBe(true);
  });

  it('makes its scheduled stop once the target lap arrives', () => {
    const c = car({ pit: { plannedStops: 1, stopsMade: 0, scheduledLaps: [22], lastPitLap: null, inPitThisLap: false, window: null, pitRequested: false, planStatus: 'planned', planCancelled: false, lastWindowPromptLap: null } });
    const action = aiLapDecision(c, live([c]), TRACK, 22);
    expect(action.pitNow).toBe(true);
  });

  it('does not schedule another routine stop inside the minimum post-stop stint', () => {
    const c = car({
      pit: { plannedStops: 2, stopsMade: 1, scheduledLaps: [22], lastPitLap: 19, inPitThisLap: false, window: null, pitRequested: false, planStatus: 'planned', planCancelled: false, lastWindowPromptLap: null },
      tire: { compound: 'Dry', age: 3, wear: 35, stintTarget: 20 },
    });
    expect(aiLapDecision(c, live([c]), TRACK, 22).pitNow).toBe(false);
  });

  it('still permits an urgent weather stop inside the minimum post-stop stint', () => {
    const c = car({
      pit: { plannedStops: 1, stopsMade: 1, scheduledLaps: [], lastPitLap: 19, inPitThisLap: false, window: null, pitRequested: false, planStatus: 'completed', planCancelled: false, lastWindowPromptLap: null },
      tire: { compound: 'Dry', age: 3, wear: 15, stintTarget: 20 },
      personality: 'RiskAverse',
    });
    const wet = live([c], { weather: { condition: 'HeavyRain', gripLevel: 0.7, wet: true, changingSoon: false, label: 'Heavy Rain' } });
    const action = aiLapDecision(c, wet, TRACK, 22);
    expect(action.pitNow).toBe(true);
    expect(action.pitReason).toBe('Weather');
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
    const undercut = car({ personality: 'UndercutFocused', pit, tire: { compound: 'Dry', age: 18, wear: 50, stintTarget: 25 } });
    const overcut = car({ personality: 'OvercutFocused', pit, tire: { compound: 'Dry', age: 18, wear: 50, stintTarget: 25 } });

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
  it('holds an AI mode through its minimum stint instead of flipping immediately', () => {
    const c = car({
      paceMode: 'Attack',
      personality: 'Balanced',
      interval: 3,
      strategyStint: { ...initialStint('Attack'), consecutiveLaps: 2 },
    });
    expect(aiLapDecision(c, live([c]), TRACK, 21).paceMode).toBe('Attack');
  });

  it('allows a mode to end after its minimum stint when the trigger has cleared', () => {
    const c = car({
      paceMode: 'Attack',
      personality: 'Balanced',
      interval: 3,
      strategyStint: { ...initialStint('Attack'), consecutiveLaps: 3 },
    });
    expect(aiLapDecision(c, live([c]), TRACK, 21).paceMode).toBe('Balanced');
  });

  it('uses a wider exit threshold to keep an established attack stable', () => {
    const c = car({
      paceMode: 'Attack',
      personality: 'Balanced',
      interval: 1.5,
      strategyStint: { ...initialStint('Attack'), consecutiveLaps: 5 },
    });
    expect(aiLapDecision(c, live([c]), TRACK, 21).paceMode).toBe('Attack');
  });

  it('lets damage override mode hysteresis immediately', () => {
    const c = car({
      paceMode: 'Attack',
      damaged: true,
      strategyStint: { ...initialStint('Attack'), consecutiveLaps: 1 },
    });
    expect(aiLapDecision(c, live([c]), TRACK, 21).paceMode).toBe('Conservative');
  });

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

  it('does not defer when its own tyres are at the cliff', () => {
    const pit: LiveCarState['pit'] = { plannedStops: 1, stopsMade: 0, scheduledLaps: [22], lastPitLap: null, inPitThisLap: false, window: null, pitRequested: false, planStatus: 'planned', planCancelled: false, lastWindowPromptLap: null };
    const mate = car({ driverId: 'd2', teamId: 't1', position: 4, gapToLeader: 9, tire: { compound: 'Dry', age: 22, wear: 85, stintTarget: 25 }, pit: { ...pit } });
    const c = car({ driverId: 'd1', teamId: 't1', position: 5, gapToLeader: 11, tire: { compound: 'Dry', age: 26, wear: 90, stintTarget: 25 }, pit: { ...pit } });
    const action = aiLapDecision(c, live([mate, c]), TRACK, 22);
    expect(action.pitNow).toBe(true);
  });

  it('is deterministic across repeated calls', () => {
    const c = car({ personality: 'Opportunistic' });
    const state = live([c], { safetyCar: { active: true, lapsRemaining: 2, deployedOnLap: 20, reason: 'Incident', deployments: 1 } });
    const first = aiLapDecision(c, state, TRACK, 21);
    const second = aiLapDecision(c, state, TRACK, 21);
    expect(first).toEqual(second);
  });
});
