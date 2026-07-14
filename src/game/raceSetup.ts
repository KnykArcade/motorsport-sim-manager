// Shared construction of the race simulation context.
//
// Both the quick race (RUN_RACE in the reducer) and the live race (the LiveRace
// screen) build the same RaceContext from the current game state, so a race
// produces a consistent field whichever path is used.

import { getTrackById } from '../data';
import { getPointsSystem } from '../data/pointsSystems/pointsSystems';
import { setupOptionsById } from '../data/setupOptions/setupOptions';
import { autoSetupOptionsForTrack } from '../sim/autoSetup';
import { deriveSetupOption, type SetupTrim } from '../sim/setupDerive';
import { setupConfidenceBonus, pitCrewBonus, strategyBonus } from '../sim/staffEngine';
import { facilitySetupFeedbackBonus } from '../sim/facilityEngine';
import {
  driverPracticeSummary,
  practiceSetupConfidenceBonus,
} from '../sim/practiceProgramEngine';
import { objectiveSetupQuality, adjustedSetupTolerance } from '../sim/setupFitEngine';
import { driverSetupComfort } from '../sim/driverComfortEngine';
import { weekendForecast } from '../sim/weatherEngine';
import { raceStrategiesById } from '../data/decisions/raceStrategies';
import { driverInstructionsById } from '../data/decisions/driverInstructions';
import { aiRaceDecision } from './ai';
import {
  activeDriversForTeam,
  carForTeam,
  currentRace,
  driversForTeam,
  type GameState,
} from './careerState';
import type { SetupOption, Track } from '../types/gameTypes';
import type { Entrant, RaceContext, RaceDecision, RacePrepFocusEffect } from '../types/simTypes';
import type { RaceWeekendPackageEffects } from '../types/raceWeekendPackageTypes';
import type { DamageBalanceSettings, PitIntensity } from '../types/liveTypes';
import type { TeamOrganizationRatings } from '../types/teamRatingsTypes';
import { carWithFittedParts } from '../sim/partsEngine';
import { packageEffects as getPackageEffects } from '../sim/raceWeekendPackageEngine';
import { confidencePerformanceModifier } from '../sim/driverConfidenceEngine';
import { applyLeadershipPreparationModifier } from '../sim/phase18IdentityCultureEngine';
import { applyPreseasonCarModifier } from '../sim/phase18PreseasonEngine';
import { applyFailureRiskModifier } from '../sim/phase18FailureInvestigationEngine';
import type { LiveRaceMeta, LiveRaceOptions } from '../sim/liveRaceEngine';
import { computeRacePrepFocusEffect, getOrCreatePhaseState } from './careerPhaseEngine';

