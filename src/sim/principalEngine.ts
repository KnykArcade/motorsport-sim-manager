// Team Principal job market (Living Universe Phase 6).
//
// The player is a Team Principal with their own reputation, contract, job
// security and career record. Each season the owner reviews performance, which
// moves job security; strong or weak results draw approaches from rival teams.
// A principal can be renewed, sacked, or accept a move to another team — turning
// the game into a long manager career. Pure and deterministic.

import type { Team } from '../types/gameTypes';
import type { TeamReputation } from '../types/expectationTypes';
import type {
  JobOffer,
  PrincipalAttributes,
  TeamPrincipalProfile,
  CredentialTierInfo,
} from '../types/principalTypes';
import { CREDENTIAL_TIERS } from '../types/principalTypes';
import type { ExpectationReview } from '../types/expectationTypes';
import { createSeededRandom, deriveSeed } from './random';

// Job-security bands that decide the principal's fate at the season review.
export const SACK_THRESHOLD = 22; // below this, the owner pulls the trigger
export const RENEW_THRESHOLD = 42; // at/above this, an expiring deal is renewed

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

// A team's standing in the paddock, preferring the slow-moving reputation
// profile (which carries owner patience etc.) and falling back to the team's
// own reputation value.
function teamPrestige(
  team: Team,
  reputations?: Record<string, TeamReputation>,
): number {
  return reputations?.[team.id]?.reputation ?? team.reputation;
}

export function budgetTierOf(team: Team): string {
  const b = team.budget;
  if (b >= 120) return 'Works-level';
  if (b >= 70) return 'Front-running';
  if (b >= 35) return 'Midfield';
  if (b >= 15) return 'Limited';
  return 'Shoestring';
}

// A one-line remit for an offer, scaled by the hiring team's prestige.
function objectiveForPrestige(prestige: number): string {
  if (prestige >= 80) return 'Deliver championships';
  if (prestige >= 60) return 'Win races and fight at the front';
  if (prestige >= 40) return 'Establish the team in the midfield';
  if (prestige >= 20) return 'Score points and grow the operation';
  return 'Rebuild the team and survive';
}

function startingAttributes(rep: number, rng: { variance: (s?: number) => number }): PrincipalAttributes {
  const base = (offset: number) => clamp(Math.round(40 + rep * 0.25 + offset + rng.variance(6)));
  return {
    mediaImage: base(5),
    boardConfidence: base(8),
    financialDiscipline: base(0),
    driverManagement: base(2),
    development: base(0),
    strategy: base(2),
  };
}

// Build the player's starting principal profile from their chosen team.
export function createPrincipalProfile(
  team: Team,
  reputations: Record<string, TeamReputation> | undefined,
  year: number,
  seed: string,
  name = 'You',
): TeamPrincipalProfile {
  const rng = createSeededRandom(deriveSeed(seed, 'principal', team.id, year));
  const prestige = teamPrestige(team, reputations);
  const reputation = clamp(Math.round(35 + prestige * 0.25));
  const ownerPatience = reputations?.[team.id]?.ownerPatience ?? 55;
  return {
    id: `principal-${team.id}`,
    name,
    reputation,
    currentTeamId: team.id,
    contractYearsRemaining: 3,
    // Start job security around the owner's patience, nudged by prestige.
    jobSecurity: clamp(Math.round(ownerPatience * 0.6 + 25)),
    attributes: startingAttributes(prestige, rng),
    careerStats: {
      seasonsCompleted: 0,
      raceWins: 0,
      podiums: 0,
      driverTitles: 0,
      constructorTitles: 0,
      teamsManaged: [team.id],
    },
    xp: 0,
    level: 1,
    skillPoints: 0,
    spentSkillPoints: {},
  };
}

export type PrincipalSeasonOutcome = {
  wins: number;
  podiums: number;
  driverTitle: boolean;
  constructorTitle: boolean;
};

export type PrincipalStatus = 'retained' | 'renewed' | 'sacked';

export type PrincipalReview = {
  profile: TeamPrincipalProfile;
  status: PrincipalStatus;
  notes: string[];
};

