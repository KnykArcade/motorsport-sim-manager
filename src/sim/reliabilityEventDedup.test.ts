import { describe, expect, it } from 'vitest';
import { shouldLogReliabilityRecovery } from './raceTickEngine';

describe('reliability recovery event deduplication', () => {
  it('ignores recovery rolls that do not change component severity', () => {
    expect(shouldLogReliabilityRecovery('partial', 'moderate', 'moderate', 20, 0)).toBe(false);
    expect(shouldLogReliabilityRecovery('worse', 'severe', 'severe', 20, 0)).toBe(false);
    expect(shouldLogReliabilityRecovery('none', 'moderate', 'minor', 20, 0)).toBe(false);
  });

  it('logs genuine improvement and worsening transitions', () => {
    expect(shouldLogReliabilityRecovery('partial', 'moderate', 'minor', 20, 0)).toBe(true);
    expect(shouldLogReliabilityRecovery('worse', 'minor', 'moderate', 20, 0)).toBe(true);
  });

  it('suppresses repeated non-terminal transitions during the component cooldown', () => {
    expect(shouldLogReliabilityRecovery('partial', 'moderate', 'minor', 22, 25)).toBe(false);
    expect(shouldLogReliabilityRecovery('worse', 'minor', 'moderate', 22, 25)).toBe(false);
    expect(shouldLogReliabilityRecovery('partial', 'moderate', 'minor', 25, 25)).toBe(true);
  });

  it('always reports a full recovery that clears the component issue', () => {
    expect(shouldLogReliabilityRecovery('full', 'minor', 'none', 22, 25)).toBe(true);
  });
});
