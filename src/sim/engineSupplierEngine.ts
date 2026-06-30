// Engine supplier / manufacturer deals (Living Universe Phase 5).
//
// Each team runs an engine deal whose type (Works → BudgetCustomer) and supplier
// quality shape the car's enginePower and reliability, an annual cost, upgrade
// cadence and political influence. Deals are seeded at new-game for the whole
// grid; the player can negotiate a new deal that takes effect at the next season
// rollover. Pure and deterministic. Money in $M.

import type { Series, Team } from '../types/gameTypes';
import type {
  EngineDealType,
  EngineState,
  EngineSupplier,
  EngineSupplierDeal,
} from '../types/engineTypes';
import { suppliersFor } from '../data/engine/engineSuppliers';
import { createSeededRandom, deriveSeed } from './random';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type DealSpec = {
  label: string;
  description: string;
  powerDelta: number; // ratings-scale delta on top of supplier quality
  reliabilityDelta: number;
  upgradeFrequency: number; // upgrades per season
  politicalInfluence: number; // 0-100
  costMultiplier: number; // applied to the supplier's base price
  exclusivity?: boolean;
};

export const ENGINE_DEAL_SPECS: Record<EngineDealType, DealSpec> = {
  Works: {
    label: 'Works',
    description: 'Full factory team — best engine, priority upgrades, top cost.',
    powerDelta: 1.0,
    reliabilityDelta: 0.8,
    upgradeFrequency: 5,
    politicalInfluence: 80,
    costMultiplier: 1.6,
    exclusivity: true,
  },
  FactoryBacked: {
    label: 'Factory-Backed',
    description: 'Strong manufacturer support, near-works spec.',
    powerDelta: 0.6,
    reliabilityDelta: 0.5,
    upgradeFrequency: 4,
    politicalInfluence: 60,
    costMultiplier: 1.3,
  },
  PreferredCustomer: {
    label: 'Preferred Customer',
    description: 'Current-spec engines with regular updates.',
    powerDelta: 0.2,
    reliabilityDelta: 0.2,
    upgradeFrequency: 3,
    politicalInfluence: 35,
    costMultiplier: 1.0,
  },
  Customer: {
    label: 'Customer',
    description: 'Standard customer supply — last year-ish spec.',
    powerDelta: 0,
    reliabilityDelta: 0,
    upgradeFrequency: 2,
    politicalInfluence: 15,
    costMultiplier: 0.8,
  },
  BudgetCustomer: {
    label: 'Budget Customer',
    description: 'Cheapest deal — detuned, infrequent updates.',
    powerDelta: -0.6,
    reliabilityDelta: -0.5,
    upgradeFrequency: 1,
    politicalInfluence: 5,
    costMultiplier: 0.5,
  },
};

// How much of the supplier's intrinsic quality (relative to an average 5.5)
// carries into the car. Kept modest so deals shift, not rewrite, the grid.
const SUPPLIER_QUALITY_FACTOR = 0.25;
const MAX_POWER_BONUS = 1.6;
const MAX_RELIABILITY_BONUS = 1.4;

// The enginePower / reliability deltas a deal grants on the 1-10 ratings scale.
export function engineBonusFromDeal(
  deal: EngineSupplierDeal,
  supplier?: EngineSupplier,
): { power: number; reliability: number } {
  const spec = ENGINE_DEAL_SPECS[deal.dealType];
  const qPower = supplier ? (supplier.basePower - 5.5) * SUPPLIER_QUALITY_FACTOR : 0;
  const qRel = supplier ? (supplier.baseReliability - 5.5) * SUPPLIER_QUALITY_FACTOR : 0;
  const power = Math.max(-MAX_POWER_BONUS, Math.min(MAX_POWER_BONUS, round2(spec.powerDelta + qPower)));
  const reliability = Math.max(
    -MAX_RELIABILITY_BONUS,
    Math.min(MAX_RELIABILITY_BONUS, round2(spec.reliabilityDelta + qRel)),
  );
  return { power, reliability };
}

// Annual $M cost of a deal: scales with supplier prestige and deal tier.
export function dealAnnualCost(dealType: EngineDealType, supplier: EngineSupplier): number {
  const spec = ENGINE_DEAL_SPECS[dealType];
  return round2((supplier.prestige * 0.12 + 2) * spec.costMultiplier);
}

// The best deal tier a team of a given reputation can realistically secure with
// a given supplier. Strong teams attract works/factory deals; weak teams don't.
export function bestDealTypeFor(teamReputation: number, supplierPrestige: number): EngineDealType {
  const score = teamReputation * 0.6 + supplierPrestige * 0.4;
  if (score >= 85) return 'Works';
  if (score >= 70) return 'FactoryBacked';
  if (score >= 50) return 'PreferredCustomer';
  if (score >= 32) return 'Customer';
  return 'BudgetCustomer';
}

function makeDeal(
  team: Team,
  supplier: EngineSupplier,
  dealType: EngineDealType,
  rng: { int: (a: number, b: number) => number },
): EngineSupplierDeal {
  const spec = ENGINE_DEAL_SPECS[dealType];
  const bonus = engineBonusFromDeal({ dealType } as EngineSupplierDeal, supplier);
  return {
    id: `engdeal-${team.id}-${supplier.id}`,
    teamId: team.id,
    supplierName: supplier.name,
    dealType,
    annualCost: dealAnnualCost(dealType, supplier),
    powerRating: round2(supplier.basePower + bonus.power),
    reliabilityRating: round2(supplier.baseReliability + bonus.reliability),
    upgradeFrequency: spec.upgradeFrequency,
    politicalInfluence: spec.politicalInfluence,
    contractYearsRemaining: rng.int(1, 3),
    exclusivity: spec.exclusivity,
    notes: [spec.description],
  };
}

