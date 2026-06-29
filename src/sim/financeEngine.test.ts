import { describe, expect, it } from 'vitest';
import {
  driverSalary,
  makeTransaction,
  projectedAnnualCosts,
  summarize,
  toMoney,
} from './financeEngine';
import type { Driver } from '../types/gameTypes';

function fakeDriver(overall: number, salary?: number): Driver {
  return {
    id: `d-${overall}-${salary ?? 'x'}`,
    name: 'Test',
    number: 1,
    nationality: 'GB',
    teamId: 't',
    ratings: {
      cornering: overall,
      braking: overall,
      straights: overall,
      tractionAcceleration: overall,
      elevationBlindCorners: overall,
      technical: overall,
      overtakingRacecraft: overall,
      surfaceGripBumpiness: overall,
      riskManagement: overall,
      enduranceConsistency: overall,
      qualifying: overall,
      racePace: overall,
      adaptability: overall,
      aggression: overall,
      composure: overall,
      overall,
    },
    morale: 60,
    confidence: 60,
    contractYearsRemaining: 1,
    salary,
    traits: [],
  };
}

describe('toMoney', () => {
  it('converts $M to raw dollars', () => {
    expect(toMoney(1.2)).toBe(1_200_000);
    expect(toMoney(0)).toBe(0);
  });
});

describe('driverSalary', () => {
  it('uses explicit salary when set, otherwise estimates from overall', () => {
    expect(driverSalary(fakeDriver(8, 5.5))).toBe(toMoney(5.5));
    const est = driverSalary(fakeDriver(8));
    expect(est).toBe(toMoney((8 - 4) * 1.2));
    // floor for weak drivers
    expect(driverSalary(fakeDriver(3))).toBe(toMoney(0.5));
  });
});

describe('summarize', () => {
  it('splits income and expense and totals by category for a season', () => {
    const txns = [
      makeTransaction(1995, 'Prize Money', 'a', 1_000_000, 1),
      makeTransaction(1995, 'Driver Salary', 'b', -400_000),
      makeTransaction(1996, 'Prize Money', 'c', 500_000),
    ];
    const s = summarize(txns, 1995);
    expect(s.income).toBe(1_000_000);
    expect(s.expense).toBe(-400_000);
    expect(s.net).toBe(600_000);
    expect(s.byCategory['Prize Money']).toBe(1_000_000);
    expect(s.byCategory['Driver Salary']).toBe(-400_000);
  });
});

describe('projectedAnnualCosts', () => {
  it('sums salaries and academy fees', () => {
    const drivers = [fakeDriver(8, 5), fakeDriver(7, 3)];
    const academy = [{ prospectId: 'p1' }, { prospectId: 'p2' }];
    const result = projectedAnnualCosts(drivers, academy, { p1: 0.2, p2: 0.3 });
    expect(result.salaries).toBe(toMoney(5) + toMoney(3));
    expect(result.academy).toBe(toMoney(0.2) + toMoney(0.3));
    expect(result.total).toBe(result.salaries + result.academy);
  });
});
