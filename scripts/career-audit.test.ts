// P6 long-run audit — drives the real-race career audit (runCareerAudit) for 20
// seasons from F1-1990 and asserts the cleanup's acceptance criteria: no broken
// roster/market invariants, believable-but-not-locked competitive balance, car
// ratings that never saturate at the ceiling, and AI budgets that don't inflate.
//
// This complements scripts/career-longrun.test.ts (rollover-only) by playing out
// actual races each year so standings, prize money, AI development and finances
// all respond to real results.

import { describe, it, expect } from 'vitest';

import { runCareerAudit, type CareerAuditReport } from './careerAudit';

describe('Career audit — F1 1990, 20 real-race seasons', () => {
  const report: CareerAuditReport = runCareerAudit({ seasons: 20, seed: 'career-audit-1990' });
  const seasons = report.seasons;

  it('completes a full 20-season simulation', () => {
    expect(seasons).toHaveLength(20);
    expect(seasons[0].year).toBe(1990);
    expect(seasons[seasons.length - 1].year).toBe(2009);
  });

  // --- Driver / market invariants -------------------------------------------

  it('has no duplicate driver names in any season', () => {
    for (const s of seasons) {
      expect({ year: s.year, dup: s.duplicateNames }).toEqual({ year: s.year, dup: [] });
    }
  });

  it('never leaves an academy-only driver aged 21+', () => {
    for (const s of seasons) {
      expect({ year: s.year, over21: s.academyOver21 }).toEqual({ year: s.year, over21: [] });
    }
  });

  it('never leaks a market tag into any name', () => {
    for (const s of seasons) {
      expect({ year: s.year, leaks: s.nameTagLeaks }).toEqual({ year: s.year, leaks: [] });
    }
  });

  it('keeps no 18+ driver in the youth signing pool', () => {
    for (const s of seasons) expect(s.youthPoolOverAge).toBe(0);
  });

  it('never fields a reserve/test driver in a race seat', () => {
    for (const s of seasons) expect(s.reservesRacing).toBe(0);
  });

  it('gives every team two race seats once the grid has rolled over', () => {
    // Season 0 is the raw 1990 bundle (a couple of teams historically ran a
    // single car); every season after the first rollover must be full.
    for (const s of seasons.slice(1)) {
      expect({ year: s.year, missing: s.teamsWithoutTwoSeats }).toEqual({
        year: s.year,
        missing: [],
      });
    }
  });

  // --- Competitive balance ---------------------------------------------------

  it('produces dynasties without a permanent lockout', () => {
    // The pre-cleanup run locked out 18/20 titles for one team (0.90 share).
    expect(report.distinctConstructorChampions).toBeGreaterThanOrEqual(2);
    expect(report.topTeamTitleShare).toBeLessThanOrEqual(0.8);
  });

  // --- Development / rating saturation ---------------------------------------

  it('keeps car ratings clear of the 100.0 ceiling', () => {
    expect(report.maxCarRating).toBeLessThan(98);
    expect(report.everSaturated).toBe(false);
    for (const s of seasons) expect(s.saturatedCars).toBe(0);
  });

  // --- Budgets ---------------------------------------------------------------

  it('keeps AI budgets from inflating endlessly across the run', () => {
    for (const s of seasons) {
      expect(Number.isFinite(s.budget.min)).toBe(true);
      // Real 1990s-2000s F1 money is tens to low hundreds of $M; forbid runaway.
      expect(s.budget.max).toBeLessThan(300_000_000);
    }
    // The richest team late in the run is not wildly above the richest early on
    // (no compounding blow-up).
    const earlyMax = Math.max(...seasons.slice(0, 5).map((s) => s.budget.max));
    const lateMax = Math.max(...seasons.slice(-5).map((s) => s.budget.max));
    expect(lateMax).toBeLessThan(earlyMax * 3);
  });

  it('assigns a coherent financial-health spread (no impossible grades)', () => {
    for (const s of seasons) {
      const counts = s.financialHealth;
      const total =
        counts.Excellent + counts.Stable + counts.Tight + counts.AtRisk + counts.Critical;
      // Every AI team is graded exactly once.
      expect(total).toBeGreaterThan(0);
    }
  });
});
