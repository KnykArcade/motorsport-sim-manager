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

  it('defines each identity once and ages it through eligible seasons', () => {
    expect(documentedYouthForYear(2024).find((entry) => entry.name === 'Noah Baglin')?.age).toBe(12);
    expect(documentedYouthForYear(2026).find((entry) => entry.name === 'Noah Baglin')?.age).toBe(14);
    expect(documentedYouthForYear(2026).some((entry) => entry.name === 'Freddie Slater')).toBe(false);
  });
});
