// Team Principal job market (Living Universe Phase 1 — types only).
//
// The player is a Team Principal with their own reputation, contract, job
// security and career record. Over a long career they can be approached, sacked,
// renewed, or move between teams — turning the game into a manager career.

export type PrincipalCareerStats = {
  seasonsCompleted: number;
  raceWins: number;
  podiums: number;
  driverTitles: number;
  constructorTitles: number;
  teamsManaged: string[]; // teamIds, in order
};

// Skill/standing ratings for the principal (0-100 unless noted).
export type PrincipalAttributes = {
  mediaImage: number;
  boardConfidence: number;
  financialDiscipline: number;
  driverManagement: number;
  development: number;
  strategy: number;
};

export type TeamPrincipalProfile = {
  id: string;
  name: string;
  reputation: number; // 0-100
  currentTeamId: string;
  contractYearsRemaining: number;
  jobSecurity: number; // 0-100
  attributes: PrincipalAttributes;
  careerStats: PrincipalCareerStats;
  xp: number;
  level: number;
  // Skill progression system.
  skillPoints: number; // unspent points available for allocation
  spentSkillPoints: Partial<Record<keyof PrincipalAttributes, number>>;
};

// ---------------------------------------------------------------------------
// Team Principal Creator ("Paddock Credentials") — Career Mode Phase 1.
//
// The player-created manager identity, set up before entering a save. The
// background and management-style choices produce small gameplay modifiers; the
// derived 0-100 trait scores below feed those modifiers and future systems.
// ---------------------------------------------------------------------------

export type TeamPrincipal = {
  id: string;
  name: string;
  startingLevel?: 'rookie' | 'veteran' | 'superstar';
  traitPointBudget?: number;
  nationality?: string;
  age?: number;
  background: string;
  managementStyle: string;
  primaryStrength: string;
  secondaryStrength: string;
  weakness: string;
  mediaPersonality: string;
  driverManagementStyle: string;
  developmentPhilosophy: string;
  raceStrategyPhilosophy: string;
  // Derived 0-100 trait scores.
  riskTolerance: number;
  driverManagement: number;
  developmentFocus: number;
  raceStrategy: number;
  commercialSkill: number;
  politicalSkill: number;
  reputation: number;
  // Creation-time allocation; carried into the career as available Principal Points.
  skillAttributes?: PrincipalAttributes;
  skillPoints?: number;
};

// Named gameplay modifiers a principal's choices contribute. Each value is a
// small signed fraction (e.g. +0.06 = +6%). Used for the creator's preview and,
// in later phases, applied to the relevant subsystems.
export type PrincipalModifierKey =
  | 'driverMorale'
  | 'driverDevelopment'
  | 'research'
  | 'setupFeedback'
  | 'sponsorNegotiation'
  | 'budgetManagement'
  | 'raceStrategy'
  | 'reliabilityDiagnosis'
  | 'mediaHandling'
  | 'marketing'
  | 'academyDevelopment'
  | 'youngDriverInterest'
  | 'veteranDriverAppeal'
  | 'inRaceDecisions'
  | 'commercialSkill'
  | 'politicalInfluence';

export type PrincipalModifiers = Partial<Record<PrincipalModifierKey, number>>;

// A job approach/offer from another team in the universe.
export type JobOffer = {
  id: string;
  teamId: string;
  seasonYear: number;
  contractYears: number;
  // Stated remit & resources, used to evaluate the offer.
  objective: string;
  prestige: number; // 0-100
  budgetTier: string;
  // Whether this is a firm offer or an informal rumor/approach.
  kind: 'Offer' | 'Rumor';
  expiresSeasonYear: number;
};

// ---------------------------------------------------------------------------
// Credential Tiers — milestone-based progression labels.
// ---------------------------------------------------------------------------

export type CredentialTier =
  | 'Rookie'
  | 'Established'
  | 'Respected'
  | 'Renowned'
  | 'Legendary';

export type CredentialTierInfo = {
  tier: CredentialTier;
  minLevel: number;
  minReputation: number;
  label: string;
  description: string;
};

export const CREDENTIAL_TIERS: CredentialTierInfo[] = [
  { tier: 'Rookie', minLevel: 1, minReputation: 0, label: 'Rookie', description: 'A new face in the paddock, earning their stripes.' },
  { tier: 'Established', minLevel: 4, minReputation: 30, label: 'Established', description: 'A proven manager with a track record.' },
  { tier: 'Respected', minLevel: 7, minReputation: 50, label: 'Respected', description: 'A well-regarded principal with real pull.' },
  { tier: 'Renowned', minLevel: 10, minReputation: 70, label: 'Renowned', description: 'A paddock heavyweight courted by top teams.' },
  { tier: 'Legendary', minLevel: 14, minReputation: 85, label: 'Legendary', description: 'One of the greats — a household name in motorsport.' },
];
