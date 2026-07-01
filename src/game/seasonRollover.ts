// Offseason → next-season rollover. Applies the driver-market decisions made
// during the offseason (seat signings, academy promotions), progresses academy
// members, carries the player car's development into next year, and resets the
// season for a fresh championship. Only the player's seats change; the AI grid
// is stable for now. Pure and deterministic.

import { getSeasonBundle } from '../data';
import {
  careerMarketBundle,
  marketRolloverChanges,
  marketRolloverNotes,
} from '../sim/careerMarketEngine';
import {
  FACILITY_SPECS,
  facilityYouthDevelopmentBonus,
  resolvePendingUpgrades,
} from '../sim/facilityEngine';
import { BALANCED_SETUP } from '../data/setup/setupComponents';
import { calculateOffseasonCarryover } from '../sim/developmentEngine';
import {
  academyMemberAge,
  academyMemberToDriver,
  academyMemberToReserveDriver,
  marketDriverToDriver,
  progressAcademyMember,
} from '../sim/driverMarketEngine';
import {
  firstOptionStatusFor,
  isPromotionEligible,
} from '../sim/youthAcademyEngine';
import { resolveDriverBid } from '../sim/driverBiddingEngine';
import { marketDriverOfferInterest } from '../sim/crossSeriesEngine';
import { carPerformanceRating } from '../sim/trackFitEngine';
import { driverSalary, makeTransaction, toMoney } from '../sim/financeEngine';
import { thirdDriverAmbitions, THIRD_DRIVER_SALARY_FACTOR } from '../sim/contractEngine';
import {
  evaluateSeasonObjectives,
  rollSponsorRenewals,
  sponsorAnnualIncome,
} from '../sim/commercialEngine';
import {
  buildTeamExpectations,
  reviewExpectation,
  applyPatience,
} from '../sim/expectationEngine';
import {
  applyEngineBonuses,
  resolveEngineRollover,
  evaluateManufacturerRelationship,
  ENGINE_DEAL_SPECS,
} from '../sim/engineSupplierEngine';
import {
  bestRehireOffer,
  generateJobOffers,
  reviewPrincipal,
  type PrincipalSeasonOutcome,
} from '../sim/principalEngine';
import { buildInitialCommercial } from '../sim/commercialEngine';
import { createInitialFacilities } from '../sim/facilityEngine';
import { rolloverRelationships } from '../sim/relationshipEngine';
import { generateRegulationProposals, resolveRegulationVoting } from '../sim/politicsEngine';
import { refreshScoutingNetwork } from '../sim/scoutingEngine';
import { createDriverDevelopmentCurve, developmentStep } from '../sim/developmentCurveEngine';
import { finalizeSeasonHistory } from '../sim/universeHistoryEngine';
import { buildAITeamState, rolloverAITeamStates } from '../sim/aiTeamEngine';
import { runAIOffseason } from '../sim/aiOffseasonEngine';
import { applyDriverRetirements } from '../sim/driverRetirementEngine';
import type { DriverDevelopmentCurve } from '../types/developmentCurveTypes';
import type { Car, Driver, OffseasonSummary, Team } from '../types/gameTypes';
import type { AcademyDecision, AcademyMember } from '../types/marketTypes';
import type { FinanceTransaction } from '../types/financeTypes';
import type { CommercialState } from '../types/sponsorTypes';
import type { CarSetup } from '../types/setupTypes';
import type { ExpectationReview, TeamExpectation, TeamReputation } from '../types/expectationTypes';
import { carForTeam, type GameState } from './careerState';

// Annual sponsorship the player's team earns, driven by reputation and the
// appeal (overall rating) of its driver line-up. Invented but ties sponsorship
// to sporting success and to signing stronger drivers.
function sponsorshipIncome(team: Team | undefined, playerDrivers: Driver[]): number {
  const base = toMoney((team?.reputation ?? 0) * 0.05);
  const fromDrivers = playerDrivers.reduce(
    (sum, d) => sum + toMoney(Math.max(0, d.ratings.overall - 3) * 0.8),
    0,
  );
  return base + fromDrivers;
}

// Result of applying the player's Academy Rights / First Option decisions on
// promotion-eligible (18+) academy drivers at the rollover.
type FirstOptionResolution = {
  // seatDriverId -> the promoted academy driver taking that race seat.
  seatReplacements: Map<string, Driver>;
  // New non-racing (3rd/reserve/test) drivers joining the player roster.
  reserveDrivers: Driver[];
  // Academy members who leave the academy this rollover (promoted or released).
  consumedAcademyIds: Set<string>;
  // Academy members kept under academy rights (extend / undecided), by id →
  // status stamp to apply after progression.
  retainedStatus: Map<string, AcademyMember['firstOptionStatus']>;
  notes: string[];
};

