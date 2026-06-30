import { describe, expect, it } from 'vitest';
import {
  calculateAcademyCapacity,
  calculateOverallTeamRating,
} from './teamRatingsEngine';
import type { TeamOrganizationRatings } from '../types/teamRatingsTypes';

function ratings(overall: number, overrides: Partial<TeamOrganizationRatings> = {}): TeamOrganizationRatings {
  const flat = (v: number): TeamOrganizationRatings => ({
    teamId: 't',
    carPerformance: v,
    marketing: v,
    research: v,
    facilities: v,
    scouting: v,
    fanSupport: v,
    mediaReach: v,
    financialStability: v,
    staffQuality: v,
    driverAppeal: v,
    sponsorAppeal: v,
    operations: v,
    reliabilityDepartment: v,
    pitCrew: v,
    youthAcademy: v,
    overallTeamRating: v,
  });
  return { ...flat(overall), ...overrides, overallTeamRating: overall };
}

describe('calculateOverallTeamRating', () => {
  it('returns the flat value when all categories are equal', () => {
    const r = ratings(70);
    expect(calculateOverallTeamRating(r)).toBe(70);
  });

  it('weights car performance more heavily than minor categories', () => {
    const highCar = calculateOverallTeamRating(ratings(50, { carPerformance: 90 }));
    const highScouting = calculateOverallTeamRating(ratings(50, { scouting: 90 }));
    expect(highCar).toBeGreaterThan(highScouting);
  });
});

describe('calculateAcademyCapacity', () => {
  it('gives the weakest teams a single slot', () => {
    expect(calculateAcademyCapacity(ratings(30))).toBe(1);
  });

  it('gives midfield teams two slots', () => {
    expect(calculateAcademyCapacity(ratings(55))).toBe(2);
  });

  it('gives strong teams three slots', () => {
    expect(calculateAcademyCapacity(ratings(70))).toBe(3);
  });

  it('gives elite teams four slots', () => {
    expect(calculateAcademyCapacity(ratings(85))).toBe(4);
  });

  it('never returns below 1 or above 4', () => {
    expect(calculateAcademyCapacity(ratings(0))).toBe(1);
    expect(calculateAcademyCapacity(ratings(100))).toBe(4);
  });

  it('nudges a near-boundary team up one band with strong youth/facilities', () => {
    const base = ratings(63);
    expect(calculateAcademyCapacity(base)).toBe(2);
    const boosted = ratings(63, { youthAcademy: 90, facilities: 90 });
    expect(calculateAcademyCapacity(boosted)).toBe(3);
  });
});
