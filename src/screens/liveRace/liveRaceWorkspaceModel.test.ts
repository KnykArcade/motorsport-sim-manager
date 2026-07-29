import { beforeEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AnalyticsRecommendation, LiveCarState, LiveRaceState } from '../../types/liveTypes';
import { LiveRaceStrategyDrawer } from './LiveRaceWorkspace';
import {
  DEFAULT_LIVE_RACE_WORKSPACE_PREFERENCES,
  buildEngineerCheckpointSummary,
  buildLiveRaceStrategyProjection,
  canDelegateLiveRaceRecommendation,
  driverIdForRaceEvent,
  liveRaceDnfAlertFromTransition,
  liveRaceAutoPauseReason,
  liveRaceWorkspaceStorageKey,
  loadLiveRaceWorkspacePreferences,
  moveLiveRacePanel,
  saveLiveRaceWorkspacePreferences,
} from './liveRaceWorkspaceModel';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  get length() { return this.values.size; }
}

function car(overrides: Partial<LiveCarState> = {}): LiveCarState {
  return {
    driverId: 'driver-1',
    teamId: 'team-1',
    isPlayer: true,
    grid: 4,
    position: 3,
    totalTime: 1000,
    gapToLeader: 5,
    interval: 1,
    lastLapTime: 80,
    bestLap: 79,
    lapsCompleted: 20,
    running: true,
    status: 'Finished',
    retiredOnLap: null,
    paceRating: 8,
    baseRacePace: 8,
    baseFailureRisk: 0.01,
    baseCrashRisk: 0.01,
    baseMistakeRisk: 0.01,
    tireDegRate: 2,
    pitLossBase: 24,
    opsForm: 0,
    personality: 'Balanced',
    strategyId: 'balanced',
    instructionId: 'normal',
    paceMode: 'Balanced',
    strategyStint: {
      mode: 'Balanced',
      previousMode: null,
      startedLap: 1,
      consecutiveLaps: 20,
      source: 'initial',
      lastChangedLap: 1,
      warned: false,
    },
    liveRacePace: 8,
    tire: { compound: 'Dry', age: 20, wear: 40, stintTarget: 28 },
    pit: {
      plannedStops: 1,
      stopsMade: 0,
      scheduledLaps: [22],
      lastPitLap: null,
      inPitThisLap: false,
      window: { open: 21, ideal: 22, close: 24 },
      pitRequested: false,
      planStatus: 'planned',
      planCancelled: false,
      lastWindowPromptLap: null,
    },
    reliabilityIssue: null,
    reliabilityRisk: 0.01,
    crashRisk: 0.01,
    damaged: false,
    fuel: 55,
    engineHealth: 90,
    gearboxHealth: 88,
    brakeHealth: 86,
    lastSectors: [25, 28, 27],
    bestSectors: [24, 28, 27],
    reliabilityRiskLevel: 'Low',
    crashRiskLevel: 'Low',
    trafficStatus: 'Clear',
    statusMessage: 'Running',
    ...overrides,
  };
}

function live(overrides: Partial<LiveRaceState> = {}): LiveRaceState {
  return {
    raceId: 'race-1',
    trackId: 'track-1',
    seed: 'seed',
    totalLaps: 60,
    currentLap: 20,
    phase: 'racing',
    weather: { condition: 'Dry', gripLevel: 1, wet: false, changingSoon: false, label: 'Dry' },
    safetyCar: { active: false, lapsRemaining: 0, deployedOnLap: null, reason: null, deployments: 0 },
    cars: [car()],
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

describe('live race workspace preferences', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: new MemoryStorage(),
    });
  });

  it('persists per-career layout and sanitizes malformed panels', () => {
    saveLiveRaceWorkspacePreferences('career-a', {
      ...DEFAULT_LIVE_RACE_WORKSPACE_PREFERENCES,
      viewMode: 'data',
      panelOrder: ['events', 'timing', 'events'],
      hiddenPanels: ['telemetry'],
    });
    localStorage.setItem(liveRaceWorkspaceStorageKey('career-b'), '{"panelOrder":["bogus"]}');
    expect(loadLiveRaceWorkspacePreferences('career-a')).toMatchObject({
      viewMode: 'data',
      panelOrder: ['events', 'timing', 'analytics', 'pit-wall', 'engineer-summary', 'telemetry'],
      hiddenPanels: ['telemetry'],
    });
    expect(loadLiveRaceWorkspacePreferences('career-b').panelOrder).toEqual(
      DEFAULT_LIVE_RACE_WORKSPACE_PREFERENCES.panelOrder,
    );
    expect(moveLiveRacePanel(['timing', 'events'], 'events', -1)).toEqual(['events', 'timing']);
  });
});

