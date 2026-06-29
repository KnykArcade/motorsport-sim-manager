// Commercial / sponsor engine (Living Universe Phase 3).
//
// Generates and runs a team's sponsor portfolio: annual income, per-race
// performance bonuses, season-end objective evaluation, sponsor confidence and
// offseason renewal/withdrawal. All randomness flows through the deterministic
// seeded RNG so saves replay identically. Money fields on Sponsor are in $M
// (matching the market/finance convention); callers convert with `toMoney`.

import type { Driver, Team } from '../types/gameTypes';
import type {
  CommercialState,
  Sponsor,
  SponsorBonus,
  SponsorObjective,
} from '../types/sponsorTypes';
import { createSeededRandom, deriveSeed } from './random';
import { toMoney } from './financeEngine';

// Generic, era-agnostic sponsor brand pools (no real licensing). Picked
// deterministically per team so a given save always shows the same portfolio.
const TITLE_BRANDS = [
  'Vantage Bank',
  'Helios Energy',
  'Orbit Telecom',
  'Meridian Oil',
  'Apex Logistics',
  'Crown Tobacco',
  'Nordic Air',
  'Solaris Tech',
];
const SECONDARY_BRANDS = [
  'PulseCola',
  'IronGrip Tools',
  'Cobalt Watches',
  'Velocity Tyres',
  'Strata Insurance',
  'Lumen Optics',
  'Granite Finance',
  'Riviera Resorts',
  'Quantum Chips',
  'Forge Steel',
  'Zephyr Drinks',
  'Atlas Freight',
];
const TECH_BRANDS = [
  'HydraLube',
  'SparkPlugX',
  'AeroComposites',
  'ThermoBrake',
  'DataDyne Systems',
];

// Performance-bonus templates scaled by the team's commercial tier.
function makeBonus(id: string, kind: SponsorBonus['trigger'], amount: number, threshold?: number): SponsorBonus {
  const description =
    kind === 'PerWin'
      ? `$${amount}M per race win`
      : kind === 'PerPodium'
      ? `$${amount}M per podium`
      : kind === 'PerPole'
      ? `$${amount}M per pole position`
      : kind === 'PointsThreshold'
      ? `$${amount}M for ${threshold ?? 0}+ points`
      : `$${amount}M if the title is won`;
  return { id, description, trigger: kind, threshold, amount };
}

const OBJECTIVE_TEMPLATES: Array<
  (tier: number) => Omit<SponsorObjective, 'id' | 'status'>
> = [
  () => ({
    description: 'Score championship points by midseason',
    category: 'Performance',
    deadline: 'midseason',
    reward: 1.5,
    penalty: 1,
  }),
  (tier) => ({
    description: `Finish top ${Math.max(3, 11 - tier * 2)} in the constructors`,
    category: 'Performance',
    targetValue: Math.max(3, 11 - tier * 2),
    deadline: 'seasonend',
    reward: 3,
    penalty: 2,
  }),
  () => ({
    description: 'Avoid failing to qualify all season',
    category: 'Reliability',
    deadline: 'seasonend',
    reward: 1,
    penalty: 1.5,
  }),
  () => ({
    description: 'Win at least one race',
    category: 'Marketability',
    targetValue: 1,
    deadline: 'seasonend',
    reward: 4,
    penalty: 0,
  }),
];

// 0 (backmarker) .. 4 (front-running) commercial tier from team reputation.
export function commercialTier(reputation: number): number {
  return Math.max(0, Math.min(4, Math.floor(reputation / 20)));
}

function buildSponsor(
  id: string,
  name: string,
  type: Sponsor['type'],
  annualValue: number,
  bonusTerms: SponsorBonus[],
  objectiveTemplates: Array<Omit<SponsorObjective, 'id' | 'status'>>,
  confidence: number,
  contractYearsRemaining: number,
  linkedDriverId?: string,
): Sponsor {
  return {
    id,
    name,
    type,
    annualValue: Math.round(annualValue * 10) / 10,
    bonusTerms,
    objectives: objectiveTemplates.map((o, i) => ({
      ...o,
      id: `${id}-obj-${i}`,
      status: 'Pending',
    })),
    confidence,
    contractYearsRemaining,
    renewalChance: Math.min(0.95, 0.4 + confidence / 200),
    linkedDriverId,
  };
}

