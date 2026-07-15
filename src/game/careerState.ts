// The serializable game state. This is what gets saved to localStorage and is
// the single source of truth at runtime. Historical seed data is copied into
// here on new game so alternate history can diverge from the real 1995 season.

import type {
  Car,
  DevelopmentProject,
  Driver,
  GameMode,
  NewsItem,
  OffseasonSummary,
  QualifyingResult,
  Race,
  RaceResult,
  RegulationChangeEvent,
  Series,
  StandingsEntry,
  Team,
} from '../types/gameTypes';
import type { RaceEvent } from '../types/simTypes';
import type { CarSetup } from '../types/setupTypes';
import type { AcademyDecision, AcademyMember, SeatSigning } from '../types/marketTypes';
import type { FinanceTransaction } from '../types/financeTypes';
import type { StaffMember } from '../types/staffTypes';
import type { RaceArchiveEntry } from '../types/historyTypes';
import type { WeekendPractice } from '../types/practiceTypes';
import type { CommercialState } from '../types/sponsorTypes';
import type { EngineState } from '../types/engineTypes';
import type { TeamReputation, TeamExpectation, ExpectationReview } from '../types/expectationTypes';
import type { TeamPrincipalProfile, JobOffer, TeamPrincipal } from '../types/principalTypes';
import type { TeamOrganizationRatings } from '../types/teamRatingsTypes';
import type { FacilitiesState } from '../types/facilityTypes';
import type { DriverRelationship, DriverPromise, TeamOrderDecision } from '../types/relationshipTypes';
import type { RegulationProposal, RegulationVoteResult } from '../types/politicsTypes';
import type { HistoricalEventHook, FiredEvent } from '../types/eventHookTypes';
import type { ScoutingState } from '../types/scoutingTypes';
import type { DriverDevelopmentCurve } from '../types/developmentCurveTypes';
import type { MotorsportUniverseState, UniverseHistory } from '../types/universeTypes';
import type { AITeamState, TeamMemoryEntry } from '../types/aiTeamTypes';
import type { RaceWeekendPackageSelection, FinancialDistressMap } from '../types/raceWeekendPackageTypes';
import type { CareerPhaseState } from '../types/careerPhaseTypes';
import type { TeamResearchMap } from '../types/rdTypes';
import type { TeamPartsMap } from '../types/partsTypes';
import type { Phase18FoundationState } from '../types/phase18Types';
import type { CharacterInteractionState } from '../types/characterInteractionTypes';
import type { PersonnelCareerTenure } from '../types/personnelCareerTypes';

