// Build a fresh GameState from a season bundle and the player's chosen team.

import { getCachedBundle } from '../data/seasonLoader';
import type { SeasonBundle } from '../data/seasonCatalog';
import { BALANCED_SETUP } from '../data/setup/setupComponents';
import type { GameMode, Series, TeamPrincipal as HistoricalTeamPrincipal } from '../types/gameTypes';
import type { CarSetup } from '../types/setupTypes';
import type { GameState } from './careerState';
import { buildInitialCommercial } from '../sim/commercialEngine';
import { buildTeamReputations, buildTeamExpectations } from '../sim/expectationEngine';
import { createInitialFacilities } from '../sim/facilityEngine';
import {
  applyEngineBonuses,
  applyInitialEngineSelection,
  createInitialEngineState,
  seedManufacturerRelationship,
} from '../sim/engineSupplierEngine';
import type { EngineDealType } from '../types/engineTypes';
import { createPrincipalProfile, generateJobOffers } from '../sim/principalEngine';
import { createDriverRelationships } from '../sim/relationshipEngine';
import { generateRegulationProposals } from '../sim/politicsEngine';
import { createInitialScoutingState } from '../sim/scoutingEngine';
import { seedDevelopmentCurves } from '../sim/developmentCurveEngine';
import { createInitialUniverseHistory } from '../sim/universeHistoryEngine';
import { buildAllTeamOrganizationRatings } from '../sim/teamRatingsEngine';
import { buildAllAITeamStates } from '../sim/aiTeamEngine';
import { createInitialTeamResearchMap } from '../sim/rdEngine';
import { createInitialTeamPartsMap } from '../sim/partsEngine';
import { enforceRosters } from './rosterEnforcement';
import type { TeamPrincipal } from '../types/principalTypes';
import { createMotorsportUniverse } from '../sim/motorsportUniverseEngine';
import { planAITechnicalPrograms } from '../sim/aiTechnicalDirectorEngine';
import { createInitialPhase18FoundationState } from '../sim/phase18FoundationEngine';
import { ensureContractClauses } from '../sim/phase18ContractClauseEngine';
import { ensurePreseasonHubState } from '../sim/phase18PreseasonEngine';
import { ensureFailureInvestigationState } from '../sim/phase18FailureInvestigationEngine';
import { ensureRivalRelationships } from '../sim/phase18RivalRelationshipEngine';
import { syncNarratives } from '../sim/phase18NarrativeEngine';
import { CURRENT_SAVE_SCHEMA_VERSION } from './saveSchema';
import { createAIPrincipalAttributes } from '../sim/principalPressureEngine';
import { ensureCharacterInteractionState } from '../sim/characterInteractionEngine';
import { ensureCharacterOpinions } from '../sim/characterOpinionEngine';
import { ensureCharacterAmbitions } from '../sim/characterAmbitionEngine';
import { ensureCharacterConnections } from '../sim/characterConnectionEngine';
import { ensureCharacterInfluence } from '../sim/characterInfluenceEngine';

// Deep clone via structuredClone (available in modern browsers / Node 18+).
function clone<T>(value: T): T {
  return structuredClone(value);
}

function principalRoleScore(principal: HistoricalTeamPrincipal, teamId: string, year: number, series: Series): number {
  const role = principal.careerTimeline.find((entry) =>
    entry.teamId === teamId && entry.year === year && entry.series === series,
  )?.role ?? '';
  if (/team principal|team boss|crew chief/i.test(role)) return 3;
  if (/owner/i.test(role)) return 2;
  return 1;
}

function createInitialAIPrincipals(
  bundle: SeasonBundle,
  selectedTeamId: string,
  year: number,
  series: Series,
  seed: string,
): NonNullable<GameState['aiPrincipals']> {
  const principals = bundle.principals ?? [];
  const result: NonNullable<GameState['aiPrincipals']> = {};
  for (const team of bundle.teams) {
    if (team.id === selectedTeamId) continue;
    const historical = principals
      .filter((candidate) => candidate.careerTimeline.some((entry) =>
        entry.teamId === team.id && entry.year === year && entry.series === series,
      ))
      .sort((a, b) => principalRoleScore(b, team.id, year, series) - principalRoleScore(a, team.id, year, series))[0];
    const priorSeasons = historical?.careerTimeline.filter((entry) =>
      entry.teamId === team.id && entry.series === series && entry.year <= year,
    ).length ?? 1;
    result[team.id] = {
      principalId: historical?.principalId ?? `principal-${team.id}`,
      name: historical?.name ?? `${team.shortName} Team Principal`,
      pressure: 0,
      contractYearsRemaining: historical?.contract?.teamId === team.id
        ? Math.max(1, historical.contract.yearsLeft)
        : 2,
      seasonsAtTeam: Math.max(0, priorSeasons - 1),
      fired: false,
      attributes: historical ? {
        mediaImage: Math.round((historical.commercial + historical.political + historical.reputation) / 3),
        boardConfidence: historical.leadership,
        financialDiscipline: historical.commercial,
        driverManagement: historical.driverManagement,
        development: Math.round((historical.technicalVision + historical.developmentVision) / 2),
        strategy: Math.round((historical.operations + historical.crisisManagement) / 2),
      } : createAIPrincipalAttributes(`${seed}-${team.id}`, team.reputation),
    };
  }
  return result;
}

export type NewGameOptions = {
  gameMode: GameMode;
  seasonYear: number;
  series: Series;
  teamId: string;
  seed?: string;
  // The player-created Team Principal ("Paddock Credentials"). Optional so tests
  // and legacy callers still work; when absent a default profile is used.
  teamPrincipal?: TeamPrincipal;
  // The player's chosen season-1 engine deal. Optional; when absent the deal is
  // the auto-assigned one from createInitialEngineState.
  initialEngineSupplierId?: string;
  initialEngineDealType?: EngineDealType;
  // Pre-loaded season bundle (from async loader). If absent, falls back to cache.
  bundle?: SeasonBundle;
};

