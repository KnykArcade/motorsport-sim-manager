export type DriversTab = 'lineup' | 'reserves' | 'directory';

export const DRIVERS_TABS: Array<{ id: DriversTab; label: string }> = [
  { id: 'lineup', label: 'Race Lineup' },
  { id: 'reserves', label: 'Reserve Drivers' },
  { id: 'directory', label: 'Grid Directory' },
];

export const DRIVER_DIRECTORY_PAGE_SIZE = 6;

export function driverDirectoryPageCount(totalDrivers: number): number {
  return Math.max(1, Math.ceil(totalDrivers / DRIVER_DIRECTORY_PAGE_SIZE));
}

export function driverDirectoryPage<T>(drivers: T[], page: number): T[] {
  const pageCount = driverDirectoryPageCount(drivers.length);
  const safePage = Math.max(0, Math.min(pageCount - 1, page));
  return drivers.slice(
    safePage * DRIVER_DIRECTORY_PAGE_SIZE,
    (safePage + 1) * DRIVER_DIRECTORY_PAGE_SIZE,
  );
}

