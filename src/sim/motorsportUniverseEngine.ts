import { availableSeasons } from '../data/seasonCatalog';
import { getCachedBundle } from '../data/seasonLoader';
import { getPointsSystem } from '../data/pointsSystems/pointsSystems';
import { canonicalNameOf, getMasterRegistry, registryList } from '../data/registry/masterRegistry';
import type { SeasonBundle } from '../data/seasonCatalog';
import type { Driver, Series, StandingsEntry, Team } from '../types/gameTypes';
import type { MasterDriverEntry } from '../types/registryTypes';
import type {
  MotorsportUniverseState,
  UniverseChampionshipSeason,
  UniverseChampionshipState,
  UniverseDriverContract,
  UniverseDriverAbsence,
  UniverseDriverMovement,
  UniverseLiveSeason,
  UniverseRaceSummary,
  UniverseTeamRoster,
} from '../types/universeTypes';
import type { NewsItem } from '../types/gameTypes';
import type { GameState } from '../game/careerState';

const SERIES_ORDER: readonly Series[] = ['F1', 'CART', 'Champ Car', 'IndyCar', 'NASCAR'];

function hash01(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

function activeSeat(driver: Driver): boolean {
  return driver.contractType == null || driver.contractType === 'seat';
}

function registryIdForName(name: string): string | undefined {
  const canonical = canonicalNameOf(name);
  return registryList().find((entry) => entry.canonicalName === canonical)?.driverId;
}

function championshipFromRoster(
  year: number,
  series: Series,
  teams: readonly Team[],
  drivers: readonly Driver[],
  occupiedNames: Set<string>,
  seed: string,
): UniverseChampionshipState {
  const contracts: UniverseDriverContract[] = [];
  const driverIdsByTeam = new Map<string, string[]>();
  const championshipNames = new Set<string>();

  for (const driver of drivers.filter(activeSeat)) {
    const nameKey = canonicalNameOf(driver.name);
    // A documented driver may legitimately race in multiple championships in
    // the same year. De-duplicate only within this championship; the global set
    // is for market availability and future free-agent signings.
    if (championshipNames.has(nameKey)) continue;
    championshipNames.add(nameKey);
    occupiedNames.add(nameKey);
    const contractYearsRemaining = driver.contractYearsRemaining
      ?? 1 + Math.floor(hash01(`${seed}-${year}-${series}-${nameKey}`) * 3);
    contracts.push({
      driverId: driver.id,
      registryDriverId: registryIdForName(driver.name),
      name: driver.name,
      teamId: driver.teamId,
      series,
      contractYearsRemaining: Math.max(1, contractYearsRemaining),
    });
    const ids = driverIdsByTeam.get(driver.teamId) ?? [];
    ids.push(driver.id);
    driverIdsByTeam.set(driver.teamId, ids);
  }

  const teamRosters: UniverseTeamRoster[] = teams.map((team) => {
    const historicalSeats = drivers.filter((driver) => driver.teamId === team.id && activeSeat(driver)).length;
    return {
      teamId: team.id,
      name: team.name,
      reputation: team.reputation,
      seatCount: Math.max(1, historicalSeats),
      driverIds: driverIdsByTeam.get(team.id) ?? [],
    };
  });

  return {
    series,
    seasonYear: year,
    teams: teamRosters,
    drivers: contracts,
    seasonHistory: [],
    movementHistory: [],
  };
}

function movementId(
  year: number,
  series: Series,
  kind: UniverseDriverMovement['kind'],
  driverId: string,
  teamId?: string,
): string {
  return `${year}-${series}-${kind}-${driverId}-${teamId ?? 'market'}`;
}

function compareRosters(
  previous: UniverseChampionshipState | undefined,
  next: UniverseChampionshipState,
  effectiveYear: number,
): UniverseDriverMovement[] {
  if (!previous) return [];
  const priorByName = new Map(previous.drivers.map((driver) => [canonicalNameOf(driver.name), driver]));
  const nextByName = new Map(next.drivers.map((driver) => [canonicalNameOf(driver.name), driver]));
  const priorTeams = new Map(previous.teams.map((team) => [team.teamId, team.name]));
  const nextTeams = new Map(next.teams.map((team) => [team.teamId, team.name]));
  const movements: UniverseDriverMovement[] = [];

  for (const driver of next.drivers) {
    const prior = priorByName.get(canonicalNameOf(driver.name));
    if (prior?.teamId === driver.teamId) continue;
    const kind = prior ? 'transfer' : 'signing';
    movements.push({
      id: movementId(effectiveYear, next.series, kind, driver.driverId, driver.teamId),
      effectiveYear,
      series: next.series,
      kind,
      driverId: driver.driverId,
      driverName: driver.name,
      fromTeamId: prior?.teamId,
      fromTeamName: prior ? priorTeams.get(prior.teamId) : undefined,
      toTeamId: driver.teamId,
      toTeamName: nextTeams.get(driver.teamId),
      contractYears: driver.contractYearsRemaining,
    });
  }

  for (const driver of previous.drivers) {
    if (nextByName.has(canonicalNameOf(driver.name))) continue;
    movements.push({
      id: movementId(effectiveYear, next.series, 'release', driver.driverId, driver.teamId),
      effectiveYear,
      series: next.series,
      kind: 'release',
      driverId: driver.driverId,
      driverName: driver.name,
      fromTeamId: driver.teamId,
      fromTeamName: priorTeams.get(driver.teamId),
    });
  }

  return movements;
}

function activeSeriesForYear(year: number): Series[] {
  const found = new Set(availableSeasons.filter((season) => season.year === year).map((season) => season.series));
  return SERIES_ORDER.filter((series) => found.has(series));
}

export function createMotorsportUniverse(
  year: number,
  selectedSeries: Series,
  selectedBundle: SeasonBundle,
  seed: string,
  selectedTeams: readonly Team[] = selectedBundle.teams,
  selectedDrivers: readonly Driver[] = selectedBundle.drivers,
): MotorsportUniverseState {
  const occupiedNames = new Set<string>();
  const championships: Partial<Record<Series, UniverseChampionshipState>> = {};
  const orderedSeries = [selectedSeries, ...activeSeriesForYear(year).filter((series) => series !== selectedSeries)];

  for (const series of orderedSeries) {
    const bundle = series === selectedSeries ? selectedBundle : getCachedBundle(year, series);
    if (!bundle) continue;
    championships[series] = championshipFromRoster(
      year,
      series,
      series === selectedSeries ? selectedTeams : bundle.teams,
      series === selectedSeries ? selectedDrivers : bundle.drivers,
      occupiedNames,
      seed,
    );
  }

  return { version: 1, seasonYear: year, championships };
}

export function ensureMotorsportUniverse(state: GameState): GameState {
  if (state.motorsportUniverse) return state;
  const bundle = getCachedBundle(state.seasonYear, state.series);
  if (!bundle) return state;
  return {
    ...state,
    motorsportUniverse: createMotorsportUniverse(
      state.seasonYear,
      state.series,
      bundle,
      state.randomSeed,
      state.teams,
      state.drivers,
    ),
  };
}

export function universeOccupiedNames(universe: MotorsportUniverseState | undefined): Set<string> {
  const names = new Set<string>();
  if (!universe) return names;
  for (const championship of Object.values(universe.championships)) {
    for (const driver of championship?.drivers ?? []) names.add(canonicalNameOf(driver.name));
  }
  return names;
}

function ageInYear(entry: MasterDriverEntry, year: number): number | undefined {
  if (entry.birthYear != null) return year - entry.birthYear;
  if (entry.startingAge != null) return entry.startingAge + (year - entry.firstSeenYear);
  return undefined;
}

function seriesFit(entry: MasterDriverEntry, series: Series): number {
  if (entry.preferredSeries === series) return 100;
  if (entry.eligibleSeries.includes(series)) return 78;
  if (entry.secondarySeriesInterest.includes(series)) return 58;
  return entry.willingnessToSwitchSeries;
}

function candidateScore(entry: MasterDriverEntry, series: Series, year: number, seed: string): number {
  const snapshot = [...entry.baseRatingsByYear]
    .filter((item) => item.year <= year)
    .sort((a, b) => b.year - a.year)[0];
  const overall = snapshot?.overall ?? entry.baseRatings.overall;
  return overall * 0.6 + seriesFit(entry, series) * 0.4 + hash01(`${seed}-${year}-${series}-${entry.driverId}`) * 4;
}

function eligibleCandidate(entry: MasterDriverEntry, year: number, occupiedNames: Set<string>): boolean {
  if (occupiedNames.has(entry.canonicalName)) return false;
  if (entry.marketEntryYear > year) return false;
  if (entry.retirementYear != null && entry.retirementYear <= year) return false;
  const age = ageInYear(entry, year);
  return age == null || (age >= 18 && age <= 48);
}

function emptyStanding(entityId: string): StandingsEntry {
  return { entityId, points: 0, wins: 0, podiums: 0, dnfs: 0 };
}

function sortedStandings(table: Map<string, StandingsEntry>): StandingsEntry[] {
  return [...table.values()].sort(
    (a, b) => b.points - a.points || b.wins - a.wins || b.podiums - a.podiums || a.entityId.localeCompare(b.entityId),
  );
}

function normalizedOverall(contract: UniverseDriverContract, series: Series, year: number): number {
  const registry = getMasterRegistry();
  const entry = contract.registryDriverId
    ? registry.byId[contract.registryDriverId]
    : registryList(registry).find((candidate) => candidate.canonicalName === canonicalNameOf(contract.name));
  if (!entry) return 50;
  const snapshot = [...entry.baseRatingsByYear]
    .filter((item) => item.series === series && item.year <= year)
    .sort((a, b) => b.year - a.year)[0]
    ?? [...entry.baseRatingsByYear].filter((item) => item.year <= year).sort((a, b) => b.year - a.year)[0];
  const overall = snapshot?.overall ?? entry.baseRatings.overall;
  return overall <= 10 ? overall * 10 : overall;
}

function retirementRate(series: Series, year: number): number {
  if (series === 'NASCAR') return 0.1;
  if (series === 'F1') return year < 2000 ? 0.18 : year < 2010 ? 0.12 : 0.08;
  return year < 2000 ? 0.16 : 0.11;
}

/** Conditional probability that a crash DNF is severe enough to cost races.
 * This is intentionally tiny: injuries are exceptional crash consequences,
 * never unrelated random events. */
export function offscreenSevereCrashInjuryRate(series: Series, year: number): number {
  if (series === 'NASCAR') return year < 2000 ? 0.006 : 0.003;
  if (series === 'F1') return year < 2000 ? 0.008 : 0.003;
  return year < 2000 ? 0.007 : 0.003;
}

const INJURY_TYPES: UniverseDriverAbsence['injuryType'][] = [
  'Concussion', 'Hand injury', 'Back injury',
];

function replacementForAbsence(
  championship: UniverseChampionshipState,
  driver: UniverseDriverContract,
  round: number,
  seed: string,
): UniverseDriverAbsence['replacement'] | undefined {
  const occupied = new Set(championship.drivers.map((entry) => canonicalNameOf(entry.name)));
  const candidate = registryList(getMasterRegistry())
    .filter((entry) => eligibleCandidate(entry, championship.seasonYear, occupied))
    .sort((a, b) =>
      candidateScore(b, championship.series, championship.seasonYear, seed)
      - candidateScore(a, championship.series, championship.seasonYear, seed)
      || a.driverId.localeCompare(b.driverId),
    )[Math.floor(hash01(`${seed}-${championship.series}-${championship.seasonYear}-${round}-${driver.driverId}-replacement`) * 8)];
  if (!candidate) return undefined;
  return {
    driverId: `sub-${championship.series}-${championship.seasonYear}-${driver.driverId}-${round}`,
    registryDriverId: candidate.driverId,
    name: candidate.displayName,
    teamId: driver.teamId,
    series: championship.series,
    replacesDriverId: driver.driverId,
  };
}

function activeAbsencesForRound(
  championship: UniverseChampionshipState,
  round: number,
): UniverseDriverAbsence[] {
  const previous = championship.driverAbsences ?? [];
  return previous.filter((absence) => absence.expectedReturnRound > round);
}

function severeCrashAbsence(
  championship: UniverseChampionshipState,
  driver: UniverseDriverContract,
  round: number,
  seed: string,
): UniverseDriverAbsence | undefined {
  const eventRoll = hash01(`${seed}-${championship.seasonYear}-${championship.series}-${round}-${driver.driverId}-severe-crash`);
  if (eventRoll >= offscreenSevereCrashInjuryRate(championship.series, championship.seasonYear)) return undefined;
  const replacement = replacementForAbsence(championship, driver, round, seed);
  if (!replacement) return undefined;
  const duration = 1 + Math.floor(
    hash01(`${seed}-${championship.series}-${championship.seasonYear}-${round}-${driver.driverId}-injury-duration`) * 2,
  );
  const injuryType = INJURY_TYPES[Math.floor(
    hash01(`${seed}-${championship.series}-${championship.seasonYear}-${round}-${driver.driverId}-injury-type`) * INJURY_TYPES.length,
  )];
  return {
    driverId: driver.driverId,
    driverName: driver.name,
    teamId: driver.teamId,
    injuryType,
    startRound: round + 1,
    expectedReturnRound: round + 1 + duration,
    replacement,
  };
}

function fallbackRaceCount(series: Series): number {
  if (series === 'NASCAR') return 36;
  if (series === 'F1') return 22;
  return 17;
}

function liveSeasonSchedule(championship: UniverseChampionshipState): UniverseLiveSeason['schedule'] {
  const bundle = getCachedBundle(championship.seasonYear, championship.series);
  if (bundle) {
    return bundle.season.calendar.map((race) => ({
      round: race.round,
      raceId: race.id,
      raceName: race.gpName,
      trackName: race.trackName,
      date: race.date,
    }));
  }
  return Array.from({ length: fallbackRaceCount(championship.series) }, (_, index) => ({
    round: index + 1,
    raceId: `${championship.series.toLowerCase()}-${championship.seasonYear}-${index + 1}`,
    raceName: `${championship.series} Round ${index + 1}`,
    trackName: 'Circuit TBA',
  }));
}

function initialLiveSeason(championship: UniverseChampionshipState): UniverseLiveSeason {
  const schedule = liveSeasonSchedule(championship);
  return {
    seasonYear: championship.seasonYear,
    totalRaces: schedule.length,
    completedRaces: 0,
    driverStandings: championship.drivers.map((driver) => emptyStanding(driver.driverId)),
    teamStandings: championship.teams.map((team) => emptyStanding(team.teamId)),
    raceResults: [],
    schedule,
    driverNames: Object.fromEntries(championship.drivers.map((driver) => [driver.driverId, driver.name])),
  };
}

function standingMap(entries: readonly StandingsEntry[], ids: readonly string[]): Map<string, StandingsEntry> {
  const existing = new Map(entries.map((entry) => [entry.entityId, { ...entry }]));
  for (const id of ids) if (!existing.has(id)) existing.set(id, emptyStanding(id));
  return existing;
}

/** Advance exactly one off-screen round. The round result depends only on the
 * persisted championship, round number and save seed, so reloading cannot
 * change an outcome. */
export function simulateOffscreenChampionshipRound(
  championship: UniverseChampionshipState,
  seed: string,
): UniverseChampionshipState {
  const live = championship.liveSeason?.seasonYear === championship.seasonYear
    ? championship.liveSeason
    : initialLiveSeason(championship);
  if (live.completedRaces >= live.totalRaces) return { ...championship, liveSeason: live };

  const round = live.completedRaces + 1;
  const activeAbsences = activeAbsencesForRound(championship, round);
  const bundle = getCachedBundle(championship.seasonYear, championship.series);
  const points = getPointsSystem(bundle?.season.pointsSystemId ?? 'pts-modern').pointsByPosition;
  const driverTable = standingMap(live.driverStandings, [
    ...championship.drivers.map((driver) => driver.driverId),
    ...activeAbsences.map((absence) => absence.replacement.driverId),
  ]);
  const teamTable = standingMap(live.teamStandings, championship.teams.map((team) => team.teamId));
  const teamById = new Map(championship.teams.map((team) => [team.teamId, team]));
  const absenceByDriver = new Map(activeAbsences.map((absence) => [absence.driverId, absence]));
  const classified = championship.drivers.map((primaryDriver) => {
    const absence = absenceByDriver.get(primaryDriver.driverId);
    const driver: UniverseDriverContract = absence
      ? { ...absence.replacement, contractYearsRemaining: 1 }
      : primaryDriver;
    const team = teamById.get(driver.teamId);
    const ability = normalizedOverall(driver, championship.series, championship.seasonYear);
    const noise = hash01(`${seed}-${championship.seasonYear}-${championship.series}-${round}-${driver.driverId}-pace`);
    const dnf = hash01(`${seed}-${championship.seasonYear}-${championship.series}-${round}-${driver.driverId}-dnf`)
      < retirementRate(championship.series, championship.seasonYear);
    const crashDnf = dnf && hash01(`${seed}-${championship.seasonYear}-${championship.series}-${round}-${driver.driverId}-dnf-cause`)
      < 0.42;
    return { driver, primaryDriver, dnf, crashDnf, score: ability * 0.58 + (team?.reputation ?? 50) * 0.3 + noise * 24 };
  }).sort((a, b) => Number(a.dnf) - Number(b.dnf) || b.score - a.score);

  let finishingPosition = 0;
  const finishers: UniverseDriverContract[] = [];
  for (const result of classified) {
    const driverStanding = driverTable.get(result.driver.driverId)!;
    const teamStanding = teamTable.get(result.driver.teamId)!;
    if (result.dnf) {
      driverStanding.dnfs += 1;
      teamStanding.dnfs += 1;
      continue;
    }
    finishingPosition += 1;
    finishers.push(result.driver);
    const scored = points[finishingPosition] ?? 0;
    driverStanding.points += scored;
    teamStanding.points += scored;
    if (finishingPosition === 1) {
      driverStanding.wins += 1;
      teamStanding.wins += 1;
    }
    if (finishingPosition <= 3) {
      driverStanding.podiums += 1;
      teamStanding.podiums += 1;
    }
  }

  const scheduled = live.schedule[round - 1];
  const winner = finishers[0];
  const winnerTeam = winner ? teamById.get(winner.teamId) : undefined;
  const raceSummary: UniverseRaceSummary = {
    round,
    raceId: scheduled?.raceId ?? `${championship.series}-${championship.seasonYear}-${round}`,
    raceName: scheduled?.raceName ?? `${championship.series} Round ${round}`,
    trackName: scheduled?.trackName ?? 'Circuit TBA',
    winnerDriverId: winner?.driverId,
    winnerDriverName: winner?.name,
    winnerTeamId: winner?.teamId,
    winnerTeamName: winnerTeam?.name,
    podiumDriverIds: finishers.slice(0, 3).map((driver) => driver.driverId),
  };
  const newAbsence = classified
    .filter((result) => result.crashDnf && !absenceByDriver.has(result.primaryDriver.driverId))
    .map((result) => severeCrashAbsence(championship, result.primaryDriver, round, seed))
    .find((absence): absence is UniverseDriverAbsence => Boolean(absence));
  const driverAbsences = newAbsence ? [...activeAbsences, newAbsence] : activeAbsences;

  return {
    ...championship,
    driverAbsences,
    liveSeason: {
      ...live,
      completedRaces: round,
      driverStandings: sortedStandings(driverTable),
      teamStandings: sortedStandings(teamTable),
      raceResults: [...live.raceResults, raceSummary],
      driverNames: {
        ...(live.driverNames ?? Object.fromEntries(championship.drivers.map((driver) => [driver.driverId, driver.name]))),
        ...Object.fromEntries(driverAbsences.map((absence) => [absence.replacement.driverId, absence.replacement.name])),
      },
    },
  };
}

export function advanceOffscreenChampionshipsAfterPlayerRace(state: GameState): {
  universe?: MotorsportUniverseState;
  news: NewsItem[];
} {
  if (state.gameMode === 'SingleSeason' || !state.motorsportUniverse) {
    return { universe: state.motorsportUniverse, news: [] };
  }
  const championships: Partial<Record<Series, UniverseChampionshipState>> = {};
  const news: NewsItem[] = [];
  for (const [series, current] of Object.entries(state.motorsportUniverse.championships) as [Series, UniverseChampionshipState][]) {
    if (!current || series === state.series) {
      championships[series] = current;
      continue;
    }
    const next = simulateOffscreenChampionshipRound(current, state.randomSeed);
    championships[series] = next;
    const latest = next.liveSeason?.raceResults.at(-1);
    if (latest && next.liveSeason?.completedRaces !== current.liveSeason?.completedRaces) {
      news.push({
        id: `world-${state.seasonYear}-${series}-${latest.round}`,
        round: state.calendar[state.currentRaceIndex]?.round ?? state.currentRaceIndex + 1,
        headline: `${series}: ${latest.winnerDriverName ?? 'A new winner'} wins ${latest.raceName}`,
        body: `${latest.winnerTeamName ?? 'An independent entry'} took victory at ${latest.trackName}. ${series} has completed ${next.liveSeason?.completedRaces ?? 0} of ${next.liveSeason?.totalRaces ?? 0} rounds.`,
        timestamp: new Date(Date.UTC(state.seasonYear, 0, Math.max(1, state.currentRaceIndex + 1))).toISOString(),
        category: 'championship',
        priority: 'normal',
      });
      const priorAbsences = new Map((current.driverAbsences ?? []).map((absence) => [absence.driverId, absence]));
      const nextAbsences = new Map((next.driverAbsences ?? []).map((absence) => [absence.driverId, absence]));
      for (const absence of nextAbsences.values()) {
        if (priorAbsences.has(absence.driverId)) continue;
        news.push({
          id: `world-injury-${state.seasonYear}-${series}-${absence.driverId}-${absence.startRound}`,
          round: latest.round,
          headline: `${series}: ${absence.driverName} ruled out`,
          body: `${absence.driverName} will miss racing with a ${absence.injuryType.toLowerCase()}. ${absence.replacement.name} steps into the seat for ${next.teams.find((team) => team.teamId === absence.teamId)?.name ?? 'the team'}, with a return targeted for round ${absence.expectedReturnRound}.`,
          timestamp: new Date(Date.UTC(state.seasonYear, 0, Math.max(1, state.currentRaceIndex + 1))).toISOString(),
          category: 'paddock',
          priority: 'high',
        });
      }
      for (const absence of priorAbsences.values()) {
        if (nextAbsences.has(absence.driverId)) continue;
        news.push({
          id: `world-return-${state.seasonYear}-${series}-${absence.driverId}-${latest.round}`,
          round: latest.round,
          headline: `${series}: ${absence.driverName} cleared to return`,
          body: `${absence.driverName} has recovered from a ${absence.injuryType.toLowerCase()} and returns to the race seat. ${absence.replacement.name}'s temporary spell is complete.`,
          timestamp: new Date(Date.UTC(state.seasonYear, 0, Math.max(1, state.currentRaceIndex + 1))).toISOString(),
          category: 'paddock',
          priority: 'normal',
        });
      }
    }
  }
  return {
    universe: { ...state.motorsportUniverse, championships },
    news,
  };
}

// A lightweight annual simulation for championships the player is not driving.
// It produces real persisted standings without running every live-race subsystem.
export function simulateOffscreenChampionshipSeason(
  championship: UniverseChampionshipState,
  seed: string,
): UniverseChampionshipSeason {
  let completed = championship;
  const target = completed.liveSeason?.totalRaces ?? liveSeasonSchedule(completed).length;
  while ((completed.liveSeason?.completedRaces ?? 0) < target) {
    completed = simulateOffscreenChampionshipRound(completed, seed);
  }
  const live = completed.liveSeason ?? initialLiveSeason(completed);
  const driverStandings = live.driverStandings;
  const teamStandings = live.teamStandings;
  const driverChampionId = driverStandings[0]?.entityId;
  const teamChampionId = teamStandings[0]?.entityId;
  return {
    seasonYear: championship.seasonYear,
    series: championship.series,
    completedRaces: live.completedRaces,
    driverChampionId,
    driverChampionName: championship.drivers.find((driver) => driver.driverId === driverChampionId)?.name,
    teamChampionId,
    teamChampionName: championship.teams.find((team) => team.teamId === teamChampionId)?.name,
    driverNames: {
      ...Object.fromEntries(championship.drivers.map((driver) => [driver.driverId, driver.name])),
      ...(live.driverNames ?? {}),
    },
    teamNames: Object.fromEntries(championship.teams.map((team) => [team.teamId, team.name])),
    driverStandings,
    teamStandings,
    raceResults: live.raceResults,
  };
}

export function performanceRenewalProbability(
  contract: UniverseDriverContract,
  completedSeason: UniverseChampionshipSeason,
  team: UniverseTeamRoster | undefined,
): number {
  const index = completedSeason.driverStandings.findIndex((standing) => standing.entityId === contract.driverId);
  const fieldSize = Math.max(2, completedSeason.driverStandings.length);
  const performance = index < 0 ? 0.5 : 1 - index / (fieldSize - 1);
  return Math.min(0.92, 0.32 + performance * 0.48 + (team?.reputation ?? 50) / 1000);
}

function selectedSeasonSummary(state: GameState): UniverseChampionshipSeason | undefined {
  if (state.driverStandings.length === 0 || state.constructorStandings.length === 0) return undefined;
  const driverChampionId = state.driverStandings[0]?.entityId;
  const teamChampionId = state.constructorStandings[0]?.entityId;
  return {
    seasonYear: state.seasonYear,
    series: state.series,
    completedRaces: Object.keys(state.completedRaceResults).length,
    driverChampionId,
    driverChampionName: state.drivers.find((driver) => driver.id === driverChampionId)?.name,
    teamChampionId,
    teamChampionName: state.teams.find((team) => team.id === teamChampionId)?.name,
    driverNames: Object.fromEntries(state.drivers.map((driver) => [driver.id, driver.name])),
    teamNames: Object.fromEntries(state.teams.map((team) => [team.id, team.name])),
    driverStandings: state.driverStandings,
    teamStandings: state.constructorStandings,
  };
}

function advanceOffscreenChampionship(
  current: UniverseChampionshipState,
  nextYear: number,
  occupiedNames: Set<string>,
  seed: string,
): UniverseChampionshipState {
  const completedSeason = simulateOffscreenChampionshipSeason(current, seed);
  const drivers: UniverseDriverContract[] = [];
  const retainedByTeam = new Map<string, UniverseDriverContract[]>();
  const retainedNames = new Set<string>();
  const teamNames = new Map(current.teams.map((team) => [team.teamId, team.name]));
  const priorByCanonicalName = new Map(current.drivers.map((driver) => [canonicalNameOf(driver.name), driver]));
  const movementByDriverName = new Map<string, UniverseDriverMovement>();

  for (const contract of current.drivers) {
    const nameKey = canonicalNameOf(contract.name);
    const yearsLeft = contract.contractYearsRemaining - 1;
    const team = current.teams.find((candidate) => candidate.teamId === contract.teamId);
    const renew = yearsLeft <= 0
      && hash01(`${seed}-${nextYear}-renew-${contract.driverId}`) < performanceRenewalProbability(contract, completedSeason, team);
    if (yearsLeft <= 0 && !renew) {
      movementByDriverName.set(nameKey, {
        id: movementId(nextYear, current.series, 'release', contract.driverId, contract.teamId),
        effectiveYear: nextYear,
        series: current.series,
        kind: 'release',
        driverId: contract.driverId,
        driverName: contract.name,
        fromTeamId: contract.teamId,
        fromTeamName: teamNames.get(contract.teamId),
      });
      continue;
    }
    // Existing concurrent cross-series contracts are valid. Only block a
    // duplicate seat inside this same championship.
    if (retainedNames.has(nameKey)) continue;
    retainedNames.add(nameKey);
    const retained = {
      ...contract,
      contractYearsRemaining: renew
        ? 1 + Math.floor(hash01(`${seed}-${nextYear}-term-${contract.driverId}`) * 3)
        : yearsLeft,
    };
    if (renew) {
      movementByDriverName.set(nameKey, {
        id: movementId(nextYear, current.series, 'renewal', contract.driverId, contract.teamId),
        effectiveYear: nextYear,
        series: current.series,
        kind: 'renewal',
        driverId: contract.driverId,
        driverName: contract.name,
        fromTeamId: contract.teamId,
        fromTeamName: teamNames.get(contract.teamId),
        toTeamId: contract.teamId,
        toTeamName: teamNames.get(contract.teamId),
        contractYears: retained.contractYearsRemaining,
      });
    }
    occupiedNames.add(nameKey);
    drivers.push(retained);
    const teamDrivers = retainedByTeam.get(retained.teamId) ?? [];
    teamDrivers.push(retained);
    retainedByTeam.set(retained.teamId, teamDrivers);
  }

  const candidates = registryList(getMasterRegistry())
    .filter((entry) => eligibleCandidate(entry, nextYear, occupiedNames))
    .sort((a, b) => candidateScore(b, current.series, nextYear, seed) - candidateScore(a, current.series, nextYear, seed));

  const teamOrder = [...current.teams].sort((a, b) => {
    const aPosition = completedSeason.teamStandings.findIndex((standing) => standing.entityId === a.teamId);
    const bPosition = completedSeason.teamStandings.findIndex((standing) => standing.entityId === b.teamId);
    return aPosition - bPosition;
  });
  const updatedTeams = new Map<string, UniverseTeamRoster>();
  for (const team of teamOrder) {
    const teamDrivers = retainedByTeam.get(team.teamId) ?? [];
    while (teamDrivers.length < team.seatCount) {
      const candidateIndex = candidates.findIndex((entry) => eligibleCandidate(entry, nextYear, occupiedNames));
      if (candidateIndex < 0) break;
      const [entry] = candidates.splice(candidateIndex, 1);
      const contract: UniverseDriverContract = {
        driverId: `reg-${entry.driverId}`,
        registryDriverId: entry.driverId,
        name: entry.displayName,
        teamId: team.teamId,
        series: current.series,
        contractYearsRemaining: 1 + Math.floor(hash01(`${seed}-${nextYear}-sign-${entry.driverId}`) * 3),
      };
      const nameKey = entry.canonicalName;
      const prior = priorByCanonicalName.get(nameKey);
      const kind: UniverseDriverMovement['kind'] = prior && prior.teamId !== team.teamId ? 'transfer' : 'signing';
      movementByDriverName.set(nameKey, {
        id: movementId(nextYear, current.series, kind, contract.driverId, team.teamId),
        effectiveYear: nextYear,
        series: current.series,
        kind,
        driverId: contract.driverId,
        driverName: contract.name,
        fromTeamId: prior?.teamId,
        fromTeamName: prior ? teamNames.get(prior.teamId) : undefined,
        toTeamId: team.teamId,
        toTeamName: team.name,
        contractYears: contract.contractYearsRemaining,
      });
      occupiedNames.add(entry.canonicalName);
      teamDrivers.push(contract);
      drivers.push(contract);
    }
    updatedTeams.set(team.teamId, { ...team, driverIds: teamDrivers.map((driver) => driver.driverId) });
  }
  const teams = current.teams.map((team) => updatedTeams.get(team.teamId) ?? team);

  return {
    ...current,
    seasonYear: nextYear,
    teams,
    drivers,
    seasonHistory: [...(current.seasonHistory ?? []), completedSeason].slice(-50),
    movementHistory: [...(current.movementHistory ?? []), ...movementByDriverName.values()].slice(-200),
  };
}

export function advanceMotorsportUniverse(
  state: GameState,
  nextYear: number,
  selectedTeams: readonly Team[],
  selectedDrivers: readonly Driver[],
): MotorsportUniverseState | undefined {
  const seededState = ensureMotorsportUniverse(state);
  const current = seededState.motorsportUniverse;
  const selectedBundle = getCachedBundle(nextYear, state.series) ?? getCachedBundle(state.seasonYear, state.series);
  if (!current || !selectedBundle) return current;

  const championships: Partial<Record<Series, UniverseChampionshipState>> = {};
  const selectedOccupiedNames = new Set<string>();
  const selectedChampionship = championshipFromRoster(
    nextYear,
    state.series,
    selectedTeams,
    selectedDrivers,
    selectedOccupiedNames,
    state.randomSeed,
  );
  const completedSelectedSeason = selectedSeasonSummary(state);
  const priorSelectedHistory = current.championships[state.series]?.seasonHistory ?? [];
  selectedChampionship.seasonHistory = completedSelectedSeason
    ? [...priorSelectedHistory, completedSelectedSeason].slice(-50)
    : priorSelectedHistory;
  const priorSelected = current.championships[state.series];
  selectedChampionship.movementHistory = [
    ...(priorSelected?.movementHistory ?? []),
    ...compareRosters(priorSelected, selectedChampionship, nextYear),
  ].slice(-200);
  championships[state.series] = selectedChampionship;

  const catalogSeries = activeSeriesForYear(nextYear);
  // After the final historical season, keep the existing championships alive
  // as alternate history instead of making the surrounding world disappear.
  const activeSeries = new Set<Series>(
    catalogSeries.length > 0
      ? catalogSeries
      : Object.keys(current.championships) as Series[],
  );
  for (const series of SERIES_ORDER) {
    if (series === state.series || !activeSeries.has(series)) continue;
    const prior = current.championships[series];
    if (prior) {
      // Reserve every seat outside the championship currently being advanced.
      // Already-advanced grids use their new roster; not-yet-advanced grids use
      // their current roster. That prevents a new cross-series double-signing
      // while still preserving documented concurrent contracts already in place.
      const occupiedNames = new Set<string>();
      for (const [otherSeries, championship] of Object.entries(current.championships)) {
        if (otherSeries === series || championships[otherSeries as Series]) continue;
        for (const driver of championship?.drivers ?? []) occupiedNames.add(canonicalNameOf(driver.name));
      }
      for (const [otherSeries, championship] of Object.entries(championships)) {
        if (otherSeries === series) continue;
        for (const driver of championship?.drivers ?? []) occupiedNames.add(canonicalNameOf(driver.name));
      }
      championships[series] = advanceOffscreenChampionship(prior, nextYear, occupiedNames, state.randomSeed);
      continue;
    }
    const bundle = getCachedBundle(nextYear, series);
    if (bundle) {
      championships[series] = championshipFromRoster(
        nextYear,
        series,
        bundle.teams,
        bundle.drivers,
        new Set<string>(),
        state.randomSeed,
      );
    }
  }

  return { version: 1, seasonYear: nextYear, championships };
}
