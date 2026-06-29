import { describe, it, expect } from 'vitest';
import {
  FACILITY_SPECS,
  createInitialFacilities,
  facilityDevelopmentSuccessBonus,
  facilityRepairCostReduction,
  orderUpgrade,
  resolvePendingUpgrades,
  upgradeCostFor,
} from './facilityEngine';

describe('facility engine', () => {
  it('initializes one facility per type with effects', () => {
    const fs = createInitialFacilities('t-test');
    expect(fs.facilities.length).toBe(Object.keys(FACILITY_SPECS).length);
    for (const f of fs.facilities) {
      expect(f.level).toBeGreaterThanOrEqual(1);
      expect(Object.keys(f.effects).length).toBeGreaterThan(0);
    }
  });

  it('starts a higher-reputation team further along', () => {
    const low = createInitialFacilities('a', 0).facilities[0].level;
    const high = createInitialFacilities('b', 90).facilities[0].level;
    expect(high).toBeGreaterThan(low);
  });

  it('orders an upgrade as pending without changing the level yet', () => {
    const fs = createInitialFacilities('t-test');
    const target = fs.facilities[0];
    const ordered = orderUpgrade(fs, target.id);
    expect(ordered).not.toBeNull();
    expect(ordered!.cost).toBe(upgradeCostFor(target));
    expect(ordered!.state.pendingUpgrades).toHaveLength(1);
    // Level unchanged until resolved.
    expect(ordered!.state.facilities.find((f) => f.id === target.id)!.level).toBe(target.level);
    // Cannot double-order the same facility.
    expect(orderUpgrade(ordered!.state, target.id)).toBeNull();
  });

  it('resolves pending upgrades by raising the level and effects', () => {
    const fs = createInitialFacilities('t-test');
    const target = fs.facilities[0];
    const ordered = orderUpgrade(fs, target.id)!;
    const { state: resolved, completed } = resolvePendingUpgrades(ordered.state);
    expect(completed).toHaveLength(1);
    expect(resolved.pendingUpgrades).toHaveLength(0);
    const after = resolved.facilities.find((f) => f.id === target.id)!;
    expect(after.level).toBe(target.level + 1);
    const beforeEffect = Object.values(target.effects)[0];
    const afterEffect = after.effects[Object.keys(target.effects)[0]];
    expect(afterEffect).toBeGreaterThan(beforeEffect);
  });

  it('aggregates effects and caps them', () => {
    const fs = createInitialFacilities('t-test', 90);
    expect(facilityDevelopmentSuccessBonus(fs)).toBeGreaterThan(0);
    expect(facilityRepairCostReduction(fs)).toBeLessThanOrEqual(0.6);
  });
});
