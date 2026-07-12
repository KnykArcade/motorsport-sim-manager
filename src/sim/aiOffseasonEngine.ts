// AI offseason actions — Career Mode Phase D.
//
// Consumes the AI management brain from Phase C (archetype, budget, financial
// health, goal) and makes each non-player team actually *act* during the
// offseason: run car development, work the driver market (fill/renew/release/
// sign race + reserve drivers), sign & promote youth academy prospects (with
// first option at 18), and make light staff/sponsor/engine adjustments — all
// budget-limited and personality-driven. Every move is surfaced as a rollover
// summary note + news item so the paddock visibly comes alive.
//
// Pure & deterministic: given the same inputs it produces the same moves.

import type {
  Car,
  CarRatings,
  Driver,
  DriverRatings,
  RegulationChangeEvent,
  StandingsEntry,
  Team,
  ProjectRiskLevel,
} from '../types/gameTypes';
import type { EngineState } from '../types/engineTypes';
import type { TeamOrganizationRatings } from '../types/teamRatingsTypes';
import type { AcademyMember, MarketDriver, YouthProspect } from '../types/marketTypes';
import type { AITeamState } from '../types/aiTeamTypes';
import type { PrincipalAttributes } from '../types/principalTypes';
import type { MarketBundle } from '../data/market';
import { MILLION, toMoney } from './financeEngine';
import { carPerformanceRating } from './trackFitEngine';
import {
  academyMemberAge,
  academyMemberToDriver,
  academyMemberToReserveDriver,
  marketDriverToDriver,
  progressAcademyMember,
  signProspectToAcademy,
} from './driverMarketEngine';
import {
  aiFirstOptionDecision,
  academyRightsExpired,
  isPromotionEligible,
  openFirstOptionWindow,
} from './youthAcademyEngine';
import { calculateAcademyCapacity } from './teamRatingsEngine';
import {
  applyOffseasonDecay,
  catchUpMultiplier,
  diminishingGainMultiplier,
  nearCapFailureChance,
  rollOutcome,
  OUTCOME_GAIN_MULTIPLIERS,
} from './developmentEngine';
import { aiFacilityLevel, facilityOutcomeChances, facilityImpactMultiplier } from './facilityEngine';
import { ARCHETYPE_SPECS } from './aiTeamEngine';
import { weightedDevTarget, effectiveRisk, marketMod } from './teamIdentityEngine';
import { createSeededRandom, deriveSeed, type Rng } from './random';
import { getStaffPool } from '../data';
import type { StaffRole } from '../types/staffTypes';

export type AIOffseasonInput = {
  nextYear: number;
  seed: string;
  selectedTeamId: string;
  teams: Team[];
  drivers: Driver[];
  cars: Car[];
  engine?: EngineState;
  aiTeamStates: Record<string, AITeamState>;
  aiPrincipals?: Record<string, { attributes?: PrincipalAttributes }>;
  aiAcademies: Record<string, AcademyMember[]>;
  orgRatings: Record<string, TeamOrganizationRatings>;
  market: MarketBundle;
  signedMarketIds: string[];
  // Identities to leave alone (player grid + player academy) so the AI never
  // poaches a name the player already controls.
  reservedNames: Set<string>;
  constructorStandings: StandingsEntry[];
  // 0 (stable regulations) .. 1 (major regulation shakeup) for the upcoming
  // season. Drives offseason car decay/reshuffle and carryover reduction.
  regulationShakeup?: number;
  regulationAffectedAreas?: RegulationChangeEvent['affectedAreas'];
  series?: string;
};

export type AIOffseasonResult = {
  teams: Team[];
  drivers: Driver[];
  cars: Car[];
  engine?: EngineState;
  aiAcademies: Record<string, AcademyMember[]>;
  orgRatings: Record<string, TeamOrganizationRatings>;
  signedMarketIds: string[];
  notes: string[];
  news: { headline: string; body?: string }[];
};

const clamp10 = (n: number) => Math.max(1, Math.min(100, Math.round(n)));
const clamp100 = (n: number) => Math.max(1, Math.min(100, Math.round(n)));
const norm = (name: string) => name.trim().toLowerCase();

// The overall rating a team aspires to field, from its goal/archetype. Drives
// how demanding it is in the driver market.
function targetDriverOverall(ai: AITeamState): number {
  switch (ai.goal) {
    case 'TitleChallenge':
      return 84;
    case 'Podiums':
      return 72;
    case 'PointsFinish':
      return 68;
    case 'MidfieldImprovement':
      return 60;
    case 'YouthDevelopment':
      return 62;
    case 'Survival':
      return 52;
  }
}

// Cash a team is willing to commit this offseason above its reserve target.
function spendableCash(team: Team, ai: AITeamState): number {
  return Math.max(0, team.budget - ai.budget.reserveTarget);
}

// --- Development -------------------------------------------------------------

