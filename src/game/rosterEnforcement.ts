// Pre-Race-1 F1 roster enforcement.
//
// F1 teams may intentionally start preseason with 0, 1, or 2 race drivers.
// Before Race 1 (the first race weekend), every F1 team must have exactly 2
// active race drivers. AI-controlled teams are auto-filled from the driver
// market. The player's team is blocked from entering the race weekend until
// they sign enough drivers.
//
// This module provides pure, deterministic functions that operate on GameState.
// It is imported by the reducer for game-state-level enforcement and by the UI
// for route guarding and messaging.

import { careerMarketBundle } from '../sim/careerMarketEngine';
import { marketDriverToDriver } from '../sim/driverMarketEngine';
import { makeTransaction, toMoney } from '../sim/financeEngine';
import { syncDriverRelationshipsForTeam } from '../sim/relationshipEngine';
import {
  activeDriversForTeam,
  driversForTeam,
  isReserveContract,
  MAX_RACE_DRIVERS,
} from './careerState';
import type { GameState } from './careerState';
import type { MarketDriver } from '../types/marketTypes';

export type RosterViolation = {
  teamId: string;
  message: string;
};

export type EnforcementResult = {
  state: GameState;
  violations: RosterViolation[];
  autoFilled: { teamId: string; driverNames: string[] }[];
};

// Is the player's team ready to enter the race weekend?
export function canEnterRaceWeekend(state: GameState): {
  allowed: boolean;
  reason?: string;
} {
  if (state.series !== 'F1') return { allowed: true };
  const active = activeDriversForTeam(state, state.selectedTeamId);
  if (active.length < MAX_RACE_DRIVERS) {
    return {
      allowed: false,
      reason: `Your team must sign two race drivers before entering Round 1. You currently have ${active.length} active race driver${active.length === 1 ? '' : 's'}.`,
    };
  }
  return { allowed: true };
}

// Is this the preseason (before Race 1)?
export function isPreseason(state: GameState): boolean {
  return state.currentRaceIndex === 0 && !state.calendar[0]?.completed;
}

// Find the best available market driver for an AI team, excluding drivers
// already taken or assigned to other teams.
function findBestAvailableDriver(
  market: MarketDriver[],
  takenMarketIds: Set<string>,
  activeDriverIds: Set<string>,
): MarketDriver | undefined {
  const candidates = market
    .filter((d) => !takenMarketIds.has(d.id))
    .filter((d) => !activeDriverIds.has(`d-${d.id}`))
    .sort((a, b) => b.overall - a.overall);
  return candidates[0];
}

// Find a free driver number.
function freeNumber(used: Set<number>): number {
  let n = 1;
  while (used.has(n)) n += 1;
  return n;
}

// Auto-fill AI teams that have fewer than 2 active race drivers.
// Returns the updated state plus a list of auto-fill actions.
export function enforceF1Rosters(state: GameState): EnforcementResult {
  if (state.series !== 'F1') {
    return { state, violations: [], autoFilled: [] };
  }

  let drivers = [...state.drivers];
  const teams = state.teams.map((t) => ({ ...t, driverIds: [...t.driverIds] }));
  const violations: RosterViolation[] = [];
  const autoFilled: { teamId: string; driverNames: string[] }[] = [];
  const signedMarketIds = new Set(state.signedMarketIds ?? []);

  // Collect all currently active driver IDs (across all teams) to prevent
  // signing the same driver to multiple teams.
  const activeDriverIds = new Set<string>();
  for (const team of teams) {
    for (const d of activeDriversForTeam({ ...state, drivers, teams }, team.id)) {
      activeDriverIds.add(d.id);
    }
  }

  // Get the market bundle for available drivers.
  const market = careerMarketBundle({ ...state, drivers, teams });

  // Process AI teams (non-player teams).
  const aiTeams = teams.filter((t) => t.id !== state.selectedTeamId);

  for (const team of aiTeams) {
    const active = activeDriversForTeam({ ...state, drivers, teams }, team.id);
    const roster = drivers.filter((d) => d.teamId === team.id);

    // Check for over-assignment (>3 total drivers).
    if (roster.length > 3) {
      violations.push({
        teamId: team.id,
        message: `${team.name} has ${roster.length} total assigned drivers (max 3).`,
      });
      continue;
    }

    const needed = MAX_RACE_DRIVERS - active.length;
    if (needed <= 0) continue;

    const signedNames: string[] = [];
    const usedNumbers = new Set(drivers.map((d) => d.number));

    for (let i = 0; i < needed; i++) {
      const pick = findBestAvailableDriver(market.drivers, signedMarketIds, activeDriverIds);
      if (!pick) {
        violations.push({
          teamId: team.id,
          message: `${team.name} could not find enough available drivers to fill ${needed} race seat(s).`,
        });
        break;
      }

      const number = freeNumber(usedNumbers);
      usedNumbers.add(number);
      const newDriver = marketDriverToDriver(pick, { teamId: team.id, number });
      newDriver.contractType = 'seat';
      newDriver.contractYearsRemaining = 2;

      drivers = [...drivers, newDriver];
      team.driverIds = [...team.driverIds, newDriver.id];
      signedMarketIds.add(pick.id);
      activeDriverIds.add(newDriver.id);
      signedNames.push(pick.name);
    }

    if (signedNames.length > 0) {
      autoFilled.push({ teamId: team.id, driverNames: signedNames });
    }
  }

  // Post-enforcement validation.
  const finalState = { ...state, drivers, teams, signedMarketIds: [...signedMarketIds] };

  for (const team of teams) {
    const active = activeDriversForTeam(finalState, team.id);
    if (active.length !== MAX_RACE_DRIVERS) {
      violations.push({
        teamId: team.id,
        message: `${team.name} has ${active.length} active race drivers after enforcement (expected ${MAX_RACE_DRIVERS}).`,
      });
    }
    const roster = drivers.filter((d) => d.teamId === team.id);
    if (roster.length > 3) {
      violations.push({
        teamId: team.id,
        message: `${team.name} has ${roster.length} total assigned drivers after enforcement (max 3).`,
      });
    }
  }

  // Check for duplicate active drivers across teams.
  const driverTeamCount = new Map<string, number>();
  for (const team of teams) {
    for (const d of activeDriversForTeam(finalState, team.id)) {
      driverTeamCount.set(d.id, (driverTeamCount.get(d.id) ?? 0) + 1);
    }
  }
  for (const [driverId, count] of driverTeamCount) {
    if (count > 1) {
      violations.push({
        teamId: '*',
        message: `Driver ${driverId} is active on ${count} teams after enforcement.`,
      });
    }
  }

  return { state: finalState, violations, autoFilled };
}

