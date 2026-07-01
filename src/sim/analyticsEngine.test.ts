import { describe, it, expect } from 'vitest';
import {
  generateCandidates,
  parseDurationLaps,
  requiresDecision,
  cooldownFor,
  REC_COOLDOWN,
} from './analyticsEngine';
import {
  acceptRecommendation,
  ignoreRecommendation,
  modifyRecommendation,
  expireRecommendation,
  refreshRecommendations,
} from './raceTickEngine';
import type { LiveRaceMeta } from './liveRaceEngine';
import type { LiveCarState, LiveRaceState } from '../types/liveTypes';
import type { RaceEvent } from '../types/simTypes';
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
    recCooldowns: {},
    retirements: 0,
    ...overrides,
  };
}

const META: LiveRaceMeta = {
  track: {} as Track,
  driverNames: { d1: 'Driver One', d2: 'Driver Two', d3: 'Driver Three' },
  teamNames: { 't-player': 'Player Team' },
  playerTeamId: 't-player',
  year: 2005,
};

const nameOf = (id: string) => META.driverNames[id] ?? id;

// Advance the recommendation lifecycle one lap (mimics the merge inside a tick),
// leaving the sim state otherwise untouched so tests control the conditions.
function merge(state: LiveRaceState, lap: number): LiveRaceState {
  const evs: RaceEvent[] = [];
  const { recommendations, ignoredRecs, recCooldowns } = refreshRecommendations(
    state.cars,
    { ...state, currentLap: lap },
    lap,
    nameOf,
    evs,
  );
  return {
    ...state,
    currentLap: lap,
    recommendations,
    ignoredRecs,
    recCooldowns,
    events: [...state.events, ...evs],
  };
}

// Seed a state with the freshly generated pending candidates for `lap`.
function withCandidates(state: LiveRaceState, lap = state.currentLap): LiveRaceState {
  return { ...state, currentLap: lap, recommendations: generateCandidates(state.cars, state, lap) };
}

describe('analyticsEngine — candidate generation', () => {
  it('flags critical reliability as an urgent Protect Engine recommendation (pending)', () => {
    const s = live([car({ reliabilityRiskLevel: 'Critical' })]);
    const recs = generateCandidates(s.cars, s, s.currentLap);
    expect(recs).toHaveLength(1);
    expect(recs[0].kind).toBe('reliability');
    expect(recs[0].priority).toBe('urgent');
    expect(recs[0].status).toBe('pending');
    expect(recs[0].action.paceMode).toBe('ProtectEngine');
    expect(recs[0].driverId).toBe('d1');
  });

  it('recommends wets when the track is wet and the car is on slicks', () => {
    const s = live([car()], {
      weather: { condition: 'HeavyRain', gripLevel: 0.7, wet: true, changingSoon: false, label: 'Heavy Rain' },
    });
    const recs = generateCandidates(s.cars, s, s.currentLap);
    expect(recs[0].kind).toBe('weatherTyres');
    expect(recs[0].action.pitNow).toBe(true);
  });

  it('picks the single highest-priority candidate per driver', () => {
    const s = live([
      car({ crashRiskLevel: 'High', paceMode: 'Push', tire: { compound: 'Dry', age: 30, wear: 65, stintTarget: 25 } }),
    ]);
    const recs = generateCandidates(s.cars, s, s.currentLap);
    expect(recs).toHaveLength(1);
    expect(recs[0].priority).toBe('high');
  });

  it('never produces recommendations for non-player cars', () => {
    const s = live([car({ isPlayer: false, reliabilityRiskLevel: 'Critical' })]);
    expect(generateCandidates(s.cars, s, s.currentLap)).toHaveLength(0);
  });

  it('parses a suggested duration into laps for duration-based mode advice', () => {
    // High reliability advises Protect Engine for "5-8 laps" → midpoint 6.
    const s = live([car({ reliabilityRiskLevel: 'High' })]);
    const rec = generateCandidates(s.cars, s, s.currentLap)[0];
    expect(rec.suggestedDurationLaps).toBe(6);
  });

  it('generates independent recommendations for each player driver', () => {
    // d3 (non-player) leads so d1 has a car ahead to attack.
    const lead = car({ driverId: 'd3', isPlayer: false, position: 4, interval: 3 });
    const d1 = car({ driverId: 'd1', position: 5, interval: 0.6, baseRacePace: 6 });
    const d2 = car({ driverId: 'd2', position: 8, interval: 20, reliabilityRiskLevel: 'High', baseRacePace: 6 });
    const recs = generateCandidates([lead, d1, d2], live([lead, d1, d2]), 20);
    const byDriver = Object.fromEntries(recs.map((r) => [r.driverId, r]));
    expect(byDriver.d1.kind).toBe('attack');
    expect(byDriver.d2.kind).toBe('reliability');
  });
});

