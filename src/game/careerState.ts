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
import type { DriverRelationship, TeamOrderDecision } from '../types/relationshipTypes';
import type { RegulationProposal, RegulationVoteResult } from '../types/politicsTypes';
import type { HistoricalEventHook, FiredEvent } from '../types/eventHookTypes';
import type { ScoutingState } from '../types/scoutingTypes';
import type { DriverDevelopmentCurve } from '../types/developmentCurveTypes';
import type { UniverseHistory } from '../types/universeTypes';
import type { AITeamState } from '../types/aiTeamTypes';
import type { RaceWeekendPackageSelection, FinancialDistressMap } from '../types/raceWeekendPackageTypes';
import type { CareerPhaseState } from '../types/careerPhaseTypes';

export type GameState = {
  id: string;
  createdAt: string;
  updatedAt: string;

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

  // Per-race history + lap-time archive (Phase D). Optional for save compat.
  raceArchive?: RaceArchiveEntry[];

  driverStandings: StandingsEntry[];
  constructorStandings: StandingsEntry[];

  activeDevelopmentProjects: DevelopmentProject[];
  completedDevelopmentProjects: DevelopmentProject[];

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

  // AI Team Management (Phase C): the management brain for every non-player
  // team — archetype, budget, financial health, goal — keyed by teamId. Absent
  // on pre-Phase-C saves; rebuilt lazily by the AI engine when needed.
  aiTeamStates?: Record<string, AITeamState>;

  // AI youth academies (Phase D): prospects each non-player team has signed to
  // its own academy, keyed by teamId. They progress and reach first-option age
  // exactly like the player's academy. Absent on pre-Phase-D saves.
  aiAcademies?: Record<string, AcademyMember[]>;

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
};

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

// Only two cars per team race. The active race drivers are the first two entries
// of the team's roster (`team.driverIds`), resolved to the driver objects that
// actually belong to that team. Any further roster members are reserves.
export const MAX_RACE_DRIVERS = 2;

export function activeDriversForTeam(state: GameState, teamId: string): Driver[] {
  const team = teamById(state, teamId);
  const active: Driver[] = [];
  const seen = new Set<string>();
  // Only full race-seat contracts (contractType undefined or 'seat') may fill a
  // race seat. Third / reserve / test drivers are excluded until promoted.
  for (const id of team?.driverIds ?? []) {
    if (active.length >= MAX_RACE_DRIVERS) break;
    if (seen.has(id)) continue;
    const driver = state.drivers.find((d) => d.id === id && d.teamId === teamId);
    if (driver && !isReserveContract(driver)) {
      active.push(driver);
      seen.add(id);
    }
  }
  // Fallback for rosters that don't fully specify driverIds: fill from the pool
  // with race-seat drivers only.
  if (active.length < MAX_RACE_DRIVERS) {
    for (const d of state.drivers) {
      if (active.length >= MAX_RACE_DRIVERS) break;
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
