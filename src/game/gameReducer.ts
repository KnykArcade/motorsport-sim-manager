// Pure reducer wiring the simulation engines into state transitions.
// Keeping this outside React keeps the simulation testable and deterministic.

import { getTrackById } from '../data';
import { setupOptionsById } from '../data/setupOptions/setupOptions';
import { autoSetupOptionsForTrack } from '../sim/autoSetup';
import { qualifyingRunPlansById } from '../data/decisions/qualifyingRunPlans';
import { developmentProjectsById } from '../data/development/developmentProjects';
import { qualifyingFormatFor, simulateQualifying } from '../sim/qualifyingEngine';
import { simulateRace } from '../sim/raceEngine';
import { buildConstructorStandings, buildDriverStandings } from '../sim/standingsEngine';
import { applyDevelopmentProgress, raceOpsDevelopmentBonus, computeAdjustedDuration, RUSH_COST_MULTIPLIER } from '../sim/developmentEngine';
import { updateMorale } from '../sim/moraleEngine';
import { generateRaceNews } from '../sim/newsEngine';
import {
  generateCareerRaceNews,
  generateQualifyingNews as generateCareerQualifyingNews,
  generatePreseasonNews as generateCareerPreseasonNews,
  generatePaddockNews as generateCareerPaddockNews,
  generateYouthAcademyNews as generateCareerYouthAcademyNews,
  deduplicateNews,
  mergeNewsWithSpamControl,
  capNewsPerRound,
  sortNewsByPriority,
  type CareerNewsContext,
} from '../sim/careerNewsEngine';
import { generateDriverDramaNews, type DramaNewsContext } from '../sim/driverDramaNewsEngine';
import { aiQualifyingDecision } from './ai';
import {
  activeDriversForTeam,
  carForTeam,
  currentRace,
  driversForTeam,
  maxRaceDriversForSeries,
  type GameState,
} from './careerState';
import { buildRaceContext, playerTunedSetups } from './raceSetup';
import { createNewGame, type NewGameOptions } from './initialCareer';
import { advanceSeason } from './seasonRollover';
import {
  canEnterRaceWeekend,
  enforceF1Rosters,
  isPreseason,
  signRaceDriver,
} from './rosterEnforcement';
import { getMaxQualifiers, getStaffPool } from '../data';
import { careerMarketBundle } from '../sim/careerMarketEngine';
import { marketDriverToDriver, signProspectToAcademy } from '../sim/driverMarketEngine';
import { academyCapacityFor } from '../sim/teamRatingsEngine';
import { makeTransaction, toMoney } from '../sim/financeEngine';
import { driverExtensionSigningFee, extendedDriverSalaryMillions, thirdDriverMidSeasonFee, thirdDriverSalary } from '../sim/contractEngine';
import {
  generateSponsorOffers,
  racePerformanceBonuses,
  sponsorInstallmentPayment,
  sponsorSlotCapacity,
} from '../sim/commercialEngine';
import { developmentSuccessBonus } from '../sim/staffEngine';
import {
  FACILITY_SPECS,
  facilityDevelopmentSuccessBonus,
  facilityRepairCostReduction,
  orderUpgrade,
  developmentSlots,
  relevantFacilityLevel,
} from '../sim/facilityEngine';
import type { FacilitySpecialization } from '../types/facilityTypes';
import {
  availableEngineOffers,
  buildSignedDeal,
  engineSwitchFee,
} from '../sim/engineSupplierEngine';
import { classifyCrashDamage, damageConditionHit, repairCost } from '../sim/repairEngine';
import { buildRaceArchiveEntry } from '../sim/lapArchiveEngine';
import { resolveTeamOrderConsequences } from '../sim/relationshipEngine';
import { reactToRaceResult, applyConfidenceUpdates, makePromise, resolvePromise, applyPromiseResolution, evaluatePromisesAfterRace, checkExpiredPromises, hasActivePromiseOfType, confidencePerformanceModifier, type ConfidenceUpdate, type RaceEventContext, type PromiseResolution } from '../sim/driverConfidenceEngine';
import { allocateSkillPoint } from '../sim/principalEngine';
import type { TeamOrderDecision, PromiseType } from '../types/relationshipTypes';
import { createSeededRandom, deriveSeed } from '../sim/random';
import type { AcademyDecision, FirstOptionDecision, SeatSigning } from '../types/marketTypes';
import type { FinanceTransaction } from '../types/financeTypes';
import type {
  Car,
  DevelopmentProject,
  Driver,
  NewsItem,
  QualifyingResult,
  RaceResult,
  RaceStrategyId,
  Team,
  Track,
} from '../types/gameTypes';
import type { EngineDealType } from '../types/engineTypes';
import type { RegulationVote } from '../types/politicsTypes';
import type { ScoutedEntityType } from '../types/scoutingTypes';
import { driverScoutTarget, recordScouting, scoutingCost, type ScoutTarget } from '../sim/scoutingEngine';
import type {
  Entrant,
  QualifyingDecision,
  RaceDecision,
  RaceEvent,
  RacePrepFocusEffect,
  ScoreBreakdown,
} from '../types/simTypes';
import type { CarSetup } from '../types/setupTypes';
import type {
  PracticeAssignment,
  PracticeSession,
  PracticeSessionKind,
  WeekendPractice,
} from '../types/practiceTypes';
import { initialBaselineSetup } from '../sim/setupFitEngine';
import {
  accumulateKnowledge,
  emptyKnowledge,
  practiceLapBudget,
  runPracticeSession,
  sessionLapCost,
} from '../sim/practiceProgramEngine';
import { weekendForecast } from '../sim/weatherEngine';
import type { RaceWeekendPackageType, RaceWeekendPackageSelection, RaceWeekendPackageEffects, FinancialDistressMap } from '../types/raceWeekendPackageTypes';
import type { AIPackageContext } from '../types/raceWeekendPackageTypes';
import {
  computeRaceWeekendPackageCost,
  packageEffects,
  availablePackagesForSeries,
  aiSelectPackage,
  trackCostClass,
  RACE_WEEKEND_PACKAGES,
  canAffordAnyNormalPackage,
  computeMandatoryMinimumCost,
  updateFinancialDistress,
  distressNewsHeadline,
} from '../sim/raceWeekendPackageEngine';
import { ARCHETYPE_SPECS } from '../sim/aiTeamEngine';
import { effectiveCarRatings } from '../sim/trackFitEngine';
import { syncDriverRelationshipsForTeam } from '../sim/relationshipEngine';
import {
  enterPostRaceReview,
  enterPaddockWeek,
  enterPreRaceBriefing,
  enterRaceWeekend,
  enterPreSeasonSetup,
  enterPreRaceBriefingFromPreseason,
  generateAndStorePaddockEvents,
  resolvePaddockEvent,
  hasUnresolvedRequiredDecisions,
  togglePreseasonChecklistItem,
  isPreseasonChecklistComplete,
  getCareerPhase,
  getOrCreatePhaseState,
  processAITeamActivity,
  computeRacePrepFocusEffect,
  approvePreseasonTab,
} from './careerPhaseEngine';
import { isActionBlocked, isSingleSeasonMode } from './modeRestrictions';

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
      teamOrders?: TeamOrderDecision[];
      strategyRiskByDriver?: Record<string, 'conservative' | 'balanced' | 'aggressive'>;
    }
  | { type: 'START_DEVELOPMENT'; projectId: string; rushed?: boolean }
  | { type: 'RUSH_DEVELOPMENT'; projectId: string }
  | { type: 'SET_CAR_SETUP'; driverId: string; setup: CarSetup }
  | {
      type: 'RUN_PRACTICE_SESSION';
      raceId: string;
      kind: PracticeSessionKind;
      assignments: PracticeAssignment[];
    }
  | { type: 'SIGN_MARKET_DRIVER'; marketId: string; seatDriverId: string; bid?: number }
  | { type: 'PROMOTE_ACADEMY'; academyId: string; seatDriverId: string }
  | { type: 'RELEASE_SIGNING'; seatDriverId: string }
  | { type: 'SIGN_YOUTH'; youthId: string }
  | { type: 'RELEASE_ACADEMY'; academyId: string }
  | {
      type: 'SET_ACADEMY_DECISION';
      academyId: string;
      decision: FirstOptionDecision;
      seatDriverId?: string;
    }
  | { type: 'CLEAR_ACADEMY_DECISION'; academyId: string }
  | { type: 'HIRE_STAFF'; staffId: string }
  | { type: 'FIRE_STAFF'; staffId: string }
  | { type: 'UPGRADE_FACILITY'; facilityId: string }
  | { type: 'SIGN_ENGINE_DEAL'; supplierId: string; dealType: EngineDealType }
  | { type: 'SIGN_SPONSOR'; offerId: string }
  | { type: 'DROP_SPONSOR'; sponsorId: string }
  | { type: 'ACCEPT_JOB_OFFER'; offerId: string }
  | { type: 'DECLINE_JOB_OFFER'; offerId: string }
  | { type: 'SET_REGULATION_VOTE'; proposalId: string; vote: RegulationVote }
  | { type: 'SCOUT_TARGET'; entityId: string; entityType: ScoutedEntityType }
  | { type: 'SWAP_RACE_DRIVER'; seatIndex: number; reserveDriverId: string }
  | { type: 'SIGN_THIRD_DRIVER'; marketId: string }
  | { type: 'PROMOTE_THIRD_DRIVER'; seatDriverId: string; thirdDriverId: string }
  | { type: 'EXTEND_DRIVER_CONTRACT'; driverId: string; years: number; offerMultiplier?: number }
  | { type: 'ADVANCE_SEASON'; nextBundle?: import('../data/seasonCatalog').SeasonBundle }
  | { type: 'ADVANCE_RACE' }
  | { type: 'SIGN_RACE_DRIVER'; marketId: string }
  | { type: 'SELECT_RACE_WEEKEND_PACKAGE'; packageType: RaceWeekendPackageType }
  | { type: 'ADVANCE_TO_PADDOCK_WEEK' }
  | { type: 'ADVANCE_TO_PRE_RACE_BRIEFING' }
  | { type: 'ADVANCE_TO_RACE_WEEKEND' }
  | { type: 'COMPLETE_PRESEASON_SETUP' }
  | { type: 'GENERATE_PADDOCK_EVENTS' }
  | { type: 'RESOLVE_PADDOCK_EVENT'; eventId: string; optionId: string }
  | { type: 'TOGGLE_PRESEASON_CHECKLIST_ITEM'; itemId: string }
  | { type: 'APPROVE_PRESEASON_TAB'; tabId: 'teamOverview' | 'budget' | 'driverLineup' | 'carDevelopment' | 'sponsorsEngine' | 'seasonObjectives' | 'roundOnePreview' }
  | { type: 'SET_CAREER_MOBILITY'; mode: 'StandardCareer' | 'TeamLock' | 'Sandbox' }
  | { type: 'ALLOCATE_SKILL_POINT'; attribute: 'mediaImage' | 'boardConfidence' | 'financialDiscipline' | 'driverManagement' | 'development' | 'strategy'; points?: number }
  | { type: 'MAKE_PROMISE'; driverId: string; promiseType: PromiseType; dueSeason?: number; dueRound?: number }
  | { type: 'RESOLVE_PROMISE'; promiseId: string; fulfilled: boolean }
  | { type: 'SET_FACILITY_SPECIALIZATION'; specialization: FacilitySpecialization };

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
    wp = { raceId, sessions: [], knowledge: emptyKnowledge(raceId), lapsUsed: 0 };
  }
  if (wp.sessions.some((s) => s.kind === kind && s.completed)) return state;

  const players = activeDriversForTeam(state, state.selectedTeamId);
  const car = carForTeam(state, state.selectedTeamId);
  // The engineer's baseline setup family for the weekend. Practice is run on
  // this (or the player's carried-over setup) and the workshop compares the
  // final tuned setup against it for driver comfort.
  const baseline = initialBaselineSetup(track, car);
  const driversById: Record<string, Driver> = {};
  const setupsById: Record<string, CarSetup> = {};
  const carsByDriverId: Record<string, Car> = {};
  for (const d of players) {
    driversById[d.id] = d;
    setupsById[d.id] = state.carSetups?.[d.id] ?? baseline;
    if (car) carsByDriverId[d.id] = car;
  }
  const validAssignments = assignments.filter((a) => driversById[a.driverId]);

  // Enforce the weekend practice lap budget: a session can't be run if it would
  // exceed the remaining laps.
  const budget = practiceLapBudget(state.seasonYear, state.series, players.length);
  const lapsUsed = wp.lapsUsed ?? 0;
  const cost = sessionLapCost(validAssignments);
  if (lapsUsed + cost > budget) return state;

  const session: PracticeSession = {
    id: `${raceId}-${kind}`,
    raceId,
    kind,
    assignments: validAssignments,
    completed: true,
  };

  const raceWet = weekendForecast(track, `${state.randomSeed}-r${race.round}`).Race.wet;
  const results = runPracticeSession(session, {
    raceId,
    track,
    seed: state.randomSeed,
    driversById,
    setupsById,
    carsByDriverId,
    knowledge: wp.knowledge,
    raceWet,
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

  // Record the setup family each driver actually ran, plus laps banked. This is
  // the practised baseline the workshop compares the final tuned setup against.
  const practicedSetupByDriver = { ...(wp.practicedSetupByDriver ?? {}) };
  const practicedSetupHistory = { ...(wp.practicedSetupHistory ?? {}) };
  const practiceLapsByDriver = { ...(wp.practiceLapsByDriver ?? {}) };
  for (const r of results) {
    const ranSetup = setupsById[r.driverId];
    if (ranSetup) {
      practicedSetupByDriver[r.driverId] = ranSetup;
      practicedSetupHistory[r.driverId] = [...(practicedSetupHistory[r.driverId] ?? []), ranSetup];
    }
    practiceLapsByDriver[r.driverId] = (practiceLapsByDriver[r.driverId] ?? 0) + r.lapsCompleted;
  }

  const sessions = [...wp.sessions.filter((s) => s.kind !== kind), session];
  return {
    ...state,
    drivers,
    weekendPractice: {
      raceId,
      sessions,
      knowledge,
      lapsUsed: lapsUsed + cost,
      practicedSetupByDriver,
      practicedSetupHistory,
      practiceLapsByDriver,
    },
  };
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
  // Promotion changes the contract tier: the reserve taking the seat becomes a
  // full race-seat driver, and the driver they displace drops to a reserve deal.
  // Without this the race-lineup filter would still treat the promoted driver as
  // a reserve and leave the seat empty.
  const drivers = state.drivers.map((d) => {
    if (d.id === reserveDriverId) return { ...d, contractType: 'seat' as const };
    if (d.id === seatDriverId) return { ...d, contractType: 'reserve' as const };
    return d;
  });
  const updated = { ...state, teams, drivers };
  // Sync relationships after roster change.
  return syncDriverRelationshipsForTeam(updated, teamId, state.randomSeed ?? 'sync');
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
  if (roster.length >= maxRaceDriversForSeries(state.series) + 1) return state; // already have a 3rd driver
  if (roster.some((d) => d.contractType === 'third')) return state;

  const m = careerMarketBundle(state).drivers.find((d) => d.id === marketId);
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
  const updated = {
    ...charged,
    drivers: [...charged.drivers, driver],
    teams: charged.teams.map((t) =>
      t.id === teamId ? { ...t, driverIds: [...t.driverIds, driver.id] } : t,
    ),
    signedMarketIds: [...(charged.signedMarketIds ?? []), m.id],
  };
  // Sync relationships after roster change.
  return syncDriverRelationshipsForTeam(updated, teamId, state.randomSeed ?? 'sync');
}

// Track the last debug breakdowns so the UI can show them (kept outside state
// to avoid bloating the save file).
export const lastBreakdowns: {
  qualifying: Record<string, ScoreBreakdown>;
  race: Record<string, ScoreBreakdown>;
} = { qualifying: {}, race: {} };

export function gameReducer(state: GameState | null, action: GameAction): GameState | null {
  // Block restricted actions in Single Season mode.
  if (state && isActionBlocked(action.type, state.gameMode)) {
    return state;
  }
  switch (action.type) {
    case 'NEW_GAME':
      return enterPreSeasonSetup(createNewGame(action.options));

    case 'LOAD_GAME':
      return action.state;

    case 'RUN_QUALIFYING': {
      if (!state) return state;
      if (getCareerPhase(state) !== 'race_weekend') return state;
      // Pre-Race-1 F1 roster enforcement: block the player from running
      // qualifying if their team has fewer than 2 active race drivers.
      const entryCheck = canEnterRaceWeekend(state);
      if (!entryCheck.allowed) return state;
      // Auto-fill AI teams before the first race weekend.
      if (isPreseason(state)) {
        const enforcement = enforceF1Rosters(state);
        state = enforcement.state;
      }
      return runQualifying(state, action.decisions);
    }

    case 'RUN_RACE': {
      if (!state) return state;
      if (getCareerPhase(state) !== 'race_weekend') return state;
      const entryCheck = canEnterRaceWeekend(state);
      if (!entryCheck.allowed) return state;
      const race = currentRace(state);
      if (!race) return state;
      const raced = runRace(state, action.decisions);
      return enterPostRaceReview(raced, race.id);
    }

    case 'COMMIT_LIVE_RACE': {
      if (!state) return state;
      if (getCareerPhase(state) !== 'race_weekend') return state;
      const race = currentRace(state);
      if (!race) return state;
      const applied = applyRaceResults(
        state,
        race,
        action.results,
        action.events,
        action.breakdowns,
        action.teamOrders ?? [],
        action.strategyRiskByDriver,
      );
      return enterPostRaceReview(applied, race.id);
    }

    case 'START_DEVELOPMENT': {
      if (!state) return state;
      return startDevelopment(state, action.projectId, action.rushed ?? false);
    }

    case 'RUSH_DEVELOPMENT': {
      if (!state) return state;
      return rushDevelopment(state, action.projectId);
    }

    case 'SET_CAR_SETUP': {
      if (!state) return state;
      if (getCareerPhase(state) !== 'race_weekend') return state;
      // Minimum Package: no setup changes allowed — team runs the locked baseline.
      if (state.raceWeekendPackage?.packageType === 'MandatoryMinimum') return state;
      return {
        ...state,
        carSetups: { ...(state.carSetups ?? {}), [action.driverId]: action.setup },
      };
    }

    case 'RUN_PRACTICE_SESSION': {
      if (!state) return state;
      if (getCareerPhase(state) !== 'race_weekend') return state;
      // Minimum Package: no practice sessions — bare-minimum operations only.
      if (state.raceWeekendPackage?.packageType === 'MandatoryMinimum') return state;
      return runPracticeSessionAction(state, action.raceId, action.kind, action.assignments);
    }

    case 'SIGN_MARKET_DRIVER': {
      if (!state) return state;
      return queueSigning(state, action.seatDriverId, 'market', action.marketId, action.bid);
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

    case 'SET_ACADEMY_DECISION': {
      if (!state) return state;
      return setAcademyDecision(state, action.academyId, action.decision, action.seatDriverId);
    }

    case 'CLEAR_ACADEMY_DECISION': {
      if (!state) return state;
      return {
        ...state,
        academyDecisions: (state.academyDecisions ?? []).filter(
          (d) => d.academyId !== action.academyId,
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

    case 'UPGRADE_FACILITY': {
      if (!state) return state;
      return upgradeFacility(state, action.facilityId);
    }

    case 'SIGN_SPONSOR': {
      if (!state) return state;
      return signSponsor(state, action.offerId);
    }

    case 'DROP_SPONSOR': {
      if (!state) return state;
      return dropSponsor(state, action.sponsorId);
    }

    case 'SIGN_ENGINE_DEAL': {
      if (!state) return state;
      return signEngineDeal(state, action.supplierId, action.dealType);
    }

    case 'ACCEPT_JOB_OFFER': {
      if (!state) return state;
      return acceptJobOffer(state, action.offerId);
    }

    case 'DECLINE_JOB_OFFER': {
      if (!state) return state;
      return {
        ...state,
        jobOffers: (state.jobOffers ?? []).filter((o) => o.id !== action.offerId),
        acceptedJobOfferId:
          state.acceptedJobOfferId === action.offerId ? undefined : state.acceptedJobOfferId,
      };
    }

    case 'SET_REGULATION_VOTE': {
      if (!state) return state;
      return {
        ...state,
        regulationProposals: (state.regulationProposals ?? []).map((p) =>
          p.id === action.proposalId
            ? { ...p, playerVote: p.playerVote === action.vote ? undefined : action.vote }
            : p,
        ),
      };
    }

    case 'SCOUT_TARGET': {
      if (!state) return state;
      return scoutTargetAction(state, action.entityId, action.entityType);
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

    case 'EXTEND_DRIVER_CONTRACT': {
      if (!state) return state;
      return extendDriverContract(state, action.driverId, action.years, action.offerMultiplier ?? 1);
    }

    case 'ADVANCE_SEASON': {
      if (!state) return state;
      if (!state.seasonComplete) return state;
      return advanceSeason(state, action.nextBundle);
    }

    case 'ADVANCE_RACE': {
      if (!state) return state;
      // Clear the weekend package when advancing to the next race.
      return { ...state, raceWeekendPackage: undefined, aiRaceWeekendPackages: undefined };
    }

    case 'SIGN_RACE_DRIVER': {
      if (!state) return state;
      return signRaceDriver(state, action.marketId);
    }

    case 'SELECT_RACE_WEEKEND_PACKAGE': {
      if (!state) return state;
      const phase = getCareerPhase(state);
      if (phase !== 'paddock_week' && phase !== 'race_weekend' && phase !== 'pre_season_setup') return state;
      return selectRaceWeekendPackage(state, action.packageType);
    }

    case 'ADVANCE_TO_PADDOCK_WEEK': {
      if (!state) return state;
      if (getCareerPhase(state) !== 'post_race_review') return state;
      return { ...enterPaddockWeek(state), raceWeekendPackage: undefined, aiRaceWeekendPackages: undefined };
    }

    case 'ADVANCE_TO_PRE_RACE_BRIEFING': {
      if (!state) return state;
      const phase = getCareerPhase(state);
      // Only allow from paddock_week (after resolving required decisions) or
      // from pre_season_setup (if preseason checklist is complete — handled
      // by COMPLETE_PRESEASON_SETUP instead, but guard anyway).
      if (phase !== 'paddock_week' && phase !== 'pre_season_setup') return state;
      if (phase === 'paddock_week' && hasUnresolvedRequiredDecisions(state)) return state;
      if (phase === 'paddock_week' && !hasPackageForCurrentRace(state)) return state;
      if (phase === 'pre_season_setup' && !isPreseasonChecklistComplete(state)) return state;
      // Use enterPreRaceBriefingFromPreseason for the preseason path so that
      // preseasonSetupComplete and preseasonDecisionsComplete are set.
      if (phase === 'pre_season_setup') return enterPreRaceBriefingFromPreseason(ensureDefaultRaceWeekendPackage(state));
      return enterPreRaceBriefing(state);
    }

    case 'ADVANCE_TO_RACE_WEEKEND': {
      if (!state) return state;
      if (getCareerPhase(state) !== 'pre_race_briefing') return state;
      if (!hasPackageForCurrentRace(state)) return state;
      return enterRaceWeekend(state);
    }

    case 'COMPLETE_PRESEASON_SETUP': {
      if (!state) return state;
      if (getCareerPhase(state) !== 'pre_season_setup') return state;
      if (!isPreseasonChecklistComplete(state)) return state;
      // Generate preseason career news.
      const preseasonCtx: CareerNewsContext = {
        state,
        phase: 'pre_season_setup',
        round: 0,
        gpName: '',
        seed: state.randomSeed,
      };
      const preseasonNews = generateCareerPreseasonNews(preseasonCtx);
      const youthNews = generateCareerYouthAcademyNews(preseasonCtx);
      const allPreseasonNews = deduplicateNews(state.news, [...preseasonNews, ...youthNews]);
      const withNews = { ...state, news: [...allPreseasonNews, ...state.news].slice(0, 80) };
      return enterPreRaceBriefingFromPreseason(ensureDefaultRaceWeekendPackage(withNews));
    }

    case 'GENERATE_PADDOCK_EVENTS': {
      if (!state) return state;
      if (getCareerPhase(state) !== 'paddock_week') return state;
      // Process AI team activity once per paddock week (real state changes).
      state = processAITeamActivity(state);
      // Generate paddock week career news.
      const race = currentRace(state);
      const paddockCtx: CareerNewsContext = {
        state,
        phase: 'paddock_week',
        round: race?.round ?? 0,
        gpName: race?.gpName ?? '',
        seed: state.randomSeed,
      };
      const paddockNews = generateCareerPaddockNews(paddockCtx);
      const dedupedPaddockNews = deduplicateNews(state.news, paddockNews);
      state = { ...state, news: [...dedupedPaddockNews, ...state.news].slice(0, 80) };
      return generateAndStorePaddockEvents(state);
    }

    case 'RESOLVE_PADDOCK_EVENT': {
      if (!state) return state;
      if (getCareerPhase(state) !== 'paddock_week') return state;
      return resolvePaddockEvent(state, action.eventId, action.optionId);
    }

    case 'TOGGLE_PRESEASON_CHECKLIST_ITEM': {
      if (!state) return state;
      if (getCareerPhase(state) !== 'pre_season_setup') return state;
      return togglePreseasonChecklistItem(state, action.itemId);
    }

    case 'APPROVE_PRESEASON_TAB': {
      if (!state) return state;
      if (getCareerPhase(state) !== 'pre_season_setup') return state;
      return approvePreseasonTab(state, action.tabId);
    }

    case 'SET_CAREER_MOBILITY': {
      if (!state) return state;
      return { ...state, careerMobilityMode: action.mode };
    }

    case 'ALLOCATE_SKILL_POINT': {
      if (!state || !state.principal) return state;
      const points = action.points ?? 1;
      if (state.principal.skillPoints < points) return state;
      const updated = allocateSkillPoint(state.principal, action.attribute, points);
      return { ...state, principal: updated };
    }

    case 'MAKE_PROMISE': {
      if (!state || !state.driverRelationships) return state;
      const rel = state.driverRelationships[action.driverId];
      if (!rel) return state;
      // Block duplicate active promises of the same type for the same driver.
      const existingPromises = state.driverPromises ?? [];
      if (hasActivePromiseOfType(existingPromises, action.driverId, action.promiseType)) {
        return state;
      }
      const race = currentRace(state);
      const round = race?.round ?? 0;
      const counter = state.promiseCounter ?? 0;
      const promise = makePromise(
        action.driverId,
        action.promiseType,
        state.seasonYear,
        round,
        action.dueSeason,
        action.dueRound,
        counter,
      );
      const promises = [...existingPromises, promise];
      const relationships = applyPromiseResolution(state.driverRelationships, promise);
      return { ...state, driverPromises: promises, driverRelationships: relationships, promiseCounter: counter + 1 };
    }

    case 'RESOLVE_PROMISE': {
      if (!state || !state.driverPromises) return state;
      const existing = state.driverPromises.find((p) => p.id === action.promiseId);
      if (!existing || existing.status !== 'active') return state;
      const resolved = resolvePromise(existing, action.fulfilled);
      const promises = state.driverPromises.map((p) =>
        p.id === action.promiseId ? resolved : p,
      );
      const relationships = state.driverRelationships
        ? applyPromiseResolution(state.driverRelationships, resolved)
        : state.driverRelationships;
      return { ...state, driverPromises: promises, driverRelationships: relationships };
    }

    case 'SET_FACILITY_SPECIALIZATION': {
      if (!state || !state.facilities) return state;
      return {
        ...state,
        facilities: { ...state.facilities, specialization: action.specialization },
      };
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

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function extendDriverContract(state: GameState, driverId: string, years: number, offerMultiplier: number): GameState {
  if (state.seasonComplete) return state;
  const driver = state.drivers.find((d) => d.id === driverId && d.teamId === state.selectedTeamId);
  if (!driver) return state;
  const addYears = Math.max(1, Math.min(3, Math.round(years)));
  const currentYears = driver.contractYearsRemaining ?? 1;
  if (currentYears >= 5) return state;
  const appliedYears = Math.min(addYears, 5 - currentYears);
  const racesRemaining = Math.max(1, state.calendar.length - state.currentRaceIndex);
  const multiplier = Math.max(1, Math.min(2.5, offerMultiplier));
  const fee = Math.round(driverExtensionSigningFee(driver, appliedYears, racesRemaining, state.calendar.length) * multiplier);
  if (fee > playerBudget(state)) return state;

  const offer = evaluateExtensionOffer(state, driver, appliedYears, multiplier);
  if (!offer.accepted) {
    const rel = state.driverRelationships?.[driverId];
    const driverRelationships =
      state.driverRelationships && rel
        ? {
            ...state.driverRelationships,
            [driverId]: {
              ...rel,
              frustration: clamp100(rel.frustration + 4),
              morale: clamp100(rel.morale - 2),
              trustInPrincipal: clamp100(rel.trustInPrincipal - 2),
            },
          }
        : state.driverRelationships;
    const refusalNews = contractOfferNews(state, driver, appliedYears, fee, false, offer.score);
    return { ...state, driverRelationships, news: [refusalNews, ...state.news].slice(0, 80) };
  }

  const charged = applyTransaction(
    state,
    makeTransaction(state.seasonYear, 'Driver Signing', `Extension accepted: ${driver.name} +${appliedYears} yr`, -fee),
  );
  const drivers = charged.drivers.map((d) =>
    d.id === driverId
      ? {
          ...d,
          contractYearsRemaining: currentYears + appliedYears,
          salary: Math.max(d.salary ?? 0, extendedDriverSalaryMillions(d, appliedYears)),
        }
      : d,
  );
  const rel = charged.driverRelationships?.[driverId];
  const driverRelationships =
    charged.driverRelationships && rel
      ? {
          ...charged.driverRelationships,
          [driverId]: {
            ...rel,
            teamLoyalty: clamp100(rel.teamLoyalty + 4 * appliedYears),
            trustInPrincipal: clamp100(rel.trustInPrincipal + 5 * appliedYears),
            morale: clamp100(rel.morale + 3 * appliedYears),
            frustration: clamp100(rel.frustration - 4 * appliedYears),
          },
      }
      : charged.driverRelationships;
  const acceptedNews = contractOfferNews(charged, driver, appliedYears, fee, true, offer.score);
  return { ...charged, drivers, driverRelationships, news: [acceptedNews, ...charged.news].slice(0, 80) };
}

function evaluateExtensionOffer(
  state: GameState,
  driver: Driver,
  appliedYears: number,
  offerMultiplier: number,
): { accepted: boolean; score: number } {
  const rel = state.driverRelationships?.[driver.id];
  const team = state.teams.find((t) => t.id === state.selectedTeamId);
  const relationshipScore = rel
    ? rel.morale * 0.16 + rel.teamLoyalty * 0.16 + rel.trustInPrincipal * 0.14 - rel.frustration * 0.18
    : driver.morale * 0.18 + driver.confidence * 0.12;
  const driverMood = driver.morale * 0.12 + driver.confidence * 0.08;
  const teamPull = Math.max(-8, Math.min(8, (((team as Team | undefined)?.reputation ?? 50) - 50) / 5));
  const ambitionPenalty = Math.max(0, driver.ratings.overall - 80) * 0.7;
  const seatInsecure =
    driver.contractType === 'third' ||
    driver.contractType === 'reserve' ||
    driver.contractType === 'test' ||
    driver.confidence < 40 ||
    driver.morale < 40 ||
    (rel?.frustration ?? 0) >= 70;
  const shortTermPenalty = appliedYears === 1 && !seatInsecure
    ? Math.max(5, Math.round((driver.ratings.overall - 50) * 0.3 + ((rel?.ego ?? 50) - 50) / 8))
    : 0;
  const securityBoost = (appliedYears >= 2 ? 9 + appliedYears * 7 : seatInsecure ? 5 : 1) + (offerMultiplier - 1) * 44;
  const expiringBoost = (driver.contractYearsRemaining ?? 1) <= 1 ? 4 : 0;
  const score = Math.round(22 + relationshipScore + driverMood + teamPull + securityBoost + expiringBoost - ambitionPenalty - shortTermPenalty);
  return { accepted: score >= 58, score };
}

function contractOfferNews(
  state: GameState,
  driver: Driver,
  appliedYears: number,
  fee: number,
  accepted: boolean,
  score: number,
): NewsItem {
  const team = state.teams.find((t) => t.id === state.selectedTeamId);
  const suffix = `${state.seasonYear}-${state.currentRaceIndex}-${driver.id}-${appliedYears}-${fee}-${state.news.length}`;
  return {
    id: `news-contract-offer-${accepted ? 'accepted' : 'refused'}-${suffix}`,
    round: currentRace(state)?.round,
    headline: accepted
      ? `${driver.name} agrees to ${appliedYears}-year extension`
      : `${driver.name} turns down extension offer`,
    body: accepted
      ? `${team?.name ?? 'The team'} secured the deal after the driver accepted the extension package.`
      : `${driver.name} is not ready to commit on those terms and may need a stronger offer or a happier team situation. Interest score: ${score}.`,
    timestamp: new Date().toISOString(),
    category: 'driver_market',
    priority: accepted ? 'normal' : 'high',
    careerPhase: getCareerPhase(state),
    teamId: state.selectedTeamId,
    driverId: driver.id,
  };
}

// Queue (or replace) a seat change for the player's seat held by seatDriverId.
// Signings are only allowed during the offseason (season complete). The buyout
// is charged at the season rollover; here we only check affordability.
function queueSigning(
  state: GameState,
  seatDriverId: string,
  source: SeatSigning['source'],
  sourceId: string,
  bidM?: number,
): GameState {
  if (!state.seasonComplete) return state;
  const seat = state.drivers.find((d) => d.id === seatDriverId);
  if (!seat || seat.teamId !== state.selectedTeamId) return state;

  let name: string;
  let bid: number | undefined;
  if (source === 'market') {
    const m = careerMarketBundle(state).drivers.find(
      (d) => d.id === sourceId,
    );
    if (!m || (state.signedMarketIds ?? []).includes(m.id)) return state;
    // The bid (defaulting to the buyout) must clear the buyout floor and be
    // affordable now; it is charged at the rollover only if the bid wins.
    bid = Math.max(m.buyoutCost, bidM ?? m.buyoutCost);
    if (toMoney(bid) > playerBudget(state)) return state;
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
    pendingSignings: [...others, { seatDriverId, source, sourceId, name, bid }],
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
  const hireTeam = state.teams.find((t) => t.id === state.selectedTeamId);
  const staffNews: NewsItem = {
    id: `news-staff-hire-${recruit.id}-${state.seasonYear}`,
    headline: `${hireTeam?.name ?? 'The team'} appoints ${recruit.name} as ${recruit.role}`,
    body: `The team strengthens its technical department with a new ${recruit.role}.`,
    timestamp: new Date().toISOString(),
    category: 'development',
    priority: 'normal',
    careerPhase: getCareerPhase(charged),
    teamId: hireTeam?.id,
  };
  return { ...charged, staff: nextRoster, news: [staffNews, ...charged.news].slice(0, 80) };
}

// Order a facility upgrade: charge the cost now (must be affordable); the level
// gain resolves at the next season rollover. One pending upgrade per facility.
function upgradeFacility(state: GameState, facilityId: string): GameState {
  const facilities = state.facilities;
  if (!facilities) return state;
  const ordered = orderUpgrade(facilities, facilityId);
  if (!ordered) return state;
  const fee = toMoney(ordered.cost);
  if (fee > playerBudget(state)) return state;
  const facility = facilities.facilities.find((f) => f.id === facilityId);
  const label = facility ? FACILITY_SPECS[facility.type].label : 'facility';
  const charged = applyTransaction(
    state,
    makeTransaction(state.seasonYear, 'Facilities', `Upgrade ${label} to L${(facility?.level ?? 0) + 1}`, -fee),
  );
  const facTeam = state.teams.find((t) => t.id === state.selectedTeamId);
  const facilityNews: NewsItem = {
    id: `news-facility-${facilityId}-${state.seasonYear}`,
    headline: `${facTeam?.name ?? 'The team'} upgrades ${label} facility`,
    body: `The team invests in its ${label} infrastructure, set to take effect next season.`,
    timestamp: new Date().toISOString(),
    category: 'development',
    priority: 'normal',
    careerPhase: getCareerPhase(charged),
    teamId: facTeam?.id,
  };
  return { ...charged, facilities: ordered.state, news: [facilityNews, ...charged.news].slice(0, 80) };
}

// Spend one round of scouting effort on a market driver or youth prospect,
// sharpening the fogged view of their true ratings. The target's true ratings
// come from the current season's market bundle.
function scoutTargetAction(
  state: GameState,
  entityId: string,
  entityType: ScoutedEntityType,
): GameState {
  if (!state.scouting) return state;
  const bundle = careerMarketBundle(state);

  let target: ScoutTarget | undefined;
  let targetName = 'target';
  if (entityType === 'Driver') {
    const d = bundle.drivers.find((x) => x.id === entityId);
    if (d) {
      target = { id: d.id, skills: d.skills, potential: d.potential };
      targetName = d.name;
    } else {
      const currentDriver = state.drivers.find((x) => x.id === entityId);
      if (currentDriver) {
        target = driverScoutTarget(currentDriver);
        targetName = currentDriver.name;
      }
    }
  } else if (entityType === 'YouthProspect') {
    const y = bundle.youth.find((x) => x.id === entityId);
    if (y) {
      target = { id: y.id, skills: y.skills, potential: y.potential };
      targetName = y.name;
    }
  }
  if (!target) return state;

  // A scouting trip costs budget; refining a known target costs more. Block the
  // trip if the team can't afford it.
  const currentLevel = state.scouting.reports[target.id]?.scoutingLevel ?? 0;
  const cost = scoutingCost(entityType, currentLevel);
  if (cost > playerBudget(state)) return state;

  const scouting = recordScouting(
    state.scouting,
    target,
    entityType,
    state.facilities,
    state.randomSeed,
    new Date().toISOString(),
  );
  const charged = applyTransaction(
    state,
    makeTransaction(state.seasonYear, 'Scouting', `Scouted ${targetName}`, -cost),
  );
  return { ...charged, scouting };
}

// Negotiate a new engine deal. It's queued as the pending deal and takes effect
// (with its power/reliability modifier and annual cost) at the next season
// rollover, so it behaves as offseason planning. Only valid offers are accepted.
function signEngineDeal(state: GameState, supplierId: string, dealType: EngineDealType): GameState {
  const engine = state.engine;
  const team = state.teams.find((t) => t.id === state.selectedTeamId);
  if (!engine || !team) return state;
  const offer = availableEngineOffers(engine, team).find(
    (o) => o.supplier.id === supplierId && o.dealType === dealType,
  );
  if (!offer) return state;

  // A switch fee may already have been charged for a queued deal; canceling or
  // re-negotiating refunds it.
  const refundM = engine.pendingDealFee ?? 0;
  const current = engine.currentDeal;

  // Re-signing the deal you already run clears any pending change and refunds the
  // fee paid for it.
  if (current && current.supplierName === offer.supplier.name && current.dealType === dealType) {
    let next = state;
    if (refundM > 0) {
      next = applyTransaction(
        next,
        makeTransaction(state.seasonYear, 'Engine', 'Refund: engine switch canceled', toMoney(refundM)),
      );
    }
    return { ...next, engine: { ...next.engine!, pendingDeal: undefined, pendingDealFee: undefined } };
  }

  // A new switch: buy out the current contract. The fee is affordable against the
  // budget after refunding any previously-queued fee.
  const inPreseasonSetup = state.careerPhase?.currentPhase === 'pre_season_setup';
  const fee = inPreseasonSetup ? 0 : engineSwitchFee(current, offer);
  if (toMoney(fee) > playerBudget(state) + toMoney(refundM)) return state;

  let next = state;
  if (refundM > 0) {
    next = applyTransaction(
      next,
      makeTransaction(state.seasonYear, 'Engine', 'Refund: engine deal re-negotiated', toMoney(refundM)),
    );
  }
  if (fee > 0) {
    next = applyTransaction(
      next,
      makeTransaction(state.seasonYear, 'Engine', `Engine switch fee: ${offer.supplier.name}`, -toMoney(fee)),
    );
  }
  return {
    ...next,
    engine: { ...next.engine!, pendingDeal: buildSignedDeal(team, offer), pendingDealFee: fee },
  };
}

// Sign a sponsor from the available offers into an open portfolio slot. Blocked
// when the portfolio is at capacity (sized by commercial tier) or the deal is no
// longer on offer. The deal's annual value feeds next season's income.
function signSponsor(state: GameState, offerId: string): GameState {
  const commercial = state.commercial;
  const team = state.teams.find((t) => t.id === state.selectedTeamId);
  if (!commercial || !team) return state;
  if (commercial.sponsors.length >= sponsorSlotCapacity(team)) return state;
  const offers = generateSponsorOffers(
    team,
    commercial,
    state.randomSeed,
    state.seasonYear,
    state.series,
  );
  const offer = offers.find((o) => o.id === offerId);
  if (!offer) return state;
  if (commercial.sponsors.some((s) => s.id === offer.id)) return state;
  const sponsorNews: NewsItem = {
    id: `news-sponsor-${offer.id}-${state.seasonYear}`,
    headline: `${team.name} signs new sponsor: ${offer.name}`,
    body: `A new commercial partnership strengthens the team's financial position.`,
    timestamp: new Date().toISOString(),
    category: 'sponsor',
    priority: 'normal',
    careerPhase: getCareerPhase(state),
    teamId: team.id,
  };
  return {
    ...state,
    commercial: { ...commercial, sponsors: [...commercial.sponsors, offer] },
    news: [sponsorNews, ...state.news].slice(0, 80),
  };
}

// Drop a sponsor from the portfolio to free a slot (e.g. to take a bigger deal).
function dropSponsor(state: GameState, sponsorId: string): GameState {
  const commercial = state.commercial;
  if (!commercial) return state;
  const sponsors = commercial.sponsors.filter((s) => s.id !== sponsorId);
  if (sponsors.length === commercial.sponsors.length) return state;
  return { ...state, commercial: { ...commercial, sponsors } };
}

// Accept a firm job offer from a rival team. The move is queued and takes effect
// at the next season rollover (where the player switches teams). Accepting the
// same offer again cancels it; only firm offers (not rumors) can be accepted.
function acceptJobOffer(state: GameState, offerId: string): GameState {
  const offer = (state.jobOffers ?? []).find((o) => o.id === offerId);
  if (!offer || offer.kind !== 'Offer') return state;
  if (state.acceptedJobOfferId === offerId) {
    return { ...state, acceptedJobOfferId: undefined };
  }
  return { ...state, acceptedJobOfferId: offerId };
}

// Sign a youth prospect into the academy. The one-off signing fee is charged
// immediately; the player must be able to afford it.
function signYouth(state: GameState, youthId: string): GameState {
  const academy = state.academy ?? [];
  if (academy.some((a) => a.prospectId === youthId)) return state;
  // Academy capacity (Career Mode Phase 1): a team can only hold so many youth
  // drivers, based on its overall team rating. Block signings past the limit.
  const capacity = academyCapacityFor(state.teamOrgRatings, state.selectedTeamId);
  if (academy.length >= capacity) return state;
  const prospect = careerMarketBundle(state).youth.find(
    (y) => y.id === youthId,
  );
  if (!prospect) return state;
  const fee = toMoney(prospect.signingCost);
  if (fee > playerBudget(state)) return state;
  const member = signProspectToAcademy(prospect, state.seasonYear, state.selectedTeamId);
  const charged = applyTransaction(
    state,
    makeTransaction(state.seasonYear, 'Academy', `Signed ${prospect.name} to academy`, -fee),
  );
  return { ...charged, academy: [...(charged.academy ?? []), member] };
}

// Queue (or replace) a first-option decision for a promotion-eligible academy
// driver. Applied at the next season rollover. A race-seat promotion must name
// which of the team's seats it takes.
function setAcademyDecision(
  state: GameState,
  academyId: string,
  decision: FirstOptionDecision,
  seatDriverId?: string,
): GameState {
  const academy = state.academy ?? [];
  if (!academy.some((a) => a.id === academyId)) return state;
  if (decision === 'race_seat' && !seatDriverId) return state;
  const next: AcademyDecision = { academyId, decision, seatDriverId };
  const rest = (state.academyDecisions ?? []).filter((d) => d.academyId !== academyId);
  return { ...state, academyDecisions: [...rest, next] };
}

// Drivers who ran the Wet-Weather Preparation program in any completed practice
// session this weekend — they cope better if qualifying turns wet.
function wetPreparedDrivers(wp: WeekendPractice): string[] {
  const ids = new Set<string>();
  for (const session of wp.sessions) {
    if (!session.completed) continue;
    for (const a of session.assignments) {
      if (a.program === 'WetWeatherPreparation') ids.add(a.driverId);
    }
  }
  return [...ids];
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

  // Qualifying picks up the weekend forecast for its own session, the era's
  // format (knockout vs single), and which drivers banked wet running in practice.
  const forecast = weekendForecast(track, `${state.randomSeed}-r${race.round}`);
  const wetPreparedDriverIds =
    state.weekendPractice && state.weekendPractice.raceId === race.id
      ? wetPreparedDrivers(state.weekendPractice)
      : [];

  const teamReputation: Record<string, number> = {};
  const teamRaceOps: Record<string, number> = {};
  const pkgEffects: Record<string, RaceWeekendPackageEffects> = {};
  state.teams.forEach((t) => {
    teamReputation[t.id] = t.reputation;
    teamRaceOps[t.id] = t.raceOperations;
    if (t.id === state.selectedTeamId && state.raceWeekendPackage?.raceId === race.id) {
      pkgEffects[t.id] = packageEffects(state.raceWeekendPackage.packageType);
    } else if (state.aiRaceWeekendPackages?.[t.id]) {
      pkgEffects[t.id] = packageEffects(state.aiRaceWeekendPackages[t.id].packageType);
    }
  });

  // Build confidence modifier map from driver relationships.
  const confidenceModifierByDriver: Record<string, number> = {};
  if (state.driverRelationships) {
    for (const [id, rel] of Object.entries(state.driverRelationships)) {
      confidenceModifierByDriver[id] = confidencePerformanceModifier(rel);
    }
  }

  const { results, breakdowns } = simulateQualifying({
    track,
    entrants,
    decisions,
    setupOptions: { ...setupOptionsById, ...autoSetupOptionsForTrack(track), ...tuned.overlay },
    runPlans: qualifyingRunPlansById,
    seed: `${state.randomSeed}-r${race.round}`,
    maxQualifiers: getMaxQualifiers(state.series),
    weather: forecast.Qualifying,
    wetPreparedDriverIds,
    format: qualifyingFormatFor(state.seasonYear, state.series),
    teamReputation,
    teamRaceOps,
    packageEffectsByTeam: pkgEffects,
    racePrepFocusEffect: getRacePrepFocusEffectForQualifying(state),
    playerTeamId: state.selectedTeamId,
    confidenceModifierByDriver,
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

  // Generate career qualifying news.
  const driverNames: Record<string, string> = {};
  state.drivers.forEach((d) => (driverNames[d.id] = d.name));
  const teamNames: Record<string, string> = {};
  state.teams.forEach((t) => (teamNames[t.id] = t.name));
  const qualCtx: CareerNewsContext = {
    state,
    phase: 'race_weekend',
    round: race.round,
    gpName: race.gpName,
    seed: state.randomSeed,
  };
  const qualNews = generateCareerQualifyingNews(qualCtx, results, driverNames, teamNames);
  const dedupedQualNews = deduplicateNews(state.news, qualNews);

  return {
    ...state,
    cars,
    qualifyingResults: { ...state.qualifyingResults, [race.id]: results },
    news: [...dedupedQualNews, ...state.news].slice(0, 80),
  };
}

function getRacePrepFocusEffectForQualifying(state: GameState): RacePrepFocusEffect | undefined {
  const phaseState = getOrCreatePhaseState(state);
  if (!phaseState.racePrepFocus || phaseState.racePrepFocusApplied) return undefined;
  return computeRacePrepFocusEffect(phaseState.racePrepFocus);
}

function runRace(state: GameState, playerDecisions: RaceDecision[]): GameState {
  const race = currentRace(state);
  if (!race) return state;

  const built = buildRaceContext(state, playerDecisions);
  if (!built) return state;

  const { results, events, breakdowns } = simulateRace(built.context);
  const strategyRiskByDriver: Record<string, 'conservative' | 'balanced' | 'aggressive'> = {};
  for (const d of playerDecisions) {
    strategyRiskByDriver[d.driverId] = strategyRiskFromId(d.strategyId);
  }
  return applyRaceResults(state, race, results, events, breakdowns, [], strategyRiskByDriver);
}

function strategyRiskFromId(id: RaceStrategyId): 'conservative' | 'balanced' | 'aggressive' {
  switch (id) {
    case 'ConservativeOneStop':
    case 'SafetyFirstPoints':
    case 'TrackPositionFocus':
      return 'conservative';
    case 'AggressiveTwoStop':
    case 'UndercutFocused':
      return 'aggressive';
    default:
      return 'balanced';
  }
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
  teamOrders: TeamOrderDecision[] = [],
  strategyRiskByDriver?: Record<string, 'conservative' | 'balanced' | 'aggressive'>,
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

  let drivers = state.drivers.map((d) => ({
    ...d,
    confidence: morale.driverConfidence[d.id] ?? d.confidence,
    morale: morale.driverMorale[d.id] ?? d.morale,
  }));

  // Team-order fallout (Living Universe Phase 7): resolve the orders called this
  // race into the relationship map, nudge the affected drivers' morale, and keep
  // the season's order log + any media reactions for the news.
  let driverRelationships = state.driverRelationships;
  const prevDriverRelationships = state.driverRelationships ? { ...state.driverRelationships } : undefined;
  let driverPromises = state.driverPromises;
  let teamOrderHistory = state.teamOrderHistory ?? [];
  const relationshipNews: string[] = [];

  // Check for expired promises at the start of race processing.
  if (driverPromises && driverPromises.length > 0) {
    const race = currentRace(state);
    const round = race?.round ?? 0;
    const { promises: checkedPromises, expired } = checkExpiredPromises(
      driverPromises,
      state.seasonYear,
      round,
    );
    if (expired.length > 0 && driverRelationships) {
      for (const exp of expired) {
        driverRelationships = applyPromiseResolution(driverRelationships, exp);
      }
    }
    driverPromises = checkedPromises;
  }
  if (teamOrders.length > 0 && driverRelationships) {
    const driverNameOf = (id: string) => state.drivers.find((d) => d.id === id)?.name ?? id;
    const resolved = resolveTeamOrderConsequences(teamOrders, driverRelationships, driverNameOf);
    driverRelationships = resolved.relationships;
    teamOrderHistory = [...teamOrderHistory, ...teamOrders];
    relationshipNews.push(...resolved.news);
    const moraleDeltaById: Record<string, number> = {};
    for (const c of resolved.consequences) {
      moraleDeltaById[c.driverId] = (moraleDeltaById[c.driverId] ?? 0) + c.moraleDelta;
    }
    drivers = drivers.map((d) =>
      moraleDeltaById[d.id]
        ? { ...d, morale: Math.max(0, Math.min(100, Math.round(d.morale + moraleDeltaById[d.id]))) }
        : d,
    );
  }

  // Driver Confidence / Trust / Ego updates from race results.
  const perDriverConfidenceUpdates: Record<string, ConfidenceUpdate[]> = {};
  const perDriverRaceCtx: Record<string, RaceEventContext> = {};
  const perDriverPromiseResolutions: Record<string, PromiseResolution[]> = {};
  if (driverRelationships) {
    const allUpdates: ConfidenceUpdate[] = [];
    for (const r of results) {
      const rel = driverRelationships[r.driverId];
      if (!rel) continue;
      const teammateId = rel.teammateId;
      const teammateResult = teammateId ? results.find((x) => x.driverId === teammateId) : undefined;
      const qualEntry = qualifying.find((q) => q.driverId === r.driverId);
      const wasFavored = teamOrders.some((o) => o.favoredDriverId === r.driverId);
      const wasDisadvantaged = teamOrders.some((o) => o.disadvantagedDriverId === r.driverId);
      const isDNF = r.status !== 'Finished' && r.position === null;
      const hasCrashIncident = r.incidents.some((i) => i.toLowerCase().includes('crash') || i.toLowerCase().includes('collision'));
      const ctx: RaceEventContext = {
        driverId: r.driverId,
        finishingPosition: r.position ?? 99,
        totalDrivers: results.length,
        qualifiedPosition: qualEntry?.position ?? 0,
        dnf: isDNF,
        teammateFinishingPosition: teammateResult?.position ?? undefined,
        teammateDNF: teammateResult ? teammateResult.status !== 'Finished' : undefined,
        teamOrderIssued: teamOrders.length > 0,
        wasFavoredInOrders: wasFavored,
        wasDisadvantagedInOrders: wasDisadvantaged,
        carReliabilityDNF: isDNF && !hasCrashIncident,
        strategyRiskLevel: strategyRiskByDriver?.[r.driverId] ?? 'balanced',
        pointsScored: r.points,
        podium: r.position !== null && r.position <= 3,
        win: r.position === 1,
      };
      perDriverRaceCtx[r.driverId] = ctx;
      const driverUpdates = reactToRaceResult(rel, ctx);
      allUpdates.push(...driverUpdates);
      perDriverConfidenceUpdates[r.driverId] = driverUpdates;

      // Auto-resolve promises based on race events.
      const currentPromises = driverPromises ?? [];
      if (currentPromises.length > 0) {
        const resolutions = evaluatePromisesAfterRace(currentPromises, r.driverId, ctx);
        if (resolutions.length > 0) {
          perDriverPromiseResolutions[r.driverId] = resolutions;
        }
        for (const res of resolutions) {
          const resolved = resolvePromise(res.promise, res.fulfilled);
          driverPromises = (driverPromises ?? currentPromises).map((p) =>
            p.id === resolved.id ? resolved : p,
          );
          if (driverRelationships) {
            driverRelationships = applyPromiseResolution(driverRelationships, resolved);
          }
        }
      }
    }
    driverRelationships = applyConfidenceUpdates(driverRelationships, allUpdates);
  }
  // A per-race transport/logistics stipend helps offset the weekend package cost.
  const teams = state.teams.map((t) => ({ ...t, morale: morale.teamMorale[t.id] ?? t.morale }));
  let cars = state.cars.map((c) => ({ ...c }));
  const financeTxns: FinanceTransaction[] = [];
  const damageMessages: string[] = [];
  const conditionHitByTeam: Record<string, number> = {};
  const stipend = toMoney(0.8); // $800K per race per team (transport/logistics)
  for (const team of teams) {
    team.budget += stipend;
    if (team.id === state.selectedTeamId) {
      financeTxns.push(
        makeTransaction(state.seasonYear, 'Sponsorship', `${race.gpName}: Transport & logistics stipend`, stipend, race.round),
      );
    }
  }
  for (const r of results) {
    const team = teams.find((t) => t.id === r.teamId);
    if (!team) continue;
    const prize = r.points * 500_000; // prize money per point
    team.budget += prize;
    const roll = createSeededRandom(deriveSeed(state.randomSeed, 'damage', race.round, r.driverId)).next();
    const severity = classifyCrashDamage(r.status, r.incidents, roll);
    const reduction = team.id === state.selectedTeamId ? facilityRepairCostReduction(state.facilities) : 0;
    const repair = Math.round(repairCost(severity) * (1 - reduction));
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

  // Per-race sponsor installment: 75% of annual sponsorship paid across the
  // season's races for a realistic cashflow (25% was paid upfront at rollover).
  const totalRaces = state.calendar.length;
  const installments = sponsorInstallmentPayment(state.commercial, totalRaces);
  for (const inst of installments) {
    const team = teams.find((t) => t.id === state.selectedTeamId);
    if (team) team.budget += inst.amount;
    financeTxns.push(
      makeTransaction(state.seasonYear, 'Sponsorship', `${race.gpName}: ${inst.label}`, inst.amount, race.round),
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
    const playerTeamData = state.teams.find((t) => t.id === state.selectedTeamId);
    const tick = applyDevelopmentProgress(
      activeDevelopmentProjects,
      playerCar,
      state.randomSeed,
      race.round,
      developmentSuccessBonus(state.staff ?? []) +
        facilityDevelopmentSuccessBonus(state.facilities) +
        (playerTeamData ? raceOpsDevelopmentBonus(playerTeamData.raceOperations) : 0),
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

  // Generate structured career news for the race result.
  const careerCtx: CareerNewsContext = {
    state,
    phase: 'post_race_review',
    round: race.round,
    gpName: race.gpName,
    seed: state.randomSeed,
  };
  const careerRaceNews = generateCareerRaceNews(careerCtx, qualifying, results, driverNames, teamNames);
  // Merge race news + career race news with headline dedup (removes duplicates
  // like "X wins the GP" appearing from both newsEngine and careerNewsEngine).
  const mergedRaceNews = mergeNewsWithSpamControl(state.news, news, careerRaceNews);
  news.length = 0;
  news.push(...mergedRaceNews);

  // Generate driver drama news from confidence, trust, ego, morale, promise,
  // and teammate rivalry events.
  if (driverRelationships && prevDriverRelationships) {
    const dramaCtx: DramaNewsContext = {
      season: state.seasonYear,
      round: race.round,
      gpName: race.gpName,
      driverNames,
      teamNames,
    };
    const expiredPromises = (driverPromises ?? []).filter((p) => p.status === 'expired');
    const dramaNews = generateDriverDramaNews(dramaCtx, {
      relationships: driverRelationships,
      prevRelationships: prevDriverRelationships,
      confidenceUpdates: perDriverConfidenceUpdates,
      raceContexts: perDriverRaceCtx,
      promiseResolutions: perDriverPromiseResolutions,
      expiredPromises,
      allPromises: driverPromises ?? [],
      teamOrderConsequences: teamOrders.length > 0
        ? resolveTeamOrderConsequences(teamOrders, driverRelationships, (id) => driverNames[id] ?? id).consequences
        : [],
      teamOrders,
    });
    const dedupedDramaNews = deduplicateNews(news, dramaNews);
    news.push(...dedupedDramaNews);
  }

  for (const m of devMessages) {
    news.unshift({ id: `news-dev-${race.round}-${m.slice(0, 8)}`, round: race.round, headline: m, timestamp: new Date().toISOString() });
  }
  damageMessages.forEach((m, i) => {
    news.unshift({ id: `news-damage-${race.round}-${i}`, round: race.round, headline: m, timestamp: new Date().toISOString() });
  });
  relationshipNews.forEach((m, i) => {
    news.unshift({ id: `news-order-${race.round}-${i}`, round: race.round, headline: m, timestamp: new Date().toISOString() });
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
    driverRelationships,
    driverPromises,
    teamOrderHistory,
    news: sortNewsByPriority(capNewsPerRound([...news, ...state.news]).slice(0, 80)),
    currentRaceIndex: seasonComplete ? state.currentRaceIndex : nextIndex,
    seasonComplete,
  };
}

function startDevelopment(state: GameState, projectId: string, rushed: boolean): GameState {
  const template = developmentProjectsById[projectId];
  if (!template) return state;
  const team = state.teams.find((t) => t.id === state.selectedTeamId);
  if (!team) return state;

  // In Single Season mode, block projects that only have next-season effects
  // (no current-season effects). Projects with current-season effects are allowed.
  if (isSingleSeasonMode(state.gameMode)) {
    const hasCurrentEffects = template.currentSeasonEffects && Object.keys(template.currentSeasonEffects).length > 0;
    if (!hasCurrentEffects) return state;
  }

  // Check development slots (facility-based).
  const slots = developmentSlots(state.facilities);
  if (state.activeDevelopmentProjects.length >= slots) return state;

  // Compute facility level for this project category.
  const facLevel = relevantFacilityLevel(state.facilities, template.category);

  // Compute adjusted duration based on facility level, project size, and rush.
  const projectSize = template.projectSize ?? 'Medium';
  const adjustedDuration = computeAdjustedDuration(
    template.durationRaces,
    facLevel,
    projectSize,
    rushed,
  );

  // Compute cost (rush increases cost by 1.5x).
  const cost = rushed ? Math.round(template.cost * RUSH_COST_MULTIPLIER()) : template.cost;
  if (team.budget < cost) return state;

  const instance: DevelopmentProject = {
    ...template,
    id: `${template.id}-${Date.now()}`,
    progressRaces: 0,
    rushed,
    facilityLevelAtStart: facLevel,
    adjustedDurationRaces: adjustedDuration,
  };

  const teams = state.teams.map((t) =>
    t.id === team.id ? { ...t, budget: t.budget - cost } : t,
  );

  return {
    ...state,
    teams,
    finance: [
      ...(state.finance ?? []),
      makeTransaction(state.seasonYear, 'Development', `${template.name}${rushed ? ' (Rushed)' : ''}`, -cost),
    ],
    activeDevelopmentProjects: [...state.activeDevelopmentProjects, instance],
  };
}

function rushDevelopment(state: GameState, projectId: string): GameState {
  const project = state.activeDevelopmentProjects.find((p) => p.id === projectId);
  if (!project || project.rushed) return state;

  const team = state.teams.find((t) => t.id === state.selectedTeamId);
  if (!team) return state;

  // Rush cost: 50% of original project cost.
  const rushCost = Math.round(project.cost * 0.5);
  if (team.budget < rushCost) return state;

  const facLevel = project.facilityLevelAtStart ?? 3;
  const projectSize = project.projectSize ?? 'Medium';
  const newDuration = computeAdjustedDuration(
    project.durationRaces,
    facLevel,
    projectSize,
    true,
  );

  const teams = state.teams.map((t) =>
    t.id === team.id ? { ...t, budget: t.budget - rushCost } : t,
  );

  const activeDevelopmentProjects = state.activeDevelopmentProjects.map((p) =>
    p.id === projectId
      ? {
          ...p,
          rushed: true,
          adjustedDurationRaces: newDuration,
        }
      : p,
  );

  return {
    ...state,
    teams,
    finance: [
      ...(state.finance ?? []),
      makeTransaction(state.seasonYear, 'Development', `${project.name} (Rush Fee)`, -rushCost),
    ],
    activeDevelopmentProjects,
  };
}

function hasPackageForCurrentRace(state: GameState): boolean {
  const race = currentRace(state);
  return !!race && state.raceWeekendPackage?.raceId === race.id;
}

function chooseDefaultRaceWeekendPackage(state: GameState): RaceWeekendPackageType {
  const race = currentRace(state);
  const track = race ? getTrackById(race.trackId) : undefined;
  const team = state.teams.find((t) => t.id === state.selectedTeamId);
  if (!race || !track || !team) return 'Standard';

  const available = availablePackagesForSeries(state.series);
  if (available.includes('Standard')) {
    const standard = computeRaceWeekendPackageCost(state.series, team, track, 'Standard');
    if (team.budget >= standard.cost) return 'Standard';
  }

  const affordable = available
    .map((packageType) => ({
      packageType,
      cost: computeRaceWeekendPackageCost(state.series, team, track, packageType).cost,
    }))
    .filter((candidate) => team.budget >= candidate.cost)
    .sort((a, b) => a.cost - b.cost);

  return affordable[0]?.packageType ?? 'MandatoryMinimum';
}

function ensureDefaultRaceWeekendPackage(state: GameState): GameState {
  if (hasPackageForCurrentRace(state)) return state;
  return selectRaceWeekendPackage(state, chooseDefaultRaceWeekendPackage(state));
}

// Select a Race Weekend Package for the current race: deduct cost from budget,
// store the selection, apply sponsor confidence and driver morale effects.
function selectRaceWeekendPackage(
  state: GameState,
  packageType: RaceWeekendPackageType,
): GameState {
  const race = currentRace(state);
  if (!race) return state;
  if (state.raceWeekendPackage?.raceId === race.id) return state;
  const track = getTrackById(race.trackId);
  if (!track) return state;
  const team = state.teams.find((t) => t.id === state.selectedTeamId);
  if (!team) return state;

  const isEmergency = packageType === 'MandatoryMinimum';

  // Validate package is available for this series.
  // MandatoryMinimum is always available as an emergency fallback.
  if (!isEmergency && !availablePackagesForSeries(state.series).includes(packageType)) return state;

  // For MandatoryMinimum: only allow if team cannot afford any normal package.
  if (isEmergency && canAffordAnyNormalPackage(state.series, team, track)) return state;

  // Compute cost.
  const costResult = isEmergency
    ? computeMandatoryMinimumCost()
    : computeRaceWeekendPackageCost(state.series, team, track, packageType);

  // Budget Focus no longer reduces race weekend cost — it gives +$500K upfront
  // (handled in resolvePaddockEvent) and applies next-race performance penalties.
  const adjustedCost = costResult.cost;

  if (!isEmergency && team.budget < adjustedCost) return state;

  const selection: RaceWeekendPackageSelection = {
    packageType,
    raceId: race.id,
    gpName: race.gpName,
    cost: adjustedCost,
    teamScale: costResult.teamScale,
    trackModifier: costResult.trackModifier,
    packageModifier: costResult.packageModifier,
    damageReserve: costResult.damageReserve,
  };

  // Deduct cost from budget.
  const teams = state.teams.map((t) =>
    t.id === team.id ? { ...t, budget: t.budget - adjustedCost } : t,
  );

  // Apply sponsor confidence changes.
  const effects = packageEffects(packageType);
  let commercial = state.commercial;
  if (commercial && effects.sponsorSatisfaction !== 0) {
    commercial = {
      ...commercial,
      sponsors: commercial.sponsors.map((s) => ({
        ...s,
        confidence: Math.max(0, Math.min(100, Math.round(s.confidence + effects.sponsorSatisfaction))),
      })),
    };
  }

  // Apply driver morale changes.
  let drivers = state.drivers;
  if (effects.driverMorale !== 0) {
    drivers = state.drivers.map((d) =>
      d.teamId === state.selectedTeamId
        ? { ...d, morale: Math.max(0, Math.min(100, Math.round(d.morale + effects.driverMorale))) }
        : d,
    );
  }

  // Apply team morale change (half of driver morale delta).
  const teamMoraleDelta = Math.round(effects.driverMorale * 0.5);
  const teamsWithMorale = teams.map((t) =>
    t.id === team.id
      ? { ...t, morale: Math.max(0, Math.min(100, Math.round(t.morale + teamMoraleDelta))) }
      : t,
  );

  // Add finance transaction.
  const financeTxns: FinanceTransaction[] = [
    makeTransaction(
      state.seasonYear,
      'Operations',
      `${race.gpName}: ${RACE_WEEKEND_PACKAGES[packageType].label}`,
      -costResult.cost,
      race.round,
    ),
  ];

  // Add to history.
  const history = [...(state.raceWeekendPackageHistory ?? []), selection];

  // Generate AI team package selections for this weekend.
  const aiPackages = generateAIPackages(state, race, track);

  // Add news item for the package selection.
  const packageNews = {
    id: `news-pkg-${race.round}-${packageType}`,
    round: race.round,
    headline: isEmergency
      ? `${team.name} forced into Minimum Operations at ${race.gpName} due to financial constraints.`
      : `${team.name} opts for ${RACE_WEEKEND_PACKAGES[packageType].label} at ${race.gpName}.`,
    body: isEmergency
      ? 'Your team cannot afford a standard race package. Minimum Operations will get the cars to the grid, but performance, reliability, morale, and sponsor confidence may suffer.'
      : undefined,
    timestamp: new Date().toISOString(),
  };

  // Update financial distress for the player team.
  const playerDistress = updateFinancialDistress(
    state.financialDistress?.[team.id],
    teamsWithMorale.find((t) => t.id === team.id)!.budget,
    isEmergency,
  );

  // Generate distress news if level has escalated.
  const distressNews = distressNewsHeadline(team.name, playerDistress);
  const allNews = [packageNews];
  if (distressNews) {
    allNews.unshift({
      id: `news-distress-${race.round}-${team.id}`,
      round: race.round,
      headline: distressNews.headline,
      body: distressNews.body,
      timestamp: new Date().toISOString(),
    });
  }

  return {
    ...state,
    teams: aiPackages.teams.map((t) =>
      t.id === team.id ? teamsWithMorale.find((tw) => tw.id === team.id)! : t,
    ),
    drivers,
    commercial,
    raceWeekendPackage: selection,
    raceWeekendPackageHistory: history,
    aiRaceWeekendPackages: aiPackages.packages,
    finance: [...(state.finance ?? []), ...financeTxns],
    financialDistress: { ...aiPackages.financialDistress, [team.id]: playerDistress },
    news: [...allNews, ...aiPackages.news, ...state.news].slice(0, 80),
  };
}

// Generate Race Weekend Package selections for all AI teams based on their
// financial state, archetype, championship position, and car reliability.
// Also deducts package costs from AI budgets, updates financial distress,
// and generates news for AI emergency package usage.
function generateAIPackages(
  state: GameState,
  race: NonNullable<ReturnType<typeof currentRace>>,
  track: Track,
): { packages: Record<string, RaceWeekendPackageSelection>; teams: Team[]; financialDistress: FinancialDistressMap; news: NewsItem[] } {
  const result: Record<string, RaceWeekendPackageSelection> = {};
  const constructorStandings = state.constructorStandings;
  const teamCount = state.teams.length;
  const isLateSeason = race.round > state.calendar.length * 0.7;
  const aiNews: NewsItem[] = [];
  let teams = [...state.teams];
  let financialDistress = { ...state.financialDistress };

  for (const team of state.teams) {
    if (team.id === state.selectedTeamId) continue;

    // Build AI context from available state.
    const aiState = state.aiTeamStates?.[team.id];
    const car = carForTeam(state, team.id);
    const carReliability = car ? effectiveCarRatings(car).reliability : 50;
    const constructorPosition =
      constructorStandings.findIndex((s) => s.entityId === team.id) + 1 || teamCount;

    // Determine financial health from AI state or estimate from budget.
    const financialHealth = aiState?.financialHealth ?? 'Stable';
    const archetype = aiState?.archetype ?? 'FinanciallyConservative';
    const risk = aiState?.archetype
      ? ARCHETYPE_SPECS[aiState.archetype]?.risk ?? 0.3
      : 0.3;

    const trackClass = trackCostClass(track);
    const damageRiskTrack = trackClass === 'HighDamageRisk' || trackClass === 'Street';

    const ctx: AIPackageContext = {
      teamBudget: team.budget,
      financialHealth,
      archetype,
      risk,
      championshipPosition: constructorPosition,
      teamCount,
      carReliability,
      raceImportance: 0.5,
      isLateSeason,
      damageRiskTrack,
    };

    const pkgType = aiSelectPackage(ctx, state.series, state.randomSeed, team.id, race.round);
    const costResult = computeRaceWeekendPackageCost(state.series, team, track, pkgType);

    let selectedType: RaceWeekendPackageType = pkgType;
    let selectedCost = costResult;

    // If AI team cannot afford the selected package, fall back to MandatoryMinimum.
    if (team.budget < costResult.cost) {
      selectedType = 'MandatoryMinimum';
      selectedCost = computeMandatoryMinimumCost();
    }

    result[team.id] = {
      packageType: selectedType,
      raceId: race.id,
      gpName: race.gpName,
      cost: selectedCost.cost,
      teamScale: selectedCost.teamScale,
      trackModifier: selectedCost.trackModifier,
      packageModifier: selectedCost.packageModifier,
      damageReserve: selectedCost.damageReserve,
    };

    // Deduct package cost from AI team budget.
    teams = teams.map((t) =>
      t.id === team.id ? { ...t, budget: t.budget - selectedCost.cost } : t,
    );

    // Update AI financial distress.
    const isEmergency = selectedType === 'MandatoryMinimum';
    const updatedBudget = teams.find((t) => t.id === team.id)!.budget;
    const aiDistress = updateFinancialDistress(
      financialDistress[team.id],
      updatedBudget,
      isEmergency,
    );
    financialDistress = { ...financialDistress, [team.id]: aiDistress };

    // Generate news for AI emergency package usage.
    if (isEmergency) {
      aiNews.push({
        id: `news-ai-emergency-${race.round}-${team.id}`,
        round: race.round,
        headline: `${team.name} forced into Minimum Operations at ${race.gpName}`,
        body: 'Financial constraints force the team to run emergency operations.',
        timestamp: new Date().toISOString(),
        category: 'ai_team',
        priority: 'high',
        careerPhase: 'pre_race_briefing',
        teamId: team.id,
      });
    }

    // Generate AI distress escalation news.
    const distressNews = distressNewsHeadline(team.name, aiDistress);
    if (distressNews) {
      aiNews.push({
        id: `news-ai-distress-${race.round}-${team.id}`,
        round: race.round,
        headline: distressNews.headline,
        body: distressNews.body,
        timestamp: new Date().toISOString(),
        category: 'financial',
        priority: aiDistress.level === 'ClosureRisk' || aiDistress.level === 'Administration' ? 'critical' : 'high',
        careerPhase: 'pre_race_briefing',
        teamId: team.id,
      });
    }
  }

  return { packages: result, teams, financialDistress, news: aiNews };
}

export type { QualifyingResult };
