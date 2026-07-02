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

// A works/factory manufacturer's performance target for the partnership.
export type EngineManufacturerObjective = {
  description: string;
  // constructorPosition: finish at or above targetValue (lower is better);
  // wins/points: reach at least targetValue.
  metric: 'constructorPosition' | 'wins' | 'points';
  targetValue: number;
};

// A season-end review of how the manufacturer rates the partnership.
export type EngineManufacturerReview = {
  seasonYear: number;
  met: boolean;
  summary: string;
  confidenceDelta: number;
};

// The player team's engine state, persisted in career mode.
export type EngineState = {
  // The player team's active deal for the current season.
  currentDeal?: EngineSupplierDeal;
  // A deal signed during the season that takes effect at the next rollover.
  pendingDeal?: EngineSupplierDeal;
  // Buyout fee ($M) already charged for the queued pendingDeal, so canceling the
  // switch (or re-negotiating) refunds it.
  pendingDealFee?: number;
  // Every team's active deal this season (keyed by teamId), so AI cars also
  // carry an engine-supplier modifier.
  deals?: Record<string, EngineSupplierDeal>;
  // Manufacturers present in the universe this era (negotiation pool).
  suppliers?: EngineSupplier[];
  // Supplier-level expectations (e.g. a works partner expecting wins).
  manufacturerExpectation?: string;
  // Manufacturer relationship for works/factory deals: the supplier's confidence
  // in the partnership (0-100), its performance target, and a per-season log.
  manufacturerConfidence?: number;
  manufacturerObjective?: EngineManufacturerObjective;
  manufacturerReviews?: EngineManufacturerReview[];
};
