// Driver bidding (Team Principal Career Mode).
//
// Signing a market driver is contested: rival teams put up a competing bid, and
// the driver weighs offers by money *and* the prestige of the team courting
// them. A stronger organisation can win a driver for less than a weak one would
// have to pay. All amounts are in $M (matching MarketDriver.buyoutCost). Pure
// and deterministic per (seed, driver).

import type { MarketDriver } from '../types/marketTypes';
import { createSeededRandom, deriveSeed } from './random';

// How much a driver's standing inflates the asking price. A top driver (overall
// ~9.5) attracts ~50% more interest than a backmarker (~6).
function appealFactor(overall: number): number {
  const norm = Math.max(0, Math.min(1, (overall - 6) / 4)); // 6→0, 10→1
  return 0.15 + norm * 0.55; // 0.15 .. 0.70
}

// The deterministic competing bid ($M) a rival makes for a driver: their buyout
// inflated by appeal plus a stable per-driver seeded swing. Returns 0 when no
// rival is interested — then the buyout alone secures the driver. Hot drivers
// (high overall) are far more likely to draw a competing bid.
export function competingBidFor(driver: MarketDriver, seed: string): number {
  const rng = createSeededRandom(deriveSeed(seed, 'bid', driver.id));
  const norm = Math.max(0, Math.min(1, (driver.overall - 6) / 4));
  const interestChance = 0.25 + norm * 0.6; // 0.25 (journeyman) .. 0.85 (star)
  if (rng.next() >= interestChance) return 0; // uncontested
  const base = Math.max(0.5, driver.buyoutCost);
  const swing = 1 + rng.variance(1) * 0.15; // ±15%
  const bid = base * (1 + appealFactor(driver.overall)) * swing;
  return round2(Math.max(base, bid));
}

// How strongly a driver favours the player's team for non-financial reasons.
// An elite organisation (rating ~100) makes the player's money worth ~1.3x; a
// backmarker (~30) barely above par. Used to weight the player's bid.
export function teamPreferenceMultiplier(playerTeamOverall: number): number {
  const norm = Math.max(0, Math.min(1, playerTeamOverall / 100));
  return 0.9 + norm * 0.4; // 0.9 .. 1.3
}

// Below this interest (0-100) a driver refuses the move outright, no matter the
// money — e.g. a star being courted by a weak team from a series they have no
// interest in. Only applied when an interest value is supplied (cross-series).
export const REFUSE_INTEREST = 22;

// How a driver's interest in the offer (0-100) weights the player's bid. A keen
// driver (interest 100) values the money at 1.3x; a lukewarm one (interest 50)
// at par; a reluctant one demands a steep premium. Used only for cross-series
// signings — same-series offers pass no interest and are unaffected.
export function interestMultiplier(interest: number): number {
  const norm = Math.max(0, Math.min(1, interest / 100));
  return 0.55 + norm * 0.75; // 0.55 .. 1.30 (par at interest 60)
}

// Combined non-financial weighting on the player's bid: team prestige, plus the
// driver's interest in the offer when one is supplied.
function bidWeighting(playerTeamOverall: number, interest?: number): number {
  const team = teamPreferenceMultiplier(playerTeamOverall);
  return interest == null ? team : team * interestMultiplier(interest);
}

// The smallest bid ($M) that wins the driver given team prestige (and, for
// cross-series moves, the driver's interest): the rival bid discounted by the
// player's combined weighting.
export function bidToWin(
  driver: MarketDriver,
  playerTeamOverall: number,
  seed: string,
  interest?: number,
  loyaltyModifier = 0,
): number {
  const rival = competingBidFor(driver, seed);
  const loyaltyWeight = 1 + Math.max(-0.3, Math.min(0.3, loyaltyModifier * 0.03));
  const threshold = rival === 0 ? driver.buyoutCost : rival / (bidWeighting(playerTeamOverall, interest) * loyaltyWeight);
  return round2(Math.max(driver.buyoutCost, threshold));
}

export type BidResolution = {
  won: boolean;
  rivalBid: number; // $M
  effectivePlayerBid: number; // $M, after prestige + interest weighting
  refused: boolean; // driver rejected the move regardless of money
};

// Resolve a contested signing. The player wins when their weighted bid at least
// matches the rival's competing bid. For cross-series moves an interest value
// (0-100) is supplied: it weights the bid and, below REFUSE_INTEREST, the driver
// refuses outright.
export function resolveDriverBid(
  playerBid: number,
  driver: MarketDriver,
  playerTeamOverall: number,
  seed: string,
  interest?: number,
  loyaltyModifier = 0,
): BidResolution {
  const rivalBid = competingBidFor(driver, seed);
  const loyaltyWeight = 1 + Math.max(-0.3, Math.min(0.3, loyaltyModifier * 0.03));
  const effectivePlayerBid = round2(playerBid * bidWeighting(playerTeamOverall, interest) * loyaltyWeight);
  const refused = interest != null && interest < REFUSE_INTEREST;
  // Uncontested (rivalBid 0): a valid bid (>= buyout) always secures the driver.
  const won =
    !refused &&
    (rivalBid === 0 ? playerBid >= driver.buyoutCost : effectivePlayerBid >= rivalBid);
  return { won, rivalBid, effectivePlayerBid, refused };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
