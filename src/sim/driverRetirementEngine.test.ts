import { describe, it, expect } from 'vitest';
import { applyDriverRetirements, shouldRetire } from './driverRetirementEngine';
import type { Driver, Team } from '../types/gameTypes';

function driver(over: Partial<Driver> = {}): Driver {
  return {
    id: 'd1',
    name: 'Test Driver',
    number: 1,
    teamId: 't1',
    ratings: {
      cornering: 6,
      braking: 6,
      straights: 6,
      tractionAcceleration: 6,
      elevationBlindCorners: 6,
      technical: 6,
      overtakingRacecraft: 6,
      surfaceGripBumpiness: 6,
      riskManagement: 6,
      enduranceConsistency: 6,
      qualifying: 6,
      racePace: 6,
      adaptability: 6,
      aggression: 6,
      composure: 6,
      overall: 6,
    },
    morale: 60,
    confidence: 60,
    contractYearsRemaining: 1,
    salary: 3,
    traits: [],
    ...over,
  };
}

const seed = 'seed';

describe('shouldRetire', () => {
  it('always retires a driver past the hard age cap', () => {
    expect(shouldRetire(driver({ age: 46, ratings: { ...driver().ratings, overall: 9 } }), seed, 2000)).toBe(true);
  });

  it('retires a fading veteran but keeps an elite, motivated one', () => {
    const fading = driver({ age: 43, morale: 60, ratings: { ...driver().ratings, overall: 6.5 } });
    const elite = driver({ age: 43, morale: 70, ratings: { ...driver().ratings, overall: 8.4 } });
    expect(shouldRetire(fading, seed, 2000)).toBe(true);
    expect(shouldRetire(elite, seed, 2000)).toBe(false);
  });

  it('leaves a driver under review age alone regardless of contract', () => {
    expect(shouldRetire(driver({ age: 30, contractYearsRemaining: 0 }), seed, 2000)).toBe(false);
  });

  it('only reviews a late-30s driver whose contract is expiring', () => {
    const underContract = driver({ age: 40, contractYearsRemaining: 3, ratings: { ...driver().ratings, overall: 5 } });
    expect(shouldRetire(underContract, seed, 2000)).toBe(false);
  });

  it('ignores a driver with no recorded age', () => {
    expect(shouldRetire(driver({ age: undefined }), seed, 2000)).toBe(false);
  });
});

describe('applyDriverRetirements', () => {
  const team: Team = {
    id: 't1',
    name: 'Team One',
    shortName: 'T1',
    carId: 'c1',
    driverIds: ['d1', 'd2', 'res1'],
    budget: 50_000_000,
    reputation: 60,
    raceOperations: 5,
    morale: 60,
    color: '#fff',
  };

  it('removes retired race drivers from the grid and the team roster', () => {
    const drivers = [
      driver({ id: 'd1', age: 47 }), // retires (hard cap)
      driver({ id: 'd2', age: 28 }), // stays
      driver({ id: 'res1', age: 47, contractType: 'reserve' }), // reserve — left alone
    ];
    const result = applyDriverRetirements(drivers, [team], seed, 2000);
    expect(result.retiredIds).toEqual(['d1']);
    expect(result.drivers.map((d) => d.id).sort()).toEqual(['d2', 'res1']);
    expect(result.teams[0].driverIds).toEqual(['d2', 'res1']);
    expect(result.notes[0]).toContain('retires');
  });
});
