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
import type { AcademyMember, SeatSigning } from '../types/marketTypes';
import type { FinanceTransaction } from '../types/financeTypes';
import type { StaffMember } from '../types/staffTypes';
import type { RaceArchiveEntry } from '../types/historyTypes';

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

  randomSeed: string;
  seasonComplete: boolean;
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
export function currentRace(state: GameState): Race | undefined {
  return state.calendar[state.currentRaceIndex];
}
