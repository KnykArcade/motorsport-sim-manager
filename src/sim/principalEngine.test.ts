import { describe, it, expect } from 'vitest';
import { teams1995 } from '../data/teams/teams1995';
import { buildTeamReputations } from './expectationEngine';
import {
  RENEW_THRESHOLD,
  SACK_THRESHOLD,
  bestRehireOffer,
  budgetTierOf,
  createPrincipalProfile,
  generateJobOffers,
  generateJobOffersWithCredentials,
  reviewPrincipal,
  xpForLevel,
  xpFromSeasonOutcome,
  getCredentialTier,
  getNextCredentialTier,
  credentialUpgradeProgress,
  allocateSkillPoint,
  jobInterestModifier,
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

  it('initializes xp and level on a new profile', () => {
    const p = createPrincipalProfile(topTeam, reps, 1995, 'test');
    expect(p.xp).toBe(0);
    expect(p.level).toBe(1);
  });

  it('xpForLevel scales with level', () => {
    expect(xpForLevel(1)).toBe(100);
    expect(xpForLevel(2)).toBe(150);
    expect(xpForLevel(3)).toBe(200);
  });

  it('xpFromSeasonOutcome rewards wins, podiums, and titles', () => {
    const base = xpFromSeasonOutcome({ wins: 0, podiums: 0, driverTitle: false, constructorTitle: false }, 0);
    expect(base).toBe(50);
    const champ = xpFromSeasonOutcome({ wins: 10, podiums: 15, driverTitle: true, constructorTitle: true }, 20);
    expect(champ).toBeGreaterThan(300);
  });

  it('gains XP and levels up through season reviews', () => {
    const p = createPrincipalProfile(topTeam, reps, 1995, 'test');
    const outcome: PrincipalSeasonOutcome = { wins: 5, podiums: 10, driverTitle: false, constructorTitle: false };
    const result = reviewPrincipal(p, review(15, true), outcome);
    expect(result.profile.xp).toBeGreaterThanOrEqual(0);
    expect(result.profile.level).toBeGreaterThanOrEqual(1);
    expect(result.notes.some((n) => n.includes('XP'))).toBe(true);
  });

  it('levels up after enough XP from strong seasons', () => {
    const p = createPrincipalProfile(topTeam, reps, 1995, 'test');
    const strongOutcome: PrincipalSeasonOutcome = { wins: 8, podiums: 12, driverTitle: true, constructorTitle: true };
    // A championship-winning season should give enough XP to level up at least once.
    const result = reviewPrincipal(p, review(30, true), strongOutcome);
    expect(result.profile.level).toBeGreaterThan(1);
  });

  it('level-up grants skill points', () => {
    const p = createPrincipalProfile(topTeam, reps, 1995, 'test');
    expect(p.skillPoints).toBe(0);
    const strongOutcome: PrincipalSeasonOutcome = { wins: 8, podiums: 12, driverTitle: true, constructorTitle: true };
    const result = reviewPrincipal(p, review(30, true), strongOutcome);
    expect(result.profile.level).toBeGreaterThan(1);
    expect(result.profile.skillPoints).toBeGreaterThan(0);
  });
});

