// Pure reducer wiring the simulation engines into state transitions.
// Keeping this outside React keeps the simulation testable and deterministic.

import { getTrackById } from '../data';
import { setupOptionsById } from '../data/setupOptions/setupOptions';
import { autoSetupOptionsForTrack } from '../sim/autoSetup';
import { qualifyingRunPlansById } from '../data/decisions/qualifyingRunPlans';
import { developmentProjectsById } from '../data/development/developmentProjects';
import { simulateQualifying } from '../sim/qualifyingEngine';
import { simulateRace } from '../sim/raceEngine';
import { buildConstructorStandings, buildDriverStandings } from '../sim/standingsEngine';
import { applyDevelopmentProgress } from '../sim/developmentEngine';
import { updateMorale } from '../sim/moraleEngine';
import { generateRaceNews } from '../sim/newsEngine';
import { aiQualifyingDecision } from './ai';
import {
  activeDriversForTeam,
  carForTeam,
  currentRace,
  driversForTeam,
  MAX_RACE_DRIVERS,
  type GameState,
} from './careerState';
import { buildRaceContext, playerTunedSetups } from './raceSetup';
import { createNewGame, type NewGameOptions } from './initialCareer';
import { advanceSeason } from './seasonRollover';
import { getMarketBundle, getMaxQualifiers, getStaffPool } from '../data';
import { marketDriverToDriver, signProspectToAcademy } from '../sim/driverMarketEngine';
import { makeTransaction, toMoney } from '../sim/financeEngine';
import { thirdDriverMidSeasonFee, thirdDriverSalary } from '../sim/contractEngine';
import { racePerformanceBonuses } from '../sim/commercialEngine';
import { developmentSuccessBonus } from '../sim/staffEngine';
import { classifyCrashDamage, damageConditionHit, repairCost } from '../sim/repairEngine';
import { buildRaceArchiveEntry } from '../sim/lapArchiveEngine';
import { createSeededRandom, deriveSeed } from '../sim/random';
import type { SeatSigning } from '../types/marketTypes';
import type { FinanceTransaction } from '../types/financeTypes';
import type {
  DevelopmentProject,
  Driver,
  QualifyingResult,
  RaceResult,
} from '../types/gameTypes';
import type {
  Entrant,
  QualifyingDecision,
  RaceDecision,
  RaceEvent,
  ScoreBreakdown,
} from '../types/simTypes';
import type { CarSetup } from '../types/setupTypes';
import type { PracticeAssignment, PracticeSession, PracticeSessionKind } from '../types/practiceTypes';
import { BALANCED_SETUP } from '../data/setup/setupComponents';
import {
  accumulateKnowledge,
  emptyKnowledge,
  runPracticeSession,
} from '../sim/practiceProgramEngine';

export type GameAction =
  | { type: 'NEW_GAME'; options: NewGameOptions }
  | { type: 'LOAD_GAME'; state: GameState }
  | { type: 'RUN_QUALIFYING'; decisions: QualifyingDecision[] }
  | { type: 'RUN_RACE'; decisions: RaceDecision[] }
  | {
      type: 'COMMIT_LIVE_RACE';
      results: RaceResult[];
      events: RaceEvent[];
      breakdowns: Record<string, ScoreBreakdown>;
    }
  | { type: 'START_DEVELOPMENT'; projectId: string }
  | { type: 'SET_CAR_SETUP'; driverId: string; setup: CarSetup }
  | {
      type: 'RUN_PRACTICE_SESSION';
      raceId: string;
      kind: PracticeSessionKind;
      assignments: PracticeAssignment[];
    }
  | { type: 'SIGN_MARKET_DRIVER'; marketId: string; seatDriverId: string }
  | { type: 'PROMOTE_ACADEMY'; academyId: string; seatDriverId: string }
  | { type: 'RELEASE_SIGNING'; seatDriverId: string }
  | { type: 'SIGN_YOUTH'; youthId: string }
  | { type: 'RELEASE_ACADEMY'; academyId: string }
  | { type: 'HIRE_STAFF'; staffId: string }
  | { type: 'FIRE_STAFF'; staffId: string }
  | { type: 'SWAP_RACE_DRIVER'; seatIndex: number; reserveDriverId: string }
  | { type: 'SIGN_THIRD_DRIVER'; marketId: string }
  | { type: 'PROMOTE_THIRD_DRIVER'; seatDriverId: string; thirdDriverId: string }
  | { type: 'ADVANCE_SEASON' }
  | { type: 'ADVANCE_RACE' };

