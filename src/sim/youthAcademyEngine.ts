// Youth Academy age model + Academy Rights / First Option.
//
// Age structure across the whole driver ecosystem:
//   - under 12         → not_yet_available (hidden from every market)
//   - ages 12–17       → youth academy / scouting pool (academy_eligible)
//   - age 18+ unsigned → adult driver market (adult_market_eligible)
//   - age 18+ academy  → the academy team holds first option (promotion_eligible)
//
// An academy-signed driver who turns 18 does NOT drop straight into the open
// market: their academy team gets first option to promote (race seat / 3rd /
// reserve / test), extend development rights, or release them. Only a release,
// a declined/expired option, or a rejected offer sends them to the open market.
//
// Everything here is pure and deterministic so career rollovers replay
// identically.

import { ROOKIE_AGE, YOUTH_MAX_AGE, YOUTH_MIN_AGE } from './careerMarketEngine';
import { academyMemberAge } from './driverMarketEngine';
import type { AcademyMember, FirstOptionDecision, FirstOptionStatus } from '../types/marketTypes';

// Where a driver of a given age/contract sits in the market.
export type MarketStatus =
  | 'unavailable' // under 12 — not in any market
  | 'academy_eligible' // 12–17 — youth academy / scouting pool
  | 'adult_market_eligible' // 18+ unsigned — adult driver market
  | 'promotion_eligible'; // 18+ academy-signed — team holds first option

// Classify by age alone (the youth/adult boundary). `signedToAcademy` decides
// whether an 18+ driver is promotion-eligible (rights held) or a free agent.
export function marketStatusForAge(age: number, signedToAcademy: boolean): MarketStatus {
  if (age < YOUTH_MIN_AGE) return 'unavailable';
  if (age <= YOUTH_MAX_AGE) return 'academy_eligible';
  return signedToAcademy ? 'promotion_eligible' : 'adult_market_eligible';
}

// A driver is a youth academy candidate only in the 12–17 window.
export function isYouthAge(age: number): boolean {
  return age >= YOUTH_MIN_AGE && age <= YOUTH_MAX_AGE;
}

// An academy member has reached adult age and needs a first-option decision.
export function isPromotionEligible(member: AcademyMember, year: number): boolean {
  return academyMemberAge(member, year) >= ROOKIE_AGE;
}

// Normalize the persisted academy list for a given (current) year: recompute
// each member's promotion eligibility and stamp a first-option status on members
// who have aged into adulthood. Members already resolved keep their status.
// Under-12 / 12–17 members simply keep developing (promotionEligible = false).
export function normalizeYouthDriverMarket(
  academy: AcademyMember[],
  year: number,
): AcademyMember[] {
  return academy.map((a) => {
    const eligible = isPromotionEligible(a, year);
    if (!eligible) {
      return a.promotionEligible ? { ...a, promotionEligible: false } : a;
    }
    // Newly (or still) promotion eligible: open the first-option window if it
    // hasn't already been resolved.
    const firstOptionStatus: FirstOptionStatus =
      a.firstOptionStatus && a.firstOptionStatus !== 'pending_team_decision'
        ? a.firstOptionStatus
        : 'pending_team_decision';
    if (a.promotionEligible && a.firstOptionStatus === firstOptionStatus) return a;
    return { ...a, promotionEligible: true, firstOptionStatus };
  });
}

// The members whose first-option window is open (aged 18+, awaiting a decision).
export function promotionEligibleMembers(
  academy: AcademyMember[],
  year: number,
): AcademyMember[] {
  return academy.filter((a) => isPromotionEligible(a, year));
}

// Map a first-option decision to the resulting lifecycle status.
export function firstOptionStatusFor(decision: FirstOptionDecision): FirstOptionStatus {
  switch (decision) {
    case 'race_seat':
      return 'promoted_to_race_seat';
    case 'third':
      return 'promoted_to_third_driver';
    case 'reserve':
      return 'promoted_to_reserve';
    case 'test':
      return 'promoted_to_test_driver';
    case 'extend':
      return 'extended_development_rights';
    case 'release':
      return 'released_to_market';
  }
}

// Whether a decision keeps the driver under the team's control (vs releasing
// them to the open adult market).
export function retainsRights(decision: FirstOptionDecision): boolean {
  return decision !== 'release';
}

// --- AI first option --------------------------------------------------------

// Context an AI team weighs when exercising first option on its own academy
// driver. Kept minimal here; the AI Team Management engine (later phase) feeds
// richer signals (personality, budget, sponsor fit).
export type AiFirstOptionContext = {
  // Overall rating of the weakest current race-seat driver at the team.
  weakestSeatOverall: number;
  // True if the team has a free (unfilled) race seat.
  hasEmptySeat: boolean;
  // True if the team already carries a reserve/3rd driver.
  hasReserve: boolean;
  // Rough affordability of the driver's expected salary (0 = cannot afford,
  // 1 = comfortably affordable). Drives release/extend vs promote.
  affordability: number;
  // Bias toward promotion (youth-focused teams high, contenders low).
  promotionBias: number; // 0-1
};

// Deterministic AI decision on a promotion-eligible academy driver. Elite
// prospects who beat a seat driver get a race seat; solid ones become
// reserves/test drivers; weak or unaffordable ones are extended or released.
export function aiFirstOptionDecision(
  member: AcademyMember,
  ctx: AiFirstOptionContext,
): FirstOptionDecision {
  // Cannot afford to keep them on any senior deal → release to the market.
  if (ctx.affordability <= 0) return 'release';

  // Ready to race and better than the weakest seat driver (or a seat is open):
  // promote into a race seat.
  const raceReady = member.yearsUntilF1Ready <= 0;
  const beatsSeat = member.overall >= ctx.weakestSeatOverall - 0.3;
  if (raceReady && (ctx.hasEmptySeat || beatsSeat)) return 'race_seat';

  // High-potential but not yet ready: keep them close as a reserve/test driver,
  // or extend development rights if the reserve slot is taken.
  const highPotential = member.potential >= 7 || ctx.promotionBias >= 0.6;
  if (highPotential) {
    if (!ctx.hasReserve) return raceReady ? 'reserve' : 'test';
    return 'extend';
  }

  // Low upside: extend one more year if cheap, otherwise release.
  return ctx.affordability >= 0.5 ? 'extend' : 'release';
}

// --- Display helpers --------------------------------------------------------

export function firstOptionStatusLabel(status: FirstOptionStatus): string {
  switch (status) {
    case 'pending_team_decision':
      return 'Awaiting decision';
    case 'promoted_to_race_seat':
      return 'Promoted to race seat';
    case 'promoted_to_third_driver':
      return 'Signed as 3rd driver';
    case 'promoted_to_reserve':
      return 'Signed as reserve';
    case 'promoted_to_test_driver':
      return 'Signed as test driver';
    case 'extended_development_rights':
      return 'Development rights extended';
    case 'released_to_market':
      return 'Released to market';
    case 'driver_rejected_offer':
      return 'Driver rejected offer';
    case 'expired':
      return 'Option expired';
  }
}
