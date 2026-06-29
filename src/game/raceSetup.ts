// Shared construction of the race simulation context.
//
// Both the quick race (RUN_RACE in the reducer) and the live race (the LiveRace
// screen) build the same RaceContext from the current game state, so a race
// produces a consistent field whichever path is used.

import { getTrackById } from '../data';
import { getPointsSystem } from '../data/pointsSystems/pointsSystems';
import { setupOptionsById } from '../data/setupOptions/setupOptions';
import { autoSetupOptionsForTrack } from '../sim/autoSetup';
import { raceStrategiesById } from '../data/decisions/raceStrategies';
import { driverInstructionsById } from '../data/decisions/driverInstructions';
import { aiRaceDecision } from './ai';
import { carForTeam, currentRace, type GameState } from './careerState';
import type { Track } from '../types/gameTypes';
import type { Entrant, RaceContext, RaceDecision } from '../types/simTypes';
import type { LiveRaceMeta, LiveRaceOptions } from '../sim/liveRaceEngine';

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

  const entrants: Entrant[] = [];
  for (const driver of state.drivers) {
    const car = carForTeam(state, driver.teamId);
    if (car) entrants.push({ driver, car });
  }

  const decisions: Record<string, RaceDecision> = {};
  const playerById = new Map(playerDecisions.map((d) => [d.driverId, d]));
  for (const e of entrants) {
    decisions[e.driver.id] = playerById.get(e.driver.id) ?? aiRaceDecision(e.driver.id, track);
  }

  const pointsSystem = getPointsSystem(state.pointsSystemId);

  const context: RaceContext = {
    track,
    entrants,
    qualifyingResults: qualifying,
    decisions,
    setupOptions: { ...setupOptionsById, ...autoSetupOptionsForTrack(track) },
    strategies: raceStrategiesById,
    instructions: driverInstructionsById,
    pointsByPosition: pointsSystem.pointsByPosition,
    seed: `${state.randomSeed}-r${race.round}`,
  };

  return { context, track, raceId: race.id, totalLaps: race.laps };
}

export function buildLiveRaceOptions(
  state: GameState,
  context: RaceContext,
  raceId: string,
  totalLaps: number,
): LiveRaceOptions {
  const driverNames: Record<string, string> = {};
  context.entrants.forEach((e) => (driverNames[e.driver.id] = e.driver.name));
  const teamReputation: Record<string, number> = {};
  state.teams.forEach((t) => (teamReputation[t.id] = t.reputation));
  return {
    raceId,
    playerTeamId: state.selectedTeamId,
    totalLaps,
    driverNames,
    teamReputation,
  };
}

export function buildLiveRaceMeta(state: GameState, track: Track): LiveRaceMeta {
  const driverNames: Record<string, string> = {};
  state.drivers.forEach((d) => (driverNames[d.id] = d.name));
  const teamNames: Record<string, string> = {};
  state.teams.forEach((t) => (teamNames[t.id] = t.name));
  return { track, driverNames, teamNames, playerTeamId: state.selectedTeamId };
}
