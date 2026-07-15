import { describe, expect, it } from 'vitest';
import {
  DRIVER_DIRECTORY_PAGE_SIZE,
  DRIVERS_TABS,
  driverDirectoryPage,
  driverDirectoryPageCount,
} from './driversViewModel';

describe('drivers view model', () => {
  it('keeps roster work separate from the championship directory', () => {
    expect(DRIVERS_TABS.map((tab) => tab.id)).toEqual(['lineup', 'reserves', 'directory']);
  });

  it('paginates a 95-driver NASCAR field into stable six-card pages', () => {
    const drivers = Array.from({ length: 95 }, (_, index) => `driver-${index + 1}`);

    expect(DRIVER_DIRECTORY_PAGE_SIZE).toBe(6);
    expect(driverDirectoryPageCount(drivers.length)).toBe(16);
    expect(driverDirectoryPage(drivers, 0)).toEqual(drivers.slice(0, 6));
    expect(driverDirectoryPage(drivers, 15)).toEqual(drivers.slice(90, 95));
    expect(driverDirectoryPage(drivers, 99)).toEqual(drivers.slice(90, 95));
    expect(driverDirectoryPage(drivers, -1)).toEqual(drivers.slice(0, 6));
  });
});
