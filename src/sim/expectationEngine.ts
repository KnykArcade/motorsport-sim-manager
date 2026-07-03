// Team reputation & owner-expectations engine (Living Universe Phase 3).
//
// Builds each team's slow-moving reputation profile and the owner's per-season
// objectives, then reviews performance at season end to move owner patience
// (which later drives the Team Principal job market). Pure/deterministic.

import type { Team } from '../types/gameTypes';
import type {
  ExpectationReview,
  TeamExpectation,
  TeamReputation,
  OwnerPersonality,
} from '../types/expectationTypes';
import { createSeededRandom, deriveSeed } from './random';

// Map a team's reputation (0-100) to a competitiveness tier 0..4.
function tier(reputation: number): number {
  return Math.max(0, Math.min(4, Math.floor(reputation / 20)));
}

// Deterministically assign an owner personality based on team profile.
// High-rep teams tend toward WinNowTycoon or RacingPurist; backmarkers tend
// toward PatientBuilder or BudgetHawk. A seeded nudge adds variety.
function assignOwnerPersonality(team: Team, seed: string): OwnerPersonality {
  const rng = createSeededRandom(deriveSeed(seed, 'owner', team.id));
  const rep = team.reputation;
  const roll = rng.next();

  if (rep >= 75) {
    return roll < 0.4 ? 'WinNowTycoon' : roll < 0.7 ? 'RacingPurist' : 'Showman';
  } else if (rep >= 50) {
    return roll < 0.3 ? 'WinNowTycoon'
      : roll < 0.55 ? 'PatientBuilder'
      : roll < 0.75 ? 'BudgetHawk'
      : roll < 0.9 ? 'OldGuard'
      : 'Showman';
  } else if (rep >= 30) {
    return roll < 0.35 ? 'PatientBuilder'
      : roll < 0.6 ? 'BudgetHawk'
      : roll < 0.8 ? 'OldGuard'
      : 'RacingPurist';
  } else {
    return roll < 0.4 ? 'BudgetHawk'
      : roll < 0.7 ? 'PatientBuilder'
      : 'OldGuard';
  }
}

// Personality-driven modifiers to patience delta and expectation severity.
export function ownerPersonalityPatienceMod(personality: OwnerPersonality): number {
  switch (personality) {
    case 'PatientBuilder': return 0.6;   // patience drains slower
    case 'WinNowTycoon': return 1.5;     // patience drains faster
    case 'BudgetHawk': return 1.0;       // neutral on results
    case 'RacingPurist': return 0.8;     // slightly tolerant
    case 'Showman': return 1.2;          // impatient without spectacle
    case 'OldGuard': return 0.7;         // loyal, slow to react
  }
}

export function ownerPersonalityExpectationMod(personality: OwnerPersonality): number {
  switch (personality) {
    case 'PatientBuilder': return -0.1;  // slightly lower expectations
    case 'WinNowTycoon': return 0.2;     // higher expectations
    case 'BudgetHawk': return 0.0;       // neutral
    case 'RacingPurist': return -0.05;   // slightly lower
    case 'Showman': return 0.1;          // slightly higher
    case 'OldGuard': return -0.05;       // slightly lower
  }
}

export function buildTeamReputation(team: Team, seed?: string): TeamReputation {
  const rep = team.reputation;
  const personality = seed ? assignOwnerPersonality(team, seed) : 'PatientBuilder';
  return {
    teamId: team.id,
    reputation: rep,
    financialStability: Math.round(40 + rep * 0.5),
    ownerPatience: Math.round(45 + (100 - rep) * 0.25), // weaker teams = more patient owners
    ownerPersonality: personality,
    fanExpectation: rep,
    sponsorConfidence: Math.round(50 + rep * 0.3),
    historicalPrestige: rep,
    currentCompetitiveness: rep,
  };
}

export function buildTeamReputations(teams: Team[], seed?: string): Record<string, TeamReputation> {
  const out: Record<string, TeamReputation> = {};
  for (const t of teams) out[t.id] = buildTeamReputation(t, seed);
  return out;
}