// Build the derived session setups for the player's tuned car setups, plus a
// lookup from driverId to the setup id to use for the given session trim. Cars
// without a tuned setup (AI teams, or before the workshop runs) fall back to the
// automatic track-appropriate trim.
export function playerTunedSetups(
  state: GameState,
  track: Track,
  trim: SetupTrim,
): { overlay: Record<string, SetupOption>; setupIdByDriver: Record<string, string> } {
  const overlay: Record<string, SetupOption> = {};
  const setupIdByDriver: Record<string, string> = {};
  const carSetups = state.carSetups ?? {};
  const staffBonus = setupConfidenceBonus(state.staff ?? []) + facilitySetupFeedbackBonus(state.facilities);
  const race = currentRace(state);
  const wp =
    state.weekendPractice && state.weekendPractice.raceId === race?.id
      ? state.weekendPractice
      : undefined;
  const knowledge = wp?.knowledge;
  const car = carForTeam(state, state.selectedTeamId);
  const raceWet =
    race != null ? weekendForecast(track, `${state.randomSeed}-r${race.round}`).Race.wet : false;

  for (const driver of driversForTeam(state, state.selectedTeamId)) {
    const tuned = carSetups[driver.id];
    if (!tuned) continue;
    const confidenceBonus = staffBonus + practiceSetupConfidenceBonus(knowledge, driver.id);

    // Compute setup tolerance adjusted by team capability, staff, and practice.
    // Without practice, the tolerance widens significantly — harder to nail setup.
    const team = state.teams.find((t) => t.id === state.selectedTeamId);
    const practiceSetupKnowledge = knowledge?.setupKnowledge[driver.id] ?? 0;
    const setupTolerance = adjustedSetupTolerance(
      2.2,
      team?.raceOperations ?? 5,
      setupConfidenceBonus(state.staff ?? []),
      practiceSetupKnowledge,
    );

    // Objective quality (engineering fit vs track + this car) and the driver's
    // comfort with the tuned setup relative to what they ran in practice.
    const quality = objectiveSetupQuality(tuned, track, car, setupTolerance);
    const summary = driverPracticeSummary(wp, driver.id);
    const comfort = driverSetupComfort({
      driver,
      currentSetup: tuned,
      practicedSetup: wp?.practicedSetupByDriver?.[driver.id],
      practiceLaps: summary.laps,
      setupKnowledge: knowledge?.setupKnowledge[driver.id] ?? 0,
      ranQualiSim: summary.ranQualiSim,
      ranRacePace: summary.ranRacePace,
      ranWetPrep: summary.ranWetPrep,
      raceWet,
      hadIncident: summary.hadIncident,
    });

    const option = deriveSetupOption(tuned, track, driver, trim, {
      car,
      quality,
      comfort,
      confidenceBonus,
    });
    overlay[option.id] = option;
    setupIdByDriver[driver.id] = option.id;
  }
  return { overlay, setupIdByDriver };
}

export type BuiltRaceContext = {
  context: RaceContext;
  track: Track;
  raceId: string;
  totalLaps: number;
};

// Build the full RaceContext for the current race. Player decisions override the
// AI defaults; any driver without a player decision uses the AI's choice.
export function buildRaceContext(
  state: GameState,
  playerDecisions: RaceDecision[],
): BuiltRaceContext | null {
  const race = currentRace(state);
  if (!race) return null;
  const track = getTrackById(race.trackId);
  if (!track) return null;
  const qualifying = state.qualifyingResults[race.id];
  if (!qualifying) return null;

  // Cars flagged DNQ in qualifying do not start the race.
  const didNotQualify = new Set(qualifying.filter((q) => q.dnq).map((q) => q.driverId));

  const entrants: Entrant[] = [];
  for (const team of state.teams) {
    const car = carForTeam(state, team.id);
    if (!car) continue;
    for (const driver of activeDriversForTeam(state, team.id)) {
      if (didNotQualify.has(driver.id)) continue;
      entrants.push({
        driver,
        car: applyFailureRiskModifier(state, applyPreseasonCarModifier(state, carWithFittedParts(car, state.teamParts?.[team.id], driver.id))),
      });
    }
  }

  const tuned = playerTunedSetups(state, track, 'race');

  const decisions: Record<string, RaceDecision> = {};
  const playerById = new Map(playerDecisions.map((d) => [d.driverId, d]));
  for (const e of entrants) {
    const decision = playerById.get(e.driver.id) ?? aiRaceDecision(e.driver.id, track);
    const tunedId = tuned.setupIdByDriver[e.driver.id];
    decisions[e.driver.id] = tunedId ? { ...decision, setupId: tunedId } : decision;
  }

  const pointsSystem = getPointsSystem(state.pointsSystemId);
  const teamReputation: Record<string, number> = {};
  const teamRaceOps: Record<string, number> = {};
  const pitIntensityByTeam: Record<string, PitIntensity> = {};
  const pkgEffects: Record<string, RaceWeekendPackageEffects> = {};
  state.teams.forEach((t) => {
    teamReputation[t.id] = t.reputation;
    pitIntensityByTeam[t.id] = t.pitIntensityDefault ?? 'Standard';
    teamRaceOps[t.id] = t.raceOperations;
    // Player team uses their selected package; AI teams use Standard (no modifier)
    // until AI package selection is wired in.
    if (t.id === state.selectedTeamId && state.raceWeekendPackage?.raceId === race.id) {
      pkgEffects[t.id] = getPackageEffects(state.raceWeekendPackage.packageType);
    } else if (state.aiRaceWeekendPackages?.[t.id]) {
      pkgEffects[t.id] = getPackageEffects(state.aiRaceWeekendPackages[t.id].packageType);
    }
  });

  // Build confidence modifier map from driver relationships.
  const confidenceModifierByDriver: Record<string, number> = {};
  const driverRelationships = state.driverRelationships ?? {};
  if (state.driverRelationships) {
    for (const [id, rel] of Object.entries(state.driverRelationships)) {
      confidenceModifierByDriver[id] = confidencePerformanceModifier(rel);
    }
  }

  const context: RaceContext = {
    track,
    entrants,
    qualifyingResults: qualifying,
    decisions,
    setupOptions: { ...setupOptionsById, ...autoSetupOptionsForTrack(track), ...tuned.overlay },
    strategies: raceStrategiesById,
    instructions: driverInstructionsById,
    pointsByPosition: pointsSystem.pointsByPosition,
    pointsMultiplier: race.pointsMultiplier ?? 1,
    seed: `${state.randomSeed}-r${race.round}`,
    year: state.seasonYear,
    teamReputation,
    teamRaceOps,
    pitIntensityByTeam,
    packageEffectsByTeam: pkgEffects,
    racePrepFocusEffect: getRacePrepFocusEffect(state),
    playerTeamId: state.selectedTeamId,
    playerStaffBonus: {
      pitCrew: pitCrewBonus(state.staff ?? []),
      strategy: strategyBonus(state.staff ?? []),
    },
    confidenceModifierByDriver,
    driverRelationships,
  };

  return { context, track, raceId: race.id, totalLaps: race.laps };
}

