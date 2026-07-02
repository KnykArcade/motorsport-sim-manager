import { describe, expect, it } from 'vitest';
import {
  ACADEMY_HARD_AGE_CAP,
  FIRST_OPTION_MAX_AGE,
  FIRST_OPTION_SEASONS,
  academyRightsExpired,
  aiFirstOptionDecision,
  firstOptionDeadlineYear,
  firstOptionStatusFor,
  isPromotionEligible,
  isYouthAge,
  marketStatusForAge,
  normalizeYouthDriverMarket,
  openFirstOptionWindow,
  promotionEligibleMembers,
  retainsRights,
  type AiFirstOptionContext,
} from './youthAcademyEngine';
import type { AcademyMember, MarketSkillRatings } from '../types/marketTypes';

const skills: MarketSkillRatings = {
  cornering: 6,
  braking: 6,
  straights: 6,
  tractionAcceleration: 6,
  elevationBlindCorners: 6,
  technical: 6,
  overtakingRacecraft: 6,
  surfaceGripBumpiness: 6,
  riskManagement: 6,
  enduranceConsistency: 6,
};

function member(overrides: Partial<AcademyMember> = {}): AcademyMember {
  return {
    id: 'aca-x',
    prospectId: 'reg-x',
    name: 'Test Prospect',
    nationality: '—',
    birthYear: 2008,
    academyTeamId: 't-1',
    skills,
    overall: 6,
    potential: 8,
    developmentRate: 2,
    yearsUntilF1Ready: 2,
    signedYear: 2022,
    ...overrides,
  };
}

describe('youth age model', () => {
  it('classifies market status by the 12–17 / 18+ boundary', () => {
    expect(marketStatusForAge(10, false)).toBe('unavailable');
    expect(marketStatusForAge(11, true)).toBe('unavailable');
    expect(marketStatusForAge(12, false)).toBe('academy_eligible');
    expect(marketStatusForAge(17, false)).toBe('academy_eligible');
    // 18+ unsigned enters the adult market; 18+ academy-signed is promotion eligible.
    expect(marketStatusForAge(18, false)).toBe('adult_market_eligible');
    expect(marketStatusForAge(18, true)).toBe('promotion_eligible');
  });

  it('isYouthAge only covers 12–17', () => {
    expect(isYouthAge(11)).toBe(false);
    expect(isYouthAge(12)).toBe(true);
    expect(isYouthAge(17)).toBe(true);
    expect(isYouthAge(18)).toBe(false);
  });
});

describe('normalizeYouthDriverMarket', () => {
  it('flags 18+ members promotion eligible and leaves 12–17 members untouched', () => {
    const youth = member({ id: 'aca-young', birthYear: 2010 }); // age 15 in 2025
    const adult = member({ id: 'aca-adult', birthYear: 2007 }); // age 18 in 2025
    const [ny, na] = normalizeYouthDriverMarket([youth, adult], 2025);
    expect(ny.promotionEligible).toBeFalsy();
    expect(ny.firstOptionStatus).toBeUndefined();
    expect(na.promotionEligible).toBe(true);
    expect(na.firstOptionStatus).toBe('pending_team_decision');
  });

  it('preserves an already-resolved first-option status', () => {
    const resolved = member({
      id: 'aca-resolved',
      birthYear: 2007,
      promotionEligible: true,
      firstOptionStatus: 'extended_development_rights',
    });
    const [out] = normalizeYouthDriverMarket([resolved], 2025);
    expect(out.firstOptionStatus).toBe('extended_development_rights');
  });

  it('promotionEligibleMembers returns only 18+ members', () => {
    const youth = member({ id: 'y', birthYear: 2011 }); // 14
    const adult = member({ id: 'a', birthYear: 2006 }); // 19
    expect(promotionEligibleMembers([youth, adult], 2025).map((m) => m.id)).toEqual(['a']);
    expect(isPromotionEligible(adult, 2025)).toBe(true);
    expect(isPromotionEligible(youth, 2025)).toBe(false);
  });
});