// Build owner expectations for one team, scaled by its competitive tier and an
// estimate of how many teams it should out-finish.
export function buildTeamExpectation(
  team: Team,
  teamCount: number,
  seasonYear: number,
): TeamExpectation {
  const t = tier(team.reputation);
  const expectedPosition = team.expectedStanding ?? Math.max(1, Math.round((4 - t) / 4 * teamCount) || teamCount);

  let primaryObjective: string;
  let minimumConstructorPosition: number | undefined;
  let targetPoints: number | undefined;
  let requiredWins: number | undefined;

  if (t >= 4) {
    primaryObjective = 'Fight for the championship';
    minimumConstructorPosition = 2;
    requiredWins = 3;
  } else if (t === 3) {
    primaryObjective = 'Win races and contend for podiums';
    minimumConstructorPosition = 4;
    requiredWins = 1;
  } else if (t === 2) {
    primaryObjective = 'Score points consistently and grow';
    minimumConstructorPosition = Math.min(teamCount, expectedPosition + 1);
    targetPoints = 20;
  } else if (t === 1) {
    primaryObjective = 'Occasionally score and control costs';
    minimumConstructorPosition = Math.min(teamCount, expectedPosition + 2);
    targetPoints = 5;
  } else {
    primaryObjective = 'Qualify consistently and survive financially';
    targetPoints = 1;
  }

  return {
    teamId: team.id,
    seasonYear,
    primaryObjective,
    secondaryObjectives: [
      'Beat your nearest rival in the constructors',
      'Keep the budget under control',
    ],
    minimumConstructorPosition,
    targetPoints,
    requiredWins,
    budgetDisciplineTarget: t <= 1,
    ownerPatience: Math.round(45 + (100 - team.reputation) * 0.25),
  };
}

export function buildTeamExpectations(
  teams: Team[],
  seasonYear: number,
): Record<string, TeamExpectation> {
  const out: Record<string, TeamExpectation> = {};
  for (const t of teams) out[t.id] = buildTeamExpectation(t, teams.length, seasonYear);
  return out;
}

export type ExpectationOutcome = {
  constructorPosition: number;
  points: number;
  wins: number;
};

// Compare a season's outcome against the owner's expectation, returning a
// score in [-100, 100], the resulting owner-patience delta and a summary.
export function reviewExpectation(
  expectation: TeamExpectation,
  outcome: ExpectationOutcome,
): ExpectationReview {
  let score = 0;
  let met = true;

  if (expectation.minimumConstructorPosition !== undefined) {
    const diff = expectation.minimumConstructorPosition - outcome.constructorPosition;
    // Finishing ahead of (lower number than) the floor is positive.
    score += diff * 18;
    if (outcome.constructorPosition > expectation.minimumConstructorPosition) met = false;
  }
  if (expectation.targetPoints !== undefined) {
    if (outcome.points >= expectation.targetPoints) score += 20;
    else {
      score -= 20;
      met = false;
    }
  }
  if (expectation.requiredWins !== undefined) {
    if (outcome.wins >= expectation.requiredWins) score += 15;
    else {
      score -= 15;
      met = false;
    }
  }

  score = Math.max(-100, Math.min(100, score));
  const patienceDelta = Math.round(score / 5); // -20..20

  const summary = met
    ? `Owner satisfied: ${expectation.primaryObjective.toLowerCase()} achieved.`
    : `Owner disappointed: fell short of "${expectation.primaryObjective}".`;

  return {
    teamId: expectation.teamId,
    seasonYear: expectation.seasonYear,
    primaryObjectiveMet: met,
    score,
    patienceDelta,
    summary,
  };
}

// Apply a review's patience delta to a reputation profile (clamped 0-100).
export function applyPatience(
  reputation: TeamReputation | undefined,
  expectation: TeamExpectation,
  review: ExpectationReview,
): { ownerPatience: number; reputation?: TeamReputation } {
  const base = reputation?.ownerPatience ?? expectation.ownerPatience;
  const personality = reputation?.ownerPersonality;
  const patienceMod = personality ? ownerPersonalityPatienceMod(personality) : 1;
  const adjustedDelta = Math.round(review.patienceDelta * patienceMod);
  const ownerPatience = Math.max(0, Math.min(100, base + adjustedDelta));
  return {
    ownerPatience,
    reputation: reputation ? { ...reputation, ownerPatience } : undefined,
  };
}
