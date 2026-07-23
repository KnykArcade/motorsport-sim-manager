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
  SponsorRelationshipStatus,
  SponsorReview,
} from '../types/sponsorTypes';
import { createSeededRandom, deriveSeed } from './random';
import { toMoney } from './financeEngine';

// Round a $M value to whole cents, avoiding binary-float display noise.
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

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
function makeBonus(id: string, kind: SponsorBonus['trigger'], rawAmount: number, threshold?: number): SponsorBonus {
  // Tier scaling (e.g. 0.3 + tier * 0.15) introduces float noise like
  // 0.44999999999999996, so round to whole cents of a $M before storing/showing.
  const amount = round2(rawAmount);
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
    relationshipStatus: confidence >= 70 ? 'Secure' : 'Monitoring',
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

export type CommercialPayout = {
  sponsorId: string;
  sponsorName: string;
  label: string;
  amount: number; // raw dollars
};

// Per-race sponsor installment: 75% of annual income divided across the season's
// races. The other 25% is paid upfront at season rollover.
export function sponsorInstallmentPayment(
  commercial: CommercialState | undefined,
  totalRaces: number,
): CommercialPayout[] {
  if (!commercial || totalRaces <= 0) return [];
  const perRace = commercial.sponsors.reduce(
    (sum, s) => sum + toMoney(s.annualValue) / totalRaces,
    0,
  ) * 0.75;
  if (perRace <= 0) return [];
  return [{
    sponsorId: 'installment',
    sponsorName: 'Sponsor Installments',
    label: 'Sponsor installment payment',
    amount: Math.round(perRace),
  }];
}

export type RaceCommercialContext = {
  wins: number; // player-team race wins this round (0-2)
  podiums: number; // player-team podiums this round
  poles: number; // player-team poles this round
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

export type RoundCommercialContext = SeasonCommercialContext & {
  round: number;
  totalRounds: number;
  teamRaceResults: number;
  expectedEntries: number;
  reliabilityDnfs: number;
  withdrawnOrMissingEntries: number;
  linkedDriverResults?: Record<string, { raced: boolean; finished: boolean; points: number }>;
  publicControversies?: number;
};

export type RoundCommercialReview = {
  commercial: CommercialState;
  payouts: CommercialPayout[];
  reviews: SponsorReview[];
};

function relationshipStatus(confidence: number): SponsorRelationshipStatus {
  if (confidence <= 20) return 'Breach';
  if (confidence <= 40) return 'Warning';
  if (confidence <= 65) return 'Monitoring';
  return 'Secure';
}

export function objectiveDeadlineRound(objective: SponsorObjective, totalRounds: number): number {
  if (objective.deadlineRound) return Math.max(1, Math.min(totalRounds, objective.deadlineRound));
  return objective.deadline === 'midseason' ? Math.ceil(totalRounds / 2) : totalRounds;
}

function objectiveProgress(
  objective: SponsorObjective,
  ctx: SeasonCommercialContext,
): { value: number; label: string } {
  if (objective.category === 'Performance' && objective.targetValue) {
    return { value: ctx.constructorPosition, label: `P${ctx.constructorPosition} / target P${objective.targetValue}` };
  }
  if (objective.category === 'Performance') return { value: ctx.points, label: `${ctx.points} championship points` };
  if (objective.category === 'Reliability') return { value: ctx.failedToQualify ? 0 : 1, label: ctx.failedToQualify ? 'Qualification failure recorded' : 'No qualification failures' };
  if (objective.category === 'Marketability') return { value: ctx.wins, label: `${ctx.wins} / ${objective.targetValue ?? 1} wins` };
  return { value: ctx.points, label: `${ctx.points} championship points` };
}

function sponsorEvidenceDelta(sponsor: Sponsor, ctx: RoundCommercialContext): number {
  let delta = 0;
  const positionTarget = sponsor.objectives.find((objective) => objective.category === 'Performance' && objective.targetValue && (objective.status ?? 'Pending') === 'Pending')?.targetValue;
  if (positionTarget) delta += ctx.constructorPosition <= positionTarget ? 1 : -1;
  if (ctx.reliabilityDnfs > 0) delta -= Math.min(4, ctx.reliabilityDnfs * 2);
  if (ctx.withdrawnOrMissingEntries > 0) delta -= Math.min(8, ctx.withdrawnOrMissingEntries * 4);
  if (ctx.publicControversies) delta -= Math.min(5, ctx.publicControversies * 2);
  if (sponsor.linkedDriverId) {
    const linked = ctx.linkedDriverResults?.[sponsor.linkedDriverId];
    if (!linked?.raced) delta -= 4;
    else if (linked.points > 0) delta += 2;
    else if (!linked.finished) delta -= 2;
  }
  return delta;
}

function canResolveEarly(objective: SponsorObjective): boolean {
  // Only cumulative achievements are irreversible before their deadline.
  // Championship position and season-long reliability must remain open until
  // the specified review round because later races can still change them.
  return (objective.category === 'Performance' && !objective.targetValue)
    || objective.category === 'Marketability';
}

// Evaluate sponsor relationships after every championship round. Objectives can
// complete early, while failures resolve only once their real round deadline is
// reached. This makes repeat calls idempotent and keeps old saves compatible.
export function evaluateRoundSponsorObjectives(
  commercial: CommercialState,
  ctx: RoundCommercialContext,
): RoundCommercialReview {
  const payouts: CommercialPayout[] = [];
  const reviews: SponsorReview[] = [];
  const sponsors = commercial.sponsors.map((sponsor) => {
    let confidence = sponsor.confidence;
    const evidenceDelta = sponsorEvidenceDelta(sponsor, ctx);
    if (evidenceDelta !== 0) confidence = Math.max(0, Math.min(100, confidence + evidenceDelta));
    const objectives = sponsor.objectives.map((objective) => {
      let workingObjective = objective;
      if (
        ctx.round === Math.ceil(ctx.totalRounds / 2)
        && (objective.status ?? 'Pending') === 'Pending'
        && objective.category === 'Performance'
        && objective.targetValue
        && objective.deadline === 'seasonend'
        && objective.originalTargetValue === undefined
      ) {
        const revisedTarget = ctx.constructorPosition <= objective.targetValue - 2
          ? Math.max(1, objective.targetValue - 1)
          : ctx.constructorPosition >= objective.targetValue + 3 && sponsor.confidence >= 45
            ? Math.min(objective.targetValue + 1, ctx.constructorPosition - 1)
            : objective.targetValue;
        if (revisedTarget !== objective.targetValue) {
          const revisionNote = revisedTarget < objective.targetValue
            ? `Strong results raised the target from P${objective.targetValue} to P${revisedTarget}.`
            : `The midseason review revised the target from P${objective.targetValue} to P${revisedTarget}.`;
          workingObjective = {
            ...objective,
            originalTargetValue: objective.targetValue,
            targetValue: revisedTarget,
            description: objective.description.replace(/top \d+/, `top ${revisedTarget}`),
            revisionNote,
          };
          reviews.push({ id: `${sponsor.id}-${objective.id}-revised-r${ctx.round}`, sponsorId: sponsor.id, round: ctx.round, kind: 'Revision', headline: `${sponsor.name} revises its season expectation`, detail: revisionNote, confidenceDelta: 0 });
        }
      }
      const deadlineRound = objectiveDeadlineRound(workingObjective, ctx.totalRounds);
      const progress = objectiveProgress(workingObjective, ctx);
      if (workingObjective.status && workingObjective.status !== 'Pending') {
        return { ...workingObjective, deadlineRound, progressValue: progress.value, progressLabel: progress.label };
      }
      const met = objectiveMet(workingObjective, ctx);
      if (met && (ctx.round >= deadlineRound || canResolveEarly(workingObjective))) {
        confidence = Math.min(100, confidence + 6);
        if (workingObjective.reward) payouts.push({ sponsorId: sponsor.id, sponsorName: sponsor.name, label: `${sponsor.name}: ${workingObjective.description} completed`, amount: toMoney(workingObjective.reward) });
        reviews.push({ id: `${sponsor.id}-${workingObjective.id}-met-r${ctx.round}`, sponsorId: sponsor.id, round: ctx.round, kind: 'Progress', headline: `${sponsor.name} objective completed`, detail: `${workingObjective.description}. ${progress.label}.`, confidenceDelta: 6 });
        return { ...workingObjective, deadlineRound, progressValue: progress.value, progressLabel: progress.label, lastReviewedRound: ctx.round, resolvedRound: ctx.round, status: 'Met' as const };
      }
      if (ctx.round >= deadlineRound) {
        confidence = Math.max(0, confidence - 10);
        if (workingObjective.penalty) payouts.push({ sponsorId: sponsor.id, sponsorName: sponsor.name, label: `${sponsor.name}: missed "${workingObjective.description}"`, amount: -toMoney(workingObjective.penalty) });
        reviews.push({ id: `${sponsor.id}-${workingObjective.id}-failed-r${ctx.round}`, sponsorId: sponsor.id, round: ctx.round, kind: 'Deadline', headline: `${sponsor.name} objective missed`, detail: `${workingObjective.description}. Deadline was round ${deadlineRound}; ${progress.label}.`, confidenceDelta: -10 });
        return { ...workingObjective, deadlineRound, progressValue: progress.value, progressLabel: progress.label, lastReviewedRound: ctx.round, resolvedRound: ctx.round, status: 'Failed' as const };
      }
      if (ctx.round === Math.ceil(ctx.totalRounds / 2)) {
        reviews.push({ id: `${sponsor.id}-${workingObjective.id}-mid-r${ctx.round}`, sponsorId: sponsor.id, round: ctx.round, kind: 'Midseason', headline: `${sponsor.name} midseason review`, detail: `${workingObjective.description}: ${progress.label}. Deadline round ${deadlineRound}.`, confidenceDelta: 0 });
      }
      return { ...workingObjective, deadlineRound, progressValue: progress.value, progressLabel: progress.label, lastReviewedRound: ctx.round };
    });
    const previousStatus = sponsor.relationshipStatus ?? relationshipStatus(sponsor.confidence);
    const nextStatus = relationshipStatus(confidence);
    if ((nextStatus === 'Warning' || nextStatus === 'Breach') && nextStatus !== previousStatus) {
      reviews.push({ id: `${sponsor.id}-${nextStatus.toLowerCase()}-r${ctx.round}`, sponsorId: sponsor.id, round: ctx.round, kind: nextStatus, headline: nextStatus === 'Breach' ? `${sponsor.name} issues breach notice` : `${sponsor.name} warns the team`, detail: nextStatus === 'Breach' ? 'The commercial relationship is at immediate risk after unmet expectations and recent team performance.' : 'Sponsor confidence has fallen into a formal warning range.', confidenceDelta: confidence - sponsor.confidence });
    }
    return { ...sponsor, confidence, objectives, relationshipStatus: nextStatus, lastReviewRound: ctx.round, renewalChance: Math.min(0.95, 0.4 + confidence / 200) };
  });
  return { commercial: { ...commercial, sponsors, reviews: [...(commercial.reviews ?? []), ...reviews].slice(-100) }, payouts, reviews };
}

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
    const chance = sponsorRenewalProbability(s);
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

export function sponsorRenewalProbability(
  sponsor: Pick<Sponsor, 'renewalChance' | 'confidence'>,
): number {
  return Math.min(0.97, sponsor.renewalChance * 0.5 + sponsor.confidence / 150);
}

function resetObjectives(objectives: SponsorObjective[]): SponsorObjective[] {
  return objectives.map((o) => ({ ...o, status: 'Pending', deadlineRound: undefined, progressValue: undefined, progressLabel: undefined, lastReviewedRound: undefined, resolvedRound: undefined, originalTargetValue: undefined, revisionNote: undefined }));
}

// How many sponsor slots a team can hold at once, sized by commercial tier so a
// front-running team can carry a deeper portfolio than a backmarker. 4 .. 8.
export function sponsorSlotCapacity(team: Team): number {
  return 4 + commercialTier(team.reputation);
}

// Generate the pool of sponsor deals on offer to the player during the
// offseason. Deterministic per (seed, team, year). A title deal is offered only
// when the title slot is open; values scale with commercial tier. Deals already
// in the portfolio are excluded so signed offers disappear from the pool.
export function generateSponsorOffers(
  team: Team,
  commercial: CommercialState | undefined,
  seed: string,
  year: number,
  series: string,
): Sponsor[] {
  const rng = createSeededRandom(deriveSeed(seed, 'sponsor-offers', team.id, year, series));
  const tier = commercialTier(team.reputation);
  const current = commercial?.sponsors ?? [];
  const usedNames = new Set(current.map((s) => s.name));
  const signedIds = new Set(current.map((s) => s.id));

  const pickUnique = (pool: string[]): string => {
    let n = rng.pick(pool);
    let guard = 0;
    while (usedNames.has(n) && guard++ < 12) n = rng.pick(pool);
    usedNames.add(n);
    return n;
  };

  const offers: Sponsor[] = [];

  // A title deal only when that slot is empty (you can't run two title sponsors).
  if (!current.some((s) => s.type === 'Title')) {
    offers.push(
      buildSponsor(
        `${team.id}-offer-${year}-title`,
        pickUnique(TITLE_BRANDS),
        'Title',
        5 + tier * 8 + rng.range(0, 3),
        [makeBonus(`${team.id}-offer-${year}-title-win`, 'PerWin', 1 + tier * 0.5)],
        [OBJECTIVE_TEMPLATES[1](tier)],
        55 + tier * 3,
        rng.int(2, 3),
      ),
    );
  }

  for (let i = 0; i < 2; i++) {
    offers.push(
      buildSponsor(
        `${team.id}-offer-${year}-sec-${i}`,
        pickUnique(SECONDARY_BRANDS),
        'Secondary',
        1.5 + tier * 2 + rng.range(0, 2),
        [makeBonus(`${team.id}-offer-${year}-sec-${i}-pod`, 'PerPodium', 0.3 + tier * 0.15)],
        i === 0 ? [OBJECTIVE_TEMPLATES[0](tier)] : [],
        52 + tier * 3,
        rng.int(1, 3),
      ),
    );
  }

  offers.push(
    buildSponsor(
      `${team.id}-offer-${year}-tech`,
      pickUnique(TECH_BRANDS),
      'TechnicalPartner',
      1 + tier * 1.5,
      [makeBonus(`${team.id}-offer-${year}-tech-pole`, 'PerPole', 0.2 + tier * 0.1)],
      [OBJECTIVE_TEMPLATES[2](tier)],
      55 + tier * 3,
      rng.int(2, 3),
    ),
  );

  return offers.filter((o) => !signedIds.has(o.id));
}

// Average sponsor confidence (0-100), used for UI and reputation feedback.
export function averageSponsorConfidence(commercial: CommercialState | undefined): number {
  if (!commercial || commercial.sponsors.length === 0) return 0;
  return Math.round(
    commercial.sponsors.reduce((sum, s) => sum + s.confidence, 0) / commercial.sponsors.length,
  );
}