// Seed the whole grid's engine deals at new-game. Better-reputation teams are
// matched to higher-prestige suppliers and richer deal types. Works deals are
// exclusive: a supplier giving a works deal won't give another team a works one.
export function createInitialEngineState(
  teams: Team[],
  playerTeamId: string,
  year: number,
  series: Series,
  seed: string,
): EngineState {
  const suppliers = suppliersFor(year, series);
  const rng = createSeededRandom(deriveSeed(seed, 'engine', year, series));
  const byRep = [...teams].sort((a, b) => b.reputation - a.reputation);
  const supplierByPrestige = [...suppliers].sort((a, b) => b.prestige - a.prestige);

  const deals: Record<string, EngineSupplierDeal> = {};
  const worksTaken = new Set<string>(); // supplierId that already gave a works deal
  byRep.forEach((team, rank) => {
    // Spread teams across the supplier list by reputation rank.
    const supplier = supplierByPrestige[Math.min(rank, supplierByPrestige.length - 1)] ??
      supplierByPrestige[supplierByPrestige.length - 1];
    let dealType = bestDealTypeFor(team.reputation, supplier.prestige);
    if (dealType === 'Works' && worksTaken.has(supplier.id)) dealType = 'FactoryBacked';
    if (dealType === 'Works') worksTaken.add(supplier.id);
    deals[team.id] = makeDeal(team, supplier, dealType, rng);
  });

  return {
    currentDeal: deals[playerTeamId],
    deals,
    suppliers,
  };
}

// Apply each team's engine deal to its car as an enginePower / reliability bonus.
export function applyEngineBonuses<C extends { teamId: string; engineBonus?: { power: number; reliability: number } }>(
  cars: C[],
  engine: EngineState | undefined,
): C[] {
  if (!engine?.deals) return cars;
  const suppliersByName = new Map((engine.suppliers ?? []).map((s) => [s.name, s]));
  return cars.map((car) => {
    const deal = engine.deals![car.teamId];
    if (!deal) return car;
    return { ...car, engineBonus: engineBonusFromDeal(deal, suppliersByName.get(deal.supplierName)) };
  });
}

export type EngineOffer = {
  supplier: EngineSupplier;
  dealType: EngineDealType;
  annualCost: number;
  bonus: { power: number; reliability: number };
  upgradeFrequency: number;
  politicalInfluence: number;
};

// The deals a team can negotiate now: for each supplier, the best tier the team
// qualifies for (and the tiers below it). Works tiers are blocked for suppliers
// already committed to another team's works deal.
export function availableEngineOffers(
  engine: EngineState | undefined,
  team: Team,
): EngineOffer[] {
  if (!engine?.suppliers) return [];
  const TIER_ORDER: EngineDealType[] = [
    'Works',
    'FactoryBacked',
    'PreferredCustomer',
    'Customer',
    'BudgetCustomer',
  ];
  const worksTakenElsewhere = new Set(
    Object.values(engine.deals ?? {})
      .filter((d) => d.dealType === 'Works' && d.teamId !== team.id)
      .map((d) => d.supplierName),
  );
  const offers: EngineOffer[] = [];
  for (const supplier of engine.suppliers) {
    const best = bestDealTypeFor(team.reputation, supplier.prestige);
    const startIdx = TIER_ORDER.indexOf(best);
    for (let i = startIdx; i < TIER_ORDER.length; i++) {
      const dealType = TIER_ORDER[i];
      if (dealType === 'Works' && worksTakenElsewhere.has(supplier.name)) continue;
      offers.push({
        supplier,
        dealType,
        annualCost: dealAnnualCost(dealType, supplier),
        bonus: engineBonusFromDeal({ dealType } as EngineSupplierDeal, supplier),
        upgradeFrequency: ENGINE_DEAL_SPECS[dealType].upgradeFrequency,
        politicalInfluence: ENGINE_DEAL_SPECS[dealType].politicalInfluence,
      });
    }
  }
  return offers;
}

// Build the deal the player signs from an offer; it takes effect next season.
export function buildSignedDeal(team: Team, offer: EngineOffer): EngineSupplierDeal {
  const spec = ENGINE_DEAL_SPECS[offer.dealType];
  return {
    id: `engdeal-${team.id}-${offer.supplier.id}`,
    teamId: team.id,
    supplierName: offer.supplier.name,
    dealType: offer.dealType,
    annualCost: offer.annualCost,
    powerRating: round2(offer.supplier.basePower + offer.bonus.power),
    reliabilityRating: round2(offer.supplier.baseReliability + offer.bonus.reliability),
    upgradeFrequency: offer.upgradeFrequency,
    politicalInfluence: offer.politicalInfluence,
    contractYearsRemaining: 3,
    exclusivity: spec.exclusivity,
    notes: [spec.description],
  };
}

// Resolve engine state at the season rollover: a pending deal becomes active,
// otherwise the active deal ticks down a contract year. Returns the new state.
export function resolveEngineRollover(engine: EngineState | undefined, playerTeamId: string): EngineState | undefined {
  if (!engine) return engine;
  const deals = { ...(engine.deals ?? {}) };
  let currentDeal = engine.currentDeal;

  if (engine.pendingDeal) {
    currentDeal = { ...engine.pendingDeal };
    deals[playerTeamId] = currentDeal;
  } else if (currentDeal) {
    currentDeal = {
      ...currentDeal,
      contractYearsRemaining: Math.max(0, currentDeal.contractYearsRemaining - 1),
    };
    deals[playerTeamId] = currentDeal;
  }

  return { ...engine, deals, currentDeal, pendingDeal: undefined };
}
