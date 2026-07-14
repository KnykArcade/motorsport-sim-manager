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
  UniverseTeamRoster,
} from '../types/universeTypes';
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

  return { series, seasonYear: year, teams: teamRosters, drivers: contracts, seasonHistory: [] };
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

function fallbackRaceCount(series: Series): number {
  if (series === 'NASCAR') return 36;
  if (series === 'F1') return 22;
  return 17;
}

// A lightweight annual simulation for championships the player is not driving.
// It produces real persisted standings without running every live-race subsystem.
export function simulateOffscreenChampionshipSeason(
  championship: UniverseChampionshipState,
  seed: string,
): UniverseChampionshipSeason {
  const bundle = getCachedBundle(championship.seasonYear, championship.series);
  const completedRaces = bundle?.season.calendar.length ?? fallbackRaceCount(championship.series);
  const points = getPointsSystem(bundle?.season.pointsSystemId ?? 'pts-modern').pointsByPosition;
  const driverTable = new Map(championship.drivers.map((driver) => [driver.driverId, emptyStanding(driver.driverId)]));
  const teamTable = new Map(championship.teams.map((team) => [team.teamId, emptyStanding(team.teamId)]));
  const teamById = new Map(championship.teams.map((team) => [team.teamId, team]));

  for (let round = 1; round <= completedRaces; round += 1) {
    const classified = championship.drivers.map((driver) => {
      const team = teamById.get(driver.teamId);
      const ability = normalizedOverall(driver, championship.series, championship.seasonYear);
      const teamStrength = team?.reputation ?? 50;
      const noise = hash01(`${seed}-${championship.seasonYear}-${championship.series}-${round}-${driver.driverId}-pace`);
      const dnf = hash01(`${seed}-${championship.seasonYear}-${championship.series}-${round}-${driver.driverId}-dnf`)
        < retirementRate(championship.series, championship.seasonYear);
      return { driver, dnf, score: ability * 0.58 + teamStrength * 0.3 + noise * 24 };
    }).sort((a, b) => Number(a.dnf) - Number(b.dnf) || b.score - a.score);

    let finishingPosition = 0;
    for (const result of classified) {
      const driverStanding = driverTable.get(result.driver.driverId)!;
      const teamStanding = teamTable.get(result.driver.teamId)!;
      if (result.dnf) {
        driverStanding.dnfs += 1;
        teamStanding.dnfs += 1;
        continue;
      }
      finishingPosition += 1;
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
  }

  const driverStandings = sortedStandings(driverTable);
  const teamStandings = sortedStandings(teamTable);
  const driverChampionId = driverStandings[0]?.entityId;
  const teamChampionId = teamStandings[0]?.entityId;
  return {
    seasonYear: championship.seasonYear,
    series: championship.series,
    completedRaces,
    driverChampionId,
    driverChampionName: championship.drivers.find((driver) => driver.driverId === driverChampionId)?.name,
    teamChampionId,
    teamChampionName: championship.teams.find((team) => team.teamId === teamChampionId)?.name,
    driverNames: Object.fromEntries(championship.drivers.map((driver) => [driver.driverId, driver.name])),
    teamNames: Object.fromEntries(championship.teams.map((team) => [team.teamId, team.name])),
    driverStandings,
    teamStandings,
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

  for (const contract of current.drivers) {
    const nameKey = canonicalNameOf(contract.name);
    const yearsLeft = contract.contractYearsRemaining - 1;
    const team = current.teams.find((candidate) => candidate.teamId === contract.teamId);
    const renew = yearsLeft <= 0
      && hash01(`${seed}-${nextYear}-renew-${contract.driverId}`) < performanceRenewalProbability(contract, completedSeason, team);
    if (yearsLeft <= 0 && !renew) continue;
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

  const occupiedNames = new Set<string>();
  const championships: Partial<Record<Series, UniverseChampionshipState>> = {};
  const selectedChampionship = championshipFromRoster(
    nextYear,
    state.series,
    selectedTeams,
    selectedDrivers,
    occupiedNames,
    state.randomSeed,
  );
  const completedSelectedSeason = selectedSeasonSummary(state);
  const priorSelectedHistory = current.championships[state.series]?.seasonHistory ?? [];
  selectedChampionship.seasonHistory = completedSelectedSeason
    ? [...priorSelectedHistory, completedSelectedSeason].slice(-50)
    : priorSelectedHistory;
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
      championships[series] = advanceOffscreenChampionship(prior, nextYear, occupiedNames, state.randomSeed);
      continue;
    }
    const bundle = getCachedBundle(nextYear, series);
    if (bundle) championships[series] = championshipFromRoster(nextYear, series, bundle.teams, bundle.drivers, occupiedNames, state.randomSeed);
  }

  return { version: 1, seasonYear: nextYear, championships };
}
