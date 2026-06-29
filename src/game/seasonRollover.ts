// Offseason → next-season rollover. Applies the driver-market decisions made
// during the offseason (seat signings, academy promotions), progresses academy
// members, carries the player car's development into next year, and resets the
// season for a fresh championship. Only the player's seats change; the AI grid
// is stable for now. Pure and deterministic.

import { getMarketBundle } from '../data';
import { BALANCED_SETUP } from '../data/setup/setupComponents';
import { calculateOffseasonCarryover } from '../sim/developmentEngine';
import {
  academyMemberToDriver,
  marketDriverToDriver,
  progressAcademyMember,
} from '../sim/driverMarketEngine';
import { driverSalary, makeTransaction, toMoney } from '../sim/financeEngine';
import type { Car, Driver, OffseasonSummary, Team } from '../types/gameTypes';
import type { AcademyMember } from '../types/marketTypes';
import type { FinanceTransaction } from '../types/financeTypes';
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

  // Resolve each queued signing into the replacement driver for that seat.
  const replacements = new Map<string, Driver>();
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
    } else {
      const a = academy.find((x) => x.id === sign.sourceId);
      if (!a) continue;
      replacements.set(sign.seatDriverId, academyMemberToDriver(a, seat));
      usedAcademyIds.add(a.id);
    }
  }

  // Apply seat replacements.
  const drivers = state.drivers.map((d) => replacements.get(d.id) ?? d);

  // Carry per-driver setups across; drop replaced drivers, seed new ones.
  const carSetups = { ...(state.carSetups ?? {}) };
  for (const [oldId, newDriver] of replacements) {
    delete carSetups[oldId];
    if (newDriver.teamId === state.selectedTeamId) {
      carSetups[newDriver.id] = { ...BALANCED_SETUP };
    }
  }

  // Progress remaining academy members one offseason; promoted ones leave.
  const nextAcademy: AcademyMember[] = academy
    .filter((a) => !usedAcademyIds.has(a.id))
    .map(progressAcademyMember);

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
  const playerTeam = state.teams.find((t) => t.id === state.selectedTeamId);
  const sponsorship = sponsorshipIncome(playerTeam, playerDrivers);
  if (sponsorship > 0) {
    txns.push(makeTransaction(nextYear, 'Sponsorship', `${nextYear} sponsorship`, sponsorship));
  }
  const budgetDelta = txns.reduce((sum, t) => sum + t.amount, 0);
  const teams = state.teams.map((t) =>
    t.id === state.selectedTeamId ? { ...t, budget: t.budget + budgetDelta } : t,
  );

  // Fresh calendar (same template, uncompleted) and reset season bookkeeping.
  const calendar = state.calendar.map((r) => ({ ...r, completed: false }));

  const champion = state.driverStandings[0];
  const constructorChamp = state.constructorStandings[0];
  const summary: OffseasonSummary = {
    seasonYear: state.seasonYear,
    championDriverId: champion?.entityId,
    championTeamId: constructorChamp?.entityId,
    notes: [
      ...signings.map((s) => `Signed ${s.name} for ${nextYear}.`),
      ...(nextAcademy.length ? [`${nextAcademy.length} academy driver(s) progressed.`] : []),
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
    drivers,
    cars,
    teams,
    finance: [...(state.finance ?? []), ...txns],
    carSetups,
    academy: nextAcademy,
    pendingSignings: [],
    signedMarketIds: newSignedMarketIds,
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
