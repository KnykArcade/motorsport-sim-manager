// Master Driver Registry types.
//
// The Master Driver Registry is the permanent source of truth for driver
// IDENTITY and long-term career metadata across every series and season. It is
// built deterministically by merging all season rosters + market/youth bundles
// (see src/data/registry/masterRegistry.ts) and never mutates those season
// files. A career save state layers a living marketplace on top of it.
//
// It is intentionally distinct from:
//   - `Driver`        (a driver actually filling a race seat this season)
//   - `MarketDriver`  (a senior driver available on the transfer market)
//   - `YouthProspect` (an under-18 academy prospect)
// A registry entry unifies all three under one stable identity.

import type { Series } from './gameTypes';
import type { MarketSkillRatings } from './marketTypes';

// Lifecycle status of a driver within the registry / universe.
export type RegistryDriverStatus =
  | 'not_yet_available' // exists historically but before their debut/eligibility
  | 'youth_pool' // under-18 prospect not yet signed to an academy
  | 'academy' // signed into a team academy
  | 'adult_free_agent' // adult, eligible, without a seat
  | 'reserve_driver' // a team's 3rd/reserve driver
  | 'active_driver' // filling a race seat
  | 'inactive' // temporarily out of the sport
  | 'retired';

// Career stage bucket, used for cross-series willingness and market behaviour.
export type CareerPhase = 'prospect' | 'rising' | 'peak' | 'veteran' | 'twilight';

// The base ten driving skills plus overall/potential, shared across sources.
export type RegistryBaseRatings = MarketSkillRatings & {
  overall: number;
  potential: number;
};

// Which season file a per-year rating snapshot came from.
export type RegistryRatingSnapshot = {
  year: number;
  series: Series;
  overall: number;
  potential?: number;
  // The full skill spread when available (grid drivers), else derived.
  skills?: MarketSkillRatings;
  sourceId: string; // the id used in that season's source file
};

// One canonical driver in the Master Driver Registry.
export type MasterDriverEntry = {
  // --- Identity ---
  driverId: string; // stable canonical id (slug of canonicalName [+ disambiguator])
  canonicalName: string; // normalized identity name
  displayName: string; // human-facing name
  nationality?: string;
  birthYear?: number; // best-known birth year (from youth data or derived)
  startingAge?: number; // age at first-seen season, when birthYear unknown

  // --- Series preference / eligibility (cross-series market) ---
  preferredSeries: Series;
  eligibleSeries: Series[];
  secondarySeriesInterest: Series[];
  seriesExperience: Partial<Record<Series, number>>; // seasons seen per series
  willingnessToSwitchSeries: number; // 0-100

  // --- Availability rules (used by career rollover, not by season starts) ---
  careerStatus: RegistryDriverStatus;
  academyEligibleYear?: number; // year they enter the youth pool
  adultEligibleYear?: number; // year they age into the adult market
  marketEntryYear: number; // first year available to the adult market
  historicalDebutYear?: number;
  retirementYear?: number;

  // --- Talent ---
  potential: number;
  developmentCurve?: string; // qualitative curve label if known
  baseRatings: RegistryBaseRatings;
  baseRatingsByYear: RegistryRatingSnapshot[]; // per-season snapshots, sorted
  seriesSpecificRatings?: Partial<Record<Series, RegistryBaseRatings>>;
  traits: string[];

  // --- Market / commercial metadata ---
  sponsorBacking: number; // $M/yr brought in
  payDriverFunding: number; // $M/yr pay-driver budget
  marketValue: number; // $M
  salaryDemand: number; // $M/yr

  // --- Provenance ---
  // Every source record (season roster / market / youth) that merged into this
  // entry, so imports are idempotent and traceable.
  sourceIds: string[];
  firstSeenYear: number;
  lastSeenYear: number;
};

// The registry itself: a keyed map plus a stable ordered list.
export type MasterDriverRegistry = {
  byId: Record<string, MasterDriverEntry>;
  order: string[]; // driverIds in deterministic order
};

// The outcome of importing one season's drivers into a registry, used for the
// rollover summary and debug output.
export type RegistryMergeResult = {
  registry: MasterDriverRegistry;
  created: string[]; // driverIds newly created
  merged: string[]; // driverIds that matched an existing entry
};
