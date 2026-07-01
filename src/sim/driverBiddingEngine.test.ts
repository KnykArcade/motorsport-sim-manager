import { describe, expect, it } from 'vitest';
import {
  bidToWin,
  competingBidFor,
  interestMultiplier,
  REFUSE_INTEREST,
  resolveDriverBid,
  teamPreferenceMultiplier,
} from './driverBiddingEngine';
import type { MarketDriver, MarketSkillRatings } from '../types/marketTypes';

const skills: MarketSkillRatings = {
  cornering: 8,
  braking: 7,
  straights: 6,
  tractionAcceleration: 7,
  elevationBlindCorners: 6,
  technical: 8,
  overtakingRacecraft: 9,
  surfaceGripBumpiness: 6,
  riskManagement: 5,
  enduranceConsistency: 7,
};

function driver(overall: number, buyoutCost: number, id = 'mkt-1'): MarketDriver {
  return {
    id,
    name: 'Test Driver',
    age: 26,
    nationality: 'XX',
    context: 'F1',
    marketPool: 'pool',
    marketStatus: 'available',
    primaryRole: 'lead',
    immediateF1Eligible: true,
    skills,
    overall,
    potential: overall,
    potentialDelta: 0,
    developmentRate: 5,
    f1Readiness: 90,
    salary: 5,
    sponsorValue: 2,
    buyoutCost,
    negotiationDifficulty: 'medium',
    suggestedUse: '',
    notes: '',
  };
}

const SEED = 'bid-seed';

// Fraction of a population that draws a competing bid, for a given overall.
function contestedShare(overall: number): number {
  let contested = 0;
  const n = 200;
  for (let i = 0; i < n; i++) {
    if (competingBidFor(driver(overall, 10, `d-${overall}-${i}`), SEED) > 0) contested += 1;
  }
  return contested / n;
}

describe('driverBiddingEngine', () => {
  it('is deterministic per (seed, driver)', () => {
    const d = driver(9, 10);
    expect(competingBidFor(d, SEED)).toBe(competingBidFor(d, SEED));
  });

  it('a competing bid, when present, exceeds the buyout floor', () => {
    // Find a contested driver in a small population and check it clears buyout.
    for (let i = 0; i < 50; i++) {
      const d = driver(9, 10, `contested-${i}`);
      const bid = competingBidFor(d, SEED);
      if (bid > 0) {
        expect(bid).toBeGreaterThanOrEqual(d.buyoutCost);
        return;
      }
    }
    throw new Error('expected at least one contested driver');
  });

  it('stars are contested more often than journeymen', () => {
    expect(contestedShare(9.5)).toBeGreaterThan(contestedShare(6.2));
  });

  it('lets a prestigious team win for less money on a contested driver', () => {
    expect(teamPreferenceMultiplier(90)).toBeGreaterThan(teamPreferenceMultiplier(30));
    for (let i = 0; i < 50; i++) {
      const d = driver(9, 10, `pref-${i}`);
      if (competingBidFor(d, SEED) > 0) {
        expect(bidToWin(d, 90, SEED)).toBeLessThan(bidToWin(d, 30, SEED));
        return;
      }
    }
    throw new Error('expected a contested driver');
  });

  it('resolves the bid-to-win as a win and just below it as a loss (contested)', () => {
    for (let i = 0; i < 50; i++) {
      const d = driver(9, 10, `thresh-${i}`);
      if (competingBidFor(d, SEED) > 0) {
        const threshold = bidToWin(d, 60, SEED);
        expect(resolveDriverBid(threshold, d, 60, SEED).won).toBe(true);
        expect(resolveDriverBid(threshold - 1, d, 60, SEED).won).toBe(false);
        return;
      }
    }
    throw new Error('expected a contested driver');
  });

  it('an uncontested driver is won at the buyout', () => {
    for (let i = 0; i < 50; i++) {
      const d = driver(6.1, 10, `uncontested-${i}`);
      if (competingBidFor(d, SEED) === 0) {
        expect(resolveDriverBid(d.buyoutCost, d, 50, SEED).won).toBe(true);
        expect(bidToWin(d, 50, SEED)).toBe(d.buyoutCost);
        return;
      }
    }
    throw new Error('expected an uncontested driver');
  });

  // Cross-series interest weighting.
  it('interestMultiplier rises with interest and sits at par (1.0) near interest 60', () => {
    expect(interestMultiplier(100)).toBeGreaterThan(interestMultiplier(50));
    expect(interestMultiplier(0)).toBeLessThan(interestMultiplier(50));
    expect(interestMultiplier(60)).toBeCloseTo(1, 2);
  });

  it('passing no interest leaves bidding unchanged (same-series signings)', () => {
    const d = driver(9, 10, 'no-interest');
    const withUndefined = resolveDriverBid(20, d, 60, SEED);
    const legacy = resolveDriverBid(20, d, 60, SEED, undefined);
    expect(withUndefined).toEqual(legacy);
    expect(withUndefined.refused).toBe(false);
    expect(bidToWin(d, 60, SEED)).toBe(bidToWin(d, 60, SEED, undefined));
  });

  it('a reluctant driver needs a bigger bid to win than a keen one', () => {
    for (let i = 0; i < 50; i++) {
      const d = driver(9, 10, `xseries-${i}`);
      if (competingBidFor(d, SEED) > 0) {
        expect(bidToWin(d, 60, SEED, 30)).toBeGreaterThan(bidToWin(d, 60, SEED, 90));
        return;
      }
    }
    throw new Error('expected a contested driver');
  });

  it('a driver below the refusal floor rejects the move at any price', () => {
    const d = driver(9, 10, 'refuser');
    const res = resolveDriverBid(9999, d, 100, SEED, REFUSE_INTEREST - 1);
    expect(res.refused).toBe(true);
    expect(res.won).toBe(false);
  });

  it('higher interest can turn a losing bid into a winning one', () => {
    for (let i = 0; i < 50; i++) {
      const d = driver(9, 10, `flip-${i}`);
      if (competingBidFor(d, SEED) > 0) {
        const bid = bidToWin(d, 60, SEED, 55); // enough only for a fairly keen driver
        expect(resolveDriverBid(bid, d, 60, SEED, 90).won).toBe(true);
        expect(resolveDriverBid(bid, d, 60, SEED, 30).won).toBe(false);
        return;
      }
    }
    throw new Error('expected a contested driver');
  });
});
