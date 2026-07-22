import { describe, expect, it } from 'vitest';
import { selectRaceRuleProfile } from '../data/rules/raceRuleProfiles';
import { BALANCED_SETUP } from '../data/setup/setupComponents';
import { setupLockPhase, setupLockStatus, validateSetupChange } from './setupLockEngine';

describe('setupLockEngine', () => {
  it('opens setup before qualifying even for parc ferme series', () => {
    const profile = selectRaceRuleProfile('F1', 2026);
    const status = setupLockStatus(profile, setupLockPhase(false));

    expect(status.active).toBe(false);
    expect(validateSetupChange(profile, 'BeforeQualifying', BALANCED_SETUP, {
      ...BALANCED_SETUP,
      suspensionStiffness: 8,
      rideHeight: 2,
    }).allowed).toBe(true);
  });

  it('allows only minor permitted F1 parc ferme changes after qualifying', () => {
    const profile = selectRaceRuleProfile('F1', 2026);

    const legal = validateSetupChange(profile, 'AfterQualifying', BALANCED_SETUP, {
      ...BALANCED_SETUP,
      frontWing: 5.5,
      brakeCooling: 5.5,
    });
    const illegalMechanical = validateSetupChange(profile, 'AfterQualifying', BALANCED_SETUP, {
      ...BALANCED_SETUP,
      suspensionStiffness: 6,
    });
    const illegalMajorWing = validateSetupChange(profile, 'AfterQualifying', BALANCED_SETUP, {
      ...BALANCED_SETUP,
      frontWing: 7,
    });

    expect(legal.allowed).toBe(true);
    expect(illegalMechanical.allowed).toBe(false);
    expect(illegalMechanical.blockedParams).toContain('suspensionStiffness');
    expect(illegalMechanical.consequence).toBe('PitLaneStart');
    expect(illegalMajorWing.allowed).toBe(false);
    expect(illegalMajorWing.blockedParams).toContain('frontWing');
  });

  it('keeps flexible series unrestricted after qualifying', () => {
    const profile = selectRaceRuleProfile('IndyCar', 2026);
    const validation = validateSetupChange(profile, 'AfterQualifying', BALANCED_SETUP, {
      ...BALANCED_SETUP,
      gearing: 8,
      rideHeight: 2,
    });

    expect(setupLockStatus(profile, 'AfterQualifying').active).toBe(false);
    expect(validation.allowed).toBe(true);
  });

  it('treats NASCAR impound as stricter than later limited stock-car rules', () => {
    const impound = selectRaceRuleProfile('NASCAR', 2005);
    const modern = selectRaceRuleProfile('NASCAR', 2026);

    expect(validateSetupChange(impound, 'AfterQualifying', BALANCED_SETUP, {
      ...BALANCED_SETUP,
      brakeCooling: 5.5,
    }).allowed).toBe(true);
    expect(validateSetupChange(impound, 'AfterQualifying', BALANCED_SETUP, {
      ...BALANCED_SETUP,
      frontWing: 5.5,
    }).allowed).toBe(false);
    expect(validateSetupChange(modern, 'AfterQualifying', BALANCED_SETUP, {
      ...BALANCED_SETUP,
      frontWing: 5.5,
    }).allowed).toBe(true);
  });
});
