// Engine supplier / manufacturer deals (Living Universe Phase 1 — types only).
//
// Engine deals are central to historical F1 and IndyCar: the relationship a team
// has with its supplier shapes power, reliability, upgrade cadence, cost and
// political influence, and is a key piece of offseason planning. Money in $M.

export type EngineDealType =
  | 'Works'
  | 'PreferredCustomer'
  | 'Customer'
  | 'BudgetCustomer'
  | 'FactoryBacked';

export type EngineSupplierDeal = {
  id: string;
  teamId: string;
  supplierName: string;
  dealType: EngineDealType;
  annualCost: number; // $M / year
  powerRating: number; // 1-10 contribution to car enginePower
  reliabilityRating: number; // 1-10 contribution to car reliability
  upgradeFrequency: number; // upgrades expected per season
  politicalInfluence: number; // 0-100, lobbying weight conferred
  contractYearsRemaining: number;
  exclusivity?: boolean; // supplier provides only to this team
  notes: string[];
};

// A manufacturer present in the universe, independent of any single deal. Used
// for offseason negotiation pools and manufacturer-expectation storylines.
export type EngineSupplier = {
  id: string;
  name: string;
  basePower: number; // 1-10
  baseReliability: number; // 1-10
  prestige: number; // 0-100, drives cost & desirability
  // Teams the supplier is willing to talk to (empty = open market).
  willingTeamIds?: string[];
};

// The player team's engine state, persisted in career mode.
export type EngineState = {
  currentDeal?: EngineSupplierDeal;
  // Supplier-level expectations (e.g. a works partner expecting wins).
  manufacturerExpectation?: string;
};