// Build the initial sponsor portfolio for a team, sized by reputation and the
// strength of its lead driver. Deterministic given the same seed.
export function buildInitialCommercial(
  team: Team,
  drivers: Driver[],
  seed: string,
  series: string,
): CommercialState {
  const rng = createSeededRandom(deriveSeed(seed, 'commercial', team.id, series));
  const tier = commercialTier(team.reputation);
  const sponsors: Sponsor[] = [];

  // Title sponsor: the biggest single contributor.
  const titleValue = 6 + tier * 9 + rng.range(0, 4);
  sponsors.push(
    buildSponsor(
      `${team.id}-spn-title`,
      rng.pick(TITLE_BRANDS),
      'Title',
      titleValue,
      [makeBonus(`${team.id}-bn-title-win`, 'PerWin', 1 + tier * 0.5), makeBonus(`${team.id}-bn-title-title`, 'TitleWon', 5 + tier * 3)],
      [OBJECTIVE_TEMPLATES[1](tier), OBJECTIVE_TEMPLATES[3](tier)],
      60 + tier * 4,
      rng.int(1, 3),
    ),
  );

  // Secondary sponsors (count scales with tier).
  const secondaryCount = 2 + Math.floor(tier / 2);
  const usedSecondary = new Set<string>();
  for (let i = 0; i < secondaryCount; i++) {
    let name = rng.pick(SECONDARY_BRANDS);
    let guard = 0;
    while (usedSecondary.has(name) && guard++ < 8) name = rng.pick(SECONDARY_BRANDS);
    usedSecondary.add(name);
    const value = 1.5 + tier * 2 + rng.range(0, 2);
    sponsors.push(
      buildSponsor(
        `${team.id}-spn-sec-${i}`,
        name,
        'Secondary',
        value,
        [makeBonus(`${team.id}-bn-sec-${i}-pod`, 'PerPodium', 0.3 + tier * 0.15)],
        i === 0 ? [OBJECTIVE_TEMPLATES[0](tier)] : [],
        55 + tier * 3,
        rng.int(1, 2),
      ),
    );
  }

  // One technical partner.
  sponsors.push(
    buildSponsor(
      `${team.id}-spn-tech`,
      rng.pick(TECH_BRANDS),
      'TechnicalPartner',
      1 + tier * 1.5,
      [makeBonus(`${team.id}-bn-tech-pole`, 'PerPole', 0.2 + tier * 0.1)],
      [OBJECTIVE_TEMPLATES[2](tier)],
      58 + tier * 3,
      rng.int(2, 3),
    ),
  );

  // Driver-linked sponsor for the lead driver of strong teams.
  const lead = [...drivers].sort((a, b) => b.ratings.overall - a.ratings.overall)[0];
  if (lead && tier >= 2) {
    sponsors.push(
      buildSponsor(
        `${team.id}-spn-driver`,
        `${lead.name.split(' ').slice(-1)[0]} Personal Brand`,
        'DriverLinked',
        1 + tier,
        [makeBonus(`${team.id}-bn-driver-win`, 'PerWin', 0.5)],
        [],
        62,
        rng.int(1, 2),
        lead.id,
      ),
    );
  }

  return {
    teamId: team.id,
    sponsors,
    commercialReputation: Math.round(team.reputation * 0.6 + tier * 8),
  };
}

// Total guaranteed annual sponsorship income in raw dollars.
export function sponsorAnnualIncome(commercial: CommercialState | undefined): number {
  if (!commercial) return 0;
  return commercial.sponsors.reduce((sum, s) => sum + toMoney(s.annualValue), 0);
}

export type RaceCommercialContext = {
  wins: number; // player-team race wins this round (0-2)
  podiums: number; // player-team podiums this round
  poles: number; // player-team poles this round
};

export type CommercialPayout = {
  sponsorId: string;
  sponsorName: string;
  label: string;
  amount: number; // raw dollars
};

// Performance bonuses earned in a single race weekend, in raw dollars.
export function racePerformanceBonuses(
  commercial: CommercialState | undefined,
  ctx: RaceCommercialContext,
): CommercialPayout[] {
  if (!commercial) return [];
  const payouts: CommercialPayout[] = [];
  for (const s of commercial.sponsors) {
    for (const b of s.bonusTerms) {
      let count = 0;
      if (b.trigger === 'PerWin') count = ctx.wins;
      else if (b.trigger === 'PerPodium') count = ctx.podiums;
      else if (b.trigger === 'PerPole') count = ctx.poles;
      if (count > 0) {
        payouts.push({
          sponsorId: s.id,
          sponsorName: s.name,
          label: `${s.name}: ${b.description}`,
          amount: toMoney(b.amount * count),
        });
      }
    }
  }
  return payouts;
}

export type SeasonCommercialContext = {
  constructorPosition: number; // final position (1 = best)
  points: number;
  wins: number;
  failedToQualify: boolean;
};