const CAR_AREA_LABELS: Record<keyof CarRatings, string> = {
  enginePower: 'engine',
  aeroEfficiency: 'aero',
  mechanicalGrip: 'mechanical grip',
  reliability: 'reliability',
  pitCrewOperations: 'pit-crew',
};

// Run one AI team's offseason car development. Uses the new facility-based
// outcome system: facility level (from org ratings) + archetype risk determine
// outcome chances, and the outcome determines gain magnitude. Returns the
// updated car + a note, or null when the team can't afford any meaningful
// development.
function developCar(
  car: Car,
  team: Team,
  ai: AITeamState,
  hadReliabilityProblem: boolean,
  fieldTopRating: number,
  rng: Rng,
  org: TeamOrganizationRatings | undefined,
  regulationAffectedAreas: RegulationChangeEvent['affectedAreas'] | undefined,
  principalAttributes: PrincipalAttributes | undefined,
): { car: Car; note: string } | null {
  const spec = ARCHETYPE_SPECS[ai.archetype];
  const budget = ai.budget.developmentSpend;
  if (budget < toMoney(1)) return null;

  // Determine facility level from org ratings.
  const facLevel = aiFacilityLevel(
    org?.staffQuality ?? 45,
    org?.research ?? 45,
  );

  // Map archetype risk to ProjectRiskLevel, adjusted by philosophy traits.
  const traitRisk = effectiveRisk(ai.philosophy?.traits, spec.risk);
  const riskLevel: ProjectRiskLevel =
    traitRisk >= 0.8 ? 'Experimental'
    : traitRisk >= 0.55 ? 'Aggressive'
    : traitRisk >= 0.3 ? 'Standard'
    : 'Safe';

  // Roll outcome using the facility-based chance table.
  const chances = facilityOutcomeChances(facLevel, riskLevel);
  const outcome = rollOutcome(rng, chances);
  const gainMultiplier = OUTCOME_GAIN_MULTIPLIERS[outcome];
  const impactMult = facilityImpactMultiplier(facLevel);

  const target = weightedDevTarget(
    car,
    hadReliabilityProblem,
    ai.philosophy?.traits,
    regulationAffectedAreas,
  );
  const current = car.ratings[target];

  // Base gain scales with spend and risk appetite.
  const budgetM = budget / MILLION;
  const principalMultiplier = principalAttributes
    ? 1 + (principalAttributes.development - 50) / 500
    : 1;
  const base = Math.min(0.9, (0.12 + budgetM * 0.012 + traitRisk * 0.25) * principalMultiplier);

  let gain = base * gainMultiplier * impactMult * (0.7 + rng.next() * 0.6);

  // Diminishing returns: gains get progressively harder near the ceiling.
  gain *= diminishingGainMultiplier(current);
  // Catch-up efficiency: a car well below the front of the grid improves more.
  gain *= catchUpMultiplier(fieldTopRating - carPerformanceRating(car));

  // Near the cap even good projects often miss.
  const failChance = nearCapFailureChance(current);
  if (failChance > 0 && rng.chance(failChance) && outcome !== 'GreatSuccess') {
    if (car.ratings.reliability < 90 && target !== 'reliability') {
      const reliGain = clampGain(0.05 + rng.next() * 0.1);
      const ratings: CarRatings = {
        ...car.ratings,
        reliability: clamp10(car.ratings.reliability + reliGain * 10),
      };
      return {
        car: { ...car, ratings },
        note: `${team.name}'s ${CAR_AREA_LABELS[target]} package stalls near the limit — gains come only in reliability.`,
      };
    }
    return null;
  }

  gain = clampGain(gain);
  if (gain < 0.05 && outcome !== 'RareBackfire') return null;

  // RareBackfire: small setback in the targeted area.
  if (outcome === 'RareBackfire') {
    const penalty = clampGain(Math.min(0.3, Math.abs(gain)));
    const ratings: CarRatings = { ...car.ratings, [target]: clamp10(current - penalty * 10) };
    return {
      car: { ...car, ratings },
      note: `${team.name}'s ${CAR_AREA_LABELS[target]} development backfires — a setback.`,
    };
  }

  const ratings: CarRatings = { ...car.ratings, [target]: clamp10(current + gain * 10) };
  const scale = gain >= 0.4 ? 'a major' : gain >= 0.2 ? 'a' : 'a minor';
  const outcomeTag = outcome === 'GreatSuccess' ? ' — breakthrough!' : outcome === 'Failed' ? ' — minimal gains.' : '';
  const note = `${team.name} completes ${scale} ${CAR_AREA_LABELS[target]} development package${outcomeTag}`;
  return { car: { ...car, ratings }, note };
}

function clampGain(g: number): number {
  return Math.max(0, Math.min(0.8, Math.round(g * 100) / 100));
}

// --- Driver market -----------------------------------------------------------

