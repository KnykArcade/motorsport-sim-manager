import { describe, expect, it } from 'vitest';
import type { FogView } from '../sim/scoutingEngine';
import type { ScoutingReport } from '../types/scoutingTypes';
import { scoutingAbilitySummary, scoutingAssignments } from './scoutingViewModel';

const view: FogView = {
  accuracy: 0.6, revealed: false, maxed: false,
  potential: { revealed: false, range: [70, 90] },
  skills: { cornering: [60, 70], braking: [65, 75], technical: 'Unknown' },
  notes: [],
};

describe('scouting view model', () => {
  it('derives knowledge-aware CA and PA star bands from fog only', () => {
    const summary = scoutingAbilitySummary(view);
    expect(summary.knowledgePercentage).toBe(60);
    expect(summary.currentStars).toBeDefined();
    expect(summary.potentialStars).toEqual([3.5, 4.5]);
    expect(summary.potentialRange).toEqual([70, 90]);
  });

  it('keeps current ability unknown when every observed attribute is unknown', () => {
    expect(scoutingAbilitySummary({ ...view, skills: { technical: 'Unknown' } }).currentStars).toBeUndefined();
  });

  it('lists only outstanding stored reports and resolves existing names', () => {
    const report = (entityId: string, scoutingLevel: number): ScoutingReport => ({
      entityId, entityType: 'Driver', scoutingLevel, accuracy: 0.5,
      visibleRatings: {}, notes: [], lastUpdated: '2026-01-01',
    });
    const assignments = scoutingAssignments({ a: report('a', 50), b: report('b', 100) }, 0.3, { a: 'Known Driver' });
    expect(assignments).toHaveLength(1);
    expect(assignments[0]).toMatchObject({ entityId: 'a', name: 'Known Driver', scoutingLevel: 50 });
  });
});