// Evaluate each sponsor objective at season end, returning the updated sponsors,
// the net reward/penalty (raw dollars), confidence movement and a summary line
// per resolved objective.
export function evaluateSeasonObjectives(
  commercial: CommercialState,
  ctx: SeasonCommercialContext,
): { sponsors: Sponsor[]; payouts: CommercialPayout[]; notes: string[] } {
  const payouts: CommercialPayout[] = [];
  const notes: string[] = [];

  const sponsors = commercial.sponsors.map((s) => {
    let confidence = s.confidence;
    const objectives = s.objectives.map((o) => {
      if (o.status && o.status !== 'Pending') return o;
      const met = objectiveMet(o, ctx);
      if (met) {
        confidence = Math.min(100, confidence + 6);
        if (o.reward) {
          payouts.push({ sponsorId: s.id, sponsorName: s.name, label: `${s.name}: ${o.description} ✓`, amount: toMoney(o.reward) });
        }
        notes.push(`${s.name} objective met: ${o.description}.`);
        return { ...o, status: 'Met' as const };
      }
      confidence = Math.max(0, confidence - 10);
      if (o.penalty) {
        payouts.push({ sponsorId: s.id, sponsorName: s.name, label: `${s.name}: missed "${o.description}"`, amount: -toMoney(o.penalty) });
      }
      notes.push(`${s.name} objective missed: ${o.description}.`);
      return { ...o, status: 'Failed' as const };
    });
    return { ...s, confidence, objectives };
  });

  return { sponsors, payouts, notes };
}

function objectiveMet(o: SponsorObjective, ctx: SeasonCommercialContext): boolean {
  switch (o.category) {
    case 'Performance':
      // Constructors-position target, else "score points".
      if (o.targetValue) return ctx.constructorPosition <= o.targetValue;
      return ctx.points > 0;
    case 'Reliability':
      return !ctx.failedToQualify;
    case 'Marketability':
      return ctx.wins >= (o.targetValue ?? 1);
    default:
      return ctx.points > 0;
  }
}

// Offseason renewal: decrement contracts, drop sponsors whose deal expired and
// who decline to renew (low confidence => low chance), and reset objectives for
// the new season. Deterministic given the seed. Returns the new commercial plus
// notes describing departures/renewals.
export function rollSponsorRenewals(
  commercial: CommercialState,
  team: Team,
  seed: string,
  nextYear: number,
): { commercial: CommercialState; notes: string[] } {
  const rng = createSeededRandom(deriveSeed(seed, 'sponsor-renewal', team.id, nextYear));
  const notes: string[] = [];
  const kept: Sponsor[] = [];

  for (const s of commercial.sponsors) {
    const years = s.contractYearsRemaining - 1;
    if (years > 0) {
      kept.push({ ...s, contractYearsRemaining: years, objectives: resetObjectives(s.objectives) });
      continue;
    }
    // Contract up: renewal chance blends the base chance with confidence.
    const chance = Math.min(0.97, s.renewalChance * 0.5 + s.confidence / 150);
    if (rng.chance(chance)) {
      kept.push({
        ...s,
        contractYearsRemaining: rng.int(1, 3),
        confidence: Math.min(100, s.confidence + 4),
        renewalChance: Math.min(0.95, 0.4 + s.confidence / 200),
        objectives: resetObjectives(s.objectives),
      });
      notes.push(`${s.name} renewed their ${s.type.toLowerCase()} deal.`);
    } else {
      notes.push(`${s.name} declined to renew and will leave the team.`);
    }
  }

  // If the title slot is empty, court a replacement title sponsor.
  if (!kept.some((s) => s.type === 'Title')) {
    const tier = commercialTier(team.reputation);
    const replacement = buildSponsor(
      `${team.id}-spn-title-${nextYear}`,
      rng.pick(TITLE_BRANDS),
      'Title',
      5 + tier * 8 + rng.range(0, 3),
      [makeBonus(`${team.id}-bn-title-win-${nextYear}`, 'PerWin', 1 + tier * 0.5)],
      [OBJECTIVE_TEMPLATES[1](tier)],
      55 + tier * 3,
      rng.int(1, 3),
    );
    kept.push(replacement);
    notes.push(`${replacement.name} signed on as the new title sponsor.`);
  }

  return {
    commercial: {
      ...commercial,
      sponsors: kept,
      commercialReputation: Math.round(team.reputation * 0.6 + commercialTier(team.reputation) * 8),
    },
    notes,
  };
}

function resetObjectives(objectives: SponsorObjective[]): SponsorObjective[] {
  return objectives.map((o) => ({ ...o, status: 'Pending' }));
}

// Average sponsor confidence (0-100), used for UI and reputation feedback.
export function averageSponsorConfidence(commercial: CommercialState | undefined): number {
  if (!commercial || commercial.sponsors.length === 0) return 0;
  return Math.round(
    commercial.sponsors.reduce((sum, s) => sum + s.confidence, 0) / commercial.sponsors.length,
  );
}