// Score a market driver for a team: rating-led, with a pay-driver team valuing
// sponsor money and a youth-focused team valuing upside.
function evaluateCandidate(m: MarketDriver, ai: AITeamState): number {
  const spec = ARCHETYPE_SPECS[ai.archetype];
  const traitMod = marketMod(ai.philosophy?.traits);
  return (
    m.overall +
    (spec.payDriverBias + traitMod.payDriverBias) * (m.sponsorValue * 0.15) +
    (spec.youthBias + traitMod.youthBias) * (m.potential - m.overall) * 0.3 +
    traitMod.potentialBias * (m.potential - m.overall) * 0.2 +
    traitMod.overallBias * m.overall * 0.05
  );
}

// The effective cost of signing a market driver (buyout + first-year salary),
// discounted by any sponsor money they bring for a pay-driver team.
function signingCost(m: MarketDriver, ai: AITeamState): number {
  const spec = ARCHETYPE_SPECS[ai.archetype];
  const gross = toMoney(m.buyoutCost + m.salary);
  const sponsorOffset = toMoney(m.sponsorValue) * spec.payDriverBias;
  return Math.max(0, Math.round(gross - sponsorOffset));
}

type MarketCtx = {
  available: MarketDriver[]; // mutable pool (drivers removed as signed)
  taken: Set<string>; // market ids removed
  takenNames: Set<string>; // identity names removed / reserved
};