function growAttributes(
  attrs: PrincipalAttributes,
  review: ExpectationReview,
  outcome: PrincipalSeasonOutcome,
  jobSecurity: number,
): PrincipalAttributes {
  const met = review.primaryObjectiveMet ? 2 : -2;
  return {
    mediaImage: clamp(attrs.mediaImage + Math.round(review.score / 25)),
    boardConfidence: clamp(Math.round(attrs.boardConfidence * 0.6 + jobSecurity * 0.4)),
    financialDiscipline: clamp(attrs.financialDiscipline + met),
    driverManagement: clamp(attrs.driverManagement + (outcome.podiums > 0 ? 2 : met)),
    development: clamp(attrs.development + (outcome.wins > 0 ? 2 : met)),
    strategy: clamp(attrs.strategy + met),
  };
}

// XP required to advance from the given level to the next.
export function xpForLevel(level: number): number {
  return 100 + (level - 1) * 50;
}

// XP earned from a season's results.
export function xpFromSeasonOutcome(outcome: PrincipalSeasonOutcome, reviewScore: number): number {
  let xp = 50; // base participation
  xp += outcome.wins * 15;
  xp += outcome.podiums * 8;
  xp += (outcome.driverTitle ? 40 : 0);
  xp += (outcome.constructorTitle ? 40 : 0);
  // Bonus for exceeding expectations (positive review score).
  if (reviewScore > 0) xp += Math.round(reviewScore * 0.5);
  // Penalty for poor performance (but never below 20).
  if (reviewScore < 0) xp = Math.max(20, xp + Math.round(reviewScore * 0.3));
  return xp;
}

// Apply XP gain, level up if enough XP, and grow attributes on level up.
// Returns the updated profile and any level-up notes.
function applyXpAndLevel(
  profile: TeamPrincipalProfile,
  xpGain: number,
): { profile: TeamPrincipalProfile; levelUps: number } {
  let xp = profile.xp + xpGain;
  let level = profile.level;
  const attrs = { ...profile.attributes };
  let levelUps = 0;
  let skillPoints = profile.skillPoints;

  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level++;
    levelUps++;
    skillPoints += 2; // 2 skill points per level
    // Each level grants +2 to two random-ish attributes (deterministic by level).
    const bonusKeys: (keyof PrincipalAttributes)[] = [
      'mediaImage', 'boardConfidence', 'financialDiscipline',
      'driverManagement', 'development', 'strategy',
    ];
    const idx1 = level % bonusKeys.length;
    const idx2 = (level + 3) % bonusKeys.length;
    attrs[bonusKeys[idx1]] = clamp(attrs[bonusKeys[idx1]] + 2);
    attrs[bonusKeys[idx2]] = clamp(attrs[bonusKeys[idx2]] + 2);
  }

  return {
    profile: { ...profile, xp, level, attributes: attrs, skillPoints },
    levelUps,
  };
}