describe('parseDurationLaps', () => {
  it('averages a range', () => expect(parseDurationLaps('3-5 laps', 10, 50)).toBe(4));
  it('reads a single count', () => expect(parseDurationLaps('5 laps', 10, 50)).toBe(5));
  it('maps "rest of race" to laps remaining', () => expect(parseDurationLaps('rest of race', 20, 50)).toBe(30));
  it('defaults qualitative durations to a stint', () => expect(parseDurationLaps('until the stop', 10, 50)).toBe(6));
  it('is undefined with no text', () => expect(parseDurationLaps(undefined, 10, 50)).toBeUndefined());
});

describe('requiresDecision (pause/countdown)', () => {
  const rec = (over: Partial<LiveRaceState['recommendations'][number]>) =>
    generateCandidates(
      [car({ reliabilityRiskLevel: 'Critical' })],
      live([car({ reliabilityRiskLevel: 'Critical' })]),
      20,
    ).map((r) => ({ ...r, ...over }))[0];

  it('pauses for high/urgent pending recs', () => {
    expect(requiresDecision(rec({ priority: 'urgent' }))).toBe(true);
    expect(requiresDecision(rec({ priority: 'high' }))).toBe(true);
  });
  it('pauses for timing-sensitive medium recs but not others', () => {
    expect(requiresDecision(rec({ priority: 'medium', kind: 'safetyCarPit' }))).toBe(true);
    expect(requiresDecision(rec({ priority: 'medium', kind: 'damage' }))).toBe(false);
  });
  it('never pauses for low recs or non-pending recs', () => {
    expect(requiresDecision(rec({ priority: 'low' }))).toBe(false);
    expect(requiresDecision(rec({ priority: 'urgent', status: 'active' }))).toBe(false);
  });
});

describe('Accept / Modify / Ignore', () => {
  it('Accept applies the recommended action, removes a one-shot rec, and logs it', () => {
    const s = withCandidates(live([car({ reliabilityRiskLevel: 'Critical' })]));
    const rec = s.recommendations[0];
    const after = acceptRecommendation(s, rec.id, META);
    expect(after.cars[0].paceMode).toBe('ProtectEngine');
    // Critical Protect is "rest of race" → an active instruction, not removed.
    expect(after.recommendations[0].status).toBe('active');
    expect(after.events.some((e) => /switches to Protect Engine/.test(e.text))).toBe(true);
  });

  it('Modify applies a chosen alternative action and logs it', () => {
    const s = withCandidates(live([car({ reliabilityRiskLevel: 'High' })]));
    const rec = s.recommendations[0];
    const alt = rec.alternatives.find((a) => a.type === 'PitNow')!;
    const after = modifyRecommendation(s, rec.id, alt.type, META);
    expect(after.cars[0].pit.pitRequested).toBe(true);
    expect(after.recommendations).toHaveLength(0);
    expect(after.events.some((e) => /modified analytics recommendation/.test(e.text))).toBe(true);
  });

  it('Ignore dismisses the rec, logs it, and puts the kind on cooldown', () => {
    const s = withCandidates(live([car({ reliabilityRiskLevel: 'High' })]));
    const rec = s.recommendations[0];
    const after = ignoreRecommendation(s, rec.id, META);
    expect(after.recommendations).toHaveLength(0);
    expect(after.ignoredRecs.some((i) => i.key === rec.id)).toBe(true);
    expect(after.recCooldowns[rec.id]).toBe(after.currentLap + cooldownFor('reliability'));
    expect(after.events.some((e) => /ignored analytics recommendation/.test(e.text))).toBe(true);
  });
});

