import { describe, it, expect } from 'vitest';
import { tracks1995 } from '../data/tracks/tracks1995';
import { drivers1995 } from '../data/drivers/drivers1995';
import { cars1995 } from '../data/cars/cars1995';
import { BALANCED_SETUP } from '../data/setup/setupComponents';
import { createSeededRandom, deriveSeed } from './random';
import type { Car } from '../types/gameTypes';
import type { PracticeProgram } from '../types/practiceTypes';
import {
  accumulateKnowledge,
  calculatePracticeFeedbackConfidence,
  calculateSetupKnowledge,
  defaultAssignments,
  emptyKnowledge,
  generatePracticeFeedback,
  practiceLapBudget,
  practiceSetupConfidenceBonus,
  recommendedPracticeProgram,
  runDriverProgram,
  runPracticeSession,
  sessionLapCost,
  teamKnowledgeGaps,
  updateDriverConfidenceFromPractice,
  weekendSessionKinds,
  type DriverProgramContext,
} from './practiceProgramEngine';
import { makeWeatherState } from './weatherEngine';
import type { PracticeSession } from '../types/practiceTypes';

const track = tracks1995[0];
const driver = drivers1995[0];

function ctx(overrides: Partial<DriverProgramContext> = {}): DriverProgramContext {
  return {
    driver,
    setup: BALANCED_SETUP,
    track,
    priorSetupKnowledge: 0,
    priorTireKnowledge: 0,
    priorReliabilityKnowledge: 0,
    ...overrides,
  };
}

describe('weekendSessionKinds', () => {
  it('uses three free-practice sessions for modern F1 and a warmup for classic eras', () => {
    expect(weekendSessionKinds(2026, 'F1')).toContain('Practice3');
    expect(weekendSessionKinds(1995, 'F1')).toContain('Warmup');
    expect(weekendSessionKinds(1995, 'F1')).not.toContain('Practice3');
    expect(weekendSessionKinds(2026, 'IndyCar')).toContain('Warmup');
  });
});

describe('generatePracticeFeedback', () => {
  it('returns directional feedback without revealing exact setup values', () => {
    const rng = createSeededRandom('fb');
    const items = generatePracticeFeedback(driver, BALANCED_SETUP, track, 'SetupExploration', rng);
    expect(items.length).toBeGreaterThan(0);
    for (const i of items) {
      expect(i.message.length).toBeGreaterThan(0);
      // Feedback is qualitative — it never prints a raw setup number.
      expect(/\d/.test(i.message)).toBe(false);
    }
  });
});

describe('car-aware practice feedback (P5)', () => {
  const baseCar = cars1995[0];
  const carWith = (over: Partial<Car['ratings']>): Car => ({
    ...baseCar,
    ratings: { ...baseCar.ratings, ...over },
  });
  const messages = (car: Car | undefined, program: PracticeProgram = 'SetupExploration') =>
    generatePracticeFeedback(driver, BALANCED_SETUP, track, program, createSeededRandom('car'), {
      car,
    })
      .map((f) => f.message.toLowerCase())
      .join(' | ');

  it('surfaces mechanical-grip hints for a weak-mechanical-grip car', () => {
    const weak = messages(carWith({ mechanicalGrip: 20, aeroEfficiency: 90, enginePower: 90 }));
    const strong = messages(carWith({ mechanicalGrip: 90, aeroEfficiency: 90, enginePower: 90 }));
    expect(weak).toMatch(/traction|grip|rear/);
    expect(weak).not.toEqual(strong);
  });

  it('flags cooling / conservative settings for a fragile car in a reliability shakedown', () => {
    const fragile = messages(carWith({ reliability: 20 }), 'ReliabilityShakedown');
    expect(fragile).toMatch(/cool|conservative|temperature|fragile/);
  });

  it('mentions aero instability for an aero-weak car', () => {
    const weakAero = messages(carWith({ aeroEfficiency: 20 }));
    expect(weakAero).toMatch(/aero|high-speed|load/);
  });

  it('changes the tune of the low-drag conversation between a strong- and weak-engine car', () => {
    const strongEngine = messages(carWith({ enginePower: 90 }));
    const weakEngine = messages(carWith({ enginePower: 20 }));
    expect(strongEngine).not.toEqual(weakEngine);
  });

  it('a weak car draws more concern/warning than a strong car (aligns with objective quality)', () => {
    const rng = () => createSeededRandom('align');
    const countNegative = (car: Car) =>
      generatePracticeFeedback(driver, BALANCED_SETUP, track, 'SetupExploration', rng(), { car })
        .filter((f) => f.sentiment === 'Concern' || f.sentiment === 'Warning').length;
    const weak = countNegative(carWith({ mechanicalGrip: 20, aeroEfficiency: 20, reliability: 20 }));
    const strong = countNegative(carWith({ mechanicalGrip: 90, aeroEfficiency: 90, reliability: 90 }));
    expect(weak).toBeGreaterThan(strong);
  });

  it('gives broad, hedged feedback at low knowledge and specific feedback at high knowledge', () => {
    const car = carWith({ mechanicalGrip: 20 });
    const low = generatePracticeFeedback(driver, BALANCED_SETUP, track, 'SetupExploration', createSeededRandom('k'), {
      car,
      knowledge: { setup: 0, tire: 0, reliability: 0 },
    });
    const high = generatePracticeFeedback(driver, BALANCED_SETUP, track, 'SetupExploration', createSeededRandom('k'), {
      car,
      knowledge: { setup: 0.95, tire: 0.95, reliability: 0.95 },
    });
    // Low knowledge → a single, hedged first-impression.
    expect(low).toHaveLength(1);
    expect(low[0].message.toLowerCase()).toMatch(/early read|limited data/);
    // High knowledge → more, and never hedged.
    expect(high.length).toBeGreaterThan(low.length);
    for (const f of high) expect(f.message.toLowerCase()).not.toMatch(/early read|limited data/);
  });
});

