import { describe, expect, it } from 'vitest';
import {
  selectedWorkflowEntry,
  workflowStageForPhase,
  workflowStageIndex,
  workflowStageState,
} from './seasonRaceWorkflowViewModel';

describe('season race workflow view model', () => {
  it('maps every active career phase to its visible workflow stage', () => {
    expect(workflowStageForPhase('pre_season_setup')).toBe('preseason');
    expect(workflowStageForPhase('paddock_week')).toBe('paddock');
    expect(workflowStageForPhase('pre_race_briefing')).toBe('briefing');
    expect(workflowStageForPhase('race_weekend')).toBe('weekend');
    expect(workflowStageForPhase('post_race_review')).toBe('review');
  });

  it('uses calendar as the safe fallback and promotes a completed season', () => {
    expect(workflowStageForPhase(undefined)).toBe('calendar');
    expect(workflowStageForPhase('paddock_week', true)).toBe('season');
    expect(workflowStageForPhase('post_race_review', true)).toBe('review');
  });

  it('marks earlier, active, and later stages consistently', () => {
    expect(workflowStageState('preseason', 'weekend')).toBe('complete');
    expect(workflowStageState('weekend', 'weekend')).toBe('active');
    expect(workflowStageState('review', 'weekend')).toBe('upcoming');
    expect(workflowStageIndex('offseason')).toBeGreaterThan(workflowStageIndex('season'));
  });

  it('falls back from a missing selection to the preferred entry and then the first entry', () => {
    const entries = [{ id: 'r1' }, { id: 'r2' }];
    expect(selectedWorkflowEntry(entries, 'missing', 'r2')?.id).toBe('r2');
    expect(selectedWorkflowEntry(entries, 'missing', 'missing')?.id).toBe('r1');
    expect(selectedWorkflowEntry([], 'missing')).toBeUndefined();
  });
});
