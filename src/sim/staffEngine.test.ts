import { describe, expect, it } from 'vitest';
import {
  developmentSuccessBonus,
  setupConfidenceBonus,
  staffByRole,
  staffRatingOutOfTen,
  totalStaffSalary,
} from './staffEngine';
import { toMoney } from './financeEngine';
import type { StaffMember } from '../types/staffTypes';

function member(partial: Partial<StaffMember> & Pick<StaffMember, 'role' | 'rating'>): StaffMember {
  return {
    id: `s-${partial.role}-${partial.rating}`,
    name: 'X',
    nationality: 'GB',
    salary: 1,
    signingFee: 0.5,
    bio: '',
    ...partial,
  };
}

describe('staffByRole', () => {
  it('keeps the highest-rated member per role', () => {
    const roster = [
      member({ role: 'Technical Director', rating: 6 }),
      member({ role: 'Technical Director', rating: 8 }),
      member({ role: 'Strategist', rating: 5 }),
    ];
    const byRole = staffByRole(roster);
    expect(byRole['Technical Director']?.rating).toBe(8);
    expect(byRole['Strategist']?.rating).toBe(5);
    expect(byRole['Pit Crew Chief']).toBeUndefined();
  });
});

describe('bonuses', () => {
  it('normalizes generated 0-100 ratings without changing legacy 1-10 ratings', () => {
    expect(staffRatingOutOfTen(90)).toBe(9);
    expect(staffRatingOutOfTen(9)).toBe(9);
    expect(developmentSuccessBonus([member({ role: 'Technical Director', rating: 90 })])).toBeCloseTo(0.12, 5);
  });

  it('scale around a neutral rating of 5 and are capped', () => {
    expect(developmentSuccessBonus([])).toBe(0);
    expect(developmentSuccessBonus([member({ role: 'Technical Director', rating: 5 })])).toBe(0);
    expect(developmentSuccessBonus([member({ role: 'Technical Director', rating: 9 })])).toBeCloseTo(0.12, 5);
    expect(developmentSuccessBonus([member({ role: 'Technical Director', rating: 10 })])).toBeLessThanOrEqual(0.2);

    expect(setupConfidenceBonus([])).toBe(0);
    expect(setupConfidenceBonus([member({ role: 'Race Engineer', rating: 9 })])).toBeCloseTo(6, 5);
    expect(setupConfidenceBonus([member({ role: 'Race Engineer', rating: 10 })])).toBeLessThanOrEqual(10);
  });
});

describe('totalStaffSalary', () => {
  it('sums salaries in raw dollars', () => {
    const roster = [
      member({ role: 'Technical Director', rating: 9, salary: 4.5 }),
      member({ role: 'Strategist', rating: 7, salary: 1.8 }),
    ];
    expect(totalStaffSalary(roster)).toBe(toMoney(4.5) + toMoney(1.8));
  });
});
