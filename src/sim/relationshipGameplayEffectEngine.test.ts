import { describe, expect, it } from 'vitest';
import { DEPARTMENT_IDS, type DepartmentId, type DepartmentMood } from '../types/phase18Types';
import {
  departmentPreparationMultiplierFromMoods,
  signedRelationshipEffectPercent,
} from './relationshipGameplayEffectEngine';

function departments(
  relationshipHealth: number,
  workload: number,
): Record<DepartmentId, DepartmentMood> {
  return Object.fromEntries(DEPARTMENT_IDS.map((departmentId) => [departmentId, {
    departmentId,
    morale: relationshipHealth,
    trustInPrincipal: relationshipHealth,
    strategicAlignment: relationshipHealth,
    workload,
    conflictReasons: [],
    lastUpdatedSeasonYear: 2026,
  }])) as unknown as Record<DepartmentId, DepartmentMood>;
}

describe('relationship gameplay effects', () => {
  it('keeps normal department relationships neutral', () => {
    expect(departmentPreparationMultiplierFromMoods(departments(50, 40))).toBe(1);
    expect(signedRelationshipEffectPercent(1)).toBe('Neutral');
  });

  it('turns strong department relationships into a small capped preparation bonus', () => {
    const multiplier = departmentPreparationMultiplierFromMoods(departments(95, 25));

    expect(multiplier).toBe(1.04);
    expect(signedRelationshipEffectPercent(multiplier)).toBe('+4.0%');
  });

  it('turns low trust and overload into a small capped preparation penalty', () => {
    const multiplier = departmentPreparationMultiplierFromMoods(departments(15, 100));

    expect(multiplier).toBe(0.96);
    expect(signedRelationshipEffectPercent(multiplier)).toBe('-4.0%');
  });
});
