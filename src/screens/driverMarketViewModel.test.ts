import { describe, expect, it } from 'vitest';
import {
  MARKET_PAGE_SIZE,
  YOUTH_MARKET_TABS,
  marketPage,
  marketPageCount,
} from './driverMarketViewModel';

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