describe('calculatePracticeFeedbackConfidence', () => {
  it('rises from Low to High as the relevant knowledge axis fills', () => {
    expect(calculatePracticeFeedbackConfidence('SetupExploration', { setup: 0, tire: 0, reliability: 0 })).toBe('Low');
    expect(calculatePracticeFeedbackConfidence('SetupExploration', { setup: 0.45, tire: 0, reliability: 0 })).toBe('Medium');
    expect(calculatePracticeFeedbackConfidence('SetupExploration', { setup: 0.9, tire: 0, reliability: 0 })).toBe('High');
  });

  it('weights the knowledge axis the program actually investigates', () => {
    // A tyre program leans on tyre knowledge, not setup knowledge.
    expect(calculatePracticeFeedbackConfidence('TireWearAnalysis', { setup: 0.9, tire: 0, reliability: 0 })).toBe('Low');
    expect(calculatePracticeFeedbackConfidence('TireWearAnalysis', { setup: 0, tire: 0.9, reliability: 0 })).toBe('High');
  });
});

describe('runDriverProgram', () => {
  it('is deterministic for a given seed', () => {
    const a = runDriverProgram(ctx(), 'SetupExploration', 14, createSeededRandom('s'));
    const b = runDriverProgram(ctx(), 'SetupExploration', 14, createSeededRandom('s'));
    expect(b).toEqual(a);
  });

  it('emphasizes setup knowledge for SetupExploration and tyre knowledge for TyreWearAnalysis', () => {
    const setupRun = runDriverProgram(ctx(), 'SetupExploration', 14, createSeededRandom('x'));
    const tyreRun = runDriverProgram(ctx(), 'TireWearAnalysis', 14, createSeededRandom('x'));
    expect(setupRun.setupKnowledgeGain).toBeGreaterThan(setupRun.tireKnowledgeGain);
    expect(tyreRun.tireKnowledgeGain).toBeGreaterThan(tyreRun.setupKnowledgeGain);
  });

  it('produces diminishing knowledge as prior knowledge rises', () => {
    const fresh = runDriverProgram(ctx({ priorSetupKnowledge: 0 }), 'SetupExploration', 14, createSeededRandom('d'));
    const learned = runDriverProgram(ctx({ priorSetupKnowledge: 0.9 }), 'SetupExploration', 14, createSeededRandom('d'));
    expect(learned.setupKnowledgeGain).toBeLessThan(fresh.setupKnowledgeGain);
  });
});

describe('knowledge accumulation', () => {
  it('caps each axis at 1', () => {
    const runs = Array.from({ length: 20 }, (_, i) =>
      runDriverProgram(ctx(), 'SetupExploration', 14, createSeededRandom(`k${i}`)),
    );
    expect(calculateSetupKnowledge(0, runs)).toBeLessThanOrEqual(1);
  });

  it('accumulates per-driver knowledge and confidence across runs', () => {
    let knowledge = emptyKnowledge('r1');
    const r1 = runDriverProgram(ctx(), 'SetupExploration', 14, createSeededRandom('a1'));
    knowledge = accumulateKnowledge(knowledge, [r1]);
    expect(knowledge.setupKnowledge[driver.id]).toBeGreaterThan(0);
    const before = knowledge.setupKnowledge[driver.id];
    const r2 = runDriverProgram(
      ctx({ priorSetupKnowledge: before }),
      'SetupExploration',
      14,
      createSeededRandom('a2'),
    );
    knowledge = accumulateKnowledge(knowledge, [r2]);
    expect(knowledge.setupKnowledge[driver.id]).toBeGreaterThanOrEqual(before);
  });
});

