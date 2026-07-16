import { describe, expect, it } from 'vitest';
import { seasonBundles } from './seasonData';
import { normalizeName } from './registry/masterRegistry';

describe('NASCAR season roster integrity', () => {
  const seasons = Array.from({ length: 37 }, (_, index) => 1990 + index);

  it.each(seasons)('%i has one active record per canonical driver identity', (year) => {
    const bundle = seasonBundles[`${year}-NASCAR`];
    expect(bundle, `missing NASCAR season bundle for ${year}`).toBeDefined();
    const names = bundle.drivers.map((driver) => normalizeName(driver.name));
    const duplicates = [...new Set(names.filter((name, index) => names.indexOf(name) !== index))];
    expect(duplicates, `${year} duplicate NASCAR identities`).toEqual([]);
  });

  it.each(seasons)('%i team rosters reference only loaded drivers', (year) => {
    const bundle = seasonBundles[`${year}-NASCAR`];
    const loaded = new Set(bundle.drivers.map((driver) => driver.id));
    for (const team of bundle.teams) {
      expect(
        team.driverIds.filter((driverId) => !loaded.has(driverId)),
        `${year} ${team.name} has dangling driver references`,
      ).toEqual([]);
    }
  });
});
