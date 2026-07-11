import { describe, expect, it } from 'vitest';
import { selectRaceRuleProfile } from './raceRuleProfiles';

describe('race rule profiles', () => {
  it('selects NASCAR stage-era rules only for applicable years', () => {
    expect(selectRaceRuleProfile('NASCAR', 2010).raceControl.stageRacing).toBe(false);
    expect(selectRaceRuleProfile('NASCAR', 2026).raceControl.stageRacing).toBe(true);
  });

  it('does not apply the NASCAR free-pass rule before 2003', () => {
    expect(selectRaceRuleProfile('NASCAR', 2002).pitLane.luckyDog).toBe(false);
    expect(selectRaceRuleProfile('NASCAR', 2003).pitLane.luckyDog).toBe(true);
  });

  it('does not apply modern F1 DRS to the 1990s', () => {
    expect(selectRaceRuleProfile('F1', 1995).overtakingAids.drs).toBe(false);
    expect(selectRaceRuleProfile('F1', 2026).overtakingAids.drs).toBe(true);
  });
});