// Best affordable candidate at or above a rating floor.
function bestCandidate(
  ctx: MarketCtx,
  ai: AITeamState,
  cash: number,
  minOverall: number,
  maxOverall = Infinity,
): MarketDriver | undefined {
  let best: MarketDriver | undefined;
  let bestScore = -Infinity;
  for (const m of ctx.available) {
    if (ctx.taken.has(m.id) || ctx.takenNames.has(norm(m.name))) continue;
    if (m.overall < minOverall) continue;
    if (m.overall > maxOverall) continue;
    if (signingCost(m, ai) > cash) continue;
    const score = evaluateCandidate(m, ai);
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

// The cheapest still-available candidate, ignoring the team's cash. Used as a
// last resort to fill an empty race seat so no AI team ever starts a season a
// car short — a broke team takes a cheap pay driver rather than run one car.
function cheapestCandidate(ctx: MarketCtx, ai: AITeamState): MarketDriver | undefined {
  let cheapest: MarketDriver | undefined;
  let bestCost = Infinity;
  for (const m of ctx.available) {
    if (ctx.taken.has(m.id) || ctx.takenNames.has(norm(m.name))) continue;
    const cost = signingCost(m, ai);
    if (cost < bestCost) {
      bestCost = cost;
      cheapest = m;
    }
  }
  return cheapest;
}

// --- Main entry --------------------------------------------------------------

export function runAIOffseason(input: AIOffseasonInput): AIOffseasonResult {
  const teams = input.teams.map((t) => ({ ...t }));
  let drivers = input.drivers.map((d) => ({ ...d }));
  const cars = input.cars.map((c) => ({ ...c }));
  const carByTeam = new Map(cars.map((c) => [c.teamId, c]));
  const aiAcademies: Record<string, AcademyMember[]> = {};
  const orgRatings: Record<string, TeamOrganizationRatings> = { ...input.orgRatings };
  const signedMarketIds = [...input.signedMarketIds];
  const notes: string[] = [];
  const news: { headline: string; body?: string }[] = [];

  // Reliability problems from the finished season: teams with many DNFs.
  const reliabilityProblem = new Set<string>();
  for (const s of input.constructorStandings) {
    if ((s.dnfs ?? 0) >= 6) reliabilityProblem.add(s.entityId);
  }

  // Market pool available to the AI, minus anything the player already took.
  const ctx: MarketCtx = {
    available: input.market.drivers.filter(
      (m) => !signedMarketIds.includes(m.id) && !input.reservedNames.has(norm(m.name)),
    ),
    taken: new Set(),
    takenNames: new Set([...input.reservedNames]),
  };
  // Youth pool available to the AI.
  const youthPool: YouthProspect[] = input.market.youth.filter(
    (y) => !input.reservedNames.has(norm(y.name)),
  );
  const takenYouthNames = new Set<string>([...input.reservedNames]);
  // Names already on the grid must never be re-signed off the market.
  for (const d of drivers) ctx.takenNames.add(norm(d.name));

  // Numbers already in use across the whole grid (for new reserve numbers).
  const usedNumbers = new Set(drivers.map((d) => d.number));
  const nextFreeNumber = (): number => {
    let n = 1;
    while (usedNumbers.has(n)) n += 1;
    usedNumbers.add(n);
    return n;
  };

  // Process AI teams in a stable order (constructor standing, then id) so
  // stronger teams get first pick of the market.
  const orderIndex = new Map(input.constructorStandings.map((s, i) => [s.entityId, i]));
  const aiTeams = teams
    .filter((t) => t.id !== input.selectedTeamId && input.aiTeamStates[t.id])
    .sort((a, b) => {
      const ia = orderIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const ib = orderIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      if (ia !== ib) return ia - ib;
      if (a.reputation !== b.reputation) return b.reputation - a.reputation;
      return a.id.localeCompare(b.id);
    });

  // The strongest car on the grid this offseason (for catch-up efficiency).
  const fieldTopRating = Math.max(
    5,
    ...[...carByTeam.values()].map((c) => carPerformanceRating(c)),
  );
  const shakeup = Math.max(0, Math.min(1, input.regulationShakeup ?? 0));

  for (const team of aiTeams) {
    const ai = input.aiTeamStates[team.id];
    const spec = ARCHETYPE_SPECS[ai.archetype];
    const rng = createSeededRandom(deriveSeed(input.seed, 'ai-offseason', team.id, input.nextYear));

    // 1) Maintenance decay + development -------------------------------------
    const car = carByTeam.get(team.id);
    if (car) {
      // Ratings do not stay maxed forever: apply offseason maintenance decay
      // (design ageing + regulation shakeup), softened by facilities/staff and
      // budget health, before the team develops.
      const org = orgRatings[team.id];
      const facilityStaffQuality = org
        ? (org.staffQuality + (org.research ?? org.staffQuality)) / 2
        : 50;
      const budgetHealth =
        ai.financialHealth === 'Excellent'
          ? 1
          : ai.financialHealth === 'Stable'
            ? 0.7
            : ai.financialHealth === 'Tight'
              ? 0.4
              : ai.financialHealth === 'AtRisk'
                ? 0.2
                : 0;
      // Regulation adaptation: in a shakeup year some teams nail the new concept
      // and some miss it. Preparedness leads; seeded noise keeps outcomes from
      // becoming perfectly deterministic from static ratings alone.
      let regulationAdaptation = 0;
      if (shakeup > 0) {
        const roll = createSeededRandom(
          deriveSeed(input.seed, 'reg-adapt', team.id, input.nextYear),
        ).next();
        const principal = input.aiPrincipals?.[team.id]?.attributes;
        const preparedness =
          ((org?.research ?? 45) * 0.35 +
            (org?.facilities ?? 45) * 0.25 +
            (principal?.development ?? 50) * 0.2 +
            (org?.staffQuality ?? 45) * 0.2 - 50) / 50;
        const competitiveBias = (50 - team.reputation) / 100;
        regulationAdaptation = Math.max(
          -1,
          Math.min(1, preparedness * 1.2 + competitiveBias * 0.25 + (roll - 0.5) * 5),
        );
      }
      const decayed: Car = {
        ...car,
        ratings: applyOffseasonDecay(car.ratings, {
          regulationShakeup: shakeup,
          facilityStaffQuality,
          budgetHealth,
          regulationAdaptation,
        }),
      };
      carByTeam.set(team.id, decayed);

      const dev = developCar(
        decayed,
        team,
        ai,
        reliabilityProblem.has(team.id),
        fieldTopRating,
        rng,
        org,
        input.regulationAffectedAreas,
        input.aiPrincipals?.[team.id]?.attributes,
      );
      if (dev) {
        // The development *spend* is already applied to the team's cash by the
        // Phase C rollover delta (sponsorIncome − dev − facility); here we only
        // apply the on-track *result*, so cash isn't charged twice.
        carByTeam.set(team.id, dev.car);
        notes.push(dev.note);
        news.push({ headline: dev.note });
      }
    }

    // 2) Academy progression + first option ----------------------------------
    const academyResult = processAcademy(team, ai, input, drivers, rng, {
      youthPool,
      takenYouthNames,
      nextFreeNumber,
    });
    aiAcademies[team.id] = academyResult.academy;
    drivers = academyResult.drivers;
    for (const n of academyResult.notes) {
      notes.push(n);
      news.push({ headline: n });
    }

    // 3) Driver market: fill empty seats, then one considered upgrade ---------
    const marketResult = processDriverMarket(team, ai, drivers, ctx, rng);
    drivers = marketResult.drivers;
    for (const id of marketResult.signedIds) signedMarketIds.push(id);
    for (const n of marketResult.notes) {
      notes.push(n);
      news.push({ headline: n });
    }
    team.budget -= marketResult.spent;
    if (marketResult.signedIds.length > 0 && rng.chance(0.05)) {
      const signedDriver = drivers.find((d) => marketResult.signedIds.includes(d.id));
      if (signedDriver) {
        drivers = drivers.map((d) =>
          d.id === signedDriver.id
            ? { ...d, morale: Math.max(0, d.morale - 12), confidence: Math.max(0, d.confidence - 8) }
            : d,
        );
        const note = `${team.name}'s new signing ${signedDriver.name} struggles to match expectations.`;
        notes.push(note);
        news.push({ headline: note });
      }
    }

    // 4) Staff / sponsor / engine light adjustments --------------------------
    const org = orgRatings[team.id];
    if (org) {
      const invest = ai.financialHealth === 'Excellent' || ai.financialHealth === 'Stable';
      const retrench = ai.financialHealth === 'Critical' || ai.financialHealth === 'AtRisk';
      const staffTargets: ('staffQuality' | 'operations' | 'research' | 'facilities' | 'youthAcademy' | 'pitCrew')[] = [
        'staffQuality',
        'operations',
        'research',
        'facilities',
        'youthAcademy',
        'pitCrew',
      ];
      let updated = { ...org };

      // AI named staff hiring: pick a specialist from the pool when investing.
      if (invest && spendableCash(team, ai) > toMoney(4) && rng.chance(0.4 + spec.risk * 0.2)) {
        const pool = getStaffPool(input.nextYear, input.series ?? 'F1');
        const roleMap: Record<StaffRole, 'staffQuality' | 'operations' | 'research'> = {
          'Technical Director': 'research',
          'Race Engineer': 'staffQuality',
          'Pit Crew Chief': 'operations',
          Strategist: 'operations',
        };
        const affordable = pool.filter((s) => toMoney(s.signingFee) <= spendableCash(team, ai));
        if (affordable.length > 0) {
          const best = affordable.sort((a, b) => b.rating - a.rating).slice(0, 5);
          const hire = rng.pick(best);
          const dept = roleMap[hire.role];
          const boost = Math.round((hire.rating - 50) * 0.08);
          const failedHire = rng.chance(0.05);
          if (!failedHire) {
            updated = { ...updated, [dept]: clamp100(updated[dept] + Math.max(1, boost)) };
          }
          team.budget -= toMoney(hire.signingFee);
          if (failedHire) {
            const note = `${team.name}'s staff hire ${hire.name} fails to settle — the fee is lost with no performance gain.`;
            notes.push(note);
            news.push({ headline: note });
          } else {
            notes.push(`${team.name} hires ${hire.name} as ${hire.role}.`);
            news.push({ headline: `${team.name} hires ${hire.name} as ${hire.role}.` });
          }
        }
      }

      if (invest && spendableCash(team, ai) > toMoney(4) && rng.chance(0.35 + spec.risk * 0.3)) {
        const dept = rng.pick(staffTargets);
        updated = { ...updated, [dept]: clamp100(updated[dept] + 2 + Math.round(rng.next() * 3)) };
        notes.push(`${team.name} strengthens its ${staffDeptLabel(dept)} department.`);
        news.push({ headline: `${team.name} strengthens its ${staffDeptLabel(dept)} department.` });
      } else if (retrench && rng.chance(0.4)) {
        const dept = rng.pick(staffTargets);
        updated = { ...updated, [dept]: clamp100(updated[dept] - 2) };
      }
      // Sponsor movement tracks financial health.
      if (invest && rng.chance(0.3)) {
        updated = { ...updated, sponsorAppeal: clamp100(updated.sponsorAppeal + 2) };
        notes.push(`${team.name} secures a new sponsor.`);
        news.push({ headline: `${team.name} secures a new sponsor.` });
      }
      orgRatings[team.id] = updated;
    }
  }

  // Carry academies for AI teams we didn't touch this pass (none, but defensive)
  // and drop the player's key if it ever leaked in.
  for (const [id, a] of Object.entries(input.aiAcademies)) {
    if (!(id in aiAcademies) && id !== input.selectedTeamId) aiAcademies[id] = a;
  }

  // Apply engine improvements to the car engineBonus where a team invested in
  // engine development is out of scope; engine deal changes are left to the
  // existing engineSupplierEngine. (No-op here keeps this deterministic.)
  const engine = input.engine;

  return {
    teams,
    drivers,
    cars: [...carByTeam.values()],
    engine,
    aiAcademies,
    orgRatings,
    signedMarketIds,
    notes,
    news,
  };
}

function staffDeptLabel(dept: keyof TeamOrganizationRatings): string {
  switch (dept) {
    case 'operations':
      return 'race operations';
    case 'research':
      return 'research & development';
    default:
      return 'technical';
  }
}

// --- Academy sub-process -----------------------------------------------------

type AcademyEnv = {
  youthPool: YouthProspect[];
  takenYouthNames: Set<string>;
  nextFreeNumber: () => number;
};

function processAcademy(
  team: Team,
  ai: AITeamState,
  input: AIOffseasonInput,
  drivers: Driver[],
  rng: Rng,
  env: AcademyEnv,
): { academy: AcademyMember[]; drivers: Driver[]; notes: string[] } {
  const spec = ARCHETYPE_SPECS[ai.archetype];
  const notes: string[] = [];
  let nextDrivers = drivers;
  const org = input.orgRatings[team.id];
  const capacity = org ? calculateAcademyCapacity(org) : 2;

  // Progress existing members, then resolve first option on any who turned 18.
  const existing = input.aiAcademies[team.id] ?? [];
  const kept: AcademyMember[] = [];
  const youthBoost = spec.youthBias * 0.3;
  for (const raw of existing) {
    const progressed = progressAcademyMember(raw, youthBoost);
    if (!isPromotionEligible(progressed, input.nextYear)) {
      kept.push({ ...progressed, promotionEligible: false });
      continue;
    }
    // First option on a promotion-eligible member. Open the rights window (stamp
    // firstOptionYear / deadline) and see whether the rights have now expired.
    const member = openFirstOptionWindow(progressed, input.nextYear);
    const expired = academyRightsExpired(member, input.nextYear);
    const seatDrivers = activeSeatDrivers(nextDrivers, team.id);
    const reserves = nextDrivers.filter((d) => d.teamId === team.id && isReserveTier(d));
    const weakestSeat = seatDrivers.reduce(
      (min, d) => Math.min(min, d.ratings.overall),
      Infinity,
    );
    const affordability = affordabilityFor(team, ai);
    const rawDecision = aiFirstOptionDecision(member, {
      weakestSeatOverall: Number.isFinite(weakestSeat) ? weakestSeat : 5,
      hasEmptySeat: seatDrivers.length < 2,
      hasReserve: reserves.length > 0,
      affordability,
      promotionBias: spec.youthBias,
      rightsExpired: expired,
    });
    const raceSeatCeiling =
      ai.goal === 'Podiums' || ai.goal === 'PointsFinish'
        ? targetDriverOverall(ai) + 2
        : 90;
    const decision =
      rawDecision === 'race_seat' && member.overall > raceSeatCeiling
        ? member.yearsUntilF1Ready <= 0 ? 'reserve' : 'test'
        : rawDecision;
    const applied = applyAcademyDecision(
      decision,
      member,
      team,
      seatDrivers,
      nextDrivers,
      env,
      input.nextYear,
    );
    nextDrivers = applied.drivers;
    if (applied.note) notes.push(applied.note);
    // A member kept under academy rights is only allowed while rights are valid.
    // If they've expired (past deadline / age 21+), the driver is released to the
    // adult market rather than lingering in academy-only status.
    if (applied.keep) {
      if (expired) {
        notes.push(
          `${team.name} lets first-option rights on ${member.name} (${academyMemberAge(member, input.nextYear)}) expire — released to the driver market.`,
        );
      } else {
        kept.push(applied.keep);
      }
    }
  }

  // Sign at most one new youth prospect per offseason, gated by capacity,
  // affordability and youth appetite.
  const wantsYouth = kept.length < capacity && rng.chance(0.25 + spec.youthBias * 0.55);
  if (wantsYouth) {
    const prospect = pickYouthProspect(env.youthPool, env.takenYouthNames, team, ai, rng);
    if (prospect && team.budget - toMoney(prospect.signingCost) > ai.budget.reserveTarget * 0.5) {
      team.budget -= toMoney(prospect.signingCost);
      env.takenYouthNames.add(norm(prospect.name));
      const member = signProspectToAcademy(prospect, input.nextYear, team.id);
      kept.push(member);
      notes.push(`${team.name} signs youth prospect ${prospect.name} to its academy.`);
    }
  }

  return { academy: kept, drivers: nextDrivers, notes };
}

function applyAcademyDecision(
  decision: ReturnType<typeof aiFirstOptionDecision>,
  member: AcademyMember,
  team: Team,
  seatDrivers: Driver[],
  drivers: Driver[],
  env: AcademyEnv,
  nextYear: number,
): { drivers: Driver[]; note?: string; keep?: AcademyMember } {
  const age = academyMemberAge(member, nextYear);
  if (decision === 'race_seat') {
    // Replace the weakest seat driver with the promoted academy driver.
    const target = [...seatDrivers].sort((a, b) => a.ratings.overall - b.ratings.overall)[0];
    if (!target) {
      return { drivers, keep: markPending(member) };
    }
    const promoted = academyMemberToDriver(member, { teamId: team.id, number: target.number });
    const nextDrivers = drivers
      .filter((d) => d.id !== target.id)
      .concat(promoted);
    team.driverIds = replaceInRoster(team.driverIds, target.id, promoted.id);
    return {
      drivers: nextDrivers,
      note: `${team.name} promotes academy driver ${member.name} (${age}) to a race seat.`,
    };
  }
  if (decision === 'third' || decision === 'reserve' || decision === 'test') {
    const number = env.nextFreeNumber();
    const reserve = academyMemberToReserveDriver(member, team.id, decision, number);
    team.driverIds = [...team.driverIds, reserve.id];
    const roleLabel =
      decision === 'third' ? '3rd driver' : decision === 'reserve' ? 'reserve driver' : 'test driver';
    return {
      drivers: [...drivers, reserve],
      note: `${team.name} signs academy driver ${member.name} (${age}) as ${roleLabel}.`,
    };
  }
  if (decision === 'release') {
    return {
      drivers,
      note: `${team.name} releases academy driver ${member.name} (${age}) to the driver market.`,
    };
  }
  // extend
  return {
    drivers,
    note: `${team.name} extends academy rights for ${member.name} (${age}).`,
    keep: { ...member, promotionEligible: true, firstOptionStatus: 'extended_development_rights' },
  };
}

function markPending(member: AcademyMember): AcademyMember {
  return { ...member, promotionEligible: true, firstOptionStatus: 'pending_team_decision' };
}

function pickYouthProspect(
  pool: YouthProspect[],
  taken: Set<string>,
  team: Team,
  ai: AITeamState,
  rng: Rng,
): YouthProspect | undefined {
  const spendable = spendableCash(team, ai);
  const affordable = pool.filter(
    (y) => !taken.has(norm(y.name)) && toMoney(y.signingCost) <= spendable,
  );
  if (affordable.length === 0) return undefined;
  // Rich teams chase the highest-potential prospect; poorer teams pick a
  // cheaper one. A little randomness keeps academies varied.
  const spec = ARCHETYPE_SPECS[ai.archetype];
  const ranked = [...affordable].sort((a, b) => b.potential - a.potential);
  if (spec.risk >= 0.6 || ai.financialHealth === 'Excellent') {
    return ranked[0];
  }
  const midStart = Math.floor(ranked.length / 2);
  return ranked[midStart + Math.floor(rng.next() * (ranked.length - midStart))];
}

// --- Driver-market sub-process ----------------------------------------------

function processDriverMarket(
  team: Team,
  ai: AITeamState,
  drivers: Driver[],
  ctx: MarketCtx,
  rng: Rng,
): { drivers: Driver[]; signedIds: string[]; spent: number; notes: string[] } {
  const spec = ARCHETYPE_SPECS[ai.archetype];
  const notes: string[] = [];
  const signedIds: string[] = [];
  let nextDrivers = drivers;
  let spent = 0;
  let cash = spendableCash(team, ai);

  const usedNumbers = new Set(nextDrivers.map((d) => d.number));
  const freeNumber = (): number => {
    let n = 1;
    while (usedNumbers.has(n)) n += 1;
    usedNumbers.add(n);
    return n;
  };

  // Fill empty race seats first (AI never starts a season a car short).
  let seats = activeSeatDrivers(nextDrivers, team.id);
  while (seats.length < 2) {
    // Prefer promoting an existing reserve; otherwise sign from the market.
    const reserve = nextDrivers.find((d) => d.teamId === team.id && isReserveTier(d));
    if (reserve) {
      nextDrivers = nextDrivers.map((d) =>
        d.id === reserve.id ? { ...d, contractType: 'seat', contractYearsRemaining: 2 } : d,
      );
      team.driverIds = ensureInRoster(team.driverIds, reserve.id);
      notes.push(`${team.name} promotes reserve driver ${reserve.name} to a race seat.`);
    } else {
      // A team must never start a season a car short: prefer the best affordable
      // driver, but if nothing fits the budget take the cheapest available (a pay
      // driver), and only generate a rookie if the market is genuinely empty.
      const pick = bestCandidate(ctx, ai, cash, 4) ?? cheapestCandidate(ctx, ai);
      const number = freeNumber();
      if (!pick) {
        const rookie = makeRookieDriver(team.id, number, rng, ctx.takenNames);
        nextDrivers = [...nextDrivers, rookie];
        team.driverIds = ensureInRoster(team.driverIds, rookie.id);
        ctx.takenNames.add(norm(rookie.name));
        notes.push(`${team.name} promotes rookie ${rookie.name} into an empty race seat.`);
        seats = activeSeatDrivers(nextDrivers, team.id);
        continue;
      }
      const signed = marketDriverToDriver(pick, { teamId: team.id, number });
      nextDrivers = [...nextDrivers, signed];
      team.driverIds = ensureInRoster(team.driverIds, signed.id);
      const cost = signingCost(pick, ai);
      spent += cost;
      cash -= cost;
      ctx.taken.add(pick.id);
      ctx.takenNames.add(norm(pick.name));
      signedIds.push(pick.id);
      notes.push(`${team.name} signs ${pick.name} to fill an empty race seat.`);
    }
    seats = activeSeatDrivers(nextDrivers, team.id);
  }

  // One considered upgrade: replace the weakest seat driver if a clearly better,
  // affordable driver is available and the team is inclined to gamble. An old,
  // declining driver is replaced far more readily — teams don't hang on to a
  // fading veteran when a stronger prospect or free agent is there for the
  // taking.
  const target = targetDriverOverall(ai);
  const weakest = [...seats].sort((a, b) => a.ratings.overall - b.ratings.overall)[0];
  const contractOpen =
    weakest && (weakest.contractYearsRemaining == null || weakest.contractYearsRemaining <= 1);
  const oldDeclining = weakest != null && (weakest.age ?? 0) >= 37;
  const upgradeChance = 0.12 + spec.risk * 0.15;
  const wantsUpgrade =
    weakest &&
    contractOpen &&
    weakest.ratings.overall < target - 8 &&
    (oldDeclining || rng.chance(upgradeChance));
  if (weakest && wantsUpgrade) {
    const margin = ai.archetype === 'ChampionshipContender' ? 3 : 8;
    // Prefer a competent replacement near the team's target rather than always
    // selecting the strongest free agent. This keeps repeated contract churn
    // from ratcheting the whole grid toward the market's upper tail.
    const targetCeiling = target + (ai.archetype === 'ChampionshipContender' ? 5 : 0);
    const pick = bestCandidate(
      ctx,
      ai,
      cash,
      weakest.ratings.overall + margin,
      targetCeiling,
    );
    if (pick) {
      const signed = marketDriverToDriver(pick, { teamId: team.id, number: weakest.number });
      nextDrivers = nextDrivers.filter((d) => d.id !== weakest.id).concat(signed);
      team.driverIds = replaceInRoster(team.driverIds, weakest.id, signed.id);
      spent += signingCost(pick, ai);
      ctx.taken.add(pick.id);
      ctx.takenNames.add(norm(pick.name));
      signedIds.push(pick.id);
      notes.push(
        `${team.name} replaces ${weakest.name} with ${pick.name} (${pick.overall.toFixed(1)} overall).`,
      );
    }
  }

  return { drivers: nextDrivers, signedIds, spent, notes };
}

// --- Small helpers -----------------------------------------------------------

function isReserveTier(d: Driver): boolean {
  return d.contractType === 'third' || d.contractType === 'reserve' || d.contractType === 'test';
}

const ROOKIE_FIRST = [
  'Alex', 'Danny', 'Marco', 'Luca', 'Nico', 'Paul', 'Erik', 'Bruno', 'Diego', 'Tomas',
  'Rui', 'Sven', 'Jens', 'Karl', 'Remy', 'Theo', 'Enzo', 'Milan', 'Ivan', 'Petar',
];
const ROOKIE_LAST = [
  'Vanterpool', 'Kessler', 'Brenner', 'Falk', 'Novak', 'Adler', 'Sorenson', 'Vasquez',
  'Delgado', 'Fontana', 'Bergman', 'Larsen', 'Kovac', 'Petrov', 'Dumont', 'Nyberg',
  'Halvorsen', 'Marchetti', 'Okafor', 'Renaud',
];

// Last-resort generated rookie so an AI team is never left a car short when the
// market is genuinely empty. Deterministic (seeded rng) and de-duplicated
// against names already in use.
export function makeRookieDriver(
  teamId: string,
  number: number,
  rng: Rng,
  takenNames: Set<string>,
): Driver {
  let name = '';
  for (let attempt = 0; attempt < 128 && !name; attempt++) {
    const cand = `${rng.pick(ROOKIE_FIRST)} ${rng.pick(ROOKIE_LAST)}`;
    if (!takenNames.has(norm(cand))) name = cand;
  }
  if (!name) name = `Rookie ${teamId}-${number}`;
  const base = 4 + rng.range(0, 1.2);
  const r = () => Math.round(Math.max(10, Math.min(100, (base + rng.range(-0.5, 0.7)) * 10)));
  const ratings: DriverRatings = {
    cornering: r(), braking: r(), straights: r(), tractionAcceleration: r(),
    elevationBlindCorners: r(), technical: r(), overtakingRacecraft: r(),
    surfaceGripBumpiness: r(), riskManagement: r(), enduranceConsistency: r(),
    qualifying: r(), racePace: r(), adaptability: r(), aggression: r(),
    composure: r(), overall: Math.round(base * 10),
  };
  return {
    id: `d-rookie-${norm(name).replace(/\s+/g, '-')}-${number}`,
    name,
    number,
    age: 20,
    teamId,
    ratings,
    morale: 60,
    confidence: 55,
    contractYearsRemaining: 2,
    contractType: 'seat',
    traits: [],
  };
}

// The (up to two) race-seat drivers for a team: roster order first, then any
// remaining non-reserve drivers on the team.
function activeSeatDrivers(drivers: Driver[], teamId: string): Driver[] {
  const team = drivers.filter((d) => d.teamId === teamId && !isReserveTier(d));
  return team.slice(0, 2);
}

function affordabilityFor(team: Team, ai: AITeamState): number {
  const spendable = spendableCash(team, ai);
  if (spendable <= 0) return 0;
  if (spendable > toMoney(10)) return 1;
  return spendable / toMoney(10);
}

function replaceInRoster(roster: string[], oldId: string, newId: string): string[] {
  const idx = roster.indexOf(oldId);
  if (idx < 0) return [...roster.filter((id) => id !== newId), newId];
  const next = [...roster];
  next[idx] = newId;
  return next;
}

function ensureInRoster(roster: string[], id: string): string[] {
  return roster.includes(id) ? roster : [...roster, id];
}