describe('confidence + setup bonus', () => {
  it('applies the accumulated confidence delta to a base confidence', () => {
    const knowledge = emptyKnowledge('r1');
    knowledge.confidenceDelta[driver.id] = 5;
    expect(updateDriverConfidenceFromPractice(60, knowledge, driver.id)).toBe(65);
    // clamps to 0-100.
    expect(updateDriverConfidenceFromPractice(98, knowledge, driver.id)).toBe(100);
  });

  it('converts setup knowledge into a bounded setup-confidence bonus', () => {
    const knowledge = emptyKnowledge('r1');
    knowledge.setupKnowledge[driver.id] = 1;
    expect(practiceSetupConfidenceBonus(knowledge, driver.id)).toBeCloseTo(8, 5);
    expect(practiceSetupConfidenceBonus(undefined, driver.id)).toBe(0);
  });
});

describe('runPracticeSession', () => {
  it('runs every valid assignment in the session', () => {
    const ids = drivers1995.slice(0, 2).map((d) => d.id);
    const session: PracticeSession = {
      id: 's',
      raceId: 'r1',
      kind: 'Practice1',
      assignments: defaultAssignments(ids, 'Practice1'),
      completed: false,
    };
    const driversById = Object.fromEntries(drivers1995.slice(0, 2).map((d) => [d.id, d]));
    const setupsById = Object.fromEntries(ids.map((id) => [id, BALANCED_SETUP]));
    const results = runPracticeSession(session, {
      raceId: 'r1',
      track,
      seed: deriveSeed('seed'),
      driversById,
      setupsById,
      knowledge: emptyKnowledge('r1'),
    });
    expect(results).toHaveLength(2);
    expect(new Set(results.map((r) => r.driverId))).toEqual(new Set(ids));
  });
});

describe('wet-weather payoff', () => {
  it('boosts Wet-Weather Preparation confidence when the race is forecast wet', () => {
    const dry = runDriverProgram(ctx({ raceWet: false }), 'WetWeatherPreparation', 12, createSeededRandom('w'));
    const wet = runDriverProgram(ctx({ raceWet: true }), 'WetWeatherPreparation', 12, createSeededRandom('w'));
    expect(wet.confidenceGain).toBeGreaterThan(dry.confidenceGain);
    expect(wet.feedback.some((f) => /wet-weather/i.test(f.message))).toBe(true);
  });

  it('does not change other programs based on the wet flag', () => {
    const dry = runDriverProgram(ctx({ raceWet: false }), 'SetupExploration', 14, createSeededRandom('w'));
    const wet = runDriverProgram(ctx({ raceWet: true }), 'SetupExploration', 14, createSeededRandom('w'));
    expect(wet.confidenceGain).toBe(dry.confidenceGain);
  });
});

describe('recommendedPracticeProgram', () => {
  const noKnowledge = { setup: 0, tire: 0, reliability: 0 };

  it('recommends wet-weather prep when the relevant session is wet', () => {
    const rec = recommendedPracticeProgram('Practice1', track, makeWeatherState('HeavyRain'), noKnowledge);
    expect(rec.program).toBe('WetWeatherPreparation');
  });

  it('recommends a qualifying sim before qualifying', () => {
    const rec = recommendedPracticeProgram('QualifyingPrep', track, makeWeatherState('Dry'), noKnowledge);
    expect(rec.program).toBe('QualifyingSimulation');
  });

  it('addresses the biggest knowledge gap in the dry', () => {
    // Setup already mastered, tyre unknown -> gather tyre data.
    const rec = recommendedPracticeProgram(
      'Practice1',
      track,
      makeWeatherState('Dry'),
      { setup: 1, tire: 0, reliability: 1 },
    );
    expect(rec.program).toBe('TireWearAnalysis');
  });

  it('always returns a reason', () => {
    const rec = recommendedPracticeProgram('Practice1', track, undefined, noKnowledge);
    expect(rec.reason.length).toBeGreaterThan(0);
  });
});

describe('practice lap budget', () => {
  it('scales with car count and gives modern eras more running than classic', () => {
    expect(practiceLapBudget(2026, 'F1', 2)).toBeGreaterThan(practiceLapBudget(1995, 'F1', 2));
    expect(practiceLapBudget(2026, 'F1', 2)).toBe(practiceLapBudget(2026, 'F1', 1) * 2);
  });

  it('sums planned laps for a session', () => {
    const cost = sessionLapCost([
      { driverId: 'a', program: 'SetupExploration', lapsPlanned: 14 },
      { driverId: 'b', program: 'QualifyingSimulation', lapsPlanned: 6 },
    ]);
    expect(cost).toBe(20);
  });
});

describe('teamKnowledgeGaps', () => {
  it('averages each axis across the team drivers', () => {
    const k = emptyKnowledge('r1');
    k.setupKnowledge = { a: 0.4, b: 0.6 };
    k.tireKnowledge = { a: 0.2, b: 0.2 };
    const gaps = teamKnowledgeGaps(k, ['a', 'b']);
    expect(gaps.setup).toBeCloseTo(0.5, 5);
    expect(gaps.tire).toBeCloseTo(0.2, 5);
    expect(gaps.reliability).toBe(0);
  });
});
