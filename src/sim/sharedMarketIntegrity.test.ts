import { expect, it } from 'vitest';
import { initializeMasterRegistry, preloadMarketBundle } from '../data';
import { getMarketBundle } from '../data/market';
import { canonicalNameOf, getMasterRegistry, registryList } from '../data/registry/masterRegistry';
import { availableSeasons } from '../data/seasonCatalog';
import { createNewGame } from '../game/initialCareer';
import { careerMarketBundle } from './careerMarketEngine';

const generatedMarker = /generated|synthetic|filler|placeholder|gen-(?:drv|yth)|reserve [a-e]$|prospect [a-e]$/i;

it('keeps every 1990-2026 career market shared, real, unique, age-valid, and roster-safe', async () => {
  await initializeMasterRegistry(1990, 'F1');
  const registry = registryList(getMasterRegistry());

  for (let year = 1990; year <= 2026; year += 1) {
    await preloadMarketBundle(year, 'F1');
    const sharedBase = getMarketBundle(year, 'F1');
    const active = new Set(registry
      .filter((entry) => entry.activeSeatsByYear?.some((seat) => seat.year === year))
      .map((entry) => entry.canonicalName));
    const seriesForYear = [...new Set(availableSeasons
      .filter((season) => season.year === year)
      .map((season) => season.series))];

    for (const series of seriesForYear) {
      expect(getMarketBundle(year, series), `${year} ${series} shared base`).toBe(sharedBase);
      const state = createNewGame({
        gameMode: 'Career',
        seasonYear: year,
        series,
        teamId: 'audit-team',
        seed: `shared-market-integrity-${year}-${series}`,
      });
      const market = careerMarketBundle(state);
      const adults = market.drivers.map((entry) => canonicalNameOf(entry.name));
      const youth = market.youth.map((entry) => canonicalNameOf(entry.name));

      expect(new Set(adults).size, `${year} ${series} duplicate adults`).toBe(adults.length);
      expect(new Set(youth).size, `${year} ${series} duplicate youth`).toBe(youth.length);
      expect(adults.filter((name) => youth.includes(name)), `${year} ${series} adult/youth overlap`).toEqual([]);
      expect(market.youth.every((entry) => entry.age >= 12 && entry.age <= 17), `${year} ${series} youth ages`).toBe(true);
      expect(market.drivers.filter((entry) => generatedMarker.test(`${entry.id} ${entry.name} ${entry.notes ?? ''}`)), `${year} ${series} generated adults`).toEqual([]);
      expect(market.youth.filter((entry) => generatedMarker.test(`${entry.id} ${entry.name} ${entry.notes ?? ''}`)), `${year} ${series} generated youth`).toEqual([]);
      expect(adults.filter((name) => active.has(name)), `${year} ${series} active adult leaks`).toEqual([]);
      expect(youth.filter((name) => active.has(name)), `${year} ${series} active youth leaks`).toEqual([]);
    }
  }
});