export type GameState = {
  id: string;
  createdAt: string;
  updatedAt: string;
  // Persisted format revision. Optional only so pre-versioned saves can be
  // recognized and migrated on load.
  saveSchemaVersion?: number;

  gameMode: GameMode;
  series: Series;
  seasonYear: number;
  selectedTeamId: string;
  currentRaceIndex: number;

  // Mutable copies of the season's entities (diverge from history over time).
  calendar: Race[];
  teams: Team[];
  drivers: Driver[];
  cars: Car[];

  pointsSystemId: string;
  regulationSetId: string;

  completedRaceResults: Record<string, RaceResult[]>;
  qualifyingResults: Record<string, QualifyingResult[]>;
  raceEvents: Record<string, RaceEvent[]>;

  // Player-tuned engineering setup per driver (Car Setup Workshop). Optional so
  // older saves load cleanly; reducers/UI fall back to a balanced default.
  carSetups?: Record<string, CarSetup>;

  // Driver market & academy (Phase C). All optional for save compatibility:
  //  - academy: youth prospects signed to the team, progressing each offseason.
  //  - pendingSignings: queued seat changes applied at the next season rollover.
  //  - signedMarketIds: market drivers already taken, hidden from the market.
  academy?: AcademyMember[];
  pendingSignings?: SeatSigning[];
  signedMarketIds?: string[];
  // First-option decisions queued for promotion-eligible academy drivers (those
  // who have turned 18). Applied and cleared at the next season rollover.
  academyDecisions?: AcademyDecision[];

  // Finance ledger for the player's team (Phase D). Optional for save compat;
  // the running balance remains on Team.budget.
  finance?: FinanceTransaction[];

  // Specialists hired by the player's team (Phase D). Optional for save compat.
  staff?: StaffMember[];
  // Named specialists who have moved to AI teams. AI departments remain
  // abstract, but these people retain a real, queryable destination.
  aiStaff?: Record<string, StaffMember[]>;
  aiStaffInitialized?: boolean;

  // Per-race history + lap-time archive (Phase D). Optional for save compat.
  raceArchive?: RaceArchiveEntry[];

  driverStandings: StandingsEntry[];
  constructorStandings: StandingsEntry[];

  activeDevelopmentProjects: DevelopmentProject[];
  completedDevelopmentProjects: DevelopmentProject[];

  // Team-owned research state for every entrant. Kept separate from the legacy
  // development projects so the full R&D tree can be introduced incrementally.
  // Optional for save compatibility; the save migration backfills every team.
  teamResearch?: TeamResearchMap;

  // Driver-specific fitted components, spare inventory, repairs, and factory
  // manufacturing queues. Optional so saves from before the parts phase can be
  // migrated by seeding a standard component set for every entrant.
  teamParts?: TeamPartsMap;

  news: NewsItem[];
  regulationHistory: RegulationChangeEvent[];
  offseasonHistory: OffseasonSummary[];

  // ---------------------------------------------------------------------------
  // Living Universe systems (Phase 1: persisted state shape only — populated by
  // later phases). All optional so existing saves continue to load cleanly; the
  // save version below is bumped so a migration layer can backfill defaults.
  // ---------------------------------------------------------------------------

  // 1. Practice sessions & setup feedback for the active weekend.
  weekendPractice?: WeekendPractice;
  // 2. Sponsor & commercial system (player team).
  commercial?: CommercialState;
  // 3. Engine supplier / manufacturer deal (player team).
  engine?: EngineState;
  // 4. Team reputation & per-season owner expectations.
  teamReputations?: Record<string, TeamReputation>;
  teamExpectations?: Record<string, TeamExpectation>;
  expectationReviews?: ExpectationReview[];
  // 5. Team Principal profile + outstanding job offers/rumors.
  principal?: TeamPrincipalProfile;
  jobOffers?: JobOffer[];
  // The player-created Team Principal identity ("Paddock Credentials"). Optional
  // so existing saves load cleanly; new games created via the creator set it.
  teamPrincipal?: TeamPrincipal;
  // Organization ratings (0-100) for every team, keyed by teamId.
  teamOrgRatings?: Record<string, TeamOrganizationRatings>;
  // A job offer the player has accepted; the move takes effect at the rollover.
  acceptedJobOfferId?: string;
  // 6. Facilities (player team).
  facilities?: FacilitiesState;
  // 7. Tire/fuel/weather strategy is per-race (built at runtime); no persisted
  //    top-level field is required yet — forecasts live with the live race.
  // 8. Driver relationships + team-order decisions taken this season.
  driverRelationships?: Record<string, DriverRelationship>;
  driverPromises?: DriverPromise[];
  promiseCounter?: number;
  teamOrderHistory?: TeamOrderDecision[];
  // 9. Regulation voting / political system (career mode offseason): proposals
  //    up for the next season's vote, plus the historical record of outcomes.
  regulationProposals?: RegulationProposal[];
  regulationVoteHistory?: RegulationVoteResult[];
  // 10. Historical event hooks: available pool + ones that have fired.
  eventHooks?: HistoricalEventHook[];
  firedEvents?: FiredEvent[];
  // 11. Scouting / fog of war (player team).
  scouting?: ScoutingState;
  // 12. Driver aging & development curves, keyed by driverId.
  developmentCurves?: Record<string, DriverDevelopmentCurve>;
  // 13. Universe records / history database.
  universeHistory?: UniverseHistory;
  // Persistent rosters and contracts for every championship active in this
  // career year. Unlike universeHistory, this is the live off-screen world.
  motorsportUniverse?: MotorsportUniverseState;

  // AI Team Management (Phase C): the management brain for every non-player
  // team — archetype, budget, financial health, goal — keyed by teamId. Absent
  // on pre-Phase-C saves; rebuilt lazily by the AI engine when needed.
  aiTeamStates?: Record<string, AITeamState>;

  // AI team memory: multi-season performance history (constructor positions,
  // wins, podiums, trends) that influences archetype evolution. Updated at each
  // offseason rollover. Absent on pre-fix saves; built lazily.
  aiTeamMemory?: Record<string, TeamMemoryEntry>;

  // AI youth academies (Phase D): prospects each non-player team has signed to
  // its own academy, keyed by teamId. They progress and reach first-option age
  // exactly like the player's academy. Absent on pre-Phase-D saves.
  aiAcademies?: Record<string, AcademyMember[]>;

  // Phase 18+ living-paddock data foundation. Gameplay engines progressively
  // consume these persisted models in the reviewable PRs after 18A.
  phase18?: Phase18FoundationState;

  // Phase 19 people-management actions, their outcomes, per-character weekly
  // cooldowns, and recruitment interest. Optional for older-save migration.
  characterInteractions?: CharacterInteractionState;

  // Persistent employment timeline for principals and named staff. This keeps
  // character identity and career history intact as people change teams.
  personnelCareerHistory?: PersonnelCareerTenure[];

  randomSeed: string;
  seasonComplete: boolean;

  // Race Weekend Package selection for the current weekend (player team).
  // Optional for save compatibility; defaults to Standard when absent.
  raceWeekendPackage?: RaceWeekendPackageSelection;
  // History of package selections across the season.
  raceWeekendPackageHistory?: RaceWeekendPackageSelection[];
  // AI team package selections for the current weekend, keyed by teamId.
  aiRaceWeekendPackages?: Record<string, RaceWeekendPackageSelection>;

  // Career Phase system: tracks the between-race management flow.
  // Optional for save compatibility; defaults to pre_season_setup for new games.
  careerPhase?: CareerPhaseState;

  // Financial distress tracking for all teams, keyed by teamId.
  // Optional for save compatibility; defaults to Stable for all teams.
  financialDistress?: FinancialDistressMap;

  // News archive — permanent store of major career stories that survive beyond
  // the 50-item rolling news feed. Optional for save compatibility.
  newsArchive?: NewsItem[];

  // Player career mobility setting. Controls whether the player can be fired.
  // Defaults to StandardCareer for existing saves.
  careerMobilityMode?: 'StandardCareer' | 'TeamLock' | 'Sandbox';

  // AI Team Principal states, keyed by teamId. Tracks pressure, contract, and
  // firing status for AI principals. Optional for save compatibility.
  aiPrincipals?: Record<string, {
    principalId: string;
    name: string;
    pressure: number;
    contractYearsRemaining: number;
    seasonsAtTeam: number;
    fired: boolean;
    attributes?: import('../types/principalTypes').PrincipalAttributes;
  }>;

  // Closure/replacement hooks stored for future expansion when a team reaches
  // ClosureRisk. Each entry records the team and season for potential future
  // team sale, merger, or replacement processing.
  closureHooks?: { teamId: string; seasonYear: number; level: string }[];
};

