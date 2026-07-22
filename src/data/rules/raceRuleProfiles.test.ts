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

  it('applies parc ferme only to F1 eras where setup locks are modelled', () => {
    expect(selectRaceRuleProfile('F1', 1995).setupLock.mode).toBe('Unrestricted');
    expect(selectRaceRuleProfile('F1', 2003).setupLock.mode).toBe('ParcFerme');
    expect(selectRaceRuleProfile('F1', 2026).setupLock.mode).toBe('ParcFerme');
  });

  it('keeps IndyCar/CART flexible while modelling NASCAR impound-era restrictions', () => {
    expect(selectRaceRuleProfile('IndyCar', 2026).setupLock.mode).toBe('Unrestricted');
    expect(selectRaceRuleProfile('CART', 1995).setupLock.mode).toBe('Unrestricted');
    expect(selectRaceRuleProfile('NASCAR', 2005).setupLock.mode).toBe('Impound');
    expect(selectRaceRuleProfile('NASCAR', 2026).setupLock.mode).toBe('PostQualifyingLimited');
  });

  it('uses series-specific caution cadence without retroactive leakage', () => {
    const historicalF1 = selectRaceRuleProfile('F1', 1995).raceControl;
    const modernNascar = selectRaceRuleProfile('NASCAR', 2026).raceControl;
    expect(historicalF1.cautionFrequencyMultiplier).toBeLessThan(modernNascar.cautionFrequencyMultiplier);
    expect(historicalF1.minimumGreenLapsBetweenCautions).toBeGreaterThan(modernNascar.minimumGreenLapsBetweenCautions);
  });
});
