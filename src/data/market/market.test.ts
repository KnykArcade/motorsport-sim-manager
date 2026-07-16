import '../../testDataSetup';
import { describe, it, expect, beforeAll } from 'vitest';
import { getMarketBundle, youthSigningCost, youthYearlyAcademyCost, preloadMarketBundle } from './index';
import { youthProspects1998NASCAR } from './youthProspects1998NASCAR';
import { youthProspects2015NASCAR } from './youthProspects2015NASCAR';
import { youthProspects2017NASCAR } from './youthProspects2017NASCAR';
import { youthProspects2025NASCAR } from './youthProspects2025NASCAR';

describe('youth market costs', () => {
  beforeAll(async () => {
    await Promise.all([
      preloadMarketBundle(1994, 'F1'),
      preloadMarketBundle(1996, 'F1'),
      preloadMarketBundle(1998, 'F1'),
      preloadMarketBundle(2000, 'F1'),
      preloadMarketBundle(2005, 'Champ Car'),
      preloadMarketBundle(2026, 'F1'),
      preloadMarketBundle(2026, 'IndyCar'),
    ]);
  });

  it('normalizes youth costs to a low, consistent $M scale across all seasons', () => {
    for (const [year, series] of [
      [1994, 'F1'],
      [1995, 'F1'],
      [1996, 'F1'],
      [1998, 'F1'],
      [2000, 'F1'],
      [2026, 'F1'],
      [2026, 'IndyCar'],
    ] as const) {
      const bundle = getMarketBundle(year, series);
      expect(bundle).toBeDefined();
      for (const y of bundle!.youth) {
        // Unproven prospects must be cheap: well under $0.2M either way.
        expect(y.signingCost).toBeGreaterThan(0);
        expect(y.signingCost).toBeLessThanOrEqual(0.16);
        expect(y.yearlyAcademyCost).toBeGreaterThan(0);
        expect(y.yearlyAcademyCost).toBeLessThanOrEqual(0.11);
      }
    }
  });

  it('loads one uncapped shared universe for every series in a year', () => {
    for (const [year, series] of [
      [1994, 'F1'],
      [2005, 'Champ Car'],
      [2026, 'IndyCar'],
    ] as const) {
      const bundle = getMarketBundle(year, series);
      expect(bundle).toBeDefined();
      expect(bundle!.drivers.length).toBeGreaterThan(0);
      expect(bundle!.youth.length).toBeGreaterThan(0);
      expect(getMarketBundle(year, 'F1')).toBe(getMarketBundle(year, series));
      const names = [...bundle!.drivers, ...bundle!.youth].map((entry) => entry.name
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim());
      expect(new Set(names).size).toBe(names.length);
      expect(bundle!.drivers.every((driver) => (driver.seriesPreferences?.length ?? 0) > 0)).toBe(true);
    }
  });

  it('keeps researched NASCAR minors in the shared youth universe', () => {
    const samples = [
      ...youthProspects1998NASCAR,
      ...youthProspects2015NASCAR,
      ...youthProspects2017NASCAR,
      ...youthProspects2025NASCAR,
    ];

    expect(samples.map((prospect) => prospect.name)).toEqual(expect.arrayContaining([
      'Auggie Vidovich',
      'Cole Custer',
      'Harrison Burton',
      'Brent Crews',
    ]));
    expect(samples.every((prospect) => prospect.age >= 12 && prospect.age <= 17)).toBe(true);
    expect(samples.every((prospect) => prospect.seriesPreferences?.[0]?.series === 'NASCAR')).toBe(true);
    expect(samples.every((prospect) => prospect.notes.includes('Source: https://'))).toBe(true);
  });

  it('honors curator removals of generated CART and IndyCar placeholders', () => {
    for (const year of [1994, 2005] as const) {
      const bundle = getMarketBundle(year, 'F1')!;
      const generatedPlaceholder = new RegExp(`^${year} (?:CART|IndyCar) .+ (?:Reserve|Prospect) [A-E]$`);
      expect([...bundle.drivers, ...bundle.youth].some((entry) => generatedPlaceholder.test(entry.name))).toBe(false);
    }
  });

  it('never exposes generated or synthetic entries in the shared market', () => {
    const bundle = getMarketBundle(1998, 'F1')!;
    expect([...bundle.drivers, ...bundle.youth].every(
      (entry) => !/generated|synthetic|filler|placeholder|derived youth stand-in/i.test(`${entry.name} ${entry.notes ?? ''}`),
    )).toBe(true);
  });

  it('loads documented future CART and IndyCar drivers as shared youth prospects', () => {
    const expectedByYear = new Map([
      [1990, ['Tony Kanaan', 'Dario Franchitti', 'Greg Moore', 'Juan Pablo Montoya', 'Dan Wheldon']],
      [1994, ['Scott Dixon', 'Dan Wheldon', 'Ryan Hunter-Reay', 'AJ Allmendinger']],
    ]);
    for (const [year, expected] of expectedByYear) {
      const bundle = getMarketBundle(year, 'F1')!;
      expect(bundle.youth.map((prospect) => prospect.name)).toEqual(expect.arrayContaining(expected));
      expect(bundle.youth
        .filter((prospect) => expected.includes(prospect.name))
        .every((prospect) => prospect.notes.includes('Source: https://'))).toBe(true);
    }
  });

  it('removes audited active NASCAR drivers from the 2026 shared market', async () => {
    await preloadMarketBundle(2026, 'F1');
    const names = getMarketBundle(2026, 'F1')!.drivers.map((driver) => driver.name);
    expect(names).not.toContain('Myatt Snider');
    expect(names).not.toContain('Brent Crews');
  });

  it('retains source citations for verified 2026 adult candidates', async () => {
    await preloadMarketBundle(2026, 'F1');
    const bundle = getMarketBundle(2026, 'F1')!;
    for (const name of [
      'Jack Doohan',
      'Felipe Drugovich',
      'Theo Pourchaire',
      'Frederik Vesti',
      'Victor Martins',
      'Paul Aron',
      'Dino Beganovic',
      'Jak Crawford',
      'Ayumu Iwasa',
      'Alex Dunne',
      'Rafael Camara',
      'Ugo Ugochukwu',
      'Luke Browning',
      'Christian Mansell',
      'Ryo Hirakawa',
      'Pepe Marti',
      'Sami Meguetounif',
      'Gabriele Mini',
      'Sebastian Montoya',
    ]) {
      expect(bundle.drivers.find((driver) => driver.name === name)?.notes).toContain('Source: https://');
    }
  });

  it('scales cost with potential', () => {
    expect(youthSigningCost(90)).toBeGreaterThan(youthSigningCost(50));
    expect(youthYearlyAcademyCost(90)).toBeGreaterThan(youthYearlyAcademyCost(50));
  });
});