// Run one practice session for the player's drivers: simulate each assignment,
// fold the results into the weekend knowledge, and apply the one-off confidence
// nudges to the drivers. Each session kind runs at most once per weekend, and
// the knowledge resets when a new race weekend begins.
function runPracticeSessionAction(
  state: GameState,
  raceId: string,
  kind: PracticeSessionKind,
  assignments: PracticeAssignment[],
): GameState {
  const race = currentRace(state);
  if (!race || race.id !== raceId) return state;
  const track = getTrackById(race.trackId);
  if (!track) return state;

  let wp = state.weekendPractice;
  if (!wp || wp.raceId !== raceId) {
    wp = { raceId, sessions: [], knowledge: emptyKnowledge(raceId) };
  }
  if (wp.sessions.some((s) => s.kind === kind && s.completed)) return state;

  const players = activeDriversForTeam(state, state.selectedTeamId);
  const driversById: Record<string, Driver> = {};
  const setupsById: Record<string, CarSetup> = {};
  for (const d of players) {
    driversById[d.id] = d;
    setupsById[d.id] = state.carSetups?.[d.id] ?? BALANCED_SETUP;
  }
  const validAssignments = assignments.filter((a) => driversById[a.driverId]);
  const session: PracticeSession = {
    id: `${raceId}-${kind}`,
    raceId,
    kind,
    assignments: validAssignments,
    completed: true,
  };

  const results = runPracticeSession(session, {
    raceId,
    track,
    seed: state.randomSeed,
    driversById,
    setupsById,
    knowledge: wp.knowledge,
  });
  session.results = results;

  const knowledge = accumulateKnowledge(wp.knowledge, results);

  const gainById: Record<string, number> = {};
  for (const r of results) gainById[r.driverId] = (gainById[r.driverId] ?? 0) + r.confidenceGain;
  const drivers = state.drivers.map((d) =>
    gainById[d.id]
      ? { ...d, confidence: Math.max(1, Math.min(100, Math.round(d.confidence + gainById[d.id]))) }
      : d,
  );

  const sessions = [...wp.sessions.filter((s) => s.kind !== kind), session];
  return { ...state, drivers, weekendPractice: { raceId, sessions, knowledge } };
}

function buildEntrants(state: GameState): Entrant[] {
  const entrants: Entrant[] = [];
  for (const team of state.teams) {
    const car = carForTeam(state, team.id);
    if (!car) continue;
    for (const driver of activeDriversForTeam(state, team.id)) {
      entrants.push({ driver, car });
    }
  }
  return entrants;
}

// Promote a reserve driver into one of the two race seats for the player team.
// The roster order (`team.driverIds`) defines who races: the first two entries
// are on track, the rest are reserves. Swapping reorders that list so the chosen
// reserve takes the seat and the displaced driver becomes a reserve.
function swapRaceDriver(state: GameState, seatIndex: number, reserveDriverId: string): GameState {
  if (seatIndex !== 0 && seatIndex !== 1) return state;
  const teamId = state.selectedTeamId;
  const team = state.teams.find((t) => t.id === teamId);
  if (!team) return state;

  const active = activeDriversForTeam(state, teamId).map((d) => d.id);
  if (active.includes(reserveDriverId)) return state;
  const reserve = state.drivers.find((d) => d.id === reserveDriverId && d.teamId === teamId);
  if (!reserve) return state;
  const seatDriverId = active[seatIndex];
  if (!seatDriverId) return state;

  const ids = [...team.driverIds];
  const seatPos = ids.indexOf(seatDriverId);
  const reservePos = ids.indexOf(reserveDriverId);
  if (seatPos === -1) return state;
  if (reservePos === -1) {
    ids[seatPos] = reserveDriverId;
    ids.push(seatDriverId);
  } else {
    ids[seatPos] = reserveDriverId;
    ids[reservePos] = seatDriverId;
  }

  const teams = state.teams.map((t) => (t.id === teamId ? { ...t, driverIds: ids } : t));
  return { ...state, teams };
}

