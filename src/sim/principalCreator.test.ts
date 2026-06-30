import { describe, expect, it } from 'vitest';
import {
  buildTeamPrincipal,
  computePrincipalModifiers,
  defaultPrincipalDraft,
} from './principalCreator';

describe('buildTeamPrincipal', () => {
  it('produces 0-100 trait scores and carries the chosen identity', () => {
    const draft = { ...defaultPrincipalDraft(), name: 'Alex Carter', background: 'former-driver' };
    const tp = buildTeamPrincipal(draft);
    expect(tp.name).toBe('Alex Carter');
    expect(tp.background).toBe('former-driver');
    for (const v of [
      tp.driverManagement,
      tp.developmentFocus,
      tp.raceStrategy,
      tp.commercialSkill,
      tp.politicalSkill,
      tp.riskTolerance,
      tp.reputation,
    ]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('reflects background bonuses in the derived modifiers', () => {
    const tp = buildTeamPrincipal({ ...defaultPrincipalDraft(), background: 'former-driver' });
    const mods = computePrincipalModifiers(tp);
    // Former Driver gives a driver-morale bonus.
    expect(mods.driverMorale ?? 0).toBeGreaterThan(0);
  });

  it('applies the weakness as a penalty', () => {
    const tp = buildTeamPrincipal({
      ...defaultPrincipalDraft(),
      primaryStrength: 'commercial',
      secondaryStrength: 'media',
      weakness: 'reliability',
    });
    const mods = computePrincipalModifiers(tp);
    expect(mods.reliabilityDiagnosis ?? 0).toBeLessThan(0);
  });

  it('is deterministic for the same draft', () => {
    const draft = { ...defaultPrincipalDraft(), name: 'Same' };
    expect(buildTeamPrincipal(draft)).toEqual(buildTeamPrincipal(draft));
  });
});
