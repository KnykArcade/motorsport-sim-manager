import { availableSeasons } from '../data/seasonCatalog';
import { getCachedBundle } from '../data/seasonLoader';
import { canonicalNameOf, getMasterRegistry, registryList } from '../data/registry/masterRegistry';
import type { SeasonBundle } from '../data/seasonCatalog';
import type { Driver, Series, Team } from '../types/gameTypes';
import type { MasterDriverEntry } from '../types/registryTypes';
import type {
  MotorsportUniverseState,
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

  return { series, seasonYear: year, teams: teamRosters, drivers: contracts };
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

function advanceOffscreenChampionship(
  current: UniverseChampionshipState,
  nextYear: number,
  occupiedNames: Set<string>,
  seed: string,
): UniverseChampionshipState {
  const drivers: UniverseDriverContract[] = [];
  const retainedByTeam = new Map<string, UniverseDriverContract[]>();
  const retainedNames = new Set<string>();

  for (const contract of current.drivers) {
    const nameKey = canonicalNameOf(contract.name);
    const yearsLeft = contract.contractYearsRemaining - 1;
    const renew = yearsLeft <= 0 && hash01(`${seed}-${nextYear}-renew-${contract.driverId}`) < 0.58;
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

  const teams = current.teams.map((team) => {
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
    return { ...team, driverIds: teamDrivers.map((driver) => driver.driverId) };
  });

  return { ...current, seasonYear: nextYear, teams, drivers };
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
  championships[state.series] = championshipFromRoster(
    nextYear,
    state.series,
    selectedTeams,
    selectedDrivers,
    occupiedNames,
    state.randomSeed,
  );

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