describe('recommendation lifecycle — duration, dedup, cooldown', () => {
  // Build a state where d1 is close behind a (non-player) car ahead → Attack advice.
  function attackState(): LiveRaceState {
    const lead = car({ driverId: 'd3', isPlayer: false, position: 4, interval: 3 });
    const d1 = car({ driverId: 'd1', position: 5, interval: 0.6, baseRacePace: 6 });
    return live([lead, d1]);
  }

  it('a recommendation appears once and is not duplicated across laps while pending', () => {
    let s = withCandidates(attackState(), 20);
    expect(s.recommendations.filter((r) => r.kind === 'attack')).toHaveLength(1);
    s = merge(s, 21);
    expect(s.recommendations.filter((r) => r.kind === 'attack')).toHaveLength(1);
  });

  it('accepting Attack for 4 laps becomes active and does not re-prompt during those laps', () => {
    let s = withCandidates(attackState(), 20);
    const rec = s.recommendations.find((r) => r.kind === 'attack')!;
    expect(rec.suggestedDurationLaps).toBe(4);

    s = acceptRecommendation(s, rec.id, META);
    const active = s.recommendations.find((r) => r.id === rec.id)!;
    expect(active.status).toBe('active');
    expect(active.appliedUntilLap).toBe(24);
    expect(s.cars.find((c) => c.driverId === 'd1')!.paceMode).toBe('Attack');
    expect(s.events.filter((e) => /switches to Attack for 4 laps/.test(e.text))).toHaveLength(1);

    for (const lap of [21, 22, 23]) {
      s = merge(s, lap);
      const rows = s.recommendations.filter((r) => r.driverId === 'd1');
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('active');
    }
    // No repeated "switches to Attack" logging while active.
    expect(s.events.filter((e) => /switches to Attack/.test(e.text))).toHaveLength(1);
  });

  it('an active instruction completes after its duration and returns to Balanced', () => {
    let s = withCandidates(attackState(), 20);
    const rec = s.recommendations.find((r) => r.kind === 'attack')!;
    s = acceptRecommendation(s, rec.id, META);
    for (const lap of [21, 22, 23]) s = merge(s, lap);
    s = merge(s, 24);
    expect(s.recommendations.find((r) => r.id === rec.id)).toBeUndefined();
    expect(s.cars.find((c) => c.driverId === 'd1')!.paceMode).toBe('Balanced');
    expect(s.events.some((e) => /completes Attack instruction/.test(e.text))).toBe(true);
    // Completed kind is on cooldown, so it does not immediately re-raise.
    const s25 = merge(s, 25);
    expect(s25.recommendations.some((r) => r.kind === 'attack')).toBe(false);
  });

  it('an ignored rec is suppressed during cooldown and can re-raise afterwards', () => {
    const s0 = withCandidates(live([car({ reliabilityRiskLevel: 'High' })]));
    const rec = s0.recommendations[0];
    const ignored = ignoreRecommendation(s0, rec.id, META);

    const soon = merge(
      live([car({ reliabilityRiskLevel: 'High' })], {
        currentLap: 22,
        recCooldowns: ignored.recCooldowns,
        ignoredRecs: ignored.ignoredRecs,
      }),
      22,
    );
    expect(soon.recommendations).toHaveLength(0);

    const later = merge(
      live([car({ reliabilityRiskLevel: 'High' })], {
        currentLap: 20 + cooldownFor('reliability'),
        recCooldowns: ignored.recCooldowns,
        ignoredRecs: ignored.ignoredRecs,
      }),
      20 + cooldownFor('reliability'),
    );
    expect(later.recommendations).toHaveLength(1);
  });

  it('an ignored warning re-raises immediately (urgent) when the risk worsens', () => {
    const s0 = withCandidates(live([car({ reliabilityRiskLevel: 'High' })]));
    const rec = s0.recommendations[0];
    const ignored = ignoreRecommendation(s0, rec.id, META);

    // Risk jumps to Critical while still inside the normal cooldown window.
    const worsened = merge(
      live([car({ reliabilityRiskLevel: 'Critical' })], {
        currentLap: 22,
        recCooldowns: ignored.recCooldowns,
        ignoredRecs: ignored.ignoredRecs,
      }),
      22,
    );
    const rel = worsened.recommendations.find((r) => r.kind === 'reliability');
    expect(rel).toBeDefined();
    expect(rel!.priority).toBe('urgent');
    expect(worsened.events.some((e) => /earlier ignored warning worsens/.test(e.text))).toBe(true);
  });
});

