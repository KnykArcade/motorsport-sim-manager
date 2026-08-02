import { qualifyingRunPlansById } from '../data/decisions/qualifyingRunPlans';
import { driverInstructionsById } from '../data/decisions/driverInstructions';
import { raceStrategiesById } from '../data/decisions/raceStrategies';
import { selectRaceRuleProfile } from '../data/rules/raceRuleProfiles';
import { getTrackById } from '../data';
import {
  activeDriversForTeam,
  currentRace,
  minRaceDriversForSeries,
  reserveDriversForTeam,
  type GameState,
} from '../game/careerState';
import { calculateOverallSetupConfidence, calculateSetupFit } from '../sim/setupFitEngine';
import { setupLockPhase, setupLockStatus } from '../sim/setupLockEngine';
import { weekendCommandRecommendations } from '../sim/weekendCommandEngine';
import type { WeekendForecast } from '../sim/weatherEngine';
import type { CarSetup } from '../types/setupTypes';
import type { QualifyingDecision, RaceDecision } from '../types/simTypes';
import type { ConfirmedWeekendPlan } from '../types/weekendLeadershipTypes';

export type WeekendPlanBoardDriver = {
  driverId: string;
  driverName: string;
  grid: string;
  qualifyingPlan: string;
  raceStrategy: string;
  instruction: string;
  setupConfidence: number;
  setupWarnings: string[];
  parcFerme: string;
};

export type WeekendPlanBoard = {
  title: string;
  summary: string;
  preparation: Array<{
    label: string;
    value: string;
    detail: string;
    reviewPhase?: string;
  }>;
  drivers: WeekendPlanBoardDriver[];
  warnings: string[];
  unresolvedAdvice: number;
  reserveDecision?: {
    required: boolean;
    label: string;
    detail: string;
  };
  canConfirm: boolean;
  blockedReason?: string;
  snapshot?: ConfirmedWeekendPlan;
};

function averageKnowledge(
  ids: string[],
  source: Record<string, number> | undefined,
): number {
  if (ids.length === 0) return 0;
  return Math.round(
    ids.reduce((sum, id) => sum + (source?.[id] ?? 0), 0) / ids.length * 100,
  );
}

