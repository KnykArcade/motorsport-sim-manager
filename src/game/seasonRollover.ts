// Offseason → next-season rollover. Applies the driver-market decisions made
// during the offseason (seat signings, academy promotions), progresses academy
// members, carries the player car's development into next year, and resets the
// season for a fresh championship. Only the player's seats change; the AI grid
// is stable for now. Pure and deterministic.

import { getMarketBundle, getSeasonBundle } from '../data';
import {
  FACILITY_SPECS,
  facilityYouthDevelopmentBonus,
  resolvePendingUpgrades,
} from '../sim/facilityEngine';
import { BALANCED_SETUP } from '../data/setup/setupComponents';
import { calculateOffseasonCarryover } from '../sim/developmentEngine';
import {
  academyMemberToDriver,
  marketDriverToDriver,
  progressAcademyMember,
} from '../sim/driverMarketEngine';
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
import type { Car, Driver, OffseasonSummary, Team } from '../types/gameTypes';
import type { AcademyMember } from '../types/marketTypes';
import type { FinanceTransaction } from '../types/financeTypes';
import type { CommercialState } from '../types/sponsorTypes';
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

export function advanceSeason(state: GameState): GameState {
  const nextYear = state.seasonYear + 1;
  const market = getMarketBundle(state.seasonYear, state.series);
  const signings = state.pendingSignings ?? [];
  const academy = state.academy ?? [];

  // Resolve each queued signing.
  //  - market/academy: a new driver replaces the seat's current driver.
  //  - reserve: the team's own 3rd driver is promoted into the seat (the
  //    displaced seat driver leaves).
  const replacements = new Map<string, Driver>(); // oldSeatId -> new driver
  const reservePromotions: { seatDriverId: string; reserveId: string; upgraded: Driver }[] = [];
  const usedAcademyIds = new Set<string>();
  const newSignedMarketIds = [...(state.signedMarketIds ?? [])];

  for (const sign of signings) {
    const seatDriver = state.drivers.find((d) => d.id === sign.seatDriverId);
    if (!seatDriver) continue;
    const seat = { teamId: seatDriver.teamId, number: seatDriver.number };
    if (sign.source === 'market') {
      const m = market?.drivers.find((d) => d.id === sign.sourceId);
      if (!m) continue;
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
  const drivers = state.drivers
    .map((d) => replacements.get(d.id) ?? d)
    .filter((d) => !promotedSeatIds.has(d.id))
    .map((d) => upgradeById.get(d.id) ?? d)
    .filter((d) => !departures.has(d.id));

  // Keep team rosters (driverIds) consistent with the moves above.
  const remapId = (id: string): string => replacements.get(id)?.id ?? id;
  const rebuildRoster = (ids: string[]): string[] => {
    let next = ids.map(remapId);
    for (const p of reservePromotions) {
      next = next.filter((id) => id !== p.reserveId); // pull reserve out of its slot
      const pos = next.indexOf(p.seatDriverId);
      if (pos >= 0) next[pos] = p.reserveId; // reserve takes the seat
    }
    return next.filter((id) => !departures.has(id));
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

  // Progress remaining academy members one offseason; promoted ones leave.
  // A Driver Academy facility accelerates their growth.
  const youthBoost = facilityYouthDevelopmentBonus(state.facilities);
  const nextAcademy: AcademyMember[] = academy
    .filter((a) => !usedAcademyIds.has(a.id))
    .map((a) => progressAcademyMember(a, youthBoost));

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

  // Carry the player car's development into the new baseline; reset condition.
  const playerCar = carForTeam(state, state.selectedTeamId);
  const cars: Car[] = state.cars.map((c) => {
    if (playerCar && c.id === playerCar.id) {
      const ratings = calculateOffseasonCarryover(
        c,
        state.completedDevelopmentProjects,
        state.regulationHistory,
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
    const m = market?.drivers.find((d) => d.id === sign.sourceId);
    if (m && m.buyoutCost > 0) {
      txns.push(makeTransaction(nextYear, 'Driver Signing', `Buyout: ${m.name}`, -toMoney(m.buyoutCost)));
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
  const budgetDelta = txns.reduce((sum, t) => sum + t.amount, 0);
  const teams = state.teams.map((t) =>
    t.id === state.selectedTeamId
      ? { ...t, budget: t.budget + budgetDelta, driverIds: rebuildRoster(t.driverIds) }
      : t,
  );

  // Owner-expectation review for the completed season → owner patience, then
  // fresh expectations for the upcoming season.
  const expectationReviews: ExpectationReview[] = [...(state.expectationReviews ?? [])];
  let teamReputations: Record<string, TeamReputation> | undefined = state.teamReputations;
  if (playerTeam && state.teamExpectations?.[playerTeam.id]) {
    const exp = state.teamExpectations[playerTeam.id];
    const idx = state.constructorStandings.findIndex((s) => s.entityId === playerTeam.id);
    const standing = idx >= 0 ? state.constructorStandings[idx] : undefined;
    const review = reviewExpectation(exp, {
      constructorPosition: idx >= 0 ? idx + 1 : state.teams.length,
      points: standing?.points ?? 0,
      wins: standing?.wins ?? 0,
    });
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

  const champion = state.driverStandings[0];
  const constructorChamp = state.constructorStandings[0];
  const summary: OffseasonSummary = {
    seasonYear: state.seasonYear,
    championDriverId: champion?.entityId,
    championTeamId: constructorChamp?.entityId,
    notes: [
      ...signings.map((s) =>
        s.source === 'reserve'
          ? `Promoted ${s.name} to a race seat for ${nextYear}.`
          : `Signed ${s.name} for ${nextYear}.`,
      ),
      ...departureNotes,
      ...(nextAcademy.length ? [`${nextAcademy.length} academy driver(s) progressed.`] : []),
      ...facilityNotes,
      ...commercialNotes,
    ],
  };

  const now = new Date().toISOString();
  return {
    ...state,
    updatedAt: now,
    seasonYear: nextYear,
    currentRaceIndex: 0,
    seasonComplete: false,
    calendar,
    pointsSystemId,
    regulationSetId,
    drivers,
    cars,
    teams,
    facilities: nextFacilities,
    finance: [...(state.finance ?? []), ...txns],
    commercial: nextCommercial,
    teamExpectations: nextExpectations ?? state.teamExpectations,
    teamReputations,
    expectationReviews,
    carSetups,
    academy: nextAcademy,
    pendingSignings: [],
    signedMarketIds: finalSignedMarketIds,
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
      ...state.news,
    ].slice(0, 50),
  };
}