// Sign a free-agent market driver mid-season as the player team's 3rd driver.
// They join the reserve pool on a cheaper deal and can be swapped into a race
// seat. One 3rd driver at a time; the prorated retainer is charged immediately.
function signThirdDriver(state: GameState, marketId: string): GameState {
  if (state.seasonComplete) return state; // mid-season signing only
  const teamId = state.selectedTeamId;
  const team = state.teams.find((t) => t.id === teamId);
  if (!team) return state;

  const roster = driversForTeam(state, teamId);
  if (roster.length >= MAX_RACE_DRIVERS + 1) return state; // already have a 3rd driver
  if (roster.some((d) => d.contractType === 'third')) return state;

  const m = getMarketBundle(state.seasonYear, state.series)?.drivers.find((d) => d.id === marketId);
  if (!m || (state.signedMarketIds ?? []).includes(m.id)) return state;

  const racesRemaining = Math.max(1, state.calendar.length - state.currentRaceIndex);
  const fee = thirdDriverMidSeasonFee(m.salary, racesRemaining, state.calendar.length);
  if (fee > playerBudget(state)) return state;

  const used = new Set(state.drivers.map((d) => d.number));
  let number = 1;
  while (used.has(number)) number += 1;

  const base = marketDriverToDriver(m, { teamId, number });
  const driver: Driver = {
    ...base,
    salary: thirdDriverSalary(m.salary),
    contractType: 'third',
    contractYearsRemaining: 1,
  };

  const charged = applyTransaction(
    state,
    makeTransaction(state.seasonYear, 'Driver Signing', `3rd driver: ${m.name}`, -fee),
  );
  return {
    ...charged,
    drivers: [...charged.drivers, driver],
    teams: charged.teams.map((t) =>
      t.id === teamId ? { ...t, driverIds: [...t.driverIds, driver.id] } : t,
    ),
    signedMarketIds: [...(charged.signedMarketIds ?? []), m.id],
  };
}

// Track the last debug breakdowns so the UI can show them (kept outside state
// to avoid bloating the save file).
export const lastBreakdowns: {
  qualifying: Record<string, ScoreBreakdown>;
  race: Record<string, ScoreBreakdown>;
} = { qualifying: {}, race: {} };

