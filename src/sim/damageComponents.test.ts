import { describe, expect, it } from 'vitest';
import { computeLivePace } from './liveRacePace';
import { stepLiveRace } from './raceTickEngine';
import {
  type DamageComponent,
  collectDamageComponents,
  damagePacePenalty,
  resolveDamageProfile,
  resolveReliabilityRecoveryOutcome,
} from './damageComponents';
import { hasForcedRepairNeed, hasTerminalDamageNeed } from './safetyCarStrategy';
import type { LiveCarState, LiveRaceState } from '../types/liveTypes';
import { initialStint } from './strategyStint';
import type { LiveRaceMeta } from './liveRaceEngine';
import type { Track } from '../types/gameTypes';
import { tracks1995 } from '../data/tracks/tracks1995';

function car(
  overrides: Omit<Partial<LiveCarState>, 'pit' | 'reliabilityIssue'> & {
    pit?: Partial<LiveCarState['pit']>;
    reliabilityIssue?: LiveCarState['reliabilityIssue'];
  } = {},
): LiveCarState {
  const base: LiveCarState = {
    driverId: 'd1',
    teamId: 't1',
    isPlayer: true,
    grid: 1,
    position: 1,
    totalTime: 0,
    gapToLeader: 0,
    interval: 0,
    lastLapTime: 90,
    bestLap: null,
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
    instructionId: 'i',
    paceMode: 'Balanced',
    strategyStint: initialStint('Balanced'),
    liveRacePace: 6,
    tire: { compound: 'Dry', age: 3, wear: 20, stintTarget: 25 },
    pit: {
      plannedStops: 1,
      stopsMade: 0,
      scheduledLaps: [20],
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
    aeroHealth: 100,
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
    reliabilityIssue:
      overrides.reliabilityIssue === undefined
        ? base.reliabilityIssue
        : overrides.reliabilityIssue,
  };
}

function liveState(c: LiveCarState, overrides: Partial<LiveRaceState> = {}): LiveRaceState {
  return {
    raceId: 'r1',
    trackId: 'trk-1',
    seed: 'seed',
    totalLaps: 30,
    currentLap: 5,
    phase: 'racing',
    weather: { condition: 'Dry', gripLevel: 1, wet: false, changingSoon: false, label: 'Dry' },
    safetyCar: { active: false, lapsRemaining: 0, deployedOnLap: null, reason: null, deployments: 0 },
    cars: [c],
    events: [],
    pendingPrompt: null,
    promptCooldown: {},
    firedEventIds: [],
    recommendations: [],
    ignoredRecs: [],
    recCooldowns: {},
    battleTracker: {},
    retirements: 0,
    damageSettings: { damageFrequency: 1, damageSeverity: 1, repairTimeMultiplier: 1, reliabilityStrictness: 1 },
    ...overrides,
  };
}

const META: LiveRaceMeta = {
  track: tracks1995[0] as Track,
  driverNames: { d1: 'Driver One' },
  teamNames: { t1: 'Team One' },
  playerTeamId: 't1',
  year: 2015,
  series: 'F1',
};

describe('damage components', () => {
  it('maps active damage into components without double-penalising live pace', () => {
    const damaged = car({
      damaged: true,
      aeroHealth: 82,
    });
    const issueOnly = car({
      reliabilityIssue: {
        type: 'GearboxWarning',
        label: 'Gearbox warning',
        severity: 'Moderate',
        lap: 4,
        failureRisk: 0.03,
        managed: false,
      },
    });
    const baseline = car();
    const components = collectDamageComponents(damaged, 'F1', 2015, damaged.damageSettings);
    expect(components.some((component) => component.kind === 'Aero')).toBe(true);
    expect(collectDamageComponents(issueOnly, 'F1', 2015, issueOnly.damageSettings).some((component) => component.kind === 'Gearbox')).toBe(true);
    const paceGap =
      computeLivePace({
        car: baseline,
        lap: 5,
        totalLaps: 30,
        gripLevel: 1,
        intervalAhead: 0,
        formSwing: 0,
        mistakeThisLap: false,
      }) -
      computeLivePace({
        car: damaged,
        lap: 5,
        totalLaps: 30,
        gripLevel: 1,
        intervalAhead: 0,
        formSwing: 0,
        mistakeThisLap: false,
      });
    expect(paceGap).toBeCloseTo(damagePacePenalty(components), 5);
  });

  it('adds repair time to a pit stop when repairs are selected', () => {
    const damaged = car({
      damaged: true,
      aeroHealth: 82,
      pit: { pitRequested: true, repairMode: 'None' },
    });
    const repaired = car({
      damaged: true,
      aeroHealth: 82,
      pit: { pitRequested: true, repairMode: 'Full' },
    });
    const none = stepLiveRace(liveState(damaged), META);
    const full = stepLiveRace(liveState(repaired), META);
    const noneCar = none.cars[0];
    const fullCar = full.cars[0];
    expect(fullCar.pit.lastPitStopTime ?? 0).toBeGreaterThan(noneCar.pit.lastPitStopTime ?? 0);
  });

  it('forces a repair stop for severe damage and retires terminal non-repairable damage', () => {
    const severe = car({
      damaged: true,
      aeroHealth: 18,
      pit: { plannedStops: 1, stopsMade: 0, scheduledLaps: [6], lastWindowPromptLap: null },
    });
    expect(hasForcedRepairNeed(severe)).toBe(true);

    const terminal = stepLiveRace(
      liveState(
        car({
          damaged: true,
          aeroHealth: 0,
        }),
      ),
      META,
    );
    expect(terminal.cars[0].running).toBe(false);
    expect(hasTerminalDamageNeed(car({ damaged: true, aeroHealth: 0 }))).toBe(true);
  });

  it('supports in-race recovery outcome bands and rating gating', () => {
    const component: DamageComponent = {
      kind: 'Gearbox',
      severity: 'severe',
      pacePenalty: 0,
      riskType: 'failure' as const,
      riskContribution: 0,
      repairSeconds: 0,
      repairableInRace: true,
      managed: true,
    };
    expect(
      resolveReliabilityRecoveryOutcome(component, {
        carReliability: 88,
        teamReliabilityDepartment: 86,
        teamRaceOperations: 84,
        driverEnduranceConsistency: 90,
        driverComposure: 88,
        driverRiskManagement: 87,
      }, 0.02),
    ).toBe('full');
    expect(
      resolveReliabilityRecoveryOutcome(component, {
        carReliability: 88,
        teamReliabilityDepartment: 86,
        teamRaceOperations: 84,
        driverEnduranceConsistency: 90,
        driverComposure: 88,
        driverRiskManagement: 87,
      }, 0.55),
    ).toBe('partial');
    expect(
      resolveReliabilityRecoveryOutcome(component, {
        carReliability: 88,
        teamReliabilityDepartment: 86,
        teamRaceOperations: 84,
        driverEnduranceConsistency: 90,
        driverComposure: 88,
        driverRiskManagement: 87,
      }, 0.82),
    ).toBe('none');
    expect(
      resolveReliabilityRecoveryOutcome(component, {
        carReliability: 88,
        teamReliabilityDepartment: 86,
        teamRaceOperations: 84,
        driverEnduranceConsistency: 90,
        driverComposure: 88,
        driverRiskManagement: 87,
      }, 0.98),
    ).toBe('worse');

    const lowRatings = {
      carReliability: 22,
      teamReliabilityDepartment: 18,
      teamRaceOperations: 20,
      driverEnduranceConsistency: 24,
      driverComposure: 22,
      driverRiskManagement: 20,
    };
    const high = resolveReliabilityRecoveryOutcome(component, {
      carReliability: 88,
      teamReliabilityDepartment: 86,
      teamRaceOperations: 84,
      driverEnduranceConsistency: 90,
      driverComposure: 88,
      driverRiskManagement: 87,
    }, 0.18);
    const low = resolveReliabilityRecoveryOutcome(component, lowRatings, 0.47);
    const rank = (value: string): number => ({ full: 4, partial: 3, none: 2, worse: 1 }[value] ?? 0);
    expect(rank(high)).toBeGreaterThan(rank(low));
  });

  it('varies repair allowance by series and era', () => {
    const modernF1 = resolveDamageProfile('F1', 2015);
    const earlyF1 = resolveDamageProfile('F1', 1993);
    const nascar = resolveDamageProfile('NASCAR', 2015 as never);
    expect(modernF1.physicalRepairAllowed).toBe(true);
    expect(modernF1.mechanicalRepairAllowed).toBe(false);
    expect(earlyF1.mechanicalRepairAllowed).toBe(false);
    expect(nascar.physicalRepairAllowed).toBe(true);
    expect(nascar.mechanicalRepairAllowed).toBe(false);
  });
});