describe('first-option rights deadline & expiry (age cap)', () => {
  it('opens the window at 18 and stamps a deadline no later than the 20-year-old season', () => {
    // Turns 18 in 2025.
    const eligible = member({ birthYear: 2007 });
    const opened = openFirstOptionWindow(eligible, 2025);
    expect(opened.firstOptionYear).toBe(2025);
    // Two seasons of rights, but never past the season the driver is 20.
    expect(opened.firstOptionDeadlineYear).toBe(
      Math.min(2025 + FIRST_OPTION_SEASONS, 2007 + FIRST_OPTION_MAX_AGE),
    );
    expect(opened.firstOptionDeadlineYear).toBeLessThanOrEqual(2007 + FIRST_OPTION_MAX_AGE);
  });

  it('does not open a window for a 12–17 member', () => {
    const youth = member({ birthYear: 2010 }); // 15 in 2025
    expect(openFirstOptionWindow(youth, 2025)).toEqual(youth);
  });

  it('is idempotent once the window is stamped', () => {
    const opened = openFirstOptionWindow(member({ birthYear: 2007 }), 2025);
    expect(openFirstOptionWindow(opened, 2026)).toEqual(opened);
  });

  it('rights are still valid within the window and expire past the deadline', () => {
    const m = openFirstOptionWindow(member({ birthYear: 2007 }), 2025);
    const deadline = firstOptionDeadlineYear(m, 2025);
    expect(academyRightsExpired(m, deadline)).toBe(false);
    expect(academyRightsExpired(m, deadline + 1)).toBe(true);
  });

  it('always treats an academy-only driver at the hard age cap (21+) as expired', () => {
    // Age 21 exactly at the cap → expired regardless of any window.
    const capped = member({ birthYear: 2004 }); // 21 in 2025
    expect(academyRightsExpired(capped, 2025)).toBe(true);
    const older = member({ birthYear: 2000 }); // 25 in 2025
    expect(academyRightsExpired(older, 2025)).toBe(true);
    expect(ACADEMY_HARD_AGE_CAP).toBe(21);
  });

  it('a 12–17 member never has expired rights', () => {
    const youth = member({ birthYear: 2011 }); // 14 in 2025
    expect(academyRightsExpired(youth, 2025)).toBe(false);
  });
});

describe('first-option status mapping', () => {
  it('maps each decision to its status and rights retention', () => {
    expect(firstOptionStatusFor('race_seat')).toBe('promoted_to_race_seat');
    expect(firstOptionStatusFor('reserve')).toBe('promoted_to_reserve');
    expect(firstOptionStatusFor('release')).toBe('released_to_market');
    expect(retainsRights('extend')).toBe(true);
    expect(retainsRights('release')).toBe(false);
  });
});

describe('aiFirstOptionDecision', () => {
  const base: AiFirstOptionContext = {
    weakestSeatOverall: 7,
    hasEmptySeat: false,
    hasReserve: false,
    affordability: 1,
    promotionBias: 0.3,
  };

  it('releases a driver the team cannot afford', () => {
    expect(aiFirstOptionDecision(member(), { ...base, affordability: 0 })).toBe('release');
  });

  it('promotes a race-ready prospect who beats the weakest seat driver', () => {
    const ready = member({ yearsUntilF1Ready: 0, overall: 8 });
    expect(aiFirstOptionDecision(ready, base)).toBe('race_seat');
  });

  it('promotes a race-ready prospect into an empty seat even if weaker', () => {
    const ready = member({ yearsUntilF1Ready: 0, overall: 4 });
    expect(aiFirstOptionDecision(ready, { ...base, hasEmptySeat: true })).toBe('race_seat');
  });

  it('keeps a high-potential but not-ready prospect as a reserve/test driver', () => {
    const dev = member({ yearsUntilF1Ready: 2, potential: 9, overall: 5 });
    expect(aiFirstOptionDecision(dev, base)).toBe('test');
  });

  it('extends a high-potential prospect when the reserve slot is taken', () => {
    const dev = member({ yearsUntilF1Ready: 2, potential: 9 });
    expect(aiFirstOptionDecision(dev, { ...base, hasReserve: true })).toBe('extend');
  });

  it('never extends once rights have expired — commits to a senior role instead', () => {
    // High-potential prospect, reserve taken: would normally extend, but with
    // rights expired the team must commit (test driver) rather than hold on.
    const dev = member({ yearsUntilF1Ready: 2, potential: 9 });
    const decision = aiFirstOptionDecision(dev, { ...base, hasReserve: true, rightsExpired: true });
    expect(decision).not.toBe('extend');
    expect(decision).toBe('test');
  });

  it('releases a low-upside prospect to the market once rights have expired', () => {
    // Low potential + expired rights → no extension is possible, so the driver
    // enters the adult market rather than lingering as academy-only.
    const lowUpside = member({ yearsUntilF1Ready: 2, potential: 5, overall: 5 });
    expect(aiFirstOptionDecision(lowUpside, { ...base, rightsExpired: true })).toBe('release');
    expect(retainsRights('release')).toBe(false);
  });
});