// Validate that a player signing a race driver is legal.
export function validateRaceSeatSigning(
  state: GameState,
  marketId: string,
): { valid: boolean; reason?: string } {
  if (state.series !== 'F1') {
    return { valid: false, reason: 'Race-seat signing is only available for F1 teams.' };
  }
  if (!isPreseason(state)) {
    return { valid: false, reason: 'Race-seat signings are only available during preseason.' };
  }

  const team = state.teams.find((t) => t.id === state.selectedTeamId);
  if (!team) return { valid: false, reason: 'Team not found.' };

  const roster = driversForTeam(state, state.selectedTeamId);
  const active = activeDriversForTeam(state, state.selectedTeamId);
  if (active.length >= MAX_RACE_DRIVERS) {
    return { valid: false, reason: 'Team already has 2 active race drivers.' };
  }
  if (roster.length >= 3) {
    return { valid: false, reason: 'Team already has 3 assigned drivers (maximum).' };
  }

  const market = careerMarketBundle(state);
  const m = market.drivers.find((d) => d.id === marketId);
  if (!m) return { valid: false, reason: 'Driver not found in market.' };

  if ((state.signedMarketIds ?? []).includes(marketId)) {
    return { valid: false, reason: 'Driver already signed.' };
  }

  // Budget check: the buyout cost is charged as a one-off signing fee.
  const buyoutCost = toMoney(m.buyoutCost);
  const budget = team.budget;
  if (buyoutCost > budget) {
    return { valid: false, reason: `Insufficient budget. Signing ${m.name} costs ${buyoutCost.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} but your team has only ${budget.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}.` };
  }

  // Check the driver is not already an active race driver for another team.
  const driverId = `d-${m.id}`;
  const existing = state.drivers.find((d) => d.id === driverId);
  if (existing && !isReserveContract(existing) && existing.teamId !== state.selectedTeamId) {
    return { valid: false, reason: `${m.name} is already an active race driver for another team.` };
  }

  return { valid: true };
}

// Sign a market driver into an open race seat for the player's team.
// This is an immediate signing (not a pending offseason queue) — the driver
// joins the roster right away with a race-seat contract. The buyout cost is
// deducted from the team budget and a finance transaction is recorded.
export function signRaceDriver(state: GameState, marketId: string): GameState {
  const validation = validateRaceSeatSigning(state, marketId);
  if (!validation.valid) return state;

  const market = careerMarketBundle(state);
  const m = market.drivers.find((d) => d.id === marketId)!;

  const usedNumbers = new Set(state.drivers.map((d) => d.number));
  const number = freeNumber(usedNumbers);

  const newDriver = marketDriverToDriver(m, { teamId: state.selectedTeamId, number });
  newDriver.contractType = 'seat';
  newDriver.contractYearsRemaining = 2;

  // Deduct buyout cost from team budget and record a finance transaction.
  const buyoutCost = toMoney(m.buyoutCost);
  const txn = makeTransaction(
    state.seasonYear,
    'Driver Signing',
    `Preseason race-seat: ${m.name}`,
    -buyoutCost,
  );

  const teams = state.teams.map((t) =>
    t.id === state.selectedTeamId
      ? { ...t, budget: t.budget - buyoutCost, driverIds: [...t.driverIds, newDriver.id] }
      : t,
  );

  const updated = {
    ...state,
    drivers: [...state.drivers, newDriver],
    teams,
    finance: [...(state.finance ?? []), txn],
    signedMarketIds: [...(state.signedMarketIds ?? []), m.id],
  };
  // Sync relationships after roster change.
  return syncDriverRelationshipsForTeam(updated, state.selectedTeamId, state.randomSeed ?? 'sync');
}
