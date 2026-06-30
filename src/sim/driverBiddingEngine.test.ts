import { describe, expect, it } from 'vitest';
import {
  bidToWin,
  competingBidFor,
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
});
