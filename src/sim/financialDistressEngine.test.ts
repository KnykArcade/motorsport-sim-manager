import { describe, it, expect } from 'vitest';
import {
  applyDistressConsequences,
  isEscalation,
} from './financialDistressEngine';
import type { FinancialDistressState } from '../types/raceWeekendPackageTypes';

describe('financialDistressEngine', () => {
  describe('isEscalation', () => {
    it('detects escalation from Stable to Tight', () => {
      expect(isEscalation('Stable', 'Tight')).toBe(true);
    });

    it('detects escalation from AtRisk to Critical', () => {
      expect(isEscalation('AtRisk', 'Critical')).toBe(true);
    });

    it('detects escalation from undefined to any non-Stable', () => {
      expect(isEscalation(undefined, 'Tight')).toBe(true);
      expect(isEscalation(undefined, 'ClosureRisk')).toBe(true);
    });

    it('returns false for same level', () => {
      expect(isEscalation('Critical', 'Critical')).toBe(false);
    });

    it('returns false for de-escalation', () => {
      expect(isEscalation('Critical', 'Stable')).toBe(false);
    });
  });

  describe('applyDistressConsequences', () => {
    const baseDistress: FinancialDistressState = {
      level: 'Stable',
      consecutiveNegativeCashRaces: 0,
      racesUsingEmergencyPackage: 0,
      ownerPressure: 0,
    };

    it('returns no consequences for Stable with no escalation', () => {
      const result = applyDistressConsequences(
        'team-1',
        'Test Team',
        baseDistress,
        baseDistress,
        2024,
        1,
      );
      expect(result.news).toHaveLength(0);
      expect(result.teamMoraleDelta).toBe(0);
      expect(result.sponsorConfidenceDelta).toBe(0);
      expect(result.ownerIntervention).toBe(false);
      expect(result.closureHook).toBe(false);
    });

    it('generates news on escalation to Tight', () => {
      const tightDistress: FinancialDistressState = {
        ...baseDistress,
        level: 'Tight',
        consecutiveNegativeCashRaces: 1,
      };
      const result = applyDistressConsequences(
        'team-1',
        'Test Team',
        tightDistress,
        baseDistress,
        2024,
        1,
      );
      expect(result.news.length).toBeGreaterThan(0);
      expect(result.news[0].headline).toContain('Test Team');
      expect(result.news[0].category).toBe('financial');
      expect(result.news[0].priority).toBe('normal');
    });

    it('applies morale hit on escalation to Critical', () => {
      const criticalDistress: FinancialDistressState = {
        ...baseDistress,
        level: 'Critical',
        consecutiveNegativeCashRaces: 4,
        ownerPressure: 30,
      };
      const result = applyDistressConsequences(
        'team-1',
        'Test Team',
        criticalDistress,
        { ...baseDistress, level: 'AtRisk', consecutiveNegativeCashRaces: 2 },
        2024,
        1,
      );
      expect(result.teamMoraleDelta).toBeLessThan(0);
      expect(result.sponsorConfidenceDelta).toBeLessThan(0);
      expect(result.developmentCapacityMultiplier).toBeLessThan(1);
      expect(result.ownerIntervention).toBe(true);
    });

    it('triggers closure hook on escalation to ClosureRisk', () => {
      const closureDistress: FinancialDistressState = {
        ...baseDistress,
        level: 'ClosureRisk',
        consecutiveNegativeCashRaces: 8,
        ownerPressure: 80,
      };
      const result = applyDistressConsequences(
        'team-1',
        'Test Team',
        closureDistress,
        { ...baseDistress, level: 'Administration', consecutiveNegativeCashRaces: 6 },
        2024,
        1,
      );
      expect(result.closureHook).toBe(true);
      expect(result.ownerIntervention).toBe(true);
      expect(result.teamMoraleDelta).toBeLessThanOrEqual(-10);
      expect(result.principalPressureDelta).toBeGreaterThan(20);
      expect(result.news.length).toBeGreaterThanOrEqual(2);
    });

    it('generates recovery news when returning to Stable', () => {
      const result = applyDistressConsequences(
        'team-1',
        'Test Team',
        baseDistress,
        { ...baseDistress, level: 'AtRisk', consecutiveNegativeCashRaces: 3 },
        2024,
        1,
      );
      expect(result.news.length).toBeGreaterThan(0);
      expect(result.news[0].headline).toContain('stabilize');
      expect(result.teamMoraleDelta).toBeGreaterThan(0);
    });

    it('does not generate news on non-escalated Tight', () => {
      const tightDistress: FinancialDistressState = {
        ...baseDistress,
        level: 'Tight',
        consecutiveNegativeCashRaces: 1,
      };
      const result = applyDistressConsequences(
        'team-1',
        'Test Team',
        tightDistress,
        tightDistress, // same level, no escalation
        2024,
        1,
      );
      // Tight is not Stable, but no escalation — should still apply deltas but no news
      expect(result.sponsorConfidenceDelta).toBe(-2);
    });
  });
});