export function minRaceDriversForSeries(series: Series): number {
  return series === 'NASCAR' ? 1 : 2;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function maxRaceDriversForSeries(_series: Series): number {
  return 2;
}

export function teamById(state: GameState, id: string): Team | undefined {
  return state.teams.find((t) => t.id === id);
}
export function driverById(state: GameState, id: string): Driver | undefined {
  return state.drivers.find((d) => d.id === id);
}
export function carById(state: GameState, id: string): Car | undefined {
  return state.cars.find((c) => c.id === id);
}
export function carForTeam(state: GameState, teamId: string): Car | undefined {
  return state.cars.find((c) => c.teamId === teamId);
}
export function driversForTeam(state: GameState, teamId: string): Driver[] {
  return state.drivers.filter((d) => d.teamId === teamId);
}

// Race-seat count is series-aware. NASCAR teams may run a single car; all
// other series currently require two race drivers. The cap of two seats still
// applies everywhere, and rosters with 3+ drivers are reduced to two.
export const MAX_RACE_DRIVERS = 2;

export function activeDriversForTeam(state: GameState, teamId: string): Driver[] {
  const team = teamById(state, teamId);
  const maxRaceDrivers = maxRaceDriversForSeries(state.series);
  const active: Driver[] = [];
  const seen = new Set<string>();
  // Only full race-seat contracts (contractType undefined or 'seat') may fill a
  // race seat. Third / reserve / test drivers are excluded until promoted.
  for (const id of team?.driverIds ?? []) {
    if (active.length >= maxRaceDrivers) break;
    if (seen.has(id)) continue;
    const driver = state.drivers.find((d) => d.id === id && d.teamId === teamId);
    if (driver && !isReserveContract(driver)) {
      active.push(driver);
      seen.add(id);
    }
  }
  // Fallback for rosters that don't fully specify driverIds: fill from the pool
  // with race-seat drivers only, but never beyond the series cap.
  if (active.length < maxRaceDrivers) {
    for (const d of state.drivers) {
      if (active.length >= maxRaceDrivers) break;
      if (d.teamId === teamId && !seen.has(d.id) && !isReserveContract(d)) {
        active.push(d);
        seen.add(d.id);
      }
    }
  }
  return active;
}

// A non-racing contract tier: 3rd, reserve or test driver. Undefined/'seat' are
// full race-seat contracts.
export function isReserveContract(d: Driver): boolean {
  return d.contractType === 'third' || d.contractType === 'reserve' || d.contractType === 'test';
}

export function reserveDriversForTeam(state: GameState, teamId: string): Driver[] {
  const active = new Set(activeDriversForTeam(state, teamId).map((d) => d.id));
  return state.drivers.filter((d) => d.teamId === teamId && !active.has(d.id));
}
export function currentRace(state: GameState): Race | undefined {
  return state.calendar[state.currentRaceIndex];
}
