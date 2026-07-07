import { describe, it, expect } from 'vitest';
import {
  generateYouthProspects,
  ensureMinimumYouthProspects,
  MIN_YOUTH_PROSPECTS,
} from './youthGenerationEngine';
import type { YouthProspect } from '../types/marketTypes';

describe('youthGenerationEngine', () => {
  describe('generateYouthProspects', () => {
    it('generates the requested number of prospects', () => {
      const prospects = generateYouthProspects('test-seed', 'F1', 2024, 5);
      expect(prospects).toHaveLength(5);
    });

    it('is deterministic — same seed produces same results', () => {
      const a = generateYouthProspects('test-seed', 'F1', 2024, 10);
      const b = generateYouthProspects('test-seed', 'F1', 2024, 10);
      expect(a).toEqual(b);
    });

    it('different seeds produce different results', () => {
      const a = generateYouthProspects('seed-a', 'F1', 2024, 10);
      const b = generateYouthProspects('seed-b', 'F1', 2024, 10);
      expect(a).not.toEqual(b);
    });

    it('different years produce different results', () => {
      const a = generateYouthProspects('test-seed', 'F1', 2024, 10);
      const b = generateYouthProspects('test-seed', 'F1', 2025, 10);
      expect(a).not.toEqual(b);
    });

    it('all generated prospects have valid ages (14-17)', () => {
      const prospects = generateYouthProspects('test-seed', 'F1', 2024, 20);
      for (const p of prospects) {
        expect(p.age).toBeGreaterThanOrEqual(14);
        expect(p.age).toBeLessThanOrEqual(17);
        expect(p.birthYear).toBe(2024 - p.age);
      }
    });

    it('all generated prospects have unique ids', () => {
      const prospects = generateYouthProspects('test-seed', 'F1', 2024, 20);
      const ids = new Set(prospects.map((p) => p.id));
      expect(ids.size).toBe(20);
    });

    it('all generated prospects have valid skill ratings (1-100)', () => {
      const prospects = generateYouthProspects('test-seed', 'F1', 2024, 20);
      for (const p of prospects) {
        expect(p.overall).toBeGreaterThan(0);
        expect(p.overall).toBeLessThanOrEqual(100);
        expect(p.potential).toBeGreaterThan(0);
        expect(p.potential).toBeLessThanOrEqual(100);
        expect(p.skills.cornering).toBeGreaterThanOrEqual(1);
        expect(p.skills.cornering).toBeLessThanOrEqual(100);
      }
    });

    it('all generated prospects are academy eligible', () => {
      const prospects = generateYouthProspects('test-seed', 'F1', 2024, 10);
      for (const p of prospects) {
        expect(p.academyEligibleNow).toBe(true);
        expect(p.marketPool).toBe('Youth');
        expect(p.marketStatus).toBe('Prospect');
      }
    });

    it('produces varied overall ratings across multiple prospects', () => {
      const prospects = generateYouthProspects('test-seed', 'F1', 2024, 20);
      const overalls = prospects.map((p) => p.overall);
      const uniqueOveralls = new Set(overalls);
      // With 7 archetypes and variance, we should get varied ratings
      expect(uniqueOveralls.size).toBeGreaterThan(3);
    });
  });

  describe('ensureMinimumYouthProspects', () => {
    it('returns existing array if already at minimum', () => {
      const existing: YouthProspect[] = Array.from({ length: MIN_YOUTH_PROSPECTS }, (_, i) => ({
        id: `existing-${i}`,
        name: `Existing ${i}`,
        age: 15,
        birthYear: 2009,
        nationality: 'GBR',
        currentLevel: 'Karting',
        marketPool: 'Youth',
        marketStatus: 'Prospect',
        academyEligibleNow: true,
        earliestFullAcademyYear: 2024,
        skills: {
          cornering: 5, braking: 5, straights: 5, tractionAcceleration: 5,
          elevationBlindCorners: 5, technical: 5, overtakingRacecraft: 5,
          surfaceGripBumpiness: 5, riskManagement: 5, enduranceConsistency: 5,
        },
        overall: 50,
        potential: 70,
        potentialDelta: 2,
        developmentRate: 0.5,
        yearsUntilF1Ready: 3,
        signingCost: 0.1,
        yearlyAcademyCost: 0.1,
        riskLevel: 'Low',
        suggestedPath: 'Academy',
        notes: 'Existing prospect',
      }));
      const result = ensureMinimumYouthProspects(existing, 'test-seed', 'F1', 2024);
      expect(result).toBe(existing);
    });

    it('fills up to minimum when existing is empty', () => {
      const result = ensureMinimumYouthProspects([], 'test-seed', 'F1', 2024);
      expect(result.length).toBeGreaterThanOrEqual(MIN_YOUTH_PROSPECTS);
    });

    it('fills up to minimum when existing is below minimum', () => {
      const existing: YouthProspect[] = [{
        id: 'existing-0',
        name: 'Existing 0',
        age: 15,
        birthYear: 2009,
        nationality: 'GBR',
        currentLevel: 'Karting',
        marketPool: 'Youth',
        marketStatus: 'Prospect',
        academyEligibleNow: true,
        earliestFullAcademyYear: 2024,
        skills: {
          cornering: 5, braking: 5, straights: 5, tractionAcceleration: 5,
          elevationBlindCorners: 5, technical: 5, overtakingRacecraft: 5,
          surfaceGripBumpiness: 5, riskManagement: 5, enduranceConsistency: 5,
        },
        overall: 50,
        potential: 70,
        potentialDelta: 2,
        developmentRate: 0.5,
        yearsUntilF1Ready: 3,
        signingCost: 0.1,
        yearlyAcademyCost: 0.1,
        riskLevel: 'Low',
        suggestedPath: 'Academy',
        notes: 'Existing prospect',
      }];
      const result = ensureMinimumYouthProspects(existing, 'test-seed', 'F1', 2024);
      expect(result.length).toBe(MIN_YOUTH_PROSPECTS);
      // First item should be the existing one
      expect(result[0].id).toBe('existing-0');
    });

    it('is deterministic — same inputs produce same fill', () => {
      const a = ensureMinimumYouthProspects([], 'test-seed', 'F1', 2024);
      const b = ensureMinimumYouthProspects([], 'test-seed', 'F1', 2024);
      expect(a).toEqual(b);
    });

    it('does not replace curated eligible youth drivers', () => {
      const curated: YouthProspect[] = Array.from({ length: 3 }, (_, i) => ({
        id: `curated-${i}`,
        name: `Curated Driver ${i}`,
        age: 14 + i,
        birthYear: 2024 - (14 + i),
        nationality: 'GBR',
        currentLevel: 'Karting',
        marketPool: 'Youth' as const,
        marketStatus: 'Prospect' as const,
        academyEligibleNow: true,
        earliestFullAcademyYear: 2024,
        skills: {
          cornering: 5, braking: 5, straights: 5, tractionAcceleration: 5,
          elevationBlindCorners: 5, technical: 5, overtakingRacecraft: 5,
          surfaceGripBumpiness: 5, riskManagement: 5, enduranceConsistency: 5,
        },
        overall: 50,
        potential: 70,
        potentialDelta: 2,
        developmentRate: 0.5,
        yearsUntilF1Ready: 3,
        signingCost: 0.1,
        yearlyAcademyCost: 0.1,
        riskLevel: 'Low' as const,
        suggestedPath: 'Academy',
        notes: 'Curated prospect',
      }));
      const result = ensureMinimumYouthProspects(curated, 'test-seed', 'F1', 2024);
      // Curated drivers should be at the start, unchanged.
      expect(result.slice(0, 3)).toEqual(curated);
      // Total should be at least minimum.
      expect(result.length).toBeGreaterThanOrEqual(MIN_YOUTH_PROSPECTS);
    });

    it('does not duplicate existing driver names', () => {
      const existing: YouthProspect[] = [{
        id: 'existing-0',
        name: 'John Smith',
        age: 15,
        birthYear: 2009,
        nationality: 'GBR',
        currentLevel: 'Karting',
        marketPool: 'Youth' as const,
        marketStatus: 'Prospect' as const,
        academyEligibleNow: true,
        earliestFullAcademyYear: 2024,
        skills: {
          cornering: 5, braking: 5, straights: 5, tractionAcceleration: 5,
          elevationBlindCorners: 5, technical: 5, overtakingRacecraft: 5,
          surfaceGripBumpiness: 5, riskManagement: 5, enduranceConsistency: 5,
        },
        overall: 50,
        potential: 70,
        potentialDelta: 2,
        developmentRate: 0.5,
        yearsUntilF1Ready: 3,
        signingCost: 0.1,
        yearlyAcademyCost: 0.1,
        riskLevel: 'Low' as const,
        suggestedPath: 'Academy',
        notes: 'Existing prospect',
      }];
      const result = ensureMinimumYouthProspects(existing, 'test-seed', 'F1', 2024);
      const names = result.map((p) => p.name.toLowerCase().trim());
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it('season rollover re-checks and refills if needed', () => {
      // Simulate a season rollover: year changes, pool may shrink.
      const year1 = ensureMinimumYouthProspects([], 'test-seed', 'F1', 2024);
      expect(year1.length).toBeGreaterThanOrEqual(MIN_YOUTH_PROSPECTS);

      // Simulate some prospects aging out (e.g., only 5 remain).
      const remaining = year1.slice(0, 5);
      const year2 = ensureMinimumYouthProspects(remaining, 'test-seed', 'F1', 2025);
      expect(year2.length).toBeGreaterThanOrEqual(MIN_YOUTH_PROSPECTS);
      // Original 5 should be preserved.
      expect(year2.slice(0, 5)).toEqual(remaining);
    });

    it('respects occupiedNames to avoid collisions with senior drivers', () => {
      const occupiedNames = new Set<string>(['john smith', 'jane doe']);
      const result = ensureMinimumYouthProspects([], 'test-seed', 'F1', 2024, occupiedNames);
      const names = result.map((p) => p.name.toLowerCase().trim());
      expect(names).not.toContain('john smith');
      expect(names).not.toContain('jane doe');
    });
  });
});
