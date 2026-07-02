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
  engineSwitchFee,
  applyInitialEngineSelection,
  seedManufacturerRelationship,
  evaluateManufacturerRelationship,
  isManufacturerDeal,
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

  it('charges a switch fee to leave a contract but not to re-sign or pick initially', () => {
    const engine = createInitialEngineState(teams1995, PLAYER, 1995, 'F1', 'seed');
    const offers = availableEngineOffers(engine, topTeam);
    const current = engine.deals![topTeam.id];
    // Re-signing the exact current deal is free.
    const same = offers.find((o) => o.supplier.name === current.supplierName && o.dealType === current.dealType);
    if (same) expect(engineSwitchFee(current, same)).toBe(0);
    // A genuinely different deal costs a buyout (current has contract years left).
    const different = offers.find((o) => !(o.supplier.name === current.supplierName && o.dealType === current.dealType))!;
    expect(engineSwitchFee(current, different)).toBeGreaterThan(0);
    // No current deal -> initial selection is free.
    expect(engineSwitchFee(undefined, different)).toBe(0);
  });

  it('applies the player initial engine selection as the active deal', () => {
    const engine = createInitialEngineState(teams1995, topTeam.id, 1995, 'F1', 'seed');
    const offers = availableEngineOffers(engine, topTeam);
    const pick = offers[offers.length - 1]; // a modest tier, likely different from auto-assigned
    const next = applyInitialEngineSelection(engine, topTeam, pick.supplier.id, pick.dealType);
    expect(next.currentDeal?.supplierName).toBe(pick.supplier.name);
    expect(next.currentDeal?.dealType).toBe(pick.dealType);
    expect(next.deals?.[topTeam.id]?.dealType).toBe(pick.dealType);
  });

  it('seeds a manufacturer relationship only for works/factory deals', () => {
    const works = { ...createInitialEngineState(teams1995, PLAYER, 1995, 'F1', 's') };
    works.currentDeal = { ...works.currentDeal!, dealType: 'Works' };
    const seededWorks = seedManufacturerRelationship(works);
    expect(seededWorks.manufacturerConfidence).toBeDefined();
    expect(seededWorks.manufacturerObjective).toBeDefined();

    const cust = { ...createInitialEngineState(teams1995, PLAYER, 1995, 'F1', 's') };
    cust.currentDeal = { ...cust.currentDeal!, dealType: 'Customer' };
    const seededCust = seedManufacturerRelationship(cust);
    expect(seededCust.manufacturerConfidence).toBeUndefined();
    expect(seededCust.manufacturerObjective).toBeUndefined();
    expect(isManufacturerDeal('Works')).toBe(true);
    expect(isManufacturerDeal('Customer')).toBe(false);
  });

  it('raises confidence when the manufacturer target is met and dents it when missed', () => {
    const base = createInitialEngineState(teams1995, topTeam.id, 1995, 'F1', 's');
    base.currentDeal = { ...base.currentDeal!, dealType: 'Works', supplierName: base.suppliers![0].name };
    base.deals![topTeam.id] = base.currentDeal;
    const seeded = seedManufacturerRelationship(base);
    const start = seeded.manufacturerConfidence!;

    const met = evaluateManufacturerRelationship(seeded, topTeam.id, { constructorPosition: 1, wins: 5, points: 200 }, 1995);
    expect(met.engine!.manufacturerConfidence!).toBeGreaterThan(start);
    expect(met.notes.length).toBeGreaterThan(0);

    const missed = evaluateManufacturerRelationship(seeded, topTeam.id, { constructorPosition: 10, wins: 0, points: 0 }, 1995);
    expect(missed.engine!.manufacturerConfidence!).toBeLessThan(start);
  });

  it('scales a deal back a tier when manufacturer confidence collapses', () => {
    const base = createInitialEngineState(teams1995, topTeam.id, 1995, 'F1', 's');
    base.currentDeal = { ...base.currentDeal!, dealType: 'Works', supplierName: base.suppliers![0].name };
    base.deals![topTeam.id] = base.currentDeal;
    let eng = seedManufacturerRelationship(base);
    eng = { ...eng, manufacturerConfidence: 30 };
    // One disastrous season drops confidence below 25 and triggers a downgrade.
    const after = evaluateManufacturerRelationship(eng, topTeam.id, { constructorPosition: 12, wins: 0, points: 0 }, 1995);
    expect(after.engine!.currentDeal!.dealType).not.toBe('Works');
  });
});
