import { describe, it, expect } from 'vitest';

import { generateCandidates } from './analyticsEngine';
import {
  acceptRecommendation,
  cancelPlayerPitPlan,
  ignoreRecommendation,
  modifyRecommendation,
  refreshRecommendations,
} from './raceTickEngine';
import { orderCardsBySeat } from './liveRaceCardOrder';
import type { LiveRaceMeta } from './liveRaceEngine';
import type { LiveCarState, LiveRaceState } from '../types/liveTypes';
import { initialStint } from './strategyStint';
import type { Track } from '../types/gameTypes';

// A running player car with sensible defaults; override the fields under test.
// `pit`/`tire` accept partials that are merged over the defaults.
type CarOverrides = Partial<Omit<LiveCarState, 'pit' | 'tire'>> & {
  pit?: Partial<LiveCarState['pit']>;
  tire?: Partial<LiveCarState['tire']>;
};
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
      scheduledLaps: [23],
      lastPitLap: null,
      inPitThisLap: false,
      window: { open: 20, ideal: 23, close: 26 },
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

const META: LiveRaceMeta = {
  track: {} as Track,
  driverNames: { d1: 'Driver One', d2: 'Driver Two' },
  teamNames: { 't-player': 'Player Team' },
  playerTeamId: 't-player',
  year: 2005,
  series: 'F1',
};

// Seed the analytics candidates onto the state so the accept/modify actions can
// find a recommendation to act on (mimics a tick's refresh).
function withCandidates(state: LiveRaceState): LiveRaceState {
  return { ...state, recommendations: generateCandidates(state.cars, state, state.currentLap) };
}

describe('pit window prompt (no automatic pit)', () => {
  it('raises a pitWindow prompt when the window opens instead of pitting', () => {
    const s = live([car({ pit: { window: { open: 20, ideal: 23, close: 26 } } })], { currentLap: 20 });
    const recs = generateCandidates(s.cars, s, s.currentLap);
    const pit = recs.find((r) => r.kind === 'pitWindow');
    expect(pit).toBeDefined();
    expect(pit!.priority).toBe('high');
    expect(pit!.action.pitNow).toBe(true);
    // The car itself is untouched — no stop was executed by generating the rec.
    expect(s.cars[0].pit.stopsMade).toBe(0);
    expect(s.cars[0].pit.pitRequested).toBe(false);
    // The player can stay out or cancel the whole plan.
    const altTypes = pit!.alternatives.map((a) => a.type);
    expect(altTypes).toContain('StayOut');
    expect(altTypes).toContain('CancelStop');
  });

  it('escalates to an urgent "last recommended lap" prompt on the final window lap', () => {
    const s = live([car({ pit: { window: { open: 20, ideal: 23, close: 26 } } })], { currentLap: 26 });
    const pit = generateCandidates(s.cars, s, s.currentLap).find((r) => r.kind === 'pitWindow');
    expect(pit).toBeDefined();
    expect(pit!.priority).toBe('urgent');
    expect(pit!.issue.toLowerCase()).toContain('final lap');
  });

  it('does not raise the pit-window prompt once the plan is cancelled', () => {
    const s = live([car({ pit: { window: { open: 20, ideal: 23, close: 26 }, planCancelled: true } })], {
      currentLap: 22,
    });
    const pit = generateCandidates(s.cars, s, s.currentLap).find((r) => r.kind === 'pitWindow');
    expect(pit).toBeUndefined();
  });

  it('accepting the pit-window prompt calls the car in (does not auto-double it)', () => {
    const s = withCandidates(
      live([car({ pit: { window: { open: 20, ideal: 23, close: 26 } } })], { currentLap: 20 }),
    );
    const rec = s.recommendations.find((r) => r.kind === 'pitWindow')!;
    const after = acceptRecommendation(s, rec.id, META);
    expect(after.cars[0].pit.pitRequested).toBe(true);
    // Exactly one pit-call event is logged (no duplicate popup/message).
    const pitEvents = after.events.filter((e) => /will pit this lap/.test(e.text));
    expect(pitEvents).toHaveLength(1);
    // The recommendation is consumed, not left to fire again.
    expect(after.recommendations.find((r) => r.id === rec.id)).toBeUndefined();
  });

  it('does not re-prompt after the player ignores the same pit window', () => {
    const s = withCandidates(
      live([car({ pit: { window: { open: 20, ideal: 23, close: 26 } } })], { currentLap: 20 }),
    );
    const rec = s.recommendations.find((candidate) => candidate.kind === 'pitWindow')!;
    const ignored = ignoreRecommendation(s, rec.id, META);
    const events: LiveRaceState['events'] = [];
    const refreshed = refreshRecommendations(
      ignored.cars,
      { ...ignored, currentLap: 26 },
      26,
      (driverId) => driverId,
      events,
    );
    expect(refreshed.recommendations.find((candidate) => candidate.kind === 'pitWindow')).toBeUndefined();
  });
});

