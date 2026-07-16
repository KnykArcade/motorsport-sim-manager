import '../src/testDataSetup';
import { describe, expect, it } from 'vitest';
import { runCareerAudit } from './careerAudit';
import type { Series } from '../src/types/gameTypes';

type Scenario = {
  series: Series;
  seasonYear: number;
  seasons: number;
};

const scenarios: Scenario[] = [
  { series: 'NASCAR', seasonYear: 1998, seasons: 5 },
  { series: 'CART', seasonYear: 1999, seasons: 4 },
  { series: 'IndyCar', seasonYear: 2008, seasons: 5 },
];

const reports = scenarios.map((scenario) => ({
  scenario,
  report: runCareerAudit({
    ...scenario,
    seed: `career-audit-${scenario.series}-${scenario.seasonYear}`,
  }),
}));

describe('multi-series real-race career audit', () => {
  it.each(reports)('$scenario.series advances $scenario.seasons complete seasons', ({ scenario, report }) => {
    expect(report.seasons).toHaveLength(scenario.seasons);
    expect(report.seasons[0].year).toBe(scenario.seasonYear);
    expect(report.seasons.at(-1)?.year).toBe(scenario.seasonYear + scenario.seasons - 1);
  });

  it.each(reports)('$scenario.series preserves roster and market integrity', ({ report }) => {
    for (const season of report.seasons) {
      expect({ year: season.year, duplicateNames: season.duplicateNames }).toEqual({ year: season.year, duplicateNames: [] });
      expect({ year: season.year, missingSeats: season.teamsWithoutRequiredSeats }).toEqual({ year: season.year, missingSeats: [] });
      expect({ year: season.year, reservesRacing: season.reservesRacing }).toEqual({ year: season.year, reservesRacing: 0 });
      expect({ year: season.year, academyOver21: season.academyOver21 }).toEqual({ year: season.year, academyOver21: [] });
      expect({ year: season.year, youthPoolOverAge: season.youthPoolOverAge }).toEqual({ year: season.year, youthPoolOverAge: 0 });
      expect({ year: season.year, nameTagLeaks: season.nameTagLeaks }).toEqual({ year: season.year, nameTagLeaks: [] });
    }
  });

  it.each(reports)('$scenario.series keeps ratings and finances finite', ({ report }) => {
    for (const season of report.seasons) {
      expect(Number.isFinite(season.carRating.min)).toBe(true);
      expect(Number.isFinite(season.carRating.avg)).toBe(true);
      expect(Number.isFinite(season.carRating.max)).toBe(true);
      expect(season.carRating.max).toBeLessThan(98);
      expect(Number.isFinite(season.budget.min)).toBe(true);
      expect(Number.isFinite(season.budget.avg)).toBe(true);
      expect(Number.isFinite(season.budget.max)).toBe(true);
      expect(season.budget.min).toBeGreaterThan(-300_000_000);
      expect(season.budget.max).toBeLessThan(1_500_000_000);
    }
  });
}, 600_000);