export function buildLiveRaceOptions(
  state: GameState,
  context: RaceContext,
  raceId: string,
  totalLaps: number,
  liveRaceOptions?: { damageSettings?: DamageBalanceSettings; teamOrgRatings?: Record<string, TeamOrganizationRatings> },
): LiveRaceOptions {
  const driverNames: Record<string, string> = {};
  context.entrants.forEach((e) => (driverNames[e.driver.id] = e.driver.name));
  const teamReputation: Record<string, number> = {};
  const teamRaceOps: Record<string, number> = {};
  state.teams.forEach((t) => {
    teamReputation[t.id] = t.reputation;
    teamRaceOps[t.id] = t.raceOperations;
  });
  return {
    raceId,
    playerTeamId: state.selectedTeamId,
    totalLaps,
    driverNames,
    teamReputation,
    teamRaceOps,
    year: state.seasonYear,
    series: state.series,
    damageSettings: liveRaceOptions?.damageSettings,
    teamOrgRatings: liveRaceOptions?.teamOrgRatings ?? state.teamOrgRatings,
  };
}

export function buildLiveRaceMeta(state: GameState, track: Track): LiveRaceMeta {
  const driverNames: Record<string, string> = {};
  state.drivers.forEach((d) => (driverNames[d.id] = d.name));
  const teamNames: Record<string, string> = {};
  state.teams.forEach((t) => (teamNames[t.id] = t.name));
  return {
    track,
    driverNames,
    teamNames,
    playerTeamId: state.selectedTeamId,
    year: state.seasonYear,
    series: state.series,
  };
}

function getRacePrepFocusEffect(state: GameState): RacePrepFocusEffect | undefined {
  const phaseState = getOrCreatePhaseState(state);
  if (!phaseState.racePrepFocus || phaseState.racePrepFocusApplied) return undefined;
  return applyLeadershipPreparationModifier(state, computeRacePrepFocusEffect(phaseState.racePrepFocus));
}