describe('cancel planned pit stop', () => {
  it('cancelPlayerPitPlan clears the schedule and marks the plan cancelled', () => {
    const s = live([car({ pit: { scheduledLaps: [23], window: { open: 20, ideal: 23, close: 26 } } })]);
    const after = cancelPlayerPitPlan(s, 'd1');
    const p = after.cars[0].pit;
    expect(p.scheduledLaps).toEqual([]);
    expect(p.window).toBeNull();
    expect(p.planCancelled).toBe(true);
    expect(p.planStatus).toBe('cancelled');
    expect(p.pitRequested).toBe(false);
  });

  it('modifying the prompt with Cancel Planned Stop cancels the plan and logs it once', () => {
    const s = withCandidates(
      live([car({ pit: { window: { open: 20, ideal: 23, close: 26 } } })], { currentLap: 20 }),
    );
    const rec = s.recommendations.find((r) => r.kind === 'pitWindow')!;
    const after = modifyRecommendation(s, rec.id, 'CancelStop', META);
    expect(after.cars[0].pit.planCancelled).toBe(true);
    expect(after.cars[0].pit.planStatus).toBe('cancelled');
    const cancelEvents = after.events.filter((e) => /cancels .* planned stop/.test(e.text));
    expect(cancelEvents).toHaveLength(1);
    expect(after.recommendations.find((r) => r.id === rec.id)).toBeUndefined();
  });

  it('does not re-raise the pit-window prompt after a cancel', () => {
    const s = withCandidates(
      live([car({ pit: { window: { open: 20, ideal: 23, close: 26 } } })], { currentLap: 20 }),
    );
    const rec = s.recommendations.find((r) => r.kind === 'pitWindow')!;
    const after = modifyRecommendation(s, rec.id, 'CancelStop', META);
    // A fresh candidate pass on the next lap must not produce another pit-window rec.
    const next = generateCandidates(after.cars, { ...after, currentLap: 21 }, 21);
    expect(next.find((r) => r.kind === 'pitWindow')).toBeUndefined();
  });
});

describe('tyre-degradation re-prompt after skipping the stop', () => {
  it('recommends a stop once tyre wear becomes high even with the plan cancelled', () => {
    const s = live(
      [car({ pit: { window: null, planCancelled: true, scheduledLaps: [] }, tire: { wear: 82, age: 34 } })],
      { currentLap: 34 },
    );
    const recs = generateCandidates(s.cars, s, s.currentLap);
    const tyre = recs.find((r) => r.kind === 'tyres' || r.action.pitNow);
    expect(tyre).toBeDefined();
  });
});

describe('live race card order (P8)', () => {
  it('keeps player cards in seat order regardless of race position', () => {
    const c1 = car({ driverId: 'd1', position: 10 });
    const c2 = car({ driverId: 'd2', position: 8 });
    // Input order is arbitrary; seat order is [d1, d2].
    const ordered = orderCardsBySeat([c2, c1], ['d1', 'd2']);
    expect(ordered.map((c) => c.driverId)).toEqual(['d1', 'd2']);
    // Even when driver 2 is ahead on track, driver 1's card stays first.
    expect(ordered[0].position).toBe(10);
    expect(ordered[1].position).toBe(8);
  });

  it('is stable and pushes unknown drivers to the end', () => {
    const known = car({ driverId: 'd2' });
    const unknown = car({ driverId: 'dX' });
    const ordered = orderCardsBySeat([unknown, known], ['d1', 'd2']);
    expect(ordered.map((c) => c.driverId)).toEqual(['d2', 'dX']);
  });
});