export function createNewGame(options: NewGameOptions): GameState {
  const bundle = options.bundle ?? getCachedBundle(options.seasonYear, options.series);
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
  let engine = createInitialEngineState(
    bundle.teams,
    options.teamId,
    options.seasonYear,
    options.series,
    seed,
  );
  // Apply the player's starting-engine choice (if any), then seed the works/
  // factory manufacturer relationship from whatever deal they begin with.
  if (playerTeam && options.initialEngineSupplierId && options.initialEngineDealType) {
    engine = applyInitialEngineSelection(
      engine,
      playerTeam,
      options.initialEngineSupplierId,
      options.initialEngineDealType,
    );
  }
  engine = seedManufacturerRelationship(engine);
  const cars = applyEngineBonuses(clone(bundle.cars), engine);

  // Team Principal job market (Living Universe Phase 6): the player's own
  // manager profile plus the rival approaches their reputation attracts.
  const teamPrincipal = options.teamPrincipal;
  const principal = playerTeam
    ? createPrincipalProfile(
        playerTeam,
        teamReputations,
        options.seasonYear,
        seed,
        teamPrincipal?.name ?? 'You',
      )
    : undefined;
  // Seed the job-market profile's starting reputation from the created identity.
  if (principal && teamPrincipal) {
    principal.reputation = Math.round((principal.reputation + teamPrincipal.reputation) / 2);
    if (teamPrincipal.startingLevel === 'veteran') {
      principal.level = Math.max(principal.level, 4);
      principal.skillPoints = Math.max(principal.skillPoints, 4);
      principal.jobSecurity = Math.max(principal.jobSecurity, 58);
    } else if (teamPrincipal.startingLevel === 'superstar') {
      principal.level = Math.max(principal.level, 7);
      principal.skillPoints = Math.max(principal.skillPoints, 8);
      principal.jobSecurity = Math.max(principal.jobSecurity, 70);
    }
  }
  const jobOffers = principal
    ? generateJobOffers(principal, bundle.teams, teamReputations, options.seasonYear, seed)
    : undefined;
  const aiPrincipals = createInitialAIPrincipals(
    bundle,
    options.teamId,
    options.seasonYear,
    options.series,
    seed,
  );

  // Driver relationships + team orders (Living Universe Phase 7): the human side
  // of every garage — loyalty, chemistry, teammate rivalry, morale, frustration.
  const driverRelationships = createDriverRelationships(
    bundle.teams,
    bundle.drivers,
    teamReputations,
    seed,
    bundle.cars,
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

  // Driver aging & development curves (Living Universe Phase 10): a static curve
  // per driver plus a synthesized age where the season data omits one.
  const { curves: developmentCurves, drivers: agedDrivers } = seedDevelopmentCurves(
    clone(bundle.drivers),
    seed,
  );

  // Team organization ratings (Career Mode Phase 1): a detailed 0-100 profile
  // per team, derived from car/reputation/budget. Powers academy capacity now
  // and driver/sponsor/staff interest later.
  const teamOrgRatings = buildAllTeamOrganizationRatings(
    bundle.teams,
    cars,
    options.seasonYear,
    seed,
    options.series,
  );

  const baseState: GameState = {
    id: `save-${Date.now()}`,
    createdAt: now,
    updatedAt: now,
    saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    gameMode: options.gameMode,
    series: options.series,
    seasonYear: options.seasonYear,
    selectedTeamId: options.teamId,
    currentRaceIndex: 0,
    calendar: clone(bundle.season.calendar),
    teams: clone(bundle.teams),
    drivers: agedDrivers,
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
    teamResearch: createInitialTeamResearchMap(bundle.teams, options.seasonYear),
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
    teamPrincipal,
    aiPrincipals,
    teamOrgRatings,
    driverRelationships,
    teamOrderHistory: [],
    regulationProposals,
    regulationVoteHistory: [],
    scouting: createInitialScoutingState(options.teamId, facilities),
    developmentCurves,
    universeHistory: createInitialUniverseHistory(),
    randomSeed: seed,
    seasonComplete: false,
    careerMobilityMode: 'StandardCareer',
    characterInteractions: ensureCharacterInteractionState(),
  };

  const normalizedState = enforceRosters(baseState).state;
  const stateWithUniverse: GameState = {
    ...normalizedState,
    teamParts: createInitialTeamPartsMap(
      normalizedState.teams,
      normalizedState.drivers,
      options.seasonYear,
    ),
    motorsportUniverse: createMotorsportUniverse(
      options.seasonYear,
      options.series,
      bundle,
      seed,
      normalizedState.teams,
      normalizedState.drivers,
    ),
  };

  // AI Team Management (Phase C): give every non-player team its management
  // brain (archetype, budget, financial health, goal).
  const stateWithAI = { ...stateWithUniverse, aiTeamStates: buildAllAITeamStates(stateWithUniverse) };
  const stateWithTechnicalPrograms = planAITechnicalPrograms(stateWithAI);
  return ensureCharacterInfluence(ensureCharacterConnections(ensureCharacterAmbitions(ensureCharacterOpinions(syncNarratives(ensureRivalRelationships(ensureFailureInvestigationState(ensurePreseasonHubState(ensureContractClauses({
    ...stateWithTechnicalPrograms,
    phase18: createInitialPhase18FoundationState(stateWithTechnicalPrograms),
  })))))))));
}
