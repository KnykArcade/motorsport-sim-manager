import { describe, expect, it } from 'vitest';
import { PRESEASON_TESTING_RULES, selectPreseasonTestingRule } from './preseasonTestingRules';

describe('preseason testing rule profiles', () => {
  it('selects era and series-specific programmes', () => {
    expect(selectPreseasonTestingRule('F1', 1995).testType).toBe('Private');
    expect(selectPreseasonTestingRule('F1', 2026).maxCarsPerSession).toBe(1);
    expect(selectPreseasonTestingRule('NASCAR', 2026).testType).toBe('Organizational');
    expect(selectPreseasonTestingRule('IndyCar', 2026).testType).toBe('Open');
    expect(selectPreseasonTestingRule('CART', 1999).source.confidence).toBe('GameplayFallback');
    expect(selectPreseasonTestingRule('Champ Car', 2006).series).toBe('Champ Car');
  });

  it('records a source, confidence and bounded running model on every profile', () => {
    for (const rule of PRESEASON_TESTING_RULES) {
      expect(rule.source.title.length).toBeGreaterThan(0);
      expect(rule.source.url).toMatch(/^https:\/\//);
      expect(['Official', 'High', 'Medium', 'GameplayFallback']).toContain(rule.source.confidence);
      expect(rule.days).toBeGreaterThan(0);
      expect(rule.sessionsPerDay).toBeGreaterThan(0);
      expect(rule.maxCarsPerSession).toBeGreaterThan(0);
    }
  });
});