describe('pit decision protection', () => {
  function scState(): LiveRaceState {
    return live([car()], {
      safetyCar: { active: true, lapsRemaining: 3, deployedOnLap: 20, reason: 'incident', deployments: 1 },
    });
  }

  it('accepting Pit Now schedules exactly one stop and logs it once', () => {
    let s = withCandidates(scState());
    const rec = s.recommendations.find((r) => r.kind === 'safetyCarPit')!;
    expect(rec.action.pitNow).toBe(true);
    s = acceptRecommendation(s, rec.id, META);
    expect(s.cars[0].pit.pitRequested).toBe(true);
    expect(s.recommendations).toHaveLength(0);
    expect(s.events.filter((e) => /will pit this lap/.test(e.text))).toHaveLength(1);
  });

  it('a duplicate pit call for an already-requested car does not create a second stop', () => {
    let s = withCandidates(scState());
    const rec = s.recommendations.find((r) => r.kind === 'safetyCarPit')!;
    s = acceptRecommendation(s, rec.id, META);
    const requestedBefore = s.cars[0].pit.pitRequested;

    // A second identical recommendation arrives (e.g. from another lap/system).
    const dup = { ...rec };
    s = { ...s, recommendations: [dup] };
    s = acceptRecommendation(s, dup.id, META);

    expect(requestedBefore).toBe(true);
    expect(s.cars[0].pit.pitRequested).toBe(true);
    expect(s.cars[0].pit.stopsMade).toBe(0); // still just one pending stop
    expect(s.events.some((e) => /duplicate stop avoided/.test(e.text))).toBe(true);
  });
});

describe('timeout / expiry', () => {
  it('expiring a rec auto-ignores it and logs "no pit wall response"', () => {
    let s = withCandidates(live([car({ reliabilityRiskLevel: 'High' })]));
    const rec = s.recommendations[0];
    s = expireRecommendation(s, rec.id, META);
    expect(s.recommendations).toHaveLength(0);
    expect(s.ignoredRecs.some((i) => i.key === rec.id)).toBe(true);
    expect(s.recCooldowns[rec.id]).toBeGreaterThan(s.currentLap);
    expect(s.events.some((e) => /no pit wall response/.test(e.text))).toBe(true);
  });
});

describe('grouped multi-driver decisions', () => {
  function groupedState(): LiveRaceState {
    // Safety car: both player cars can pit. Independent rows expected.
    const d1 = car({ driverId: 'd1', position: 5 });
    const d2 = car({ driverId: 'd2', position: 8, interval: 12 });
    return live([d1, d2], {
      safetyCar: { active: true, lapsRemaining: 3, deployedOnLap: 20, reason: 'incident', deployments: 1 },
    });
  }

  it('generates a per-driver row for each affected player driver', () => {
    const s = withCandidates(groupedState());
    expect(s.recommendations.filter((r) => r.kind === 'safetyCarPit')).toHaveLength(2);
  });

  it('allows different decisions per driver (one pits, one stays out)', () => {
    let s = withCandidates(groupedState());
    const r1 = s.recommendations.find((r) => r.driverId === 'd1')!;
    const r2 = s.recommendations.find((r) => r.driverId === 'd2')!;
    s = acceptRecommendation(s, r1.id, META); // d1 pits
    s = ignoreRecommendation(s, r2.id, META); // d2 stays out
    expect(s.cars.find((c) => c.driverId === 'd1')!.pit.pitRequested).toBe(true);
    expect(s.cars.find((c) => c.driverId === 'd2')!.pit.pitRequested).toBe(false);
    expect(s.recommendations).toHaveLength(0);
  });
});

describe('event log cleanup', () => {
  it('does not spam repeated accepted-recommendation lines while an instruction is active', () => {
    const lead = car({ driverId: 'd3', isPlayer: false, position: 4, interval: 3 });
    const d1 = car({ driverId: 'd1', position: 5, interval: 0.6 });
    let s = withCandidates(live([lead, d1]), 20);
    const rec = s.recommendations.find((r) => r.kind === 'attack')!;
    s = acceptRecommendation(s, rec.id, META);
    for (const lap of [21, 22, 23, 24]) s = merge(s, lap);
    const acceptLines = s.events.filter((e) => /switches to Attack|accepted analytics/.test(e.text));
    expect(acceptLines).toHaveLength(1);
  });
});

// Referenced so the shared REC_COOLDOWN export stays covered.
describe('cooldown table', () => {
  it('falls back to the default cooldown for unknown kinds', () => {
    expect(cooldownFor('nonexistent-kind')).toBe(REC_COOLDOWN);
  });
});
