import { describe, it, expect } from 'vitest';
import { teams1995 } from '../data';
import { buildTeamReputations } from './expectationEngine';
import {
  RENEW_THRESHOLD,
  SACK_THRESHOLD,
  bestRehireOffer,
  budgetTierOf,
  createPrincipalProfile,
  generateJobOffers,
  reviewPrincipal,
  type PrincipalSeasonOutcome,
} from './principalEngine';
import type { ExpectationReview } from '../types/expectationTypes';
import type { JobOffer } from '../types/principalTypes';

const reps = buildTeamReputations(teams1995);
const topTeam = [...teams1995].sort((a, b) => b.reputation - a.reputation)[0];
const backmarker = [...teams1995].sort((a, b) => a.reputation - b.reputation)[0];

function review(score: number, met = score >= 0): ExpectationReview {
  return {
    teamId: 'x',
    seasonYear: 1995,
    primaryObjectiveMet: met,
    score,
    patienceDelta: Math.round(score / 5),
    summary: 'test',
  };
}

const NO_RESULTS: PrincipalSeasonOutcome = {
  wins: 0,
  podiums: 0,
  driverTitle: false,
  constructorTitle: false,
};

describe('principalEngine', () => {
  it('creates a profile bound to the chosen team', () => {
    const p = createPrincipalProfile(topTeam, reps, 1995, 'seed');
    expect(p.currentTeamId).toBe(topTeam.id);
    expect(p.careerStats.teamsManaged).toContain(topTeam.id);
    expect(p.jobSecurity).toBeGreaterThanOrEqual(0);
    expect(p.jobSecurity).toBeLessThanOrEqual(100);
    expect(p.contractYearsRemaining).toBeGreaterThan(0);
  });

  it('is deterministic for the same seed', () => {
    const a = createPrincipalProfile(topTeam, reps, 1995, 's');
    const b = createPrincipalProfile(topTeam, reps, 1995, 's');
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('a strong season raises job security and reputation and is retained', () => {
    const p = createPrincipalProfile(topTeam, reps, 1995, 'seed');
    const r = reviewPrincipal(p, review(80), { ...NO_RESULTS, wins: 3, podiums: 8 });
    expect(r.status).toBe('retained');
    expect(r.profile.jobSecurity).toBeGreaterThanOrEqual(p.jobSecurity);
    expect(r.profile.reputation).toBeGreaterThanOrEqual(p.reputation);
    expect(r.profile.careerStats.seasonsCompleted).toBe(1);
    expect(r.profile.careerStats.raceWins).toBe(3);
  });

  it('banks championship titles in the career record', () => {
    const p = createPrincipalProfile(topTeam, reps, 1995, 'seed');
    const r = reviewPrincipal(p, review(90), {
      wins: 5,
      podiums: 12,
      driverTitle: true,
      constructorTitle: true,
    });
    expect(r.profile.careerStats.driverTitles).toBe(1);
    expect(r.profile.careerStats.constructorTitles).toBe(1);
  });

  it('sacks the principal when job security collapses mid-contract', () => {
    const p = { ...createPrincipalProfile(backmarker, reps, 1995, 'seed'), jobSecurity: 30, contractYearsRemaining: 3 };
    const r = reviewPrincipal(p, review(-100, false), NO_RESULTS);
    expect(r.profile.jobSecurity).toBeLessThan(SACK_THRESHOLD);
    expect(r.status).toBe('sacked');
  });

  it('renews an expiring contract when security is high enough', () => {
    const p = { ...createPrincipalProfile(topTeam, reps, 1995, 'seed'), jobSecurity: 70, contractYearsRemaining: 1 };
    const r = reviewPrincipal(p, review(40), { ...NO_RESULTS, wins: 1 });
    expect(r.profile.jobSecurity).toBeGreaterThanOrEqual(RENEW_THRESHOLD);
    expect(r.status).toBe('renewed');
    expect(r.profile.contractYearsRemaining).toBeGreaterThan(0);
  });

  it('does not renew an expiring contract when security is mediocre', () => {
    const p = { ...createPrincipalProfile(topTeam, reps, 1995, 'seed'), jobSecurity: 45, contractYearsRemaining: 1 };
    const r = reviewPrincipal(p, review(-20, false), NO_RESULTS);
    // 45 - 8 = 37: above the sack floor but below the renewal bar.
    expect(r.profile.jobSecurity).toBeGreaterThanOrEqual(SACK_THRESHOLD);
    expect(r.profile.jobSecurity).toBeLessThan(RENEW_THRESHOLD);
    expect(r.status).toBe('sacked');
  });

  it('generates approaches that exclude the current team', () => {
    const p = createPrincipalProfile(topTeam, reps, 1995, 'seed');
    const offers = generateJobOffers(p, teams1995, reps, 1995, 'seed');
    expect(offers.length).toBeGreaterThan(0);
    for (const o of offers) expect(o.teamId).not.toBe(topTeam.id);
  });

  it('gives a higher-standing principal interest from more prestigious teams', () => {
    const strong = { ...createPrincipalProfile(topTeam, reps, 1995, 'seed'), reputation: 90, jobSecurity: 90 };
    const weak = { ...createPrincipalProfile(backmarker, reps, 1995, 'seed'), reputation: 20, jobSecurity: 20 };
    const strongTop = Math.max(0, ...generateJobOffers(strong, teams1995, reps, 1995, 's').map((o) => o.prestige));
    const weakTop = Math.max(0, ...generateJobOffers(weak, teams1995, reps, 1995, 's').map((o) => o.prestige));
    expect(strongTop).toBeGreaterThanOrEqual(weakTop);
  });

  it('picks the most prestigious firm offer for a re-hire, or none', () => {
    const offers: JobOffer[] = [
      { id: 'a', teamId: 't1', seasonYear: 1995, contractYears: 2, objective: 'x', prestige: 40, budgetTier: 'Midfield', kind: 'Offer', expiresSeasonYear: 1996 },
      { id: 'b', teamId: 't2', seasonYear: 1995, contractYears: 2, objective: 'x', prestige: 70, budgetTier: 'Front-running', kind: 'Offer', expiresSeasonYear: 1996 },
      { id: 'c', teamId: 't3', seasonYear: 1995, contractYears: 2, objective: 'x', prestige: 90, budgetTier: 'Works-level', kind: 'Rumor', expiresSeasonYear: 1996 },
    ];
    expect(bestRehireOffer(offers)?.id).toBe('b');
    expect(bestRehireOffer([offers[2]])).toBeUndefined();
  });

  it('labels a budget tier for every team', () => {
    for (const t of teams1995) expect(budgetTierOf(t).length).toBeGreaterThan(0);
  });
});