export function gameReducer(state: GameState | null, action: GameAction): GameState | null {
  switch (action.type) {
    case 'NEW_GAME':
      return createNewGame(action.options);

    case 'LOAD_GAME':
      return action.state;

    case 'RUN_QUALIFYING': {
      if (!state) return state;
      return runQualifying(state, action.decisions);
    }

    case 'RUN_RACE': {
      if (!state) return state;
      return runRace(state, action.decisions);
    }

    case 'COMMIT_LIVE_RACE': {
      if (!state) return state;
      const race = currentRace(state);
      if (!race) return state;
      return applyRaceResults(state, race, action.results, action.events, action.breakdowns);
    }

    case 'START_DEVELOPMENT': {
      if (!state) return state;
      return startDevelopment(state, action.projectId);
    }

    case 'SET_CAR_SETUP': {
      if (!state) return state;
      return {
        ...state,
        carSetups: { ...(state.carSetups ?? {}), [action.driverId]: action.setup },
      };
    }

    case 'RUN_PRACTICE_SESSION': {
      if (!state) return state;
      return runPracticeSessionAction(state, action.raceId, action.kind, action.assignments);
    }

    case 'SIGN_MARKET_DRIVER': {
      if (!state) return state;
      return queueSigning(state, action.seatDriverId, 'market', action.marketId);
    }

    case 'PROMOTE_ACADEMY': {
      if (!state) return state;
      return queueSigning(state, action.seatDriverId, 'academy', action.academyId);
    }

    case 'RELEASE_SIGNING': {
      if (!state) return state;
      return {
        ...state,
        pendingSignings: (state.pendingSignings ?? []).filter(
          (s) => s.seatDriverId !== action.seatDriverId,
        ),
      };
    }

    case 'SIGN_YOUTH': {
      if (!state) return state;
      return signYouth(state, action.youthId);
    }

    case 'RELEASE_ACADEMY': {
      if (!state) return state;
      return {
        ...state,
        academy: (state.academy ?? []).filter((a) => a.id !== action.academyId),
        // Drop any pending promotion that referenced this academy member.
        pendingSignings: (state.pendingSignings ?? []).filter(
          (s) => !(s.source === 'academy' && s.sourceId === action.academyId),
        ),
      };
    }

    case 'HIRE_STAFF': {
      if (!state) return state;
      return hireStaff(state, action.staffId);
    }

    case 'FIRE_STAFF': {
      if (!state) return state;
      return { ...state, staff: (state.staff ?? []).filter((s) => s.id !== action.staffId) };
    }

    case 'SWAP_RACE_DRIVER': {
      if (!state) return state;
      return swapRaceDriver(state, action.seatIndex, action.reserveDriverId);
    }

    case 'SIGN_THIRD_DRIVER': {
      if (!state) return state;
      return signThirdDriver(state, action.marketId);
    }

    case 'PROMOTE_THIRD_DRIVER': {
      if (!state) return state;
      return queueSigning(state, action.seatDriverId, 'reserve', action.thirdDriverId);
    }

    case 'ADVANCE_SEASON': {
      if (!state) return state;
      if (!state.seasonComplete) return state;
      return advanceSeason(state);
    }

    case 'ADVANCE_RACE': {
      if (!state) return state;
      return state;
    }

    default:
      return state;
  }
}

// Apply a finance transaction to the player's team: adjust the team balance and
// append the entry to the ledger.
function applyTransaction(state: GameState, txn: FinanceTransaction): GameState {
  const teams = state.teams.map((t) =>
    t.id === state.selectedTeamId ? { ...t, budget: t.budget + txn.amount } : t,
  );
  return { ...state, teams, finance: [...(state.finance ?? []), txn] };
}

function playerBudget(state: GameState): number {
  return state.teams.find((t) => t.id === state.selectedTeamId)?.budget ?? 0;
}

// Queue (or replace) a seat change for the player's seat held by seatDriverId.
// Signings are only allowed during the offseason (season complete). The buyout
// is charged at the season rollover; here we only check affordability.
function queueSigning(
  state: GameState,
  seatDriverId: string,
  source: SeatSigning['source'],
  sourceId: string,
): GameState {
  if (!state.seasonComplete) return state;
  const seat = state.drivers.find((d) => d.id === seatDriverId);
  if (!seat || seat.teamId !== state.selectedTeamId) return state;

  let name: string;
  if (source === 'market') {
    const m = getMarketBundle(state.seasonYear, state.series)?.drivers.find(
      (d) => d.id === sourceId,
    );
    if (!m || (state.signedMarketIds ?? []).includes(m.id)) return state;
    if (toMoney(m.buyoutCost) > playerBudget(state)) return state; // cannot afford buyout
    name = m.name;
  } else if (source === 'reserve') {
    // Promote the team's own 3rd driver into a seat — no buyout, no double-fill.
    const r = state.drivers.find(
      (d) => d.id === sourceId && d.teamId === state.selectedTeamId && d.contractType === 'third',
    );
    if (!r) return state;
    name = r.name;
  } else {
    const a = (state.academy ?? []).find((x) => x.id === sourceId);
    if (!a) return state;
    name = a.name;
  }

  const others = (state.pendingSignings ?? []).filter(
    (s) => s.seatDriverId !== seatDriverId && s.sourceId !== sourceId,
  );
  return {
    ...state,
    pendingSignings: [...others, { seatDriverId, source, sourceId, name }],
  };
}