export function buildWeekendPlanBoard(input: {
  state: GameState;
  forecast: WeekendForecast;
  setups: Record<string, CarSetup>;
  qualifyingDecisions: QualifyingDecision[];
  raceDecisions: RaceDecision[];
}): WeekendPlanBoard {
  const { state } = input;
  const race = currentRace(state);
  if (!race) {
    return {
      title: 'Weekend Plan',
      summary: 'No active race is available.',
      preparation: [],
      drivers: [],
      warnings: ['No active race is available.'],
      unresolvedAdvice: 0,
      canConfirm: false,
      blockedReason: 'No active race is available',
    };
  }
  const activeDrivers = activeDriversForTeam(state, state.selectedTeamId);
  const minimumDrivers = minRaceDriversForSeries(state.series);
  const qualifyingResults = state.qualifyingResults[race.id] ?? [];
  const qualifyingById = new Map(input.qualifyingDecisions.map((decision) => [decision.driverId, decision]));
  const raceById = new Map(input.raceDecisions.map((decision) => [decision.driverId, decision]));
  const resultById = new Map(qualifyingResults.map((result) => [result.driverId, result]));
  const trackData = getTrackById(race.trackId);
  if (!trackData) {
    return {
      title: `${race.gpName} Weekend Plan`,
      summary: 'Track data is unavailable.',
      preparation: [],
      drivers: [],
      warnings: ['Track data is unavailable.'],
      unresolvedAdvice: 0,
      canConfirm: false,
      blockedReason: 'Track data is unavailable',
    };
  }

  const profile = selectRaceRuleProfile(
    state.series,
    state.seasonYear,
    trackData,
    race.setupEventFormatOverride,
  );
  const lock = setupLockStatus(profile, setupLockPhase(qualifyingResults.length > 0, profile));
  const practice = state.weekendPractice?.raceId === race.id ? state.weekendPractice : undefined;
  const driverIds = activeDrivers.map((driver) => driver.id);
  const setupKnowledge = averageKnowledge(driverIds, practice?.knowledge.setupKnowledge);
  const tyreKnowledge = averageKnowledge(driverIds, practice?.knowledge.tireKnowledge);
  const reliabilityKnowledge = averageKnowledge(driverIds, practice?.knowledge.reliabilityKnowledge);
  const advice = weekendCommandRecommendations(state);
  const unresolvedAdvice = advice.filter((item) => item.status === 'Pending').length;
  const drivers: WeekendPlanBoardDriver[] = activeDrivers.map((driver) => {
    const qualifying = qualifyingById.get(driver.id);
    const raceDecision = raceById.get(driver.id);
    const setup = input.setups[driver.id];
    const setupFit = setup ? calculateSetupFit(setup, trackData, driver) : undefined;
    return {
      driverId: driver.id,
      driverName: driver.name,
      grid: resultById.get(driver.id)?.dnq
        ? 'DNQ'
        : resultById.get(driver.id)
          ? `P${resultById.get(driver.id)!.position}`
          : 'Pending',
      qualifyingPlan: qualifying
        ? qualifyingRunPlansById[qualifying.runPlanId]?.name ?? qualifying.runPlanId
        : 'Not set',
      raceStrategy: raceDecision
        ? raceStrategiesById[raceDecision.strategyId]?.name ?? raceDecision.strategyId
        : 'Not set',
      instruction: raceDecision
        ? driverInstructionsById[raceDecision.instructionId]?.name ?? raceDecision.instructionId
        : 'Not set',
      setupConfidence: setup
        ? calculateOverallSetupConfidence(setup, trackData, driver)
        : 0,
      setupWarnings: setupFit?.warnings ?? ['No committed setup found.'],
      parcFerme: lock.active ? lock.label : 'Setup changes open',
    };
  });

  const warnings = [
    ...drivers.flatMap((driver) =>
      driver.setupWarnings.map((warning) => `${driver.driverName}: ${warning}`)),
    ...(unresolvedAdvice > 0
      ? [`${unresolvedAdvice} staff recommendation${unresolvedAdvice === 1 ? ' remains' : 's remain'} unresolved.`]
      : []),
    ...(reliabilityKnowledge < 45
      ? [`Reliability knowledge is only ${reliabilityKnowledge}%.`]
      : []),
  ];
  const packageSelection = state.raceWeekendPackage?.raceId === race.id
    ? state.raceWeekendPackage
    : undefined;
  const phase = state.careerPhase;
  const completeQualifying = qualifyingResults.length > 0;
  const completeDecisions = activeDrivers.every(
    (driver) => qualifyingById.has(driver.id) && raceById.has(driver.id) && !!input.setups[driver.id],
  );
  const validLineup = activeDrivers.length >= minimumDrivers;
  const canConfirm = !!packageSelection && completeQualifying && completeDecisions && validLineup;
  const blockedReason = !packageSelection
    ? 'No race package is selected'
    : !validLineup
      ? `The active lineup needs ${minimumDrivers} race drivers`
      : !completeQualifying
        ? 'Qualifying must be completed'
        : !completeDecisions
          ? 'Every active driver needs a setup, strategy, and instruction'
          : undefined;
  const reserves = reserveDriversForTeam(state, state.selectedTeamId);
  const absences = (state.raceDriverAbsences ?? []).filter(
    (absence) =>
      absence.teamId === state.selectedTeamId
      && absence.startRound <= race.round
      && absence.expectedReturnRound > race.round,
  );
  const reserveDecision = absences.length > 0 || !validLineup
    ? {
        required: !validLineup,
        label: reserves.length > 0 ? 'Reserve decision available' : 'Reserve required',
        detail: reserves.length > 0
          ? `${reserves.length} reserve driver${reserves.length === 1 ? '' : 's'} available for the active lineup.`
          : 'No eligible reserve driver is currently available.',
      }
    : undefined;
  const recommendationResolutions = advice
    .filter((item) => item.resolutionMode)
    .map((item) => ({
      recommendationId: item.id,
      resolution: item.resolutionMode!,
    }));

  return {
    title: `${race.gpName} Weekend Plan`,
    summary: canConfirm
      ? 'The grid, preparation, setup, strategy, and instructions are ready for final confirmation.'
      : `The plan cannot be confirmed: ${blockedReason}.`,
    preparation: [
      {
        label: 'Preparation focus',
        value: phase?.racePrepFocus ?? 'Balanced',
        detail: phase?.racePrepFocusConfirmed
          ? 'Confirmed before weekend entry and now locked for this race'
          : 'Using the current fallback',
      },
      {
        label: 'Operations package',
        value: packageSelection?.packageType ?? 'Not selected',
        detail: packageSelection ? 'Committed in Paddock Week and locked for this race' : 'Required',
      },
      {
        label: 'Practice knowledge',
        value: `${setupKnowledge}% setup · ${tyreKnowledge}% tyres`,
        detail: `${reliabilityKnowledge}% reliability knowledge`,
        reviewPhase: 'practice',
      },
      {
        label: 'Race weather',
        value: input.forecast.Race.condition,
        detail: input.forecast.Race.changingSoon ? 'Conditions may change during the race' : 'Forecast currently stable',
        reviewPhase: 'briefing',
      },
    ],
    drivers,
    warnings,
    unresolvedAdvice,
    reserveDecision,
    canConfirm,
    blockedReason,
    snapshot: canConfirm && packageSelection
      ? {
          raceId: race.id,
          teamId: state.selectedTeamId,
          seasonYear: state.seasonYear,
          round: race.round,
          preparationFocus: phase?.racePrepFocus ?? 'balanced',
          packageType: packageSelection.packageType,
          weatherCondition: input.forecast.Race.condition,
          practiceKnowledge: {
            setup: setupKnowledge,
            tyres: tyreKnowledge,
            reliability: reliabilityKnowledge,
          },
          drivers: activeDrivers.map((driver) => {
            const qualifying = qualifyingById.get(driver.id)!;
            const raceDecision = raceById.get(driver.id)!;
            return {
              driverId: driver.id,
              gridPosition: resultById.get(driver.id)?.position ?? 0,
              qualifyingPlanId: qualifying.runPlanId,
              qualifyingRuns: qualifying.runs ?? 2,
              qualifyingTyreApproach: qualifying.tyreApproach ?? 'Standard',
              raceStrategyId: raceDecision.strategyId,
              instructionId: raceDecision.instructionId,
              setupConfidence: calculateOverallSetupConfidence(
                input.setups[driver.id],
                trackData,
                driver,
              ),
              parcFermeLocked: lock.active,
            };
          }),
          recommendationResolutions,
          unresolvedWarningCount: warnings.length,
        }
      : undefined,
  };
}
