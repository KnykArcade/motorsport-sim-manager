// Build a fresh GameState from a season bundle and the player's chosen team.

import { getSeasonBundle } from '../data';
import { BALANCED_SETUP } from '../data/setup/setupComponents';
import type { GameMode, Series } from '../types/gameTypes';
import type { CarSetup } from '../types/setupTypes';
import type { GameState } from './careerState';
import { buildInitialCommercial } from '../sim/commercialEngine';
import { buildTeamReputations, buildTeamExpectations } from '../sim/expectationEngine';
import { createInitialFacilities } from '../sim/facilityEngine';
import { applyEngineBonuses, createInitialEngineState } from '../sim/engineSupplierEngine';
import { createPrincipalProfile, generateJobOffers } from '../sim/principalEngine';
import { createDriverRelationships } from '../sim/relationshipEngine';
import { generateRegulationProposals } from '../sim/politicsEngine';

// Deep clone via structuredClone (available in modern browsers / Node 18+).
function clone<T>(value: T): T {
  return structuredClone(value);
}

export type NewGameOptions = {
  gameMode: GameMode;
  seasonYear: number;
  series: Series;
  teamId: string;
  seed?: string;
};

export function createNewGame(options: NewGameOptions): GameState {
  const bundle = getSeasonBundle(options.seasonYear, options.series);
  if (!bundle) {
    throw new Error(`No season data for ${options.seasonYear} ${options.series}`);
  }

  const now = new Date().toISOString();
  const seed = options.seed ?? `${options.teamId}-${Date.now()}`;

  // Start each of the player team's drivers with a balanced base setup.
  const carSetups: Record<string, CarSetup> = {};
  for (const driver of bundle.drivers) {
    if (driver.teamId === options.teamId) carSetups[driver.id] = { ...BALANCED_SETUP };
  }

  // Commercial & owner-expectation state (Living Universe Phase 3).
  const playerTeam = bundle.teams.find((t) => t.id === options.teamId);
  const playerDrivers = bundle.drivers.filter((d) => d.teamId === options.teamId);
  const commercial = playerTeam
    ? buildInitialCommercial(playerTeam, playerDrivers, seed, options.series)
    : undefined;
  const teamReputations = buildTeamReputations(bundle.teams);
  const facilities = createInitialFacilities(options.teamId, playerTeam?.reputation ?? 0);
  const teamExpectations = buildTeamExpectations(bundle.teams, options.seasonYear);

  // Engine supplier deals for the whole grid (Living Universe Phase 5); apply
  // each deal's power/reliability modifier to the corresponding car.
  const engine = createInitialEngineState(
    bundle.teams,
    options.teamId,
    options.seasonYear,
    options.series,
    seed,
  );
  const cars = applyEngineBonuses(clone(bundle.cars), engine);

  // Team Principal job market (Living Universe Phase 6): the player's own
  // manager profile plus the rival approaches their reputation attracts.
  const principal = playerTeam
    ? createPrincipalProfile(playerTeam, teamReputations, options.seasonYear, seed)
    : undefined;
  const jobOffers = principal
    ? generateJobOffers(principal, bundle.teams, teamReputations, options.seasonYear, seed)
    : undefined;

  // Driver relationships + team orders (Living Universe Phase 7): the human side
  // of every garage — loyalty, chemistry, teammate rivalry, morale, frustration.
  const driverRelationships = createDriverRelationships(
    bundle.teams,
    bundle.drivers,
    teamReputations,
    seed,
  );

  // Regulation voting / politics (Living Universe Phase 8): proposals up for a
  // vote, effective the season after this one. The player lobbies all year and
  // the outcome is settled at the offseason rollover.
  const regulationProposals = generateRegulationProposals(
    bundle.teams,
    teamReputations,
    engine,
    options.seasonYear + 1,
    seed,
    3,
    options.series,
  );

  return {
    id: `save-${Date.now()}`,
    createdAt: now,
    updatedAt: now,
    gameMode: options.gameMode,
    series: options.series,
    seasonYear: options.seasonYear,
    selectedTeamId: options.teamId,
    currentRaceIndex: 0,
    calendar: clone(bundle.season.calendar),
    teams: clone(bundle.teams),
    drivers: clone(bundle.drivers),
    cars,
    pointsSystemId: bundle.season.pointsSystemId,
    regulationSetId: bundle.season.regulationSetId,
    completedRaceResults: {},
    qualifyingResults: {},
    raceEvents: {},
    carSetups,
    driverStandings: [],
    constructorStandings: [],
    activeDevelopmentProjects: [],
    completedDevelopmentProjects: [],
    news: [
      {
        id: 'news-welcome',
        headline: `Welcome to the ${options.seasonYear} season`,
        body: 'A new era begins. Guide your team through the championship.',
        timestamp: now,
      },
    ],
    regulationHistory: [],
    offseasonHistory: [],
    commercial,
    teamReputations,
    teamExpectations,
    facilities,
    engine,
    principal,
    jobOffers,
    driverRelationships,
    teamOrderHistory: [],
    regulationProposals,
    regulationVoteHistory: [],
    randomSeed: seed,
    seasonComplete: false,
  };
}
