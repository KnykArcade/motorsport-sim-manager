import { describe, it, expect } from 'vitest';
import { teams1995, cars1995 } from '../data';
import {
  ENGINE_DEAL_SPECS,
  applyEngineBonuses,
  availableEngineOffers,
  bestDealTypeFor,
  buildSignedDeal,
  createInitialEngineState,
  dealAnnualCost,
  engineBonusFromDeal,
  resolveEngineRollover,
} from './engineSupplierEngine';
import { suppliersFor } from '../data/engine/engineSuppliers';
import type { EngineSupplierDeal } from '../types/engineTypes';

const PLAYER = teams1995[teams1995.length - 1].id; // a backmarker
const topTeam = [...teams1995].sort((a, b) => b.reputation - a.reputation)[0];

describe('engineSupplierEngine', () => {
  it('seeds a deal for every team and sets the player current deal', () => {
    const engine = createInitialEngineState(teams1995, PLAYER, 1995, 'F1', 'seed');
    expect(Object.keys(engine.deals ?? {}).length).toBe(teams1995.length);
    expect(engine.currentDeal?.teamId).toBe(PLAYER);
    expect(engine.suppliers?.length).toBeGreaterThan(0);
  });

  it('is deterministic for the same seed', () => {
    const a = createInitialEngineState(teams1995, PLAYER, 1995, 'F1', 's');
    const b = createInitialEngineState(teams1995, PLAYER, 1995, 'F1', 's');
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('never gives the same supplier two works deals (exclusivity)', () => {
    const engine = createInitialEngineState(teams1995, PLAYER, 1995, 'F1', 'seed');
    const worksBySupplier = new Map<string, number>();
    for (const d of Object.values(engine.deals ?? {})) {
      if (d.dealType === 'Works') worksBySupplier.set(d.supplierName, (worksBySupplier.get(d.supplierName) ?? 0) + 1);
    }
    for (const count of worksBySupplier.values()) expect(count).toBeLessThanOrEqual(1);
  });

  it('gives stronger deal tiers more power and reliability', () => {
    const supplier = suppliersFor(1995, 'F1')[0];
    const works = engineBonusFromDeal({ dealType: 'Works' } as EngineSupplierDeal, supplier);
    const budget = engineBonusFromDeal({ dealType: 'BudgetCustomer' } as EngineSupplierDeal, supplier);
    expect(works.power).toBeGreaterThan(budget.power);
    expect(works.reliability).toBeGreaterThan(budget.reliability);
  });

  it('charges more for richer deals', () => {
    const supplier = suppliersFor(1995, 'F1')[0];
    expect(dealAnnualCost('Works', supplier)).toBeGreaterThan(dealAnnualCost('BudgetCustomer', supplier));
  });

  it('matches stronger teams to better deal types', () => {
    const supplier = suppliersFor(1995, 'F1')[0];
    const order = ['BudgetCustomer', 'Customer', 'PreferredCustomer', 'FactoryBacked', 'Works'];
    const strong = order.indexOf(bestDealTypeFor(topTeam.reputation, supplier.prestige));
    const weak = order.indexOf(bestDealTypeFor(20, supplier.prestige));
    expect(strong).toBeGreaterThan(weak);
  });

  it('applies engine bonuses to cars by team', () => {
    const engine = createInitialEngineState(teams1995, PLAYER, 1995, 'F1', 'seed');
    const cars = applyEngineBonuses(cars1995.map((c) => ({ ...c })), engine);
    for (const car of cars) {
      const deal = engine.deals?.[car.teamId];
      if (deal) expect(car.engineBonus).toBeDefined();
    }
    // No engine state -> cars unchanged.
    expect(applyEngineBonuses(cars1995, undefined)).toBe(cars1995);
  });

  it('offers the player deals and resolves a signed deal at rollover', () => {
    const engine = createInitialEngineState(teams1995, PLAYER, 1995, 'F1', 'seed');
    const offers = availableEngineOffers(engine, topTeam);
    expect(offers.length).toBeGreaterThan(0);

    const offer = offers[0];
    const pendingDeal = buildSignedDeal(topTeam, offer);
    const withPending = { ...engine, pendingDeal };
    const resolved = resolveEngineRollover(withPending, topTeam.id);
    expect(resolved?.pendingDeal).toBeUndefined();
    expect(resolved?.currentDeal?.supplierName).toBe(offer.supplier.name);
    expect(resolved?.deals?.[topTeam.id]?.dealType).toBe(offer.dealType);
  });

  it('decrements contract years at rollover when no new deal is signed', () => {
    const engine = createInitialEngineState(teams1995, PLAYER, 1995, 'F1', 'seed');
    const before = engine.currentDeal!.contractYearsRemaining;
    const resolved = resolveEngineRollover(engine, PLAYER);
    expect(resolved?.currentDeal?.contractYearsRemaining).toBe(Math.max(0, before - 1));
  });

  it('exposes a label for every deal type', () => {
    for (const key of Object.keys(ENGINE_DEAL_SPECS)) {
      expect(ENGINE_DEAL_SPECS[key as keyof typeof ENGINE_DEAL_SPECS].label.length).toBeGreaterThan(0);
    }
  });
});
