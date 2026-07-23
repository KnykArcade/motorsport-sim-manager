import type { MarketDriver } from '../types/marketTypes';
import { toMoney } from '../sim/financeEngine';

export const DRIVER_MARKET_VIEWS = ['overview', 'scouting', 'contract'] as const;
export type DriverMarketView = (typeof DRIVER_MARKET_VIEWS)[number];

export type DriverMarketSortKey =
  | 'name'
  | 'age'
  | 'overall'
  | 'potential'
  | 'f1Readiness'
  | 'salary'
  | 'buyout'
  | 'knowledge';

export type DriverMarketSort = {
  key: DriverMarketSortKey;
  direction: 'asc' | 'desc';
};

export type DriverMarketFilters = {
  query: string;
  marketStatus: string;
  context: string;
  maxAge: string;
  affordableOnly: boolean;
  shortlistedOnly: boolean;
  scoutedOnly: boolean;
  f1ReadyOnly: boolean;
};

export const DEFAULT_DRIVER_MARKET_FILTERS: DriverMarketFilters = {
  query: '',
  marketStatus: 'All',
  context: 'All',
  maxAge: '',
  affordableOnly: false,
  shortlistedOnly: false,
  scoutedOnly: false,
  f1ReadyOnly: false,
};

export const DRIVER_MARKET_VIEW_COLUMNS: Record<DriverMarketView, DriverMarketSortKey[]> = {
  overview: ['overall', 'potential', 'age', 'f1Readiness'],
  scouting: ['overall', 'potential', 'knowledge', 'f1Readiness'],
  contract: ['overall', 'salary', 'buyout', 'age'],
};

export function filterMarketDrivers(
  drivers: MarketDriver[],
  filters: DriverMarketFilters,
  options: {
    budget: number;
    shortlistedIds?: Set<string>;
    scoutedIds?: Set<string>;
  },
): MarketDriver[] {
  const query = filters.query.trim().toLocaleLowerCase();
  const maxAge = filters.maxAge ? Number(filters.maxAge) : undefined;

  return drivers.filter((driver) => {
    if (query && !`${driver.name} ${driver.nationality} ${driver.context}`.toLocaleLowerCase().includes(query)) return false;
    if (filters.marketStatus !== 'All' && driver.marketStatus !== filters.marketStatus) return false;
    if (filters.context !== 'All' && driver.context !== filters.context) return false;
    if (maxAge !== undefined && Number.isFinite(maxAge) && driver.age > maxAge) return false;
    if (filters.affordableOnly && toMoney(driver.buyoutCost) > options.budget) return false;
    if (filters.f1ReadyOnly && !driver.immediateF1Eligible) return false;
    if (filters.shortlistedOnly && !options.shortlistedIds?.has(driver.id)) return false;
    if (filters.scoutedOnly && !options.scoutedIds?.has(driver.id)) return false;
    return true;
  });
}

export function sortMarketDrivers(
  drivers: MarketDriver[],
  sort: DriverMarketSort,
  values: Partial<Record<DriverMarketSortKey, (driver: MarketDriver) => number | string | null>> = {},
): MarketDriver[] {
  const valueFor = (driver: MarketDriver): number | string => {
    const custom = values[sort.key]?.(driver);
    if (custom !== undefined && custom !== null) return custom;
    if (sort.key === 'name') return driver.name;
    if (sort.key === 'age') return driver.age;
    if (sort.key === 'overall') return driver.overall;
    if (sort.key === 'potential') return driver.potential;
    if (sort.key === 'f1Readiness') return driver.f1Readiness;
    if (sort.key === 'salary') return driver.salary;
    if (sort.key === 'buyout') return driver.buyoutCost;
    return 0;
  };

  return [...drivers].sort((a, b) => {
    const left = valueFor(a);
    const right = valueFor(b);
    const comparison = typeof left === 'string' && typeof right === 'string'
      ? left.localeCompare(right)
      : Number(left) - Number(right);
    return (sort.direction === 'asc' ? comparison : -comparison) || a.name.localeCompare(b.name);
  });
}
