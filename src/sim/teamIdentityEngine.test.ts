import { describe, it, expect } from 'vitest';
import {
  devAreaBias,
  weightedDevTarget,
  marketMod,
  academyBias,
  spendPriorityShift,
  riskMod,
  effectiveRisk,
  updateTeamMemory,
  memoryArchetypeNudge,
  type TeamMemoryEntry,
} from './teamIdentityEngine';
import type { TeamPhilosophyTrait } from '../types/aiTeamTypes';

function car(ratings: { aeroEfficiency?: number; enginePower?: number; mechanicalGrip?: number; reliability?: number; pitCrewOperations?: number }) {
  return {
    ratings: {
      aeroEfficiency: ratings.aeroEfficiency ?? 7,
      enginePower: ratings.enginePower ?? 7,
      mechanicalGrip: ratings.mechanicalGrip ?? 7,
      reliability: ratings.reliability ?? 7,
      pitCrewOperations: ratings.pitCrewOperations ?? 7,
    },
  };
}

describe('teamIdentityEngine', () => {
  describe('devAreaBias', () => {
    it('returns zero bias for no traits', () => {
      const bias = devAreaBias(undefined);
      expect(bias.aeroEfficiency).toBe(0);
      expect(bias.enginePower).toBe(0);
    });

    it('accumulates bias from multiple traits', () => {
      const traits: TeamPhilosophyTrait[] = ['TechnicalInnovator', 'RiskTaker'];
      const bias = devAreaBias(traits);
      expect(bias.aeroEfficiency).toBeCloseTo(0.5); // 0.3 + 0.2
      expect(bias.enginePower).toBeCloseTo(0.3); // 0.15 + 0.15
    });
  });

  describe('weightedDevTarget', () => {
    it('targets reliability when there is a reliability problem', () => {
      const target = weightedDevTarget(car({ reliability: 7.5 }), true, ['TechnicalInnovator']);
      expect(target).toBe('reliability');
    });

    it('targets weakest area by default', () => {
      const target = weightedDevTarget(car({ aeroEfficiency: 5, enginePower: 8, mechanicalGrip: 8, reliability: 8, pitCrewOperations: 8 }), false, undefined);
      expect(target).toBe('aeroEfficiency');
    });

    it('trait bias can shift target away from weakest area', () => {
      // All equal ratings, TechnicalInnovator biases toward aero.
      const target = weightedDevTarget(car({ aeroEfficiency: 7, enginePower: 7, mechanicalGrip: 7, reliability: 7, pitCrewOperations: 7 }), false, ['TechnicalInnovator']);
      expect(target).toBe('aeroEfficiency');
    });

    it('Traditionalist biases toward reliability', () => {
      const target = weightedDevTarget(car({ aeroEfficiency: 7, enginePower: 7, mechanicalGrip: 7, reliability: 7, pitCrewOperations: 7 }), false, ['Traditionalist']);
      expect(target).toBe('reliability');
    });
  });

  describe('marketMod', () => {
    it('returns zero modifiers for no traits', () => {
      const mod = marketMod(undefined);
      expect(mod.overallBias).toBe(0);
      expect(mod.youthBias).toBe(0);
    });

    it('StarMaker strongly biases toward youth and potential', () => {
      const mod = marketMod(['StarMaker']);
      expect(mod.youthBias).toBeCloseTo(0.2);
      expect(mod.potentialBias).toBeCloseTo(0.15);
    });

    it('accumulates from multiple traits', () => {
      const mod = marketMod(['StarMaker', 'RiskTaker']);
      expect(mod.potentialBias).toBeCloseTo(0.3); // 0.15 + 0.15
    });
  });

  describe('academyBias', () => {
    it('returns 0 for no traits', () => {
      expect(academyBias(undefined)).toBe(0);
    });

    it('StarMaker has highest academy bias', () => {
      expect(academyBias(['StarMaker'])).toBeCloseTo(0.25);
    });

    it('Traditionalist has negative academy bias', () => {
      expect(academyBias(['Traditionalist'])).toBeCloseTo(-0.1);
    });
  });

  describe('spendPriorityShift', () => {
    it('returns zero shifts for no traits', () => {
      const shift = spendPriorityShift(undefined);
      expect(shift.devShift).toBe(0);
      expect(shift.facilityShift).toBe(0);
      expect(shift.staffShift).toBe(0);
    });

    it('PeopleFirst biases toward staff', () => {
      const shift = spendPriorityShift(['PeopleFirst']);
      expect(shift.staffShift).toBeCloseTo(0.15);
    });

    it('TechnicalInnovator biases toward dev', () => {
      const shift = spendPriorityShift(['TechnicalInnovator']);
      expect(shift.devShift).toBeCloseTo(0.1);
    });
  });

  describe('riskMod', () => {
    it('returns 0 for no traits', () => {
      expect(riskMod(undefined)).toBe(0);
    });

    it('RiskTaker increases risk', () => {
      expect(riskMod(['RiskTaker'])).toBeCloseTo(0.15);
    });

    it('Disciplined decreases risk', () => {
      expect(riskMod(['Disciplined'])).toBeCloseTo(-0.1);
    });
  });

  describe('effectiveRisk', () => {
    it('combines base risk with trait modifiers', () => {
      expect(effectiveRisk(['RiskTaker'], 0.5)).toBeCloseTo(0.65);
    });

    it('clamps to [0, 1]', () => {
      expect(effectiveRisk(['RiskTaker', 'Maverick'], 0.9)).toBeLessThanOrEqual(1);
      expect(effectiveRisk(['Disciplined', 'Traditionalist'], 0.05)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('updateTeamMemory', () => {
    it('creates new memory entry on first season', () => {
      const mem = updateTeamMemory(undefined, 't1', 3, 2, 5);
      expect(mem.teamId).toBe('t1');
      expect(mem.seasonsTracked).toBe(1);
      expect(mem.lastConstructorPosition).toBe(3);
      expect(mem.bestConstructorPosition).toBe(3);
      expect(mem.worstConstructorPosition).toBe(3);
      expect(mem.seasonsSincePodium).toBe(0);
      expect(mem.seasonsSinceWin).toBe(0);
      expect(mem.totalWins).toBe(2);
      expect(mem.totalPodiums).toBe(5);
      expect(mem.trendDirection).toBe('stable');
    });

    it('tracks improving trend', () => {
      const prev: TeamMemoryEntry = {
        teamId: 't1',
        seasonsTracked: 1,
        lastConstructorPosition: 5,
        bestConstructorPosition: 5,
        worstConstructorPosition: 5,
        avgConstructorPosition: 5,
        trendDirection: 'stable',
        seasonsSincePodium: 1,
        seasonsSinceWin: 1,
        totalWins: 0,
        totalPodiums: 0,
      };
      const mem = updateTeamMemory(prev, 't1', 3, 1, 2);
      expect(mem.trendDirection).toBe('improving');
      expect(mem.seasonsSinceWin).toBe(0);
      expect(mem.seasonsSincePodium).toBe(0);
      expect(mem.totalWins).toBe(1);
      expect(mem.seasonsTracked).toBe(2);
    });

    it('tracks declining trend', () => {
      const prev: TeamMemoryEntry = {
        teamId: 't1',
        seasonsTracked: 1,
        lastConstructorPosition: 3,
        bestConstructorPosition: 3,
        worstConstructorPosition: 3,
        avgConstructorPosition: 3,
        trendDirection: 'stable',
        seasonsSincePodium: 0,
        seasonsSinceWin: 0,
        totalWins: 1,
        totalPodiums: 3,
      };
      const mem = updateTeamMemory(prev, 't1', 6, 0, 0);
      expect(mem.trendDirection).toBe('declining');
      expect(mem.seasonsSinceWin).toBe(1);
      expect(mem.seasonsSincePodium).toBe(1);
      expect(mem.worstConstructorPosition).toBe(6);
    });
  });

  describe('memoryArchetypeNudge', () => {
    it('does not nudge with less than 2 seasons tracked', () => {
      const mem: TeamMemoryEntry = {
        teamId: 't1',
        seasonsTracked: 1,
        lastConstructorPosition: 10,
        trendDirection: 'declining',
        seasonsSincePodium: 5,
        seasonsSinceWin: 5,
        totalWins: 0,
        totalPodiums: 0,
      };
      expect(memoryArchetypeNudge(mem, 'FinanciallyConservative')).toBe('FinanciallyConservative');
    });

    it('nudges FinanciallyConservative to AmbitiousBuilder after long decline', () => {
      const mem: TeamMemoryEntry = {
        teamId: 't1',
        seasonsTracked: 3,
        lastConstructorPosition: 9,
        trendDirection: 'declining',
        seasonsSincePodium: 3,
        seasonsSinceWin: 3,
        totalWins: 0,
        totalPodiums: 0,
      };
      expect(memoryArchetypeNudge(mem, 'FinanciallyConservative')).toBe('AmbitiousBuilder');
    });

    it('nudges SurvivalMode to FinanciallyConservative after improvement', () => {
      const mem: TeamMemoryEntry = {
        teamId: 't1',
        seasonsTracked: 2,
        lastConstructorPosition: 4,
        trendDirection: 'improving',
        seasonsSincePodium: 0,
        seasonsSinceWin: 0,
        totalWins: 1,
        totalPodiums: 3,
      };
      expect(memoryArchetypeNudge(mem, 'SurvivalMode')).toBe('FinanciallyConservative');
    });

    it('nudges stagnant midfield teams', () => {
      const mem: TeamMemoryEntry = {
        teamId: 't1',
        seasonsTracked: 3,
        lastConstructorPosition: 7,
        avgConstructorPosition: 7,
        trendDirection: 'stable',
        seasonsSincePodium: 3,
        seasonsSinceWin: 3,
        totalWins: 0,
        totalPodiums: 0,
      };
      expect(memoryArchetypeNudge(mem, 'FinanciallyConservative')).toBe('AmbitiousBuilder');
    });

    it('does not nudge teams that are already aggressive', () => {
      const mem: TeamMemoryEntry = {
        teamId: 't1',
        seasonsTracked: 3,
        lastConstructorPosition: 9,
        trendDirection: 'declining',
        seasonsSincePodium: 3,
        seasonsSinceWin: 3,
        totalWins: 0,
        totalPodiums: 0,
      };
      expect(memoryArchetypeNudge(mem, 'AggressiveSpender')).toBe('AggressiveSpender');
    });
  });
});
