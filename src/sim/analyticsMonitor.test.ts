import { describe, it, expect } from 'vitest';
import { buildAnalyticsMonitor, kindLabel, selectPanelMode } from './analyticsMonitor';
import type {
  AnalyticsRecommendation,
  LiveCarState,
  LiveRaceState,
  PitStopState,
  RecStatus,
  TireState,
} from '../types/liveTypes';
import { initialStint } from './strategyStint';

type CarOverrides = Partial<Omit<LiveCarState, 'tire' | 'pit'>> & {
  tire?: Partial<TireState>;
  pit?: Partial<PitStopState>;
};

function rec(status: RecStatus, id = 'd1:defend'): AnalyticsRecommendation {
  return {
    id,
    driverId: 'd1',
    kind: 'defend',
    priority: 'medium',
    issue: 'x',
    recommendedAction: 'Defend',
    expectedImpact: 'y',
    confidence: 66,
    createdLap: 10,
    expiresLap: 15,
    action: { type: 'Defend', label: 'Defend', paceMode: 'Defend' },
    alternatives: [],
    status,
  };
}

// A running player car with sensible defaults; override the fields under test.
function car(overrides: CarOverrides = {}): LiveCarState {
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
    recCooldowns: {},
    battleTracker: {},
    retirements: 0,
    ...overrides,
  };
}

describe('buildAnalyticsMonitor — always produces useful intelligence', () => {
  it('returns a stable-state headline and full tile set for a clean car', () => {
    const m = buildAnalyticsMonitor(live([car({ position: 1, interval: 0 })]));
    expect(m.drivers).toHaveLength(1);
    expect(m.headline).toContain('All systems stable');
    expect(m.confidence).toBeGreaterThan(0);
    // Every monitoring tile is present with a defined status/value (never NaN).
    const keys = m.drivers[0].tiles.map((t) => t.key).sort();
    expect(keys).toEqual(['fuel', 'gap', 'reliability', 'strategy', 'traffic', 'tyre', 'weather']);
    for (const t of m.drivers[0].tiles) {
      expect(t.value).toBeTruthy();
      expect(t.value).not.toContain('NaN');
    }
  });

  it('keeps driver rows in the given seat order', () => {
    const cars = [car({ driverId: 'd2', position: 3 }), car({ driverId: 'd1', position: 8 })];
    const m = buildAnalyticsMonitor(live(cars), ['d1', 'd2']);
    expect(m.drivers.map((d) => d.driverId)).toEqual(['d1', 'd2']);
  });

  it('only includes running player cars', () => {
    const cars = [car({ driverId: 'd1' }), car({ driverId: 'd2', running: false, position: null })];
    const m = buildAnalyticsMonitor(live(cars), ['d1', 'd2']);
    expect(m.drivers.map((d) => d.driverId)).toEqual(['d1']);
  });
});