// Apply the player's first-option decisions for academy drivers who reach adult
// age (18) in `nextYear`. Promotions produce race-seat replacements or reserve
// drivers; releases send the driver to the open market; extend/undecided keep
// academy rights. Academy members still in the 12–17 window are untouched.
function resolvePlayerFirstOptions(
  state: GameState,
  academy: AcademyMember[],
  decisions: AcademyDecision[],
  nextYear: number,
  reservedNumbers: Set<number>,
): FirstOptionResolution {
  const res: FirstOptionResolution = {
    seatReplacements: new Map(),
    reserveDrivers: [],
    consumedAcademyIds: new Set(),
    retainedStatus: new Map(),
    notes: [],
  };
  const decisionByAcademyId = new Map(decisions.map((d) => [d.academyId, d]));
  const usedNumbers = new Set(reservedNumbers);
  const nextFreeNumber = (): number => {
    let n = 1;
    while (usedNumbers.has(n)) n += 1;
    usedNumbers.add(n);
    return n;
  };

  for (const a of academy) {
    if (!isPromotionEligible(a, nextYear)) continue;
    res.notes.push(`${a.name} turned ${academyMemberAge(a, nextYear)} and became promotion eligible.`);
    const decision = decisionByAcademyId.get(a.id)?.decision;
    if (!decision) {
      // No decision taken: keep first option open (development rights held).
      res.retainedStatus.set(a.id, 'pending_team_decision');
      res.notes.push(`Awaiting your promotion decision on academy driver ${a.name}.`);
      continue;
    }
    if (decision === 'race_seat') {
      const seatDriverId = decisionByAcademyId.get(a.id)?.seatDriverId;
      const seatDriver = seatDriverId
        ? state.drivers.find((d) => d.id === seatDriverId && d.teamId === state.selectedTeamId)
        : undefined;
      if (!seatDriver) {
        // Seat no longer valid — hold rights rather than lose the driver.
        res.retainedStatus.set(a.id, 'pending_team_decision');
        continue;
      }
      const seat = { teamId: seatDriver.teamId, number: seatDriver.number };
      res.seatReplacements.set(seatDriver.id, academyMemberToDriver(a, seat));
      res.consumedAcademyIds.add(a.id);
      res.notes.push(`Promoted academy driver ${a.name} to a race seat for ${nextYear}.`);
    } else if (decision === 'third' || decision === 'reserve' || decision === 'test') {
      const number = nextFreeNumber();
      res.reserveDrivers.push(
        academyMemberToReserveDriver(a, state.selectedTeamId, decision, number),
      );
      res.consumedAcademyIds.add(a.id);
      const roleLabel =
        decision === 'third' ? '3rd driver' : decision === 'reserve' ? 'reserve driver' : 'test driver';
      res.notes.push(`Signed academy driver ${a.name} as ${roleLabel} for ${nextYear}.`);
    } else if (decision === 'release') {
      res.consumedAcademyIds.add(a.id);
      res.notes.push(`Released academy driver ${a.name} to the open driver market.`);
    } else {
      // 'extend': keep in the academy another year.
      res.retainedStatus.set(a.id, firstOptionStatusFor(decision));
      res.notes.push(`Extended academy/development rights for ${a.name}.`);
    }
  }
  return res;
}