// Hire a specialist: charge the one-off signing fee (must be affordable) and
// add them to the roster. One member per role — a new hire replaces the old.
function hireStaff(state: GameState, staffId: string): GameState {
  const roster = state.staff ?? [];
  if (roster.some((s) => s.id === staffId)) return state;
  const recruit = getStaffPool(state.seasonYear, state.series).find((s) => s.id === staffId);
  if (!recruit) return state;
  const fee = toMoney(recruit.signingFee);
  if (fee > playerBudget(state)) return state;
  const charged = applyTransaction(
    state,
    makeTransaction(state.seasonYear, 'Staff', `Hired ${recruit.name} (${recruit.role})`, -fee),
  );
  const nextRoster = [...roster.filter((s) => s.role !== recruit.role), recruit];
  return { ...charged, staff: nextRoster };
}

// Sign a youth prospect into the academy. The one-off signing fee is charged
// immediately; the player must be able to afford it.
function signYouth(state: GameState, youthId: string): GameState {
  if ((state.academy ?? []).some((a) => a.prospectId === youthId)) return state;
  const prospect = getMarketBundle(state.seasonYear, state.series)?.youth.find(
    (y) => y.id === youthId,
  );
  if (!prospect) return state;
  const fee = toMoney(prospect.signingCost);
  if (fee > playerBudget(state)) return state;
  const member = signProspectToAcademy(prospect, state.seasonYear);
  const charged = applyTransaction(
    state,
    makeTransaction(state.seasonYear, 'Academy', `Signed ${prospect.name} to academy`, -fee),
  );
  return { ...charged, academy: [...(charged.academy ?? []), member] };
}

function runQualifying(state: GameState, playerDecisions: QualifyingDecision[]): GameState {
  const race = currentRace(state);
  if (!race) return state;
  const track = getTrackById(race.trackId);
  if (!track) return state;

  const entrants = buildEntrants(state);
  const tuned = playerTunedSetups(state, track, 'qualifying');
  const decisions: Record<string, QualifyingDecision> = {};
  const playerById = new Map(playerDecisions.map((d) => [d.driverId, d]));
  for (const e of entrants) {
    const decision = playerById.get(e.driver.id) ?? aiQualifyingDecision(e.driver.id, track);
    const tunedId = tuned.setupIdByDriver[e.driver.id];
    decisions[e.driver.id] = tunedId ? { ...decision, setupId: tunedId } : decision;
  }

  const { results, breakdowns } = simulateQualifying({
    track,
    entrants,
    decisions,
    setupOptions: { ...setupOptionsById, ...autoSetupOptionsForTrack(track), ...tuned.overlay },
    runPlans: qualifyingRunPlansById,
    seed: `${state.randomSeed}-r${race.round}`,
    maxQualifiers: getMaxQualifiers(state.series),
  });

  lastBreakdowns.qualifying = breakdowns;

  // Apply quali crash damage to car condition (carryover into the race).
  const cars = state.cars.map((c) => ({ ...c }));
  for (const r of results) {
    if (r.incident?.type === 'Crash') {
      const car = cars.find((c) => c.teamId === r.teamId);
      if (car) car.condition = Math.max(40, car.condition - 25);
    }
  }

  return {
    ...state,
    cars,
    qualifyingResults: { ...state.qualifyingResults, [race.id]: results },
  };
}

function runRace(state: GameState, playerDecisions: RaceDecision[]): GameState {
  const race = currentRace(state);
  if (!race) return state;

  const built = buildRaceContext(state, playerDecisions);
  if (!built) return state;

  const { results, events, breakdowns } = simulateRace(built.context);
  return applyRaceResults(state, race, results, events, breakdowns);
}

