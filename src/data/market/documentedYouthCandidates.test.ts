import { describe, expect, it } from 'vitest';
import { documentedYouthForYear } from './documentedYouthCandidates';

describe('documented shared youth candidates', () => {
  it('keeps every projected prospect real, sourced, unique, and age 12-17', () => {
    for (let year = 1990; year <= 2026; year += 1) {
      const youth = documentedYouthForYear(year);
      expect(youth.every((entry) => entry.age >= 12 && entry.age <= 17)).toBe(true);
      expect(youth.every((entry) => entry.notes.includes('Source: https://'))).toBe(true);
      expect(new Set(youth.map((entry) => entry.name)).size).toBe(youth.length);
    }
  });

  it('fills the previously empty 2024 and 2026 youth classes', () => {
    expect(documentedYouthForYear(2024).length).toBeGreaterThanOrEqual(6);
    expect(documentedYouthForYear(2026).length).toBeGreaterThanOrEqual(4);
  });

  it('strengthens every thin 2016-2022 class with documented real juniors', () => {
    for (let year = 2016; year <= 2022; year += 1) {
      expect(documentedYouthForYear(year).length).toBeGreaterThanOrEqual(5);
    }
  });

  it('preserves sourced junior continuity through the 2004-2011 seed gaps', () => {
    expect(documentedYouthForYear(2006).map((entry) => entry.name)).toEqual(expect.arrayContaining([
      'Max Chilton',
      'Alexander Rossi',
      'Felipe Nasr',
      'Marcus Ericsson',
      'Stoffel Vandoorne',
    ]));
    expect(documentedYouthForYear(2009).map((entry) => entry.name)).toEqual(expect.arrayContaining([
      'Carlos Sainz',
      'Pascal Wehrlein',
    ]));
  });

  it('repairs the thin 1991-1993 classes with documented American junior racers', () => {
    expect(documentedYouthForYear(1991).map((entry) => entry.name)).toEqual(expect.arrayContaining([
      'Jimmie Johnson',
      'Kevin Harvick',
      'Ryan Newman',
      'Sam Hornish Jr.',
      'Dale Earnhardt Jr.',
    ]));
    expect(documentedYouthForYear(1992).find((entry) => entry.name === 'Jimmie Johnson')?.seriesPreferences?.[0]).toEqual({
      series: 'NASCAR',
      weight: 100,
    });
    expect(documentedYouthForYear(1993).find((entry) => entry.name === 'Sam Hornish Jr.')?.seriesPreferences?.[0]).toEqual({
      series: 'IndyCar',
      weight: 100,
    });
  });

  it('restores documented American open-wheel youth continuity for the CART era', () => {
    expect(documentedYouthForYear(1990).map((entry) => entry.name)).toEqual(expect.arrayContaining([
      'Tony Kanaan',
      'Dario Franchitti',
      'Greg Moore',
      'Juan Pablo Montoya',
      'Dan Wheldon',
    ]));
    expect(documentedYouthForYear(1994).map((entry) => entry.name)).toEqual(expect.arrayContaining([
      'Scott Dixon',
      'Dan Wheldon',
      'Ryan Hunter-Reay',
      'AJ Allmendinger',
    ]));
    for (let year = 1990; year <= 1998; year += 1) {
      const openWheelYouth = documentedYouthForYear(year).filter((entry) =>
        entry.seriesPreferences?.some((preference) => preference.series === 'IndyCar' && preference.weight >= 90));
      expect(openWheelYouth.length, `${year} documented American open-wheel youth`).toBeGreaterThanOrEqual(3);
    }
  });

  it('defines each identity once and ages it through eligible seasons', () => {
    expect(documentedYouthForYear(2024).find((entry) => entry.name === 'Noah Baglin')?.age).toBe(12);
    expect(documentedYouthForYear(2026).find((entry) => entry.name === 'Noah Baglin')?.age).toBe(14);
    expect(documentedYouthForYear(2026).some((entry) => entry.name === 'Freddie Slater')).toBe(false);
  });
});
