import { describe, it, expect } from 'vitest';
import {
  evaluatePrincipalPressure,
  generateReplacementPrincipalName,
  principalHiredNews,
  playerJobMoveNews,
} from './principalPressureEngine';
import type { FinancialDistressState } from '../types/raceWeekendPackageTypes';

describe('principalPressureEngine', () => {
  const stableDistress: FinancialDistressState = {
    level: 'Stable',
    consecutiveNegativeCashRaces: 0,
    racesUsingEmergencyPackage: 0,
    ownerPressure: 0,
  };

  describe('evaluatePrincipalPressure', () => {
    it('returns zero pressure for stable team meeting expectations', () => {
      const result = evaluatePrincipalPressure(
        'Test Principal',
        'team-1',
        'Test Team',
        0,
        stableDistress,
        5,
        5,
        2024,
        false,
        'StandardCareer',
      );
      expect(result.pressureDelta).toBe(-5); // Stable reduces pressure
      expect(result.shouldFire).toBe(false);
      expect(result.news).toHaveLength(0);
    });

    it('increases pressure with financial distress', () => {
      const closureDistress: FinancialDistressState = {
        ...stableDistress,
        level: 'ClosureRisk',
        consecutiveNegativeCashRaces: 8,
        ownerPressure: 80,
      };
      const result = evaluatePrincipalPressure(
        'Test Principal',
        'team-1',
        'Test Team',
        50,
        closureDistress,
        5,
        5,
        2024,
        false,
        'StandardCareer',
      );
      expect(result.pressureDelta).toBeGreaterThan(30);
      expect(result.newPressure).toBeGreaterThan(80);
    });

    it('increases pressure for underperformance', () => {
      const result = evaluatePrincipalPressure(
        'Test Principal',
        'team-1',
        'Test Team',
        20,
        stableDistress,
        10, // 10th place
        5,  // expected 5th
        2024,
        false,
        'StandardCareer',
      );
      expect(result.pressureDelta).toBeGreaterThan(0);
    });

    it('decreases pressure for overperformance', () => {
      const result = evaluatePrincipalPressure(
        'Test Principal',
        'team-1',
        'Test Team',
        30,
        stableDistress,
        3,  // 3rd place
        8,  // expected 8th
        2024,
        false,
        'StandardCareer',
      );
      expect(result.pressureDelta).toBeLessThan(0);
    });

    it('fires AI principal at very high pressure', () => {
      const closureDistress: FinancialDistressState = {
        ...stableDistress,
        level: 'ClosureRisk',
        consecutiveNegativeCashRaces: 8,
        ownerPressure: 90,
      };
      const result = evaluatePrincipalPressure(
        'Test Principal',
        'team-1',
        'Test Team',
        80,
        closureDistress,
        10,
        5,
        2024,
        false,
        'StandardCareer',
      );
      expect(result.shouldFire).toBe(true);
      expect(result.news.length).toBeGreaterThan(0);
      expect(result.news.some((n) => n.headline.includes('fires') || n.headline.includes('sacks'))).toBe(true);
    });

    it('does not fire player in TeamLock mode', () => {
      const closureDistress: FinancialDistressState = {
        ...stableDistress,
        level: 'ClosureRisk',
        consecutiveNegativeCashRaces: 8,
        ownerPressure: 95,
      };
      const result = evaluatePrincipalPressure(
        'Player Principal',
        'team-1',
        'Test Team',
        90,
        closureDistress,
        10,
        5,
        2024,
        true,
        'TeamLock',
      );
      expect(result.shouldFire).toBe(false);
    });

    it('does not fire player in Sandbox mode', () => {
      const closureDistress: FinancialDistressState = {
        ...stableDistress,
        level: 'ClosureRisk',
        consecutiveNegativeCashRaces: 8,
        ownerPressure: 95,
      };
      const result = evaluatePrincipalPressure(
        'Player Principal',
        'team-1',
        'Test Team',
        90,
        closureDistress,
        10,
        5,
        2024,
        true,
        'Sandbox',
      );
      expect(result.shouldFire).toBe(false);
    });

    it('can fire player in StandardCareer mode at high pressure', () => {
      const closureDistress: FinancialDistressState = {
        ...stableDistress,
        level: 'ClosureRisk',
        consecutiveNegativeCashRaces: 8,
        ownerPressure: 95,
      };
      const result = evaluatePrincipalPressure(
        'Player Principal',
        'team-1',
        'Test Team',
        85,
        closureDistress,
        10,
        5,
        2024,
        true,
        'StandardCareer',
      );
      expect(result.shouldFire).toBe(true);
    });

    it('clamps pressure to 0-100', () => {
      const result1 = evaluatePrincipalPressure(
        'Test Principal',
        'team-1',
        'Test Team',
        0,
        stableDistress,
        1,
        10,
        2024,
        false,
        'StandardCareer',
      );
      expect(result1.newPressure).toBeGreaterThanOrEqual(0);

      const result2 = evaluatePrincipalPressure(
        'Test Principal',
        'team-1',
        'Test Team',
        100,
        { ...stableDistress, level: 'ClosureRisk', consecutiveNegativeCashRaces: 8 },
        10,
        1,
        2024,
        false,
        'StandardCareer',
      );
      expect(result2.newPressure).toBeLessThanOrEqual(100);
    });
  });

  describe('generateReplacementPrincipalName', () => {
    it('generates a deterministic name from seed', () => {
      const a = generateReplacementPrincipalName('test-seed-1');
      const b = generateReplacementPrincipalName('test-seed-1');
      expect(a).toBe(b);
    });

    it('generates different names for different seeds', () => {
      const a = generateReplacementPrincipalName('seed-a');
      const b = generateReplacementPrincipalName('seed-b');
      expect(a).not.toBe(b);
    });

    it('generates a name with first and last name', () => {
      const name = generateReplacementPrincipalName('test-seed');
      expect(name).toContain(' ');
      expect(name.split(' ').length).toBe(2);
    });
  });

  describe('principalHiredNews', () => {
    it('generates news with correct fields', () => {
      const news = principalHiredNews('John Doe', 'team-1', 'Test Team', 2024);
      expect(news.headline).toContain('Test Team');
      expect(news.headline).toContain('John Doe');
      expect(news.category).toBe('career_event');
      expect(news.priority).toBe('high');
      expect(news.teamId).toBe('team-1');
    });
  });

  describe('playerJobMoveNews', () => {
    it('generates news with correct fields', () => {
      const news = playerJobMoveNews('Player', 'team-1', 'Old Team', 'team-2', 'New Team', 2024);
      expect(news.headline).toContain('Old Team');
      expect(news.headline).toContain('New Team');
      expect(news.category).toBe('career_event');
      expect(news.priority).toBe('critical');
    });
  });
});