describe('live race workflow decisions', () => {
  it('explains why a retired car cannot use the strategy drawer pit action', () => {
    const retiredCar = car({ running: false, status: 'DNF', retiredOnLap: 18 });
    const html = renderToStaticMarkup(
      createElement(LiveRaceStrategyDrawer, {
        open: true,
        live: live({ cars: [retiredCar] }),
        playerCars: [retiredCar],
        strategyByDriver: {},
        nameOf: () => 'Test Driver',
        onChange: () => undefined,
        onPit: () => undefined,
        onClose: () => undefined,
      }),
    );

    expect(html).toContain('disabled=""');
    expect(html).toContain('Pit controls are unavailable because this car is no longer running.');
    expect(html).toContain('aria-label="Box this lap for Test Driver. Pit controls are unavailable');
  });

  it('projects existing deterministic pace, wear, fuel, pit, and risk effects', () => {
    const projection = buildLiveRaceStrategyProjection(
      car(),
      live(),
      { intensity: 'AllOut', exitMode: 'Push' },
    );
    expect(projection.pace).toContain('-0.63s');
    expect(projection.fuel).toBe('No modeled fuel-use change');
    expect(projection.tires).toContain('+0.70');
    expect(projection.pitTiming).toContain('Window L21-24');
    expect(projection.risk).toContain('Higher');
  });

  it('pauses only for enabled transition categories', () => {
    const previous = live();
    const next = live({
      currentLap: 21,
      cars: [car({ lapsCompleted: 21 })],
    });
    expect(liveRaceAutoPauseReason(previous, next, {
      incidents: false,
      pitWindows: true,
      weatherChanges: false,
      mechanicalProblems: false,
      engineerMessages: false,
    })).toContain('pit window');
    expect(liveRaceAutoPauseReason(previous, next, {
      incidents: false,
      pitWindows: false,
      weatherChanges: false,
      mechanicalProblems: false,
      engineerMessages: false,
    })).toBeNull();
  });

  it('keeps running through an AI-only DNF while preserving its retirement alert', () => {
    const player = car();
    const opponent = car({
      driverId: 'driver-ai',
      teamId: 'team-ai',
      isPlayer: false,
    });
    const previous = live({ cars: [player, opponent] });
    const next = live({
      currentLap: 21,
      cars: [
        player,
        {
          ...opponent,
          running: false,
          status: 'DNF',
          position: null,
          retiredOnLap: 21,
          lastIncident: 'Engine failure',
        },
      ],
      events: [{
        lap: 21,
        text: 'Opponent retires — engine failure.',
        category: 'incident',
      }],
      retirements: 1,
      lastIncident: {
        lap: 21,
        driverIds: ['driver-ai'],
        severity: 0.6,
        safetyCarDeployed: false,
        trackProgress: 0.4,
      },
    });

    expect(liveRaceAutoPauseReason(previous, next, {
      incidents: true,
      pitWindows: false,
      weatherChanges: false,
      mechanicalProblems: false,
      engineerMessages: false,
    })).toBeNull();
    expect(liveRaceDnfAlertFromTransition(previous, next)).toMatchObject({
      lap: 21,
      entries: [{ driverId: 'driver-ai', isPlayer: false }],
    });
  });

  it.each(['driver-1', 'driver-2'])(
    'pauses and raises the acknowledgment alert when player driver %s retires',
    (retiredDriverId) => {
      const playerOne = car({ driverId: 'driver-1' });
      const playerTwo = car({ driverId: 'driver-2' });
      const previous = live({ cars: [playerOne, playerTwo] });
      const next = live({
        currentLap: 21,
        cars: [playerOne, playerTwo].map((entry) => entry.driverId === retiredDriverId
          ? {
              ...entry,
              running: false,
              status: 'DNF' as const,
              position: null,
              retiredOnLap: 21,
              lastIncident: 'Gearbox failure',
            }
          : entry),
        events: [{
          lap: 21,
          text: 'Player car retires — gearbox failure.',
          category: 'incident',
        }],
        retirements: 1,
        lastIncident: {
          lap: 21,
          driverIds: [retiredDriverId],
          severity: 0.6,
          safetyCarDeployed: false,
          trackProgress: 0.6,
        },
      });

      expect(liveRaceAutoPauseReason(previous, next, {
        incidents: true,
        pitWindows: false,
        weatherChanges: false,
        mechanicalProblems: false,
        engineerMessages: false,
      })).toContain('new incident');
      expect(liveRaceDnfAlertFromTransition(previous, next)).toMatchObject({
        entries: [{ driverId: retiredDriverId, isPlayer: true }],
      });
    },
  );

  it('pauses for simultaneous player and AI retirements and for ordinary non-DNF incidents', () => {
    const player = car();
    const opponent = car({
      driverId: 'driver-ai',
      teamId: 'team-ai',
      isPlayer: false,
    });
    const previous = live({ cars: [player, opponent] });
    const simultaneous = live({
      currentLap: 21,
      cars: [player, opponent].map((entry) => ({
        ...entry,
        running: false,
        status: 'DNF' as const,
        position: null,
        retiredOnLap: 21,
        lastIncident: 'Collision',
      })),
      events: [{ lap: 21, text: 'Two cars retire after contact.', category: 'incident' }],
      retirements: 2,
      lastIncident: {
        lap: 21,
        driverIds: ['driver-1', 'driver-ai'],
        severity: 0.9,
        safetyCarDeployed: true,
        trackProgress: 0.7,
      },
    });
    const ordinaryIncident = live({
      currentLap: 21,
      cars: [player, opponent],
      events: [{ lap: 21, text: 'Opponent spins but continues.', category: 'incident' }],
      lastIncident: {
        lap: 21,
        driverIds: ['driver-ai'],
        severity: 0.3,
        safetyCarDeployed: false,
        trackProgress: 0.2,
      },
    });
    const settings = {
      incidents: true,
      pitWindows: false,
      weatherChanges: false,
      mechanicalProblems: false,
      engineerMessages: false,
    };

    expect(liveRaceAutoPauseReason(previous, simultaneous, settings)).toContain('new incident');
    expect(liveRaceDnfAlertFromTransition(previous, simultaneous)?.entries).toHaveLength(2);
    expect(liveRaceAutoPauseReason(previous, ordinaryIncident, settings)).toContain('new incident');
  });

  it('delegates only confident routine strategy advice and escalates major calls', () => {
    const routine: AnalyticsRecommendation = {
      id: 'driver-1:pace',
      driverId: 'driver-1',
      kind: 'pace',
      priority: 'medium',
      issue: 'Pace available',
      recommendedAction: 'Push',
      expectedImpact: 'Pace improves',
      confidence: 82,
      createdLap: 20,
      expiresLap: 22,
      action: { type: 'Push', label: 'Push', paceMode: 'Push' },
      alternatives: [],
      status: 'pending',
    };
    const profile = {
      policy: 'staff_execute_routine',
      owner: 'Pat Symonds',
      confidence: 88,
      confidenceLabel: 'High',
    } as const;
    expect(canDelegateLiveRaceRecommendation(routine, profile)).toBe(true);
    expect(canDelegateLiveRaceRecommendation({ ...routine, priority: 'urgent' }, profile)).toBe(false);
    expect(canDelegateLiveRaceRecommendation({
      ...routine,
      action: { type: 'SwapPositions', label: 'Swap', teamOrder: 'SwapPositions' },
    }, profile)).toBe(false);
  });

  it('builds checkpoint summaries and resolves event links to affected drivers', () => {
    const state = live({ currentLap: 31 });
    const summary = buildEngineerCheckpointSummary(state, state.cars);
    expect(summary.checkpoint).toBe('Half distance');
    expect(summary.headline).toContain('1 net place');
    expect(driverIdForRaceEvent('Smith reports brake damage', state.cars, () => 'Alex Smith')).toBe('driver-1');
  });
});
