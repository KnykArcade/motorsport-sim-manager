import { describe, expect, it } from 'vitest';
import {
  MARKET_PAGE_SIZE,
  YOUTH_MARKET_TABS,
  marketPage,
  marketPageCount,
} from './driverMarketViewModel';
import type { MarketDriver } from '../types/marketTypes';
import {
  DEFAULT_DRIVER_MARKET_FILTERS,
  filterMarketDrivers,
  sortMarketDrivers,
} from './driverMarketListViewModel';

describe('driver market view model', () => {
  it('separates signed academy members from available youth prospects', () => {
    expect(YOUTH_MARKET_TABS.map((tab) => tab.id)).toEqual(['academy', 'prospects']);
  });

  it('paginates a 95-person shared market into single-row pages', () => {
    const entries = Array.from({ length: 95 }, (_, index) => `entry-${index + 1}`);

    expect(MARKET_PAGE_SIZE).toBe(3);
    expect(marketPageCount(entries.length)).toBe(32);
    expect(marketPage(entries, 0)).toEqual(entries.slice(0, 3));
    expect(marketPage(entries, 31)).toEqual(entries.slice(93, 95));
    expect(marketPage(entries, 99)).toEqual(entries.slice(93, 95));
    expect(marketPage(entries, -1)).toEqual(entries.slice(0, 3));
  });
});

const marketDriver = (overrides: Partial<MarketDriver>): MarketDriver => ({
  id: 'driver',
  name: 'Driver',
  age: 25,
  nationality: 'Test',
  context: 'F1 free agent',
  marketPool: 'senior',
  marketStatus: 'Available',
  primaryRole: 'Race Driver',
  immediateF1Eligible: true,
  skills: {
    cornering: 80,
    braking: 80,
    straights: 80,
    tractionAcceleration: 80,
    elevationBlindCorners: 80,
    technical: 80,
    overtakingRacecraft: 80,
    surfaceGripBumpiness: 80,
    riskManagement: 80,
    enduranceConsistency: 80,
  },
  overall: 80,
  potential: 90,
  potentialDelta: 10,
  developmentRate: 80,
  f1Readiness: 90,
  salary: 4,
  sponsorValue: 1,
  buyoutCost: 3,
  negotiationDifficulty: 'medium',
  suggestedUse: 'Race seat',
  notes: '',
  ...overrides,
});

describe('driver market list view model', () => {
  it('filters by search, affordability, shortlist, and scouting state', () => {
    const drivers = [
      marketDriver({ id: 'shortlisted', name: 'Ayrton Senna', buyoutCost: 2 }),
      marketDriver({ id: 'unlisted', name: 'Dean Hall', buyoutCost: 8 }),
    ];

    expect(filterMarketDrivers(drivers, {
      ...DEFAULT_DRIVER_MARKET_FILTERS,
      query: 'senna',
      affordableOnly: true,
      shortlistedOnly: true,
      scoutedOnly: true,
    }, {
      budget: 3_000_000,
      shortlistedIds: new Set(['shortlisted']),
      scoutedIds: new Set(['shortlisted']),
    }).map((driver) => driver.id)).toEqual(['shortlisted']);
  });

  it('sorts by visible list columns while retaining every matching target', () => {
    const drivers = [
      marketDriver({ id: 'b', name: 'B Driver', age: 30, overall: 70 }),
      marketDriver({ id: 'a', name: 'A Driver', age: 22, overall: 90 }),
    ];

    expect(sortMarketDrivers(drivers, { key: 'overall', direction: 'desc' }).map((driver) => driver.id))
      .toEqual(['a', 'b']);
    expect(sortMarketDrivers(drivers, { key: 'name', direction: 'asc' }).map((driver) => driver.id))
      .toEqual(['a', 'b']);
  });
});
