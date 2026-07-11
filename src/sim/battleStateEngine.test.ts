import { describe, expect, it } from 'vitest';
import type { CircuitSegmentSet } from '../types/circuitTypes';
import type { LiveCarState } from '../types/liveTypes';
import { createInitialCarPositionState } from './segmentRaceEngine';
import { stepBattleStates, type BattleState } from './battleStateEngine';

describe('battle state engine', () => {
  it('progresses through setup, attack and side-by-side before a clean pass', () => {
    let cars = [car('defender', 1000, 6), car('attacker', 980, 7)];
    let states: Record<string, BattleState> = {};
    const phases: string[] = [];
    let outcomes: string[] = [];
    for (let tick = 0; tick < 4; tick++) {
      const result = stepBattleStates(cars, circuit(true), states);
      cars = result.cars;
      states = result.states;
      phases.push(states['attacker>defender']?.phase ?? 'none');
      outcomes = result.outcomes.map((outcome) => outcome.outcome);
    }
    expect(phases).toEqual(['Setup', 'Attacking', 'SideBySide', 'Cooldown']);
    expect(outcomes).toEqual(['CleanPass']);
    expect(cars.map((candidate) => candidate.driverId)).toEqual(['attacker', 'defender']);
    expect(cars[0]!.positionState).toMatchObject({ normalizedLapProgress: 0.0005, currentSegmentIndex: 0 });
  });

  it('rejects battles on non-overtaking segments', () => {
    const result = stepBattleStates([car('defender', 1000, 6), car('attacker', 980, 7)], circuit(false));
    expect(result.states).toEqual({});
    expect(result.outcomes).toEqual([]);
  });

  it('prevents raw distance movement from completing an unresolved pass', () => {
    const previousCars = [car('defender', 1000, 6), car('attacker', 990, 7)];
    const crossedCars = [car('attacker', 1002, 7), car('defender', 1000, 6)];
    const result = stepBattleStates(crossedCars, circuit(true), {}, previousCars);
    expect(result.cars.map((candidate) => candidate.driverId)).toEqual(['defender', 'attacker']);
    expect(result.cars[1]!.positionState!.totalRaceDistanceMeters).toBe(995);
    expect(result.cars[1]!.positionState!.normalizedLapProgress).toBe(0.995);
  });

  it('makes a failed attempt cost authoritative distance without reordering', () => {
    let cars = [car('defender', 1000, 8), car('attacker', 980, 5)];
    let states: Record<string, BattleState> = {};
    let outcome = '';
    for (let tick = 0; tick < 4; tick++) {
      const result = stepBattleStates(cars, circuit(true), states);
      cars = result.cars;
      states = result.states;
      outcome = result.outcomes[0]?.outcome ?? outcome;
    }
    expect(outcome).toBe('AttackerLosesTime');
    expect(cars.map((candidate) => candidate.driverId)).toEqual(['defender', 'attacker']);
    expect(cars[1]?.positionState?.totalRaceDistanceMeters).toBe(988);
  });

  it('is deterministic for the same inputs and prior state', () => {
    const cars = [car('defender', 1000, 6), car('attacker', 980, 7)];
    expect(stepBattleStates(cars, circuit(true))).toEqual(stepBattleStates(cars, circuit(true)));
  });
});

function circuit(overtakingEligible: boolean): CircuitSegmentSet {
  return {
    id: 'battle', trackId: 'battle', trackName: 'Battle Circuit', lapLengthMeters: 1000,
    baselineLapTimeSeconds: 100, sectors: 3, inferred: false, source: 'authored',
    segments: [{
      id: 'zone', index: 0, name: 'Passing Zone', startProgress: 0, endProgress: 1,
      lengthMeters: 1000, type: 'OvertakingZone', representativeTimeSeconds: 100,
      powerSensitivity: 0, aeroSensitivity: 0, mechanicalGripSensitivity: 0,
      brakingSensitivity: 0, driverSkillSensitivity: 0, tyreStress: 0, brakeStress: 0,
      fuelDemand: 0, overtakingEligible, overtakingDifficulty: 0.4,
      sideBySideCapacity: overtakingEligible ? 2 : 1, dirtyAirSeverity: 0.2, draftStrength: 0.8,
      wallProximity: 0, incidentRisk: 0, wetWeatherSensitivity: 0,
      localYellowApplies: true, sector: 1,
    }],
  };
}

function car(driverId: string, distance: number, liveRacePace: number): LiveCarState {
  return {
    driverId, teamId: driverId, isPlayer: false, grid: 1, position: 1, totalTime: 0,
    gapToLeader: 0, interval: 0, lastLapTime: 0, bestLap: null, lapsCompleted: 0,
    running: true, status: 'Finished', retiredOnLap: null, paceRating: 0, baseRacePace: liveRacePace,
    baseFailureRisk: 0, baseCrashRisk: 0, baseMistakeRisk: 0, tireDegRate: 0, pitLossBase: 0,
    opsForm: 0, personality: 'Balanced', strategyId: 's', instructionId: 'i', paceMode: 'Balanced',
    strategyStint: { mode: 'Balanced', previousMode: null, startedLap: 0, consecutiveLaps: 1, source: 'initial', lastChangedLap: 0, warned: false },
    liveRacePace, tire: { compound: 'Dry', age: 0, wear: 10, stintTarget: 10 },
    pit: { plannedStops: 0, stopsMade: 0, scheduledLaps: [], lastPitLap: null, inPitThisLap: false, window: null, pitRequested: false, planStatus: 'completed', planCancelled: false, lastWindowPromptLap: null },
    reliabilityIssue: null, reliabilityRisk: 0, crashRisk: 0, damaged: false, fuel: 100,
    engineHealth: 100, gearboxHealth: 100, brakeHealth: 100, lastSectors: null, bestSectors: null,
    reliabilityRiskLevel: 'Low', crashRiskLevel: 'Low', trafficStatus: 'Attacking', statusMessage: '',
    positionState: { ...createInitialCarPositionState(), totalRaceDistanceMeters: distance, trafficPhase: 'Attacking' },
  };
}