export function advanceSeason(state: GameState): GameState {
  const nextYear = state.seasonYear + 1;
  // Living career market: the curated season file plus registry free agents /
  // youth that have become available. Signings queued during the offseason are
  // resolved against this same pool.
  const market = careerMarketBundle(state);
  const marketChanges = marketRolloverChanges(state, nextYear);
  const signings = state.pendingSignings ?? [];
  const academy = state.academy ?? [];

  // Academy Rights / First Option: academy drivers who reach adult age (18) in
  // the new season become promotion eligible; their team's queued decisions are
  // applied now (promote to a seat / reserve, extend rights, or release).
  const reservedNumbers = new Set(state.drivers.map((d) => d.number));
  const firstOption = resolvePlayerFirstOptions(
    state,
    academy,
    state.academyDecisions ?? [],
    nextYear,
    reservedNumbers,
  );

  // Resolve each queued signing.
  //  - market/academy: a new driver replaces the seat's current driver.
  //  - reserve: the team's own 3rd driver is promoted into the seat (the
  //    displaced seat driver leaves).
  const replacements = new Map<string, Driver>(); // oldSeatId -> new driver
  const reservePromotions: { seatDriverId: string; reserveId: string; upgraded: Driver }[] = [];
  const usedAcademyIds = new Set<string>();
  const newSignedMarketIds = [...(state.signedMarketIds ?? [])];

  // Contested market signings (driver bidding): each queued market signing is
  // resolved against rival interest, weighted by the team's prestige. Losing a
  // bid leaves the seat unchanged and the driver leaves the market (signs with a
  // rival). Compute the outcomes once so the replacement, finance and summary
  // passes all agree.
  const playerTeamOverall =
    state.teamOrgRatings?.[state.selectedTeamId]?.overallTeamRating ?? 50;
  const playerCarForBids = carForTeam(state, state.selectedTeamId);
  const playerCarOverall = playerCarForBids ? carPerformanceRating(playerCarForBids) : 5;
  const marketBidWon = new Map<string, boolean>();
  const biddingNotes: string[] = [];
  for (const sign of signings) {
    if (sign.source !== 'market') continue;
    const m = market?.drivers.find((d) => d.id === sign.sourceId);
    if (!m) {
      marketBidWon.set(sign.sourceId, false);
      continue;
    }
    // Cross-series moves are weighted by the driver's interest in the offer;
    // same-series signings pass no interest and are unchanged.
    const interest = marketDriverOfferInterest(state, m, playerTeamOverall, playerCarOverall);
    const res = resolveDriverBid(
      sign.bid ?? m.buyoutCost,
      m,
      playerTeamOverall,
      state.randomSeed,
      interest,
    );
    marketBidWon.set(sign.sourceId, res.won);
    if (!res.won) {
      newSignedMarketIds.push(m.id); // signed with a rival (or refused) — off the market
      biddingNotes.push(
        res.refused
          ? `${m.name} turned down a move to ${state.series} — not interested in switching series right now.`
          : `Lost the bidding for ${m.name} — a rival outbid you (competing offer ~$${res.rivalBid}M).`,
      );
    }
  }

  for (const sign of signings) {
    const seatDriver = state.drivers.find((d) => d.id === sign.seatDriverId);
    if (!seatDriver) continue;
    const seat = { teamId: seatDriver.teamId, number: seatDriver.number };
    if (sign.source === 'market') {
      const m = market?.drivers.find((d) => d.id === sign.sourceId);
      if (!m) continue;
      if (!marketBidWon.get(sign.sourceId)) continue; // outbid — seat unchanged
      replacements.set(sign.seatDriverId, marketDriverToDriver(m, seat));
      newSignedMarketIds.push(m.id);
    } else if (sign.source === 'reserve') {
      const r = state.drivers.find((d) => d.id === sign.sourceId && d.teamId === seat.teamId);
      if (!r) continue;
      const upgraded: Driver = {
        ...r,
        number: seat.number,
        contractType: 'seat',
        contractYearsRemaining: 2,
        salary: r.salary ? r.salary / THIRD_DRIVER_SALARY_FACTOR : undefined,
      };
      reservePromotions.push({ seatDriverId: sign.seatDriverId, reserveId: r.id, upgraded });
    } else {
      const a = academy.find((x) => x.id === sign.sourceId);
      if (!a) continue;
      replacements.set(sign.seatDriverId, academyMemberToDriver(a, seat));
      usedAcademyIds.add(a.id);
    }
  }

  // Fold in the Academy Rights / First Option outcomes: race-seat promotions
  // replace a seat (unless already taken by a queued signing), and promoted or
  // released academy members leave the academy.
  for (const [seatDriverId, promoted] of firstOption.seatReplacements) {
    if (!replacements.has(seatDriverId)) replacements.set(seatDriverId, promoted);
  }
  for (const id of firstOption.consumedAcademyIds) usedAcademyIds.add(id);

  // A 3rd driver who outperformed a seat driver but wasn't promoted leaves for a
  // race seat at another team next season.
  const promotedReserveIds = new Set(reservePromotions.map((p) => p.reserveId));
  const departures = new Set<string>();
  const departureNotes: string[] = [];
  for (const amb of thirdDriverAmbitions(state)) {
    if (amb.wantsSeat && !promotedReserveIds.has(amb.driverId)) {
      departures.add(amb.driverId);
      departureNotes.push(
        `${amb.name} left for a race seat elsewhere after outscoring a seat driver as your 3rd driver.`,
      );
    }
  }

  // Build next season's driver list: apply replacements, promote reserves
  // (dropping the displaced seat driver), then remove departures.
  const promotedSeatIds = new Set(reservePromotions.map((p) => p.seatDriverId));
  const upgradeById = new Map(reservePromotions.map((p) => [p.reserveId, p.upgraded]));
  const drivers = [
    ...state.drivers
      .map((d) => replacements.get(d.id) ?? d)
      .filter((d) => !promotedSeatIds.has(d.id))
      .map((d) => upgradeById.get(d.id) ?? d)
      .filter((d) => !departures.has(d.id)),
    // New reserve/test/3rd drivers promoted from the academy via first option.
    ...firstOption.reserveDrivers,
  ];

  // Keep team rosters (driverIds) consistent with the moves above.
  const remapId = (id: string): string => replacements.get(id)?.id ?? id;
  const firstOptionReserveIds = firstOption.reserveDrivers.map((d) => d.id);
  const rebuildRoster = (ids: string[]): string[] => {
    let next = ids.map(remapId);
    for (const p of reservePromotions) {
      next = next.filter((id) => id !== p.reserveId); // pull reserve out of its slot
      const pos = next.indexOf(p.seatDriverId);
      if (pos >= 0) next[pos] = p.reserveId; // reserve takes the seat
    }
    // Append academy first-option reserve/test/3rd drivers behind the seats.
    return [...next.filter((id) => !departures.has(id)), ...firstOptionReserveIds];
  };

  // Departing 3rd drivers (signed off the market) return to the market.
  const departedMarketIds = new Set([...departures].map((id) => id.replace(/^d-/, '')));
  const finalSignedMarketIds = newSignedMarketIds.filter((id) => !departedMarketIds.has(id));

  // Carry per-driver setups across; drop replaced/departed drivers, seed new ones.
  const carSetups = { ...(state.carSetups ?? {}) };
  for (const [oldId, newDriver] of replacements) {
    delete carSetups[oldId];
    if (newDriver.teamId === state.selectedTeamId) {
      carSetups[newDriver.id] = { ...BALANCED_SETUP };
    }
  }
  for (const p of reservePromotions) {
    delete carSetups[p.seatDriverId];
    if (p.upgraded.teamId === state.selectedTeamId) carSetups[p.upgraded.id] = { ...BALANCED_SETUP };
  }
  for (const id of departures) delete carSetups[id];

  // Progress remaining academy members one offseason; promoted/released ones
  // leave. A Driver Academy facility accelerates their growth. Members retained
  // under first option (extended rights / undecided) keep their promotion flag
  // and status so the offseason UI re-prompts next year.
  const youthBoost = facilityYouthDevelopmentBonus(state.facilities);
  const nextAcademy: AcademyMember[] = academy
    .filter((a) => !usedAcademyIds.has(a.id))
    .map((a) => {
      const progressed = progressAcademyMember(a, youthBoost);
      const retained = firstOption.retainedStatus.get(a.id);
      if (retained) {
        return { ...progressed, promotionEligible: true, firstOptionStatus: retained };
      }
      return isPromotionEligible(progressed, nextYear)
        ? progressed
        : { ...progressed, promotionEligible: false };
    });

  // Resolve any facility upgrades ordered during the season (they take effect now).
  const facilityResolution = state.facilities
    ? resolvePendingUpgrades(state.facilities)
    : undefined;
  const nextFacilities = facilityResolution?.state ?? state.facilities;
  const facilityNotes = (facilityResolution?.completed ?? []).map(
    (u) => `${FACILITY_SPECS[
      state.facilities!.facilities.find((f) => f.id === u.facilityId)!.type
    ].label} upgraded to level ${u.toLevel}.`,
  );

  // Regulation voting / politics (Living Universe Phase 8): settle the votes on
  // the proposals that were up for the upcoming season. Passed proposals become
  // real regulation changes that feed the car carryover below, and every
  // outcome is recorded for the universe history.
  const proposalsToVote = (state.regulationProposals ?? []).filter(
    (p) => p.seasonYearEffective === nextYear,
  );
  const voteResolution = resolveRegulationVoting(
    proposalsToVote,
    state.teams,
    state.teamReputations,
    state.engine,
    state.selectedTeamId,
  );
  const regulationHistoryWithVotes = [
    ...state.regulationHistory,
    ...voteResolution.regulationChanges,
  ];

  // Carry the player car's development into the new baseline; reset condition.
  const playerCar = carForTeam(state, state.selectedTeamId);
  const carsRaw: Car[] = state.cars.map((c) => {
    if (playerCar && c.id === playerCar.id) {
      const ratings = calculateOffseasonCarryover(
        c,
        state.completedDevelopmentProjects,
        regulationHistoryWithVotes,
      );
      return {
        ...c,
        seasonYear: nextYear,
        ratings,
        developmentLevel: {
          enginePower: 0,
          aeroEfficiency: 0,
          mechanicalGrip: 0,
          reliability: 0,
          pitCrewOperations: 0,
        },
        condition: 100,
      };
    }
    return { ...c, seasonYear: nextYear, condition: 100 };
  });

  // Settle the offseason finances for the player's team: buyouts for new
  // signings, annual salaries for the new line-up, academy fees, and the
  // upcoming year's sponsorship income.
  const playerDrivers = drivers.filter((d) => d.teamId === state.selectedTeamId);
  const academyYearlyById: Record<string, number> = {};
  for (const y of market?.youth ?? []) academyYearlyById[y.id] = y.yearlyAcademyCost;

  const txns: FinanceTransaction[] = [];
  for (const sign of signings) {
    if (sign.source !== 'market') continue;
    if (!marketBidWon.get(sign.sourceId)) continue; // only the winning bid pays
    const m = market?.drivers.find((d) => d.id === sign.sourceId);
    const fee = sign.bid ?? m?.buyoutCost ?? 0;
    if (m && fee > 0) {
      txns.push(makeTransaction(nextYear, 'Driver Signing', `Signed ${m.name} (winning bid)`, -toMoney(fee)));
    }
  }
  for (const d of playerDrivers) {
    txns.push(makeTransaction(nextYear, 'Driver Salary', `Salary: ${d.name}`, -driverSalary(d)));
  }
  for (const a of nextAcademy) {
    const yearly = academyYearlyById[a.prospectId] ?? 0;
    if (yearly > 0) {
      txns.push(makeTransaction(nextYear, 'Academy', `Academy fees: ${a.name}`, -toMoney(yearly)));
    }
  }
  for (const s of state.staff ?? []) {
    txns.push(makeTransaction(nextYear, 'Staff', `Salary: ${s.name} (${s.role})`, -toMoney(s.salary)));
  }

  // Engine supplier: resolve any deal signed this season (it takes effect now),
  // re-apply the grid's engine modifiers to next year's cars, and bill the
  // player's annual engine cost.
  let nextEngine = resolveEngineRollover(state.engine, state.selectedTeamId);
  const engineNotes: string[] = [];
  if (state.engine?.pendingDeal && nextEngine?.currentDeal) {
    const d = nextEngine.currentDeal;
    engineNotes.push(`New engine deal: ${ENGINE_DEAL_SPECS[d.dealType].label} with ${d.supplierName}.`);
  }
  // Manufacturer relationship review (works/factory deals): the supplier rates the
  // season against its target, adjusting confidence and possibly the deal tier
  // for the coming year. Evaluated before billing so an up/downgrade is charged.
  {
    const playerTeamForEngine = state.teams.find((t) => t.id === state.selectedTeamId);
    const idx = playerTeamForEngine
      ? state.constructorStandings.findIndex((s) => s.entityId === playerTeamForEngine.id)
      : -1;
    const standing = idx >= 0 ? state.constructorStandings[idx] : undefined;
    const manuf = evaluateManufacturerRelationship(
      nextEngine,
      state.selectedTeamId,
      {
        constructorPosition: idx >= 0 ? idx + 1 : state.teams.length,
        wins: standing?.wins ?? 0,
        points: standing?.points ?? 0,
      },
      state.seasonYear,
    );
    nextEngine = manuf.engine;
    engineNotes.push(...manuf.notes);
  }
  const engineDeal = nextEngine?.currentDeal;
  if (engineDeal && engineDeal.annualCost > 0) {
    txns.push(
      makeTransaction(nextYear, 'Engine', `${engineDeal.supplierName} engine supply`, -toMoney(engineDeal.annualCost)),
    );
  }
  const cars = applyEngineBonuses(carsRaw, nextEngine);

  const playerTeam = state.teams.find((t) => t.id === state.selectedTeamId);

  // Commercial settlement: evaluate the season's sponsor objectives, renew the
  // portfolio for next year, then book the new annual sponsorship income. Falls
  // back to the legacy reputation-based formula for pre-Phase-3 saves.
  const commercialNotes: string[] = [];
  let nextCommercial: CommercialState | undefined = state.commercial;
  if (state.commercial && playerTeam) {
    const playerConstructor = state.constructorStandings.findIndex((s) => s.entityId === playerTeam.id);
    const playerStanding = playerConstructor >= 0 ? state.constructorStandings[playerConstructor] : undefined;
    const failedToQualify = Object.values(state.completedRaceResults).some((res) =>
      res.some((r) => r.teamId === playerTeam.id && r.status === 'DNS'),
    );
    const evalResult = evaluateSeasonObjectives(state.commercial, {
      constructorPosition: playerConstructor >= 0 ? playerConstructor + 1 : state.teams.length,
      points: playerStanding?.points ?? 0,
      wins: playerStanding?.wins ?? 0,
      failedToQualify,
    });
    for (const p of evalResult.payouts) {
      txns.push(makeTransaction(state.seasonYear, 'Sponsorship', p.label, p.amount));
    }
    commercialNotes.push(...evalResult.notes);

    const renewed = rollSponsorRenewals(
      { ...state.commercial, sponsors: evalResult.sponsors },
      playerTeam,
      state.randomSeed,
      nextYear,
    );
    nextCommercial = renewed.commercial;
    commercialNotes.push(...renewed.notes);

    const annual = sponsorAnnualIncome(nextCommercial);
    if (annual > 0) {
      txns.push(makeTransaction(nextYear, 'Sponsorship', `${nextYear} sponsorship income`, annual));
    }
  } else {
    const sponsorship = sponsorshipIncome(playerTeam, playerDrivers);
    if (sponsorship > 0) {
      txns.push(makeTransaction(nextYear, 'Sponsorship', `${nextYear} sponsorship`, sponsorship));
    }
  }
  // AI Team Management (Phase C): recompute every non-player team's management
  // brain (archetype, budget, financial health, goal) for the new season and
  // move their cash by the discretionary sponsor-income/spend flow.
  const aiRollover = rolloverAITeamStates(state);

  const budgetDelta = txns.reduce((sum, t) => sum + t.amount, 0);
  const teams = state.teams.map((t) => {
    if (t.id === state.selectedTeamId) {
      return { ...t, budget: t.budget + budgetDelta, driverIds: rebuildRoster(t.driverIds) };
    }
    const aiDelta = aiRollover.budgetDeltaByTeam[t.id] ?? 0;
    return aiDelta ? { ...t, budget: t.budget + aiDelta } : t;
  });

  // Owner-expectation review for the completed season → owner patience, then
  // fresh expectations for the upcoming season.
  const expectationReviews: ExpectationReview[] = [...(state.expectationReviews ?? [])];
  let teamReputations: Record<string, TeamReputation> | undefined = state.teamReputations;
  let playerReview: ExpectationReview | undefined;
  if (playerTeam && state.teamExpectations?.[playerTeam.id]) {
    const exp = state.teamExpectations[playerTeam.id];
    const idx = state.constructorStandings.findIndex((s) => s.entityId === playerTeam.id);
    const standing = idx >= 0 ? state.constructorStandings[idx] : undefined;
    const review = reviewExpectation(exp, {
      constructorPosition: idx >= 0 ? idx + 1 : state.teams.length,
      points: standing?.points ?? 0,
      wins: standing?.wins ?? 0,
    });
    playerReview = review;
    expectationReviews.push(review);
    commercialNotes.push(review.summary);
    const patience = applyPatience(state.teamReputations?.[playerTeam.id], exp, review);
    if (patience.reputation && teamReputations) {
      teamReputations = { ...teamReputations, [playerTeam.id]: patience.reputation };
    }
  }
  const nextExpectations: Record<string, TeamExpectation> | undefined = state.teamExpectations
    ? buildTeamExpectations(teams, nextYear)
    : undefined;
  // Carry forward the matured owner patience into next season's expectation.
  if (nextExpectations && teamReputations) {
    for (const id of Object.keys(nextExpectations)) {
      const patience = teamReputations[id]?.ownerPatience;
      if (patience !== undefined) nextExpectations[id] = { ...nextExpectations[id], ownerPatience: patience };
    }
  }

  // Team Principal review: the owner judges your season, moving job security and
  // reputation and possibly renewing or sacking you. If you accepted a rival
  // offer (or were sacked but another team still wants you) you change teams for
  // the new season. Fresh approaches are generated for next year.
  let nextPrincipal = state.principal;
  let nextJobOffers = state.jobOffers;
  let moveTeamId: string | undefined;
  const principalNotes: string[] = [];
  if (nextPrincipal && playerTeam && playerReview) {
    const champDriver = state.driverStandings[0];
    const champDriverTeam = champDriver
      ? state.drivers.find((d) => d.id === champDriver.entityId)?.teamId
      : undefined;
    const standingIdx = state.constructorStandings.findIndex((s) => s.entityId === playerTeam.id);
    const playerStandingRow = standingIdx >= 0 ? state.constructorStandings[standingIdx] : undefined;
    const podiums = Object.values(state.completedRaceResults).reduce(
      (sum, res) =>
        sum +
        res.filter((r) => r.teamId === playerTeam.id && r.position != null && r.position >= 1 && r.position <= 3)
          .length,
      0,
    );
    const outcome: PrincipalSeasonOutcome = {
      wins: playerStandingRow?.wins ?? 0,
      podiums,
      driverTitle: champDriverTeam === playerTeam.id,
      constructorTitle: state.constructorStandings[0]?.entityId === playerTeam.id,
    };

    const reviewed = reviewPrincipal(nextPrincipal, playerReview, outcome);
    nextPrincipal = reviewed.profile;
    principalNotes.push(...reviewed.notes);

    // Decide whether the principal changes teams next season.
    const accepted = state.acceptedJobOfferId
      ? (state.jobOffers ?? []).find((o) => o.id === state.acceptedJobOfferId && o.kind === 'Offer')
      : undefined;
    if (accepted) {
      moveTeamId = accepted.teamId;
      const dest = state.teams.find((t) => t.id === accepted.teamId);
      principalNotes.push(`You accepted the job at ${dest?.name ?? 'a new team'} for ${nextYear}.`);
    } else if (reviewed.status === 'sacked') {
      const rehire = bestRehireOffer(state.jobOffers ?? []);
      if (rehire) {
        moveTeamId = rehire.teamId;
        const dest = state.teams.find((t) => t.id === rehire.teamId);
        principalNotes.push(`After being let go, ${dest?.name ?? 'another team'} have hired you for ${nextYear}.`);
      } else {
        // No rival wants you: a one-year probation lifeline at the same team.
        nextPrincipal = { ...nextPrincipal, jobSecurity: 35, contractYearsRemaining: 1 };
        principalNotes.push('No rival team came calling — the board grants you one final year on probation.');
      }
    }

    // Move the principal's record/contract to the destination team.
    if (moveTeamId) {
      nextPrincipal = {
        ...nextPrincipal,
        currentTeamId: moveTeamId,
        contractYearsRemaining: accepted?.contractYears ?? 2,
        jobSecurity: Math.max(nextPrincipal.jobSecurity, 50),
        careerStats: {
          ...nextPrincipal.careerStats,
          teamsManaged: nextPrincipal.careerStats.teamsManaged.includes(moveTeamId)
            ? nextPrincipal.careerStats.teamsManaged
            : [...nextPrincipal.careerStats.teamsManaged, moveTeamId],
        },
      };
    }

    // Generate next season's approaches from the principal's new standing.
    nextJobOffers = generateJobOffers(nextPrincipal, teams, teamReputations, nextYear, state.randomSeed);
  }

  // Load next year's real schedule (and its points system / regulations) when
  // we have data for it; otherwise reuse the current calendar. The career's
  // teams/drivers carry over as alternate history — only the schedule follows
  // the new season.
  const nextBundle = getSeasonBundle(nextYear, state.series);
  const nextSeason = nextBundle?.season;
  const calendar = (nextSeason?.calendar ?? state.calendar).map((r) => ({
    ...r,
    completed: false,
  }));
  const pointsSystemId = nextSeason?.pointsSystemId ?? state.pointsSystemId;
  const regulationSetId = nextSeason?.regulationSetId ?? state.regulationSetId;

  // Carry driver relationships into the new line-up: loyalty drifts toward
  // neutral, chemistry grows another year, morale/frustration recover, and
  // teammate links + number-one status are recomputed. Unhappy player drivers
  // are flagged in the offseason notes.
  const nextRelationships = rolloverRelationships(
    state.driverRelationships,
    teams,
    drivers,
    teamReputations,
    `${state.randomSeed}-rel-${nextYear}`,
  );
  const relationshipNotes: string[] = [];
  for (const d of drivers.filter((x) => x.teamId === state.selectedTeamId)) {
    const prev = state.driverRelationships?.[d.id];
    if (prev && (prev.morale < 30 || prev.teamLoyalty < 25)) {
      relationshipNotes.push(`${d.name} is unhappy at the team and may look elsewhere.`);
    }
  }

  // Fresh regulation proposals for the season after the new one, voted on
  // during the upcoming season. Uses the updated grid + owner-patience profiles.
  const nextProposals = generateRegulationProposals(
    teams,
    teamReputations,
    nextEngine,
    nextYear + 1,
    `${state.randomSeed}-reg-${nextYear}`,
    3,
    state.series,
  );

  // Driver aging & development (Living Universe Phase 10): every driver ages a
  // year and their ratings move along their curve — youngsters improve toward
  // their ceiling, peak drivers hold, veterans decline. The player's Driver
  // Academy lifts their own developing drivers a little more.
  const academyBoost = facilityYouthDevelopmentBonus(nextFacilities);
  const nextCurves: Record<string, DriverDevelopmentCurve> = { ...(state.developmentCurves ?? {}) };
  const developmentNotes: string[] = [];
  const developedDrivers = drivers.map((d) => {
    let curve = nextCurves[d.id];
    if (!curve) {
      curve = createDriverDevelopmentCurve(d, state.randomSeed);
      nextCurves[d.id] = curve;
    }
    const isPlayer = d.teamId === state.selectedTeamId;
    const { driver, result } = developmentStep(curve, d, state.randomSeed, {
      seasonYear: nextYear,
      academyBoost: isPlayer ? academyBoost : 0,
    });
    if (isPlayer && Math.abs(result.overallAfter - result.overallBefore) >= 0.2) {
      const dir = result.overallAfter >= result.overallBefore ? 'improved to' : 'slipped to';
      developmentNotes.push(
        `${driver.name} ${dir} ${result.overallAfter.toFixed(1)} overall (${result.phase.toLowerCase()}).`,
      );
    }
    return driver;
  });

  // Active-driver retirement (long-run stability): now that drivers have aged,
  // review contracted race drivers for retirement so the grid doesn't accumulate
  // veterans who never age out. Vacated seats are refilled downstream — AI teams
  // by their offseason market pass, the player through the signing UI.
  const retirement = applyDriverRetirements(developedDrivers, teams, state.randomSeed, nextYear);
  const rosterDrivers = retirement.drivers;
  const rosterTeams = retirement.teams;

  // AI offseason actions (Phase D): every non-player team now *acts* on its
  // Phase-C brain — develops its car, works the driver market (fills/renews/
  // signs), signs & promotes youth academy prospects, and makes light staff/
  // sponsor moves. Runs on the assembled next-season entities so its moves land
  // in the new season, and its notes feed the rollover summary + news feed.
  const aiReservedNames = new Set<string>();
  for (const d of rosterDrivers) {
    if (d.teamId === state.selectedTeamId) aiReservedNames.add(d.name.trim().toLowerCase());
  }
  for (const a of nextAcademy) aiReservedNames.add(a.name.trim().toLowerCase());
  const aiMarket = careerMarketBundle({
    ...state,
    seasonYear: nextYear,
    drivers: rosterDrivers,
    academy: nextAcademy,
    signedMarketIds: finalSignedMarketIds,
  });
  const aiOffseason = runAIOffseason({
    nextYear,
    seed: state.randomSeed,
    selectedTeamId: state.selectedTeamId,
    teams: rosterTeams,
    drivers: rosterDrivers,
    cars,
    engine: nextEngine,
    aiTeamStates: aiRollover.states,
    aiAcademies: state.aiAcademies ?? {},
    orgRatings: state.teamOrgRatings ?? {},
    market: aiMarket,
    signedMarketIds: finalSignedMarketIds,
    reservedNames: aiReservedNames,
    constructorStandings: state.constructorStandings,
  });

  const champion = state.driverStandings[0];
  const constructorChamp = state.constructorStandings[0];
  const summary: OffseasonSummary = {
    seasonYear: state.seasonYear,
    championDriverId: champion?.entityId,
    championTeamId: constructorChamp?.entityId,
    notes: [
      ...signings.flatMap((s) => {
        if (s.source === 'reserve') return [`Promoted ${s.name} to a race seat for ${nextYear}.`];
        if (s.source === 'market' && marketBidWon.get(s.sourceId) === false) return [];
        return [`Signed ${s.name} for ${nextYear}.`];
      }),
      ...biddingNotes,
      ...departureNotes,
      ...firstOption.notes,
      ...marketRolloverNotes(marketChanges),
      ...(nextAcademy.length ? [`${nextAcademy.length} academy driver(s) progressed.`] : []),
      ...facilityNotes,
      ...engineNotes,
      ...commercialNotes,
      ...principalNotes,
      ...relationshipNotes,
      ...voteResolution.notes,
      ...developmentNotes,
      ...retirement.notes,
      ...aiRollover.notes,
      ...aiOffseason.notes,
    ],
  };

  // Universe history / records (Living Universe Phase 11): archive the season
  // that just finished — its race records, champions and final standings — and
  // roll the career stats + all-time records forward before the per-season state
  // is cleared below.
  const driverNameById = new Map(state.drivers.map((d) => [d.id, d.name] as const));
  const teamNameById = new Map(state.teams.map((t) => [t.id, t.name] as const));
  const prevDriverStats = state.universeHistory?.driverCareerStats ?? {};
  const prevTeamStats = state.universeHistory?.teamCareerStats ?? {};
  const nextUniverseHistory = finalizeSeasonHistory(state.universeHistory, {
    seasonYear: state.seasonYear,
    series: state.series,
    driverChampionId: champion?.entityId,
    constructorChampionId: constructorChamp?.entityId,
    finalDriverStandings: state.driverStandings,
    finalConstructorStandings: state.constructorStandings,
    raceArchive: (state.raceArchive ?? []).filter((a) => a.season === state.seasonYear),
    completedRaceResults: state.completedRaceResults,
    regulationChanges: voteResolution.notes,
    nameOfDriver: (id) => driverNameById.get(id) ?? prevDriverStats[id]?.name ?? id,
    nameOfTeam: (id) => teamNameById.get(id) ?? prevTeamStats[id]?.name ?? id,
  });

  const now = new Date().toISOString();
  const nextState: GameState = {
    ...state,
    updatedAt: now,
    seasonYear: nextYear,
    currentRaceIndex: 0,
    seasonComplete: false,
    calendar,
    pointsSystemId,
    regulationSetId,
    drivers: aiOffseason.drivers,
    cars: aiOffseason.cars,
    teams: aiOffseason.teams,
    teamOrgRatings: aiOffseason.orgRatings,
    aiAcademies: aiOffseason.aiAcademies,
    facilities: nextFacilities,
    engine: aiOffseason.engine ?? nextEngine,
    finance: [...(state.finance ?? []), ...txns],
    commercial: nextCommercial,
    teamExpectations: nextExpectations ?? state.teamExpectations,
    teamReputations,
    expectationReviews,
    principal: nextPrincipal,
    jobOffers: nextJobOffers,
    acceptedJobOfferId: undefined,
    driverRelationships: nextRelationships,
    teamOrderHistory: [],
    regulationHistory: regulationHistoryWithVotes,
    regulationProposals: nextProposals,
    regulationVoteHistory: [...(state.regulationVoteHistory ?? []), ...voteResolution.results],
    scouting: state.scouting
      ? { ...refreshScoutingNetwork(state.scouting, nextFacilities)!, reports: {} }
      : state.scouting,
    developmentCurves: nextCurves,
    universeHistory: nextUniverseHistory,
    aiTeamStates: aiRollover.states,
    carSetups,
    academy: nextAcademy,
    pendingSignings: [],
    academyDecisions: [],
    signedMarketIds: aiOffseason.signedMarketIds,
    completedRaceResults: {},
    qualifyingResults: {},
    raceEvents: {},
    driverStandings: [],
    constructorStandings: [],
    activeDevelopmentProjects: [],
    completedDevelopmentProjects: [],
    offseasonHistory: [...state.offseasonHistory, summary],
    news: [
      {
        id: `news-season-${nextYear}`,
        headline: `Welcome to the ${nextYear} season`,
        body:
          summary.notes.length > 0
            ? summary.notes.join(' ')
            : 'A new championship begins.',
        timestamp: now,
      },
      ...aiOffseason.news.slice(0, 12).map((n, i) => ({
        id: `news-ai-${nextYear}-${i}`,
        headline: n.headline,
        body: n.body ?? n.headline,
        timestamp: now,
      })),
      ...state.news,
    ].slice(0, 50),
  };

  // If the principal switched teams, re-point the player-scoped systems
  // (selected team, setups, commercial, facilities, engine deal) at the new team.
  return moveTeamId ? applyPrincipalMove(nextState, moveTeamId) : nextState;
}