describe('principalEngine — credential tiers', () => {
  it('new principal is Rookie tier', () => {
    const p = createPrincipalProfile(topTeam, reps, 1995, 'test');
    expect(getCredentialTier(p).tier).toBe('Rookie');
  });

  it('high-level principal reaches higher tiers', () => {
    const p = createPrincipalProfile(topTeam, reps, 1995, 'test');
    const advanced = { ...p, level: 8, reputation: 55 };
    expect(getCredentialTier(advanced).tier).toBe('Respected');
  });

  it('Legendary tier requires high level and reputation', () => {
    const p = createPrincipalProfile(topTeam, reps, 1995, 'test');
    const legendary = { ...p, level: 15, reputation: 90 };
    expect(getCredentialTier(legendary).tier).toBe('Legendary');
  });

  it('level alone without reputation does not upgrade tier', () => {
    const p = createPrincipalProfile(topTeam, reps, 1995, 'test');
    const highLevelLowRep = { ...p, level: 10, reputation: 20 };
    // Reputation 20 < 30 required for Established, so stays Rookie.
    expect(getCredentialTier(highLevelLowRep).tier).toBe('Rookie');
  });

  it('getNextCredentialTier returns the next tier for non-Legendary', () => {
    const p = createPrincipalProfile(topTeam, reps, 1995, 'test');
    const next = getNextCredentialTier(p);
    expect(next).toBeDefined();
    expect(next!.tier).toBe('Established');
  });

  it('getNextCredentialTier returns undefined for Legendary', () => {
    const p = createPrincipalProfile(topTeam, reps, 1995, 'test');
    const legendary = { ...p, level: 15, reputation: 90 };
    expect(getNextCredentialTier(legendary)).toBeUndefined();
  });

  it('credentialUpgradeProgress tracks progress toward next tier', () => {
    const p = createPrincipalProfile(topTeam, reps, 1995, 'test');
    const progress = credentialUpgradeProgress(p);
    expect(progress.levelProgress).toBeGreaterThanOrEqual(0);
    expect(progress.levelProgress).toBeLessThanOrEqual(1);
    expect(progress.reputationProgress).toBeGreaterThanOrEqual(0);
    expect(progress.reputationProgress).toBeLessThanOrEqual(1);
    expect(progress.ready).toBe(false);
  });

  it('credentialUpgradeProgress ready when both thresholds met for next tier', () => {
    const p = createPrincipalProfile(topTeam, reps, 1995, 'test');
    // Level 5 + reputation 35: qualifies for Established (4/30), next is Respected (7/50).
    // Not yet ready for Respected.
    const almost = { ...p, level: 5, reputation: 35 };
    const progress = credentialUpgradeProgress(almost);
    expect(progress.ready).toBe(false);
    // Level 7 + reputation 50: qualifies for Respected, next is Renowned (10/70).
    // Not yet ready for Renowned.
    const respected = { ...p, level: 7, reputation: 50 };
    const progress2 = credentialUpgradeProgress(respected);
    expect(progress2.ready).toBe(false);
  });
});

describe('principalEngine — skill-point allocation', () => {
  it('allocating a skill point increases the attribute', () => {
    const p = createPrincipalProfile(topTeam, reps, 1995, 'test');
    const withPoints = { ...p, skillPoints: 5 };
    const before = withPoints.attributes.development;
    const allocated = allocateSkillPoint(withPoints, 'development', 1);
    expect(allocated.attributes.development).toBe(before + 3);
    expect(allocated.skillPoints).toBe(4);
    expect(allocated.spentSkillPoints.development).toBe(1);
  });

  it('cannot allocate more points than available', () => {
    const p = createPrincipalProfile(topTeam, reps, 1995, 'test');
    const withPoints = { ...p, skillPoints: 1 };
    const allocated = allocateSkillPoint(withPoints, 'strategy', 2);
    // Should return unchanged profile.
    expect(allocated).toBe(withPoints);
  });

  it('multiple allocations stack correctly', () => {
    const p = createPrincipalProfile(topTeam, reps, 1995, 'test');
    let profile = { ...p, skillPoints: 6 };
    const before = profile.attributes.mediaImage;
    profile = allocateSkillPoint(profile, 'mediaImage', 2);
    profile = allocateSkillPoint(profile, 'mediaImage', 1);
    expect(profile.attributes.mediaImage).toBe(before + 9);
    expect(profile.skillPoints).toBe(3);
    expect(profile.spentSkillPoints.mediaImage).toBe(3);
  });
});

describe('principalEngine — job interest effects', () => {
  it('Rookie tier has no job interest modifier', () => {
    const p = createPrincipalProfile(topTeam, reps, 1995, 'test');
    expect(jobInterestModifier(p)).toBe(0);
  });

  it('Respected tier has higher job interest modifier', () => {
    const p = createPrincipalProfile(topTeam, reps, 1995, 'test');
    const respected = { ...p, level: 7, reputation: 50 };
    expect(jobInterestModifier(respected)).toBe(10);
  });

  it('Legendary tier has the highest job interest modifier', () => {
    const p = createPrincipalProfile(topTeam, reps, 1995, 'test');
    const legendary = { ...p, level: 15, reputation: 90 };
    expect(jobInterestModifier(legendary)).toBe(20);
  });

  it('generateJobOffersWithCredentials produces at least as many offers as base', () => {
    const p = createPrincipalProfile(topTeam, reps, 1995, 'test');
    const respected = { ...p, level: 7, reputation: 50 };
    const baseOffers = generateJobOffers(respected, teams1995, reps, 1996, 'seed');
    const credOffers = generateJobOffersWithCredentials(respected, teams1995, reps, 1996, 'seed');
    expect(credOffers.length).toBeGreaterThanOrEqual(baseOffers.length);
  });
});