// Shared post-race handling: standings, morale, budget, development, news and
// calendar advance. Used by both the quick race (RUN_RACE) and the live race
// (COMMIT_LIVE_RACE), so both paths update the season identically.
function applyRaceResults(
  state: GameState,
  race: NonNullable<ReturnType<typeof currentRace>>,
  results: RaceResult[],
  events: RaceEvent[],
  breakdowns: Record<string, ScoreBreakdown>,
): GameState {
  const qualifying = state.qualifyingResults[race.id] ?? [];

  lastBreakdowns.race = breakdowns;

  // Persist results and recompute standings.
  const completedRaceResults = { ...state.completedRaceResults, [race.id]: results };
  const allResults = Object.values(completedRaceResults);
  const driverStandings = buildDriverStandings(allResults);
  const constructorStandings = buildConstructorStandings(allResults);

  // Morale & confidence.
  const driverTeam: Record<string, string> = {};
  state.drivers.forEach((d) => (driverTeam[d.id] = d.teamId));
  const prevDriverConf: Record<string, number> = {};
  const prevDriverMorale: Record<string, number> = {};
  state.drivers.forEach((d) => {
    prevDriverConf[d.id] = d.confidence;
    prevDriverMorale[d.id] = d.morale;
  });
  const prevTeamMorale: Record<string, number> = {};
  state.teams.forEach((t) => (prevTeamMorale[t.id] = t.morale));

  const morale = updateMorale(
    qualifying,
    results,
    prevDriverConf,
    prevDriverMorale,
    prevTeamMorale,
    driverTeam,
  );

  const drivers = state.drivers.map((d) => ({
    ...d,
    confidence: morale.driverConfidence[d.id] ?? d.confidence,
    morale: morale.driverMorale[d.id] ?? d.morale,
  }));

  // Budget: prize money for points + crash repair costs scaled by damage.
  const teams = state.teams.map((t) => ({ ...t, morale: morale.teamMorale[t.id] ?? t.morale }));
  let cars = state.cars.map((c) => ({ ...c }));
  const financeTxns: FinanceTransaction[] = [];
  const damageMessages: string[] = [];
  const conditionHitByTeam: Record<string, number> = {};
  for (const r of results) {
    const team = teams.find((t) => t.id === r.teamId);
    if (!team) continue;
    const prize = r.points * 250_000; // prize money per point
    team.budget += prize;
    const roll = createSeededRandom(deriveSeed(state.randomSeed, 'damage', race.round, r.driverId)).next();
    const severity = classifyCrashDamage(r.status, r.incidents, roll);
    const repair = repairCost(severity);
    if (repair > 0) {
      team.budget -= repair;
      conditionHitByTeam[team.id] = (conditionHitByTeam[team.id] ?? 0) + damageConditionHit(severity);
    }
    if (team.id === state.selectedTeamId) {
      const driverName = state.drivers.find((d) => d.id === r.driverId)?.name ?? r.driverId;
      if (prize > 0) {
        financeTxns.push(
          makeTransaction(state.seasonYear, 'Prize Money', `${race.gpName}: ${driverName}`, prize, race.round),
        );
      }
      if (repair > 0) {
        financeTxns.push(
          makeTransaction(
            state.seasonYear,
            'Repairs',
            `${race.gpName}: ${driverName} — ${severity.toLowerCase()} damage`,
            -repair,
            race.round,
          ),
        );
        damageMessages.push(`${driverName} sustained ${severity.toLowerCase()} damage — repairs cost $${(repair / 1_000_000).toFixed(2)}M.`);
      }
    }
  }
  // Sponsor performance bonuses for the player team's result this round.
  const playerResults = results.filter((r) => r.teamId === state.selectedTeamId);
  const playerQualy = qualifying.filter((q) => q.teamId === state.selectedTeamId);
  const sponsorBonuses = racePerformanceBonuses(state.commercial, {
    wins: playerResults.filter((r) => r.position === 1).length,
    podiums: playerResults.filter((r) => r.position !== null && r.position <= 3).length,
    poles: playerQualy.filter((q) => q.position === 1).length,
  });
  for (const b of sponsorBonuses) {
    const team = teams.find((t) => t.id === state.selectedTeamId);
    if (team) team.budget += b.amount;
    financeTxns.push(
      makeTransaction(state.seasonYear, 'Sponsorship', `${race.gpName}: ${b.label}`, b.amount, race.round),
    );
  }

  // Apply crash damage, then the standard between-race recovery.
  cars = cars.map((c) => ({
    ...c,
    condition: Math.min(100, Math.max(20, c.condition - (conditionHitByTeam[c.teamId] ?? 0) + 20)),
  }));

  // Development progress (player team only, for MVP).
  const playerCar = carForTeam(state, state.selectedTeamId);
  let activeDevelopmentProjects = state.activeDevelopmentProjects;
  let completedDevelopmentProjects = state.completedDevelopmentProjects;
  const devMessages: string[] = [];
  if (playerCar && activeDevelopmentProjects.length > 0) {
    const tick = applyDevelopmentProgress(
      activeDevelopmentProjects,
      playerCar,
      state.randomSeed,
      race.round,
      developmentSuccessBonus(state.staff ?? []),
    );
    activeDevelopmentProjects = tick.active;
    completedDevelopmentProjects = [...completedDevelopmentProjects, ...tick.completed];
    devMessages.push(...tick.messages);
    // Apply rating deltas to the player car.
    cars = cars.map((c) => {
      if (c.id !== playerCar.id) return c;
      const dl = { ...c.developmentLevel };
      for (const [k, v] of Object.entries(tick.carRatingDeltas)) {
        const key = k as keyof typeof dl;
        dl[key] = (dl[key] ?? 0) + (v ?? 0);
      }
      return { ...c, developmentLevel: dl };
    });
  }

  // News.
  const driverNames: Record<string, string> = {};
  state.drivers.forEach((d) => (driverNames[d.id] = d.name));
  const teamNames: Record<string, string> = {};
  state.teams.forEach((t) => (teamNames[t.id] = t.name));
  const news = generateRaceNews(
    race.round,
    race.gpName,
    qualifying,
    results,
    driverNames,
    teamNames,
    state.randomSeed,
  );
  for (const m of devMessages) {
    news.unshift({ id: `news-dev-${race.round}-${m.slice(0, 8)}`, round: race.round, headline: m, timestamp: new Date().toISOString() });
  }
  damageMessages.forEach((m, i) => {
    news.unshift({ id: `news-damage-${race.round}-${i}`, round: race.round, headline: m, timestamp: new Date().toISOString() });
  });

  // Archive this race (results + deterministic lap-time archive).
  const archiveEntry = buildRaceArchiveEntry(
    race,
    state.seasonYear,
    results,
    qualifying,
    driverNames,
    teamNames,
    state.randomSeed,
  );
  const raceArchive = [...(state.raceArchive ?? []), archiveEntry];

  // Advance the calendar.
  const calendar = state.calendar.map((r) => (r.id === race.id ? { ...r, completed: true } : r));
  const nextIndex = state.currentRaceIndex + 1;
  const seasonComplete = nextIndex >= calendar.length;

  return {
    ...state,
    calendar,
    drivers,
    teams,
    cars,
    completedRaceResults,
    raceEvents: { ...state.raceEvents, [race.id]: events },
    driverStandings,
    constructorStandings,
    activeDevelopmentProjects,
    completedDevelopmentProjects,
    finance: [...(state.finance ?? []), ...financeTxns],
    raceArchive,
    news: [...news, ...state.news].slice(0, 50),
    currentRaceIndex: seasonComplete ? state.currentRaceIndex : nextIndex,
    seasonComplete,
  };
}

function startDevelopment(state: GameState, projectId: string): GameState {
  const template = developmentProjectsById[projectId];
  if (!template) return state;
  const team = state.teams.find((t) => t.id === state.selectedTeamId);
  if (!team || team.budget < template.cost) return state;

  const instance: DevelopmentProject = {
    ...template,
    id: `${template.id}-${Date.now()}`,
    progressRaces: 0,
  };

  const teams = state.teams.map((t) =>
    t.id === team.id ? { ...t, budget: t.budget - template.cost } : t,
  );

  return {
    ...state,
    teams,
    finance: [
      ...(state.finance ?? []),
      makeTransaction(state.seasonYear, 'Development', template.name, -template.cost),
    ],
    activeDevelopmentProjects: [...state.activeDevelopmentProjects, instance],
  };
}

export type { QualifyingResult };
