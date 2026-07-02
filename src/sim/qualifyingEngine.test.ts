import { describe, it, expect } from 'vitest';
import { tracks1995, drivers1995, cars1995, teams1995 } from '../data';
import { setupOptionsById } from '../data/setupOptions/setupOptions';
import { qualifyingRunPlansById } from '../data/decisions/qualifyingRunPlans';
import { makeWeatherState } from './weatherEngine';
import {
  qualifyingFormatFor,
  sessionWetness,
  simulateQualifying,
} from './qualifyingEngine';
import type { Entrant, QualifyingContext, QualifyingDecision } from '../types/simTypes';

const track = tracks1995[0];

const entrants: Entrant[] = drivers1995.map((d) => ({
  driver: d,
  car: cars1995.find((c) => c.teamId === d.teamId) ?? cars1995[0],
}));

function buildContext(overrides: Partial<QualifyingContext> = {}): QualifyingContext {
  const decisions: Record<string, QualifyingDecision> = {};
  for (const e of entrants) {
    decisions[e.driver.id] = {
      driverId: e.driver.id,
      setupId: 'setup-quali-trim',
      runPlanId: 'StandardPush',
    };
  }
  const teamRaceOps: Record<string, number> = {};
  for (const t of teams1995) teamRaceOps[t.id] = t.raceOperations;
  return {
    track,
    entrants,
    decisions,
    setupOptions: setupOptionsById,
    runPlans: qualifyingRunPlansById,
    seed: 'quali-test',
    teamRaceOps,
    ...overrides,
  };
}

describe('qualifyingFormatFor', () => {
  it('uses knockout for modern F1 (2006+) and single sessions otherwise', () => {
    expect(qualifyingFormatFor(2026, 'F1')).toBe('Knockout');
    expect(qualifyingFormatFor(2006, 'F1')).toBe('Knockout');
    expect(qualifyingFormatFor(2005, 'F1')).toBe('SingleLap');
    expect(qualifyingFormatFor(1995, 'F1')).toBe('SingleLap');
    expect(qualifyingFormatFor(2026, 'IndyCar')).toBe('SingleLap');
  });
});

describe('sessionWetness', () => {
  it('is 0 for dry/undefined and rises as grip falls', () => {
    expect(sessionWetness(undefined)).toBe(0);
    expect(sessionWetness(makeWeatherState('Dry'))).toBe(0);
    expect(sessionWetness(makeWeatherState('HeavyRain'))).toBeGreaterThan(
      sessionWetness(makeWeatherState('LightRain')),
    );
  });

  it('adds a little chaos when conditions are changing', () => {
    expect(sessionWetness(makeWeatherState('Cloudy', true))).toBeGreaterThan(
      sessionWetness(makeWeatherState('Cloudy', false)),
    );
  });
});

describe('simulateQualifying — single session', () => {
  it('is deterministic and ranks every entrant once', () => {
    const a = simulateQualifying(buildContext());
    const b = simulateQualifying(buildContext());
    expect(b.results).toEqual(a.results);
    expect(a.results).toHaveLength(entrants.length);
    expect(new Set(a.results.map((r) => r.driverId)).size).toBe(entrants.length);
    expect(a.results.every((r) => r.segment === 'Single')).toBe(true);
    expect(a.results[0].gapText).toBe('POLE');
    // positions are contiguous 1..n
    expect(a.results.map((r) => r.position)).toEqual(
      entrants.map((_, i) => i + 1),
    );
  });
});

describe('simulateQualifying — knockout', () => {
  it('splits the field into Q1/Q2/Q3 with the top 10 in Q3', () => {
    const { results } = simulateQualifying(buildContext({ format: 'Knockout' }));
    const q3 = results.filter((r) => r.segment === 'Q3');
    const q2 = results.filter((r) => r.segment === 'Q2');
    const q1 = results.filter((r) => r.segment === 'Q1');
    expect(q3).toHaveLength(10);
    expect(q2).toHaveLength(5); // 15 make Q2, 10 make Q3
    expect(q1.length).toBe(entrants.length - 15);
    // Q3 occupies the top of the grid, Q1 the bottom.
    expect(results.slice(0, 10).every((r) => r.segment === 'Q3')).toBe(true);
    expect(results.slice(15).every((r) => r.segment === 'Q1')).toBe(true);
  });

  it('falls back to a single session when the field is too small for knockout', () => {
    const small = buildContext({ format: 'Knockout', entrants: entrants.slice(0, 8) });
    const { results } = simulateQualifying(small);
    expect(results.every((r) => r.segment === 'Single')).toBe(true);
  });
});

describe('weather + wet preparation', () => {
  it('rewards a wet-prepared driver when qualifying is wet', () => {
    const wet = makeWeatherState('HeavyRain');
    const target = entrants[0].driver.id;
    const base = simulateQualifying(buildContext({ weather: wet }));
    const prepared = simulateQualifying(
      buildContext({ weather: wet, wetPreparedDriverIds: [target] }),
    );
    const before = base.results.find((r) => r.driverId === target)!.qualifyingScore;
    const after = prepared.results.find((r) => r.driverId === target)!.qualifyingScore;
    expect(after).toBeGreaterThan(before);
  });

  it('wet preparation does nothing in the dry', () => {
    const dry = makeWeatherState('Dry');
    const target = entrants[0].driver.id;
    const base = simulateQualifying(buildContext({ weather: dry }));
    const prepared = simulateQualifying(
      buildContext({ weather: dry, wetPreparedDriverIds: [target] }),
    );
    const before = base.results.find((r) => r.driverId === target)!.qualifyingScore;
    const after = prepared.results.find((r) => r.driverId === target)!.qualifyingScore;
    expect(after).toBe(before);
  });
});

describe('multiple runs', () => {
  it('finds more pace with more timed runs (all else equal)', () => {
    const target = entrants[0].driver.id;
    const ctxRuns = (runs: number, tyre: QualifyingDecision['tyreApproach']) => {
      const ctx = buildContext();
      ctx.decisions = {
        ...ctx.decisions,
        [target]: { driverId: target, setupId: 'setup-quali-trim', runPlanId: 'BankerLapFirst', runs, tyreApproach: tyre },
      };
      return ctx;
    };
    const one = simulateQualifying(ctxRuns(1, 'Standard'));
    const three = simulateQualifying(ctxRuns(3, 'Standard'));
    const conserve = simulateQualifying(ctxRuns(3, 'Conserve'));
    const score = (res: typeof one, id: string) =>
      res.results.find((r) => r.driverId === id)!.qualifyingScore;
    expect(score(three, target)).toBeGreaterThan(score(one, target));
    // Conserving tyres trades away some of the multi-run pace.
    expect(score(three, target)).toBeGreaterThan(score(conserve, target));
  });
});