// Apply the owner's end-of-season review to the principal: move job security and
// reputation, grow attributes, bank the season's record, then decide whether the
// principal is retained, renewed, or sacked.
export function reviewPrincipal(
  profile: TeamPrincipalProfile,
  review: ExpectationReview,
  outcome: PrincipalSeasonOutcome,
): PrincipalReview {
  const securityDelta = Math.round(review.score * 0.4); // -40..40
  const jobSecurity = clamp(profile.jobSecurity + securityDelta);
  const contractYearsRemaining = Math.max(0, profile.contractYearsRemaining - 1);

  const titles = (outcome.driverTitle ? 1 : 0) + (outcome.constructorTitle ? 1 : 0);
  const reputation = clamp(profile.reputation + Math.round(review.score * 0.08) + titles * 3);

  const careerStats = {
    seasonsCompleted: profile.careerStats.seasonsCompleted + 1,
    raceWins: profile.careerStats.raceWins + outcome.wins,
    podiums: profile.careerStats.podiums + outcome.podiums,
    driverTitles: profile.careerStats.driverTitles + (outcome.driverTitle ? 1 : 0),
    constructorTitles: profile.careerStats.constructorTitles + (outcome.constructorTitle ? 1 : 0),
    teamsManaged: profile.careerStats.teamsManaged,
  };

  const attributes = growAttributes(profile.attributes, review, outcome, jobSecurity);

  // XP and leveling.
  const xpGain = xpFromSeasonOutcome(outcome, review.score);
  const xpResult = applyXpAndLevel(
    { ...profile, attributes, careerStats, reputation, jobSecurity, contractYearsRemaining },
    xpGain,
  );

  const notes: string[] = [];
  let status: PrincipalStatus;
  let nextContractYears = contractYearsRemaining;

  if (xpResult.levelUps > 0) {
    notes.push(`Gained ${xpGain} XP and reached Level ${xpResult.profile.level}.`);
  } else {
    notes.push(`Gained ${xpGain} XP.`);
  }

  if (jobSecurity < SACK_THRESHOLD) {
    status = 'sacked';
    notes.push(`The board has lost faith and relieved you of your duties (job security ${jobSecurity}).`);
  } else if (contractYearsRemaining <= 0) {
    if (jobSecurity >= RENEW_THRESHOLD) {
      status = 'renewed';
      nextContractYears = jobSecurity >= 70 ? 3 : 2;
      notes.push(`Your contract was renewed for ${nextContractYears} more years.`);
    } else {
      status = 'sacked';
      notes.push('Your contract expired and the board chose not to renew it.');
    }
  } else {
    status = 'retained';
  }

  const updated: TeamPrincipalProfile = {
    ...xpResult.profile,
    contractYearsRemaining: nextContractYears,
  };

  return { profile: updated, status, notes };
}

// Generate the rival-team approaches a principal of this standing attracts.
// Stronger principals (reputation + recent job security) draw firm offers from
// more prestigious teams; weaker standing yields only informal rumors.
export function generateJobOffers(
  profile: TeamPrincipalProfile,
  teams: Team[],
  reputations: Record<string, TeamReputation> | undefined,
  year: number,
  seed: string,
  max = 5,
): JobOffer[] {
  const rng = createSeededRandom(deriveSeed(seed, 'joboffers', profile.id, year));
  const standing = profile.reputation * 0.7 + profile.jobSecurity * 0.3;

  const candidates: { team: Team; prestige: number; gap: number }[] = [];
  for (const team of teams) {
    if (team.id === profile.currentTeamId) continue;
    const prestige = teamPrestige(team, reputations);
    const gap = standing - prestige;
    // A team approaches only if the principal is roughly in its league.
    if (gap >= -15) candidates.push({ team, prestige, gap });
  }

  candidates.sort((a, b) => b.prestige - a.prestige);

  const offers: JobOffer[] = [];
  for (const c of candidates.slice(0, max)) {
    const firm = c.gap >= 0;
    offers.push({
      id: `joboffer-${c.team.id}-${year}`,
      teamId: c.team.id,
      seasonYear: year,
      contractYears: firm ? rng.int(2, 3) : 2,
      objective: objectiveForPrestige(c.prestige),
      prestige: Math.round(c.prestige),
      budgetTier: budgetTierOf(c.team),
      kind: firm ? 'Offer' : 'Rumor',
      expiresSeasonYear: year + 1,
    });
  }
  return offers;
}

// When a principal is sacked but rival teams still want them, they drop into the
// best firm offer available (usually a weaker team). Returns undefined if no
// team is willing to hire — the principal is left without a seat.
export function bestRehireOffer(offers: JobOffer[]): JobOffer | undefined {
  const firm = offers.filter((o) => o.kind === 'Offer');
  if (firm.length === 0) return undefined;
  return [...firm].sort((a, b) => b.prestige - a.prestige)[0];
}

// ---------------------------------------------------------------------------
// Credential Tiers — milestone-based progression labels.
// ---------------------------------------------------------------------------

export function getCredentialTier(profile: TeamPrincipalProfile): CredentialTierInfo {
  let current: CredentialTierInfo = CREDENTIAL_TIERS[0];
  for (const tier of CREDENTIAL_TIERS) {
    if (profile.level >= tier.minLevel && profile.reputation >= tier.minReputation) {
      current = tier;
    }
  }
  return current;
}

