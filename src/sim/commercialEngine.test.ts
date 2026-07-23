import { describe, it, expect } from 'vitest';
import { teams1995 } from '../data/teams/teams1995';
import { drivers1995 } from '../data/drivers/drivers1995';
import {
  buildInitialCommercial,
  commercialTier,
  sponsorAnnualIncome,
  sponsorInstallmentPayment,
  racePerformanceBonuses,
  evaluateSeasonObjectives,
  evaluateRoundSponsorObjectives,
  objectiveDeadlineRound,
  rollSponsorRenewals,
  averageSponsorConfidence,
  generateSponsorOffers,
  sponsorSlotCapacity,
  beginSponsorNegotiation,
  resolveSponsorNegotiation,
  sponsorContractTerms,
  sponsorTerminationBuyout,
  expireSponsorNegotiations,
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

  it('uses championship rounds for midseason deadlines and pays an early completion once', () => {
    const c = buildInitialCommercial(williams, williamsDrivers, 'living', 'Formula 1');
    const midseason = c.sponsors.flatMap((sponsor) => sponsor.objectives).find((objective) => objective.deadline === 'midseason')!;
    expect(objectiveDeadlineRound(midseason, 17)).toBe(9);
    const first = evaluateRoundSponsorObjectives(c, {
      round: 3,
      totalRounds: 17,
      constructorPosition: 5,
      points: 1,
      wins: 0,
      failedToQualify: false,
      teamRaceResults: 2,
      expectedEntries: 2,
      reliabilityDnfs: 0,
      withdrawnOrMissingEntries: 0,
    });
    const resolved = first.commercial.sponsors.flatMap((sponsor) => sponsor.objectives).find((objective) => objective.id === midseason.id)!;
    expect(resolved.status).toBe('Met');
    expect(resolved.resolvedRound).toBe(3);
    expect(first.payouts.some((payout) => payout.label.includes(midseason.description))).toBe(true);

    const repeated = evaluateRoundSponsorObjectives(first.commercial, {
      round: 4,
      totalRounds: 17,
      constructorPosition: 5,
      points: 2,
      wins: 0,
      failedToQualify: false,
      teamRaceResults: 2,
      expectedEntries: 2,
      reliabilityDnfs: 0,
      withdrawnOrMissingEntries: 0,
    });
    expect(repeated.payouts.some((payout) => payout.label.includes(midseason.description))).toBe(false);
  });

  it('fails an unmet objective only at its deadline and issues warnings from real evidence', () => {
    const c = buildInitialCommercial(williams, williamsDrivers, 'living-fail', 'Formula 1');
    const pressured = {
      ...c,
      sponsors: c.sponsors.map((sponsor) => ({ ...sponsor, confidence: 43, relationshipStatus: 'Monitoring' as const })),
    };
    const before = evaluateRoundSponsorObjectives(pressured, {
      round: 8,
      totalRounds: 17,
      constructorPosition: 12,
      points: 0,
      wins: 0,
      failedToQualify: true,
      teamRaceResults: 1,
      expectedEntries: 2,
      reliabilityDnfs: 1,
      withdrawnOrMissingEntries: 1,
      publicControversies: 1,
    });
    expect(before.commercial.sponsors.flatMap((sponsor) => sponsor.objectives).filter((objective) => objective.deadline === 'midseason').every((objective) => objective.status === 'Pending')).toBe(true);
    expect(before.reviews.some((review) => review.kind === 'Warning' || review.kind === 'Breach')).toBe(true);

    const deadline = evaluateRoundSponsorObjectives(before.commercial, {
      round: 9,
      totalRounds: 17,
      constructorPosition: 12,
      points: 0,
      wins: 0,
      failedToQualify: true,
      teamRaceResults: 2,
      expectedEntries: 2,
      reliabilityDnfs: 0,
      withdrawnOrMissingEntries: 0,
    });
    expect(deadline.commercial.sponsors.flatMap((sponsor) => sponsor.objectives).filter((objective) => objective.deadline === 'midseason').every((objective) => objective.status === 'Failed')).toBe(true);
    expect(deadline.payouts.some((payout) => payout.amount < 0)).toBe(true);
  });

  it('tracks driver-linked sponsor treatment separately', () => {
    const c = buildInitialCommercial(williams, williamsDrivers, 'linked', 'Formula 1');
    const linkedSponsor = c.sponsors.find((sponsor) => sponsor.linkedDriverId)!;
    const next = evaluateRoundSponsorObjectives(c, {
      round: 1,
      totalRounds: 16,
      constructorPosition: 5,
      points: 0,
      wins: 0,
      failedToQualify: false,
      teamRaceResults: 1,
      expectedEntries: 2,
      reliabilityDnfs: 0,
      withdrawnOrMissingEntries: 1,
      linkedDriverResults: { [linkedSponsor.linkedDriverId!]: { raced: false, finished: false, points: 0 } },
    });
    expect(next.commercial.sponsors.find((sponsor) => sponsor.id === linkedSponsor.id)!.confidence).toBeLessThan(linkedSponsor.confidence);
  });

  it('can revise a season-end position target at the midseason review', () => {
    const c = buildInitialCommercial(williams, williamsDrivers, 'revision', 'Formula 1');
    const target = c.sponsors.flatMap((sponsor) => sponsor.objectives).find((objective) => objective.category === 'Performance' && objective.targetValue)!;
    const review = evaluateRoundSponsorObjectives(c, {
      round: 8,
      totalRounds: 16,
      constructorPosition: 1,
      points: 100,
      wins: 4,
      failedToQualify: false,
      teamRaceResults: 2,
      expectedEntries: 2,
      reliabilityDnfs: 0,
      withdrawnOrMissingEntries: 0,
    });
    const revised = review.commercial.sponsors.flatMap((sponsor) => sponsor.objectives).find((objective) => objective.id === target.id)!;
    expect(revised.originalTargetValue).toBe(target.targetValue);
    expect(revised.targetValue).toBe((target.targetValue ?? 2) - 1);
    expect(review.reviews.some((item) => item.kind === 'Revision')).toBe(true);
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

  it('runs deterministic negotiations with counters, patience, and exact contract terms', () => {
    const commercial = buildInitialCommercial(williams, williamsDrivers, 'talks', 'Formula 1');
    const sponsor = generateSponsorOffers(williams, commercial, 'talks', 1996, 'Formula 1')[0];
    const talk = beginSponsorNegotiation(sponsor, 'New', 2, 16);
    const baseTerms = sponsorContractTerms(sponsor);
    const accepted = resolveSponsorNegotiation(talk, sponsor, baseTerms, 80, 'talks');
    expect(accepted.negotiation.status).toBe('Accepted');
    expect(accepted.signedSponsor).toMatchObject({ annualValue: baseTerms.annualValue, contractYearsRemaining: baseTerms.contractYears });

    const demanding = { ...baseTerms, annualValue: baseTerms.annualValue * 1.3, bonusMultiplier: 1.4, objectiveLevel: 'Flexible' as const };
    const response = resolveSponsorNegotiation(talk, sponsor, demanding, 50, 'talks');
    expect(['Countered', 'Rejected']).toContain(response.negotiation.status);
    expect(response.negotiation.attempts).toBe(1);
  });

  it('calculates larger termination protection for title deals', () => {
    const commercial = buildInitialCommercial(williams, williamsDrivers, 'buyout', 'Formula 1');
    const title = commercial.sponsors.find((sponsor) => sponsor.type === 'Title')!;
    const secondary = commercial.sponsors.find((sponsor) => sponsor.type === 'Secondary')!;
    expect(sponsorTerminationBuyout(title)).toBeGreaterThan(sponsorTerminationBuyout(secondary));
  });

  it('refreshes opportunity ids every four championship rounds', () => {
    const commercial = buildInitialCommercial(williams, williamsDrivers, 'market', 'Formula 1');
    const first = generateSponsorOffers(williams, commercial, 'market', 1996, 'Formula 1', 1);
    const nextWindow = generateSponsorOffers(williams, commercial, 'market', 1996, 'Formula 1', 4);
    expect(nextWindow.map((offer) => offer.id)).not.toEqual(first.map((offer) => offer.id));
  });

  it('withdraws unresolved offers when their championship-round deadline passes', () => {
    const commercial = buildInitialCommercial(williams, williamsDrivers, 'deadline', 'Formula 1');
    const sponsor = generateSponsorOffers(williams, commercial, 'deadline', 1996, 'Formula 1')[0];
    const negotiation = { ...beginSponsorNegotiation(sponsor, 'New', 1, 16), deadlineRound: 3 };
    const expired = expireSponsorNegotiations({ ...commercial, negotiations: [negotiation] }, 3);
    expect(expired.negotiations?.[0].status).toBe('Withdrawn');
    expect(expired.unavailableOfferIds).toContain(sponsor.id);
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
    // Rounding each installment to a whole dollar may move the season total by
    // a few dollars, but it must remain the intended 75% installment portion.
    expect(perRace * 16).toBeCloseTo(annual * 0.75, -1);
  });

  it('installment payment returns empty for undefined commercial or zero races', () => {
    expect(sponsorInstallmentPayment(undefined, 16)).toEqual([]);
    const c = buildInitialCommercial(williams, williamsDrivers, 's', 'Formula 1');
    expect(sponsorInstallmentPayment(c, 0)).toEqual([]);
  });
});