// Switch the player to a new team after a principal move: rebuild the
// team-scoped systems for the destination team. The principal carries their
// staff, academy and finance ledger; the new team's drivers, car, budget and
// engine deal come from the existing universe state.
function applyPrincipalMove(state: GameState, newTeamId: string): GameState {
  const newTeam = state.teams.find((t) => t.id === newTeamId);
  if (!newTeam) return state;
  const newDrivers = state.drivers.filter((d) => d.teamId === newTeamId);

  const carSetups: Record<string, CarSetup> = {};
  for (const d of newDrivers) carSetups[d.id] = { ...BALANCED_SETUP };

  const commercial = buildInitialCommercial(newTeam, newDrivers, state.randomSeed, state.series);
  const facilities = createInitialFacilities(newTeamId, newTeam.reputation);
  const engine = state.engine
    ? { ...state.engine, currentDeal: state.engine.deals?.[newTeamId], pendingDeal: undefined }
    : state.engine;

  // Keep the AI brains consistent with the new player team: the team the player
  // just joined is now player-controlled (drop its brain), and the team they
  // left rejoins the AI paddock (give it one).
  const movedState: GameState = { ...state, selectedTeamId: newTeamId };
  const aiTeamStates = { ...(state.aiTeamStates ?? {}) };
  delete aiTeamStates[newTeamId];
  const leftTeam = state.teams.find((t) => t.id === state.selectedTeamId);
  if (leftTeam && !aiTeamStates[leftTeam.id]) {
    aiTeamStates[leftTeam.id] = buildAITeamState(movedState, leftTeam);
  }

  return {
    ...movedState,
    carSetups,
    commercial,
    facilities,
    engine,
    aiTeamStates,
  };
}