export function getNextCredentialTier(profile: TeamPrincipalProfile): CredentialTierInfo | undefined {
  const current = getCredentialTier(profile);
  const idx = CREDENTIAL_TIERS.findIndex((t) => t.tier === current.tier);
  return idx >= 0 && idx < CREDENTIAL_TIERS.length - 1 ? CREDENTIAL_TIERS[idx + 1] : undefined;
}

export function credentialUpgradeProgress(profile: TeamPrincipalProfile): { levelProgress: number; reputationProgress: number; ready: boolean } {
  const next = getNextCredentialTier(profile);
  if (!next) return { levelProgress: 1, reputationProgress: 1, ready: false };
  const current = getCredentialTier(profile);
  const levelRange = next.minLevel - current.minLevel;
  const repRange = next.minReputation - current.minReputation;
  return {
    levelProgress: levelRange > 0 ? Math.min(1, (profile.level - current.minLevel) / levelRange) : 1,
    reputationProgress: repRange > 0 ? Math.min(1, (profile.reputation - current.minReputation) / repRange) : 1,
    ready: profile.level >= next.minLevel && profile.reputation >= next.minReputation,
  };
}

// ---------------------------------------------------------------------------
// Skill-point allocation — player chooses where to invest.
// ---------------------------------------------------------------------------

export function allocateSkillPoint(
  profile: TeamPrincipalProfile,
  attribute: keyof PrincipalAttributes,
  points: number = 1,
): TeamPrincipalProfile {
  if (profile.skillPoints < points) return profile;
  const spent = { ...profile.spentSkillPoints };
  spent[attribute] = (spent[attribute] ?? 0) + points;
  return {
    ...profile,
    attributes: {
      ...profile.attributes,
      [attribute]: clamp(profile.attributes[attribute] + points * 3),
    },
    skillPoints: profile.skillPoints - points,
    spentSkillPoints: spent,
  };
}

// ---------------------------------------------------------------------------
// Job interest effects — credential tier modifies offer quality.
// ---------------------------------------------------------------------------

export function jobInterestModifier(profile: TeamPrincipalProfile): number {
  const tier = getCredentialTier(profile);
  switch (tier.tier) {
    case 'Rookie': return 0;
    case 'Established': return 5;
    case 'Respected': return 10;
    case 'Renowned': return 15;
    case 'Legendary': return 20;
  }
}

export function generateJobOffersWithCredentials(
  profile: TeamPrincipalProfile,
  teams: Team[],
  reputations: Record<string, TeamReputation> | undefined,
  year: number,
  seed: string,
  max = 5,
): JobOffer[] {
  const baseOffers = generateJobOffers(profile, teams, reputations, year, seed, max);
  const interestBoost = jobInterestModifier(profile);
  if (interestBoost <= 0) return baseOffers;
  // Credential tier widens the pool: lower the gap threshold so more teams approach.
  const rng = createSeededRandom(deriveSeed(seed, 'joboffers-cred', profile.id, year));
  const standing = profile.reputation * 0.7 + profile.jobSecurity * 0.3 + interestBoost;
  const extraCandidates: { team: Team; prestige: number; gap: number }[] = [];
  for (const team of teams) {
    if (team.id === profile.currentTeamId) continue;
    if (baseOffers.some((o) => o.teamId === team.id)) continue;
    const prestige = teamPrestige(team, reputations);
    const gap = standing - prestige;
    if (gap >= -15 - interestBoost * 0.5) {
      extraCandidates.push({ team, prestige, gap });
    }
  }
  extraCandidates.sort((a, b) => b.prestige - a.prestige);
  const extra = extraCandidates.slice(0, max - baseOffers.length).map((c) => {
    const firm = c.gap >= 0;
    return {
      id: `joboffer-cred-${c.team.id}-${year}`,
      teamId: c.team.id,
      seasonYear: year,
      contractYears: firm ? rng.int(2, 3) : 2,
      objective: objectiveForPrestige(c.prestige),
      prestige: Math.round(c.prestige),
      budgetTier: budgetTierOf(c.team),
      kind: firm ? 'Offer' : 'Rumor',
      expiresSeasonYear: year + 1,
    } as JobOffer;
  });
  return [...baseOffers, ...extra];
}
