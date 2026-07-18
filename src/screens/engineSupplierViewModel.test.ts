import { describe, expect, it } from 'vitest';
import type { EngineOffer } from '../sim/engineSupplierEngine';
import {
  ENGINE_WORKSPACE_TABS,
  engineCashMovementNow,
  groupEngineOffers,
} from './engineSupplierViewModel';

function offer(supplierName: string, dealType: EngineOffer['dealType'] = 'Customer'): EngineOffer {
  return {
    supplier: {
      id: supplierName.toLowerCase(),
      name: supplierName,
      basePower: 7,
      baseReliability: 7,
      prestige: 70,
    },
    dealType,
    annualCost: 8,
    bonus: { power: 0, reliability: 0 },
    upgradeFrequency: 2,
    politicalInfluence: 15,
  };
}

describe('engine supplier view model', () => {
  it('separates the active package, manufacturer relationship, and supplier market', () => {
    expect(ENGINE_WORKSPACE_TABS.map((tab) => tab.id)).toEqual([
      'package', 'manufacturer', 'market',
    ]);
  });

  it('groups deal tiers by supplier', () => {
    const groups = groupEngineOffers([
      offer('Renault', 'PreferredCustomer'),
      offer('Ferrari'),
      offer('Renault', 'Customer'),
      offer('Mercedes'),
      offer('Honda'),
    ]);

    expect(groups.map((group) => group.supplierName)).toEqual(['Renault', 'Ferrari', 'Mercedes', 'Honda']);
    expect(groups[0].offers).toHaveLength(2);
  });

  it('shows the net cash movement when replacing a queued agreement', () => {
    expect(engineCashMovementNow(12, 0)).toBe(-12);
    expect(engineCashMovementNow(12, 8)).toBe(-4);
    expect(engineCashMovementNow(0, 8)).toBe(8);
  });
});
