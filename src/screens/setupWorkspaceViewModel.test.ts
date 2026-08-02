import { describe, expect, it } from 'vitest';
import { BALANCED_SETUP } from '../data/setup/setupComponents';
import {
  changedSetupComponentCount,
  changedSetupParameters,
  formatSetupDelta,
  setupDraftStatus,
  setupParameterChange,
} from './setupWorkspaceViewModel';

describe('setup workspace view model', () => {
  it('compares the current draft with the setup that entered the workspace', () => {
    const current = { ...BALANCED_SETUP, frontWing: 6.5, gearing: 4.5 };

    expect(setupParameterChange(BALANCED_SETUP, current, 'frontWing')).toEqual({
      previous: 5,
      current: 6.5,
      delta: 1.5,
      changed: true,
    });
    expect(changedSetupParameters(BALANCED_SETUP, current)).toEqual(['frontWing', 'gearing']);
    expect(changedSetupComponentCount(BALANCED_SETUP, current, 'aero')).toBe(1);
  });

  it('formats signed changes without presenting noise as a change', () => {
    expect(formatSetupDelta(1)).toBe('+1.0');
    expect(formatSetupDelta(-0.5)).toBe('-0.5');
    expect(formatSetupDelta(0)).toBe('No change');
  });

  it('distinguishes normal drafts, qualifying retention, and parc ferme edits', () => {
    expect(setupDraftStatus({ changedCount: 0, postQualifying: false, locked: false })).toBe('No draft changes');
    expect(setupDraftStatus({ changedCount: 0, postQualifying: true, locked: false })).toBe('Qualifying setup retained');
    expect(setupDraftStatus({ changedCount: 2, postQualifying: true, locked: true })).toBe('2 permitted post-qualifying changes');
    expect(setupDraftStatus({ changedCount: 2, postQualifying: true, locked: true, restrictedCount: 1 })).toBe('1 restricted change needs a decision');
  });
});
