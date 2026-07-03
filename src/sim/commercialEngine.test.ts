import { describe, it, expect } from 'vitest';
import { teams1995, drivers1995 } from '../data';
import {
  buildInitialCommercial,
  commercialTier,
  sponsorAnnualIncome,
  sponsorInstallmentPayment,
  racePerformanceBonuses,
  evaluateSeasonObjectives,
  rollSponsorRenewals,
  averageSponsorConfidence,
  generateSponsorOffers,
  sponsorSlotCapacity,
} from './commercialEngine';
import { toMoney } from './financeEngine';

const williams = teams1995.find((t) => t.id === 't-williams')!;
const williamsDrivers = drivers1995.filter((d) => d.teamId === 't-williams');
const minardi = teams1995.find((t) => t.reputation <= 40) ?? teams1995[teams1995.length - 1];

describe('commercialEngine', () => {
  it('maps reputation to a 0-4 tier', () => {
    expect(commercialTier(100)).toBe(4);
    expect(commercialTier(0)).toBe(0);
    expect(commercialTier(50)).toBe(2);
  });

  it('builds a portfolio with a title sponsor sized by reputation', () => {
    const c = buildInitialCommercial(williams, williamsDrivers, 'seed-1', 'Formula 1');
    expect(c.teamId).toBe('t-williams');
    expect(c.sponsors.some((s) => s.type === 'Title')).toBe(true);
    expect(c.sponsors.length).toBeGreaterThanOrEqual(4);
    expect(sponsorAnnualIncome(c)).toBeGreaterThan(0);
  });

  it('is deterministic for the same seed', () => {
    const a = buildInitialCommercial(williams, williamsDrivers, 'seed-x', 'Formula 1');
    const b = buildInitialCommercial(williams, williamsDrivers, 'seed-x', 'Formula 1');
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('gives stronger teams more sponsorship income than weak teams', () => {
    const strong = buildInitialCommercial(williams, williamsDrivers, 's', 'Formula 1');
    const weak = buildInitialCommercial(minardi, [], 's', 'Formula 1');
    expect(sponsorAnnualIncome(strong)).toBeGreaterThan(sponsorAnnualIncome(weak));
  });

  it('pays performance bonuses only when triggers fire', () => {
    const c = buildInitialCommercial(williams, williamsDrivers, 's', 'Formula 1');
    const none = racePerformanceBonuses(c, { wins: 0, podiums: 0, poles: 0 });
    expect(none.reduce((s, p) => s + p.amount, 0)).toBe(0);
    const win = racePerformanceBonuses(c, { wins: 1, podiums: 1, poles: 1 });
    expect(win.reduce((s, p) => s + p.amount, 0)).toBeGreaterThan(0);
  });

  it('evaluates season objectives, marking met/failed and paying out', () => {
    const c = buildInitialCommercial(williams, williamsDrivers, 's', 'Formula 1');
    const good = evaluateSeasonObjectives(c, {
      constructorPosition: 1,
      points: 120,
      wins: 5,
      failedToQualify: false,
    });
    expect(good.sponsors.every((s) => s.objectives.every((o) => o.status !== 'Pending'))).toBe(true);
    const met = good.sponsors.flatMap((s) => s.objectives).filter((o) => o.status === 'Met');
    expect(met.length).toBeGreaterThan(0);

    const bad = evaluateSeasonObjectives(c, {
      constructorPosition: 11,
      points: 0,
      wins: 0,
      failedToQualify: true,
    });
    const failed = bad.sponsors.flatMap((s) => s.objectives).filter((o) => o.status === 'Failed');
    expect(failed.length).toBeGreaterThan(0);
    // Missing penalised objectives lowers confidence vs. meeting them.
    const avg = (sponsors: typeof bad.sponsors) =>
      averageSponsorConfidence({ teamId: 't', sponsors, commercialReputation: 0 });
    expect(avg(bad.sponsors)).toBeLessThan(avg(good.sponsors));
  });

  it('renews or replaces sponsors at the offseason and keeps a title sponsor', () => {
    const c = buildInitialCommercial(williams, williamsDrivers, 's', 'Formula 1');
    const rolled = rollSponsorRenewals(c, williams, 's', 1996);
    expect(rolled.commercial.sponsors.some((s) => s.type === 'Title')).toBe(true);
    // Every kept sponsor has its objectives reset for the new season.
    expect(rolled.commercial.sponsors.every((s) => s.objectives.every((o) => o.status === 'Pending'))).toBe(true);
  });

  it('rounds bonus amounts and descriptions to 2 decimals (no float noise)', () => {
    // Tier scaling like 0.3 + tier * 0.15 used to leak 0.44999999999999996.
    for (const team of teams1995) {
      const c = buildInitialCommercial(team, drivers1995.filter((d) => d.teamId === team.id), 's', 'Formula 1');
      for (const s of c.sponsors) {
        for (const b of s.bonusTerms) {
          expect(b.amount).toBe(Math.round(b.amount * 100) / 100);
          expect(b.description).not.toMatch(/\d\.\d{3,}/); // no 3+ decimal runs
        }
      }
    }
  });

  it('sizes sponsor slot capacity by reputation, within 4..8', () => {
    expect(sponsorSlotCapacity(williams)).toBeGreaterThanOrEqual(4);
    expect(sponsorSlotCapacity(williams)).toBeLessThanOrEqual(8);
    expect(sponsorSlotCapacity(williams)).toBeGreaterThanOrEqual(sponsorSlotCapacity(minardi));
  });

  it('offers deterministic sponsor deals and excludes already-signed ones', () => {
    const c = buildInitialCommercial(williams, williamsDrivers, 's', 'Formula 1');
    const a = generateSponsorOffers(williams, c, 's', 1996, 'Formula 1');
    const b = generateSponsorOffers(williams, c, 's', 1996, 'Formula 1');
    expect(a.length).toBeGreaterThan(0);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
    // No offer duplicates a sponsor already in the portfolio.
    const signedIds = new Set(c.sponsors.map((s) => s.id));
    expect(a.every((o) => !signedIds.has(o.id))).toBe(true);
    // Signing one removes it from the next round of offers.
    const withSigned = { ...c, sponsors: [...c.sponsors, a[0]] };
    const after = generateSponsorOffers(williams, withSigned, 's', 1996, 'Formula 1');
    expect(after.some((o) => o.id === a[0].id)).toBe(false);
  });

  it('offers a title deal only when the title slot is open', () => {
    const c = buildInitialCommercial(williams, williamsDrivers, 's', 'Formula 1');
    // Portfolio already has a title sponsor -> no title offer.
    expect(generateSponsorOffers(williams, c, 's', 1996, 'Formula 1').some((o) => o.type === 'Title')).toBe(false);
    const noTitle = { ...c, sponsors: c.sponsors.filter((s) => s.type !== 'Title') };
    expect(generateSponsorOffers(williams, noTitle, 's', 1996, 'Formula 1').some((o) => o.type === 'Title')).toBe(true);
  });

  it('reports zero income for undefined commercial state', () => {
    expect(sponsorAnnualIncome(undefined)).toBe(0);
    expect(racePerformanceBonuses(undefined, { wins: 5, podiums: 5, poles: 5 })).toEqual([]);
  });

  it('annual income equals the sum of sponsor values in dollars', () => {
    const c = buildInitialCommercial(williams, williamsDrivers, 's', 'Formula 1');
    const expected = c.sponsors.reduce((sum, s) => sum + toMoney(s.annualValue), 0);
    expect(sponsorAnnualIncome(c)).toBe(expected);
  });

  it('installment payment splits annual income across races', () => {
    const c = buildInitialCommercial(williams, williamsDrivers, 's', 'Formula 1');
    const annual = sponsorAnnualIncome(c);
    const installments = sponsorInstallmentPayment(c, 16);
    expect(installments).toHaveLength(1);
    const perRace = installments[0].amount;
    // 16 races * perRace should approximate 75% of annual (the installment portion).
    expect(perRace * 16).toBeGreaterThan(annual * 0.7);
    expect(perRace * 16).toBeLessThanOrEqual(annual);
  });

  it('installment payment returns empty for undefined commercial or zero races', () => {
    expect(sponsorInstallmentPayment(undefined, 16)).toEqual([]);
    const c = buildInitialCommercial(williams, williamsDrivers, 's', 'Formula 1');
    expect(sponsorInstallmentPayment(c, 0)).toEqual([]);
  });
});
