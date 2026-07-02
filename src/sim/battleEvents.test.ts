import { describe, it, expect } from 'vitest';
import { detectBattleEvents } from './raceTickEngine';
import type { LiveCarState } from '../types/liveTypes';
import { initialStint } from './strategyStint';

// Minimal running car; override the fields the battle detector reads
// (driverId, teamId, isPlayer, grid, position, interval, pit.inPitThisLap).
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

const name = (id: string) => id.toUpperCase();
const TOTAL = 60;

describe('detectBattleEvents — completed passes', () => {
  it('logs a clean on-track pass when two cars swap places', () => {
    // Last lap: a=P1, b=P2. This lap they swapped -> new order [b, a].
    const prev = [
      car({ driverId: 'a', teamId: 'ta', position: 1 }),
      car({ driverId: 'b', teamId: 'tb', position: 2 }),
    ];
    const running = [
      car({ driverId: 'b', teamId: 'tb', position: 1 }),
      car({ driverId: 'a', teamId: 'ta', position: 2 }),
    ];
    const { events } = detectBattleEvents(prev, running, 10, TOTAL, {}, name);
    expect(events).toHaveLength(1);
    expect(events[0].text).toBe('B passes A for P1.');
    expect(events[0].category).toBe('battle');
  });

  it('marks a teammate pass as such', () => {
    const prev = [
      car({ driverId: 'a', teamId: 'shared', position: 1 }),
      car({ driverId: 'b', teamId: 'shared', position: 2 }),
    ];
    const running = [
      car({ driverId: 'b', teamId: 'shared', position: 1 }),
      car({ driverId: 'a', teamId: 'shared', position: 2 }),
    ];
    const { events } = detectBattleEvents(prev, running, 10, TOTAL, {}, name);
    expect(events[0].text).toBe('B passes A for P1 (teammates).');
  });

  it('does not log a swap caused by a pit stop', () => {
    const prev = [
      car({ driverId: 'a', teamId: 'ta', position: 1 }),
      car({ driverId: 'b', teamId: 'tb', position: 2 }),
    ];
    // b jumps ahead but a pitted this lap -> not an on-track pass.
    const running = [
      car({ driverId: 'b', teamId: 'tb', position: 1 }),
      car({
        driverId: 'a',
        teamId: 'ta',
        position: 2,
        pit: { inPitThisLap: true } as LiveCarState['pit'],
      }),
    ];
    const { events } = detectBattleEvents(prev, running, 10, TOTAL, {}, name);
    expect(events.filter((e) => e.text.includes('passes'))).toHaveLength(0);
  });

  it('suppresses insignificant backmarker passes (no player, not points, not final laps)', () => {
    const prev = [
      car({ driverId: 'a', teamId: 'ta', position: 18 }),
      car({ driverId: 'b', teamId: 'tb', position: 19 }),
    ];
    const running = [
      car({ driverId: 'b', teamId: 'tb', position: 18 }),
      car({ driverId: 'a', teamId: 'ta', position: 19 }),
    ];
    // Pad the field so positions 18/19 are genuinely outside the points.
    const filler = Array.from({ length: 17 }, (_, i) =>
      car({ driverId: `f${i}`, teamId: `tf${i}`, position: i + 1 }),
    );
    const { events } = detectBattleEvents(
      [...filler, ...prev],
      [...filler, ...running],
      10,
      TOTAL,
      {},
      name,
    );
    expect(events).toHaveLength(0);
  });

  it('keeps a backmarker pass in the final laps', () => {
    const prev = [
      car({ driverId: 'a', teamId: 'ta', position: 18 }),
      car({ driverId: 'b', teamId: 'tb', position: 19 }),
    ];
    const running = [
      car({ driverId: 'b', teamId: 'tb', position: 18 }),
      car({ driverId: 'a', teamId: 'ta', position: 19 }),
    ];
    const filler = Array.from({ length: 17 }, (_, i) =>
      car({ driverId: `f${i}`, teamId: `tf${i}`, position: i + 1 }),
    );
    const { events } = detectBattleEvents(
      [...filler, ...prev],
      [...filler, ...running],
      55, // > TOTAL - 10
      TOTAL,
      {},
      name,
    );
    expect(events.some((e) => e.text === 'B passes A for P18.')).toBe(true);
  });
});

describe('detectBattleEvents — sustained pressure', () => {
  it('logs a defend only after sustained pressure, not every lap', () => {
    const prev = [
      car({ driverId: 'a', teamId: 'ta', position: 1 }),
      car({ driverId: 'b', teamId: 'tb', position: 2 }),
    ];
    const running = [
      car({ driverId: 'a', teamId: 'ta', position: 1 }),
      car({ driverId: 'b', teamId: 'tb', position: 2, interval: 0.5 }), // within striking distance
    ];
    let tracker: Record<string, number> = {};
    const texts: string[] = [];
    for (let lap = 10; lap <= 12; lap++) {
      const res = detectBattleEvents(prev, running, lap, TOTAL, tracker, name);
      tracker = res.tracker;
      texts.push(...res.events.map((e) => e.text));
    }
    // Only one defend line across the three laps of pressure (at the threshold).
    expect(texts.filter((t) => t.includes('defends'))).toEqual(['A defends P1 from B.']);
  });

  it('logs a faded attack once the pressure ends without a pass', () => {
    const prev = [
      car({ driverId: 'a', teamId: 'ta', position: 1, isPlayer: true }),
      car({ driverId: 'b', teamId: 'tb', position: 2 }),
    ];
    // Attacker has dropped back (large interval) after a long challenge.
    const running = [
      car({ driverId: 'a', teamId: 'ta', position: 1, isPlayer: true }),
      car({ driverId: 'b', teamId: 'tb', position: 2, interval: 3.0 }),
    ];
    const { events } = detectBattleEvents(prev, running, 20, TOTAL, { 'b>a': 3 }, name);
    expect(events.some((e) => e.text === "B's attack on A fades.")).toBe(true);
  });
});

describe('detectBattleEvents — pit-cycle position changes', () => {
  it('logs a player driver losing places after a stop', () => {
    const prev = [car({ driverId: 'p', position: 5, isPlayer: true })];
    const running = [
      // one filler ahead + player now P8 after pitting
      car({ driverId: 'x', position: 1 }),
      car({ driverId: 'y', position: 2 }),
      car({ driverId: 'z', position: 3 }),
      car({ driverId: 'w', position: 4 }),
      car({ driverId: 'v', position: 5 }),
      car({ driverId: 'u', position: 6 }),
      car({ driverId: 't', position: 7 }),
      car({ driverId: 'p', position: 8, isPlayer: true, pit: { inPitThisLap: true } as LiveCarState['pit'] }),
    ];
    const prevFull = [
      car({ driverId: 'x', position: 1 }),
      car({ driverId: 'y', position: 2 }),
      car({ driverId: 'z', position: 3 }),
      car({ driverId: 'w', position: 4 }),
      ...prev,
      car({ driverId: 'u', position: 6 }),
      car({ driverId: 't', position: 7 }),
    ];
    const { events } = detectBattleEvents(prevFull, running, 22, TOTAL, {}, name);
    expect(events.some((e) => e.text === 'P drops 3 places to P8 after the stop.')).toBe(true);
    expect(events.every((e) => e.category === 'battle')).toBe(true);
  });
});