describe('buildAnalyticsMonitor — situational focus + tile status', () => {
  it('flags pressure from behind', () => {
    const lead = car({ driverId: 'd1', position: 4, interval: 5 });
    const chaser = car({ driverId: 'x', isPlayer: false, position: 5, interval: 0.6 });
    const m = buildAnalyticsMonitor(live([lead, chaser]), ['d1']);
    const gap = m.drivers[0].tiles.find((t) => t.key === 'gap')!;
    expect(gap.value.toLowerCase()).toContain('under pressure');
    expect(gap.status).toBe('orange');
  });

  it('flags an approaching pit window in the focus line', () => {
    const c = car({ pit: { window: { open: 24, ideal: 26, close: 28 }, plannedStops: 1, stopsMade: 0 } });
    const m = buildAnalyticsMonitor(live([c], { currentLap: 21 }));
    expect(m.drivers[0].focus.toLowerCase()).toContain('pit window opens in');
    expect(m.headline.toLowerCase()).toContain('pit window opens in');
  });

  it('surfaces high tyre wear with a warning tile status', () => {
    const c = car({ tire: { wear: 70 } });
    const m = buildAnalyticsMonitor(live([c]));
    const tyre = m.drivers[0].tiles.find((t) => t.key === 'tyre')!;
    expect(tyre.status).toBe('orange');
  });

  it('marks reliability risk on the reliability tile', () => {
    const c = car({ reliabilityRiskLevel: 'High' });
    const m = buildAnalyticsMonitor(live([c]));
    const rel = m.drivers[0].tiles.find((t) => t.key === 'reliability')!;
    expect(rel.status).toBe('orange');
    expect(m.headline.toLowerCase()).toContain('reliability');
  });

  it('lowers confidence and flags weather in changeable conditions', () => {
    const stable = buildAnalyticsMonitor(live([car()]));
    const changing = buildAnalyticsMonitor(
      live([car()], { weather: { condition: 'Changeable', gripLevel: 0.9, wet: false, changingSoon: true, label: 'Cloudy' } }),
    );
    expect(changing.confidence).toBeLessThan(stable.confidence);
    const weather = changing.drivers[0].tiles.find((t) => t.key === 'weather')!;
    expect(weather.status).toBe('blue');
  });

  it('reports a cheap safety-car stop opportunity', () => {
    const m = buildAnalyticsMonitor(
      live([car()], { safetyCar: { active: true, lapsRemaining: 2, deployedOnLap: 19, reason: 'Debris', deployments: 1 } }),
    );
    expect(m.drivers[0].focus.toLowerCase()).toContain('safety car');
  });
});

describe('buildAnalyticsMonitor — recent-decision cooldown', () => {
  it('surfaces an ignored recommendation still on cooldown', () => {
    const s = live([car()], {
      currentLap: 14,
      ignoredRecs: [{ key: 'd1:defend', lap: 12, issue: 'A car behind is within a second.', priority: 'medium', escalated: false }],
      recCooldowns: { 'd1:defend': 16 },
    });
    const m = buildAnalyticsMonitor(s);
    expect(m.recent).toHaveLength(1);
    expect(m.recent[0].kind).toBe('defend');
    expect(m.recent[0].cooldownLapsRemaining).toBe(2);
    expect(kindLabel('defend')).toBe('Defend');
  });

  it('drops recent decisions whose cooldown has elapsed', () => {
    const s = live([car()], {
      currentLap: 20,
      ignoredRecs: [{ key: 'd1:defend', lap: 12, issue: 'x', priority: 'medium', escalated: false }],
      recCooldowns: { 'd1:defend': 16 },
    });
    expect(buildAnalyticsMonitor(s).recent).toHaveLength(0);
  });
});

describe('selectPanelMode — permanent panel mode selection', () => {
  it('defaults to Monitoring when there are no recs or recent decisions', () => {
    expect(selectPanelMode([], 0)).toBe('monitoring');
  });

  it('switches to Decision when a pending recommendation exists', () => {
    expect(selectPanelMode([rec('pending')], 0)).toBe('decision');
  });

  it('shows Active Instruction when an accepted duration instruction is running', () => {
    expect(selectPanelMode([rec('active')], 0)).toBe('active');
  });

  it('prefers a pending Decision over an active instruction', () => {
    expect(selectPanelMode([rec('active', 'd1:defend'), rec('pending', 'd2:tyres')], 0)).toBe('decision');
  });

  it('shows Cooldown when only a recent ignored decision remains', () => {
    expect(selectPanelMode([], 1)).toBe('cooldown');
  });
});

describe('buildAnalyticsMonitor — numeric safety', () => {
  it('never emits NaN even with degenerate inputs', () => {
    const c = car({
      interval: Number.NaN,
      fuel: Number.NaN,
      tire: { wear: Number.NaN },
      position: null,
    });
    const m = buildAnalyticsMonitor(live([c], { totalLaps: 0, currentLap: 0 }));
    const serialized = JSON.stringify(m);
    expect(serialized).not.toContain('NaN');
    expect(serialized).not.toContain('Infinity');
    expect(m.confidence).toBeGreaterThan(0);
  });
});
