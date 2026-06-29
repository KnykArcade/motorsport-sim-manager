import { describe, expect, it } from 'vitest';
import { classifyCrashDamage, damageConditionHit, repairCost } from './repairEngine';

describe('classifyCrashDamage', () => {
  it('treats mechanical retirements as no crash damage', () => {
    expect(classifyCrashDamage('DNF', ['Engine failure'], 0)).toBe('None');
    expect(classifyCrashDamage('DNF', ['Gearbox failure'], 0.9)).toBe('None');
  });

  it('rates crash retirements as heavy or wrecked by roll', () => {
    expect(classifyCrashDamage('DNF', ['Crashed out'], 0.1)).toBe('Wrecked');
    expect(classifyCrashDamage('DNF', ['Collision damage, retired'], 0.8)).toBe('Heavy');
  });

  it('rates contact for finishers as light or moderate', () => {
    expect(classifyCrashDamage('Finished', ['Collision damage'], 0.1)).toBe('Moderate');
    expect(classifyCrashDamage('Finished', ['Contact at turn 1'], 0.9)).toBe('Light');
  });

  it('rates minor off-track moments as light, clean races as none', () => {
    expect(classifyCrashDamage('Finished', ['Ran wide and lost time'], 0)).toBe('Light');
    expect(classifyCrashDamage('Finished', ['Lock-up at the hairpin'], 0)).toBe('Light');
    expect(classifyCrashDamage('Finished', [], 0)).toBe('None');
    expect(classifyCrashDamage('Finished', ['Good clean race'], 0)).toBe('None');
  });
});

describe('repair cost and condition scale with severity', () => {
  it('increases monotonically', () => {
    expect(repairCost('None')).toBe(0);
    expect(repairCost('Light')).toBeLessThan(repairCost('Moderate'));
    expect(repairCost('Moderate')).toBeLessThan(repairCost('Heavy'));
    expect(repairCost('Heavy')).toBeLessThan(repairCost('Wrecked'));

    expect(damageConditionHit('None')).toBe(0);
    expect(damageConditionHit('Light')).toBeLessThan(damageConditionHit('Wrecked'));
  });
});
