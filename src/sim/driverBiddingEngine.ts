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

// The smallest bid ($M) that wins the driver given team prestige: the rival bid
// discounted by the player's preference multiplier.
export function bidToWin(
  driver: MarketDriver,
  playerTeamOverall: number,
  seed: string,
): number {
  const rival = competingBidFor(driver, seed);
  const threshold = rival === 0 ? driver.buyoutCost : rival / teamPreferenceMultiplier(playerTeamOverall);
  return round2(Math.max(driver.buyoutCost, threshold));
}

export type BidResolution = {
  won: boolean;
  rivalBid: number; // $M
  effectivePlayerBid: number; // $M, after prestige weighting
};

// Resolve a contested signing. The player wins when their prestige-weighted bid
// at least matches the rival's competing bid.
export function resolveDriverBid(
  playerBid: number,
  driver: MarketDriver,
  playerTeamOverall: number,
  seed: string,
): BidResolution {
  const rivalBid = competingBidFor(driver, seed);
  const effectivePlayerBid = round2(playerBid * teamPreferenceMultiplier(playerTeamOverall));
  // Uncontested (rivalBid 0): a valid bid (>= buyout) always secures the driver.
  const won = rivalBid === 0 ? playerBid >= driver.buyoutCost : effectivePlayerBid >= rivalBid;
  return { won, rivalBid, effectivePlayerBid };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
